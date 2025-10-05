use anyhow::{Error, Result};
use axum::extract::{Query, State};
use axum::http::{Method, StatusCode};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::Executor;
use sqlx::Row;
use sqlx::{SqlitePool, sqlite::Sqlite, sqlite::SqliteConnectOptions};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;

mod config;
mod websocket;

use config::PORT;

const DB: &str = "search_index/text.db";

#[derive(Clone)]
struct Context {
    connection: Arc<SqlitePool>,
}

#[tokio::main]
async fn main() {
    let options = SqliteConnectOptions::new().filename(DB);
    let db = SqlitePool::connect_with(options)
        .await
        .expect("db connection");

    let context = Context {
        connection: Arc::new(db),
    };

    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_origin(Any);

    let app = Router::new()
        .route("/api/find", get(handle_find))
        .fallback_service(ServeDir::new("static"))
        .with_state(context)
        .layer(cors);

    let _handle = tokio::spawn(websocket::socket_server());

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", PORT))
        .await
        .expect("tcp listener");
    println!("listening on 5050");
    axum::serve(listener, app).await.expect("server")
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct SearchQueryParam {
    pub phrase: String,
}

async fn handle_find(
    State(context): State<Context>,
    Query(params): Query<SearchQueryParam>,
) -> Result<Json<Vec<Document>>, StatusCode> {
    find(params.phrase, &*context.connection)
        .await
        .map_err(|err| {
            eprintln!("something went wrong {:#?}", err);
            StatusCode::INTERNAL_SERVER_ERROR
        })
        .map(Json)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Document {
    pub id: String,
    pub metadata: Value,
}

async fn find<'e, D>(phrase: String, db: D) -> Result<Vec<Document>>
where
    D: Executor<'e, Database = Sqlite>,
{
    let rows = sqlx::query(
        r#"SELECT m.id, m.metadata
        FROM text_index i
        JOIN metadata m ON i.id = m.id
        WHERE i.body MATCH $1
        ORDER BY i.rank"#,
    )
    .bind(phrase)
    .fetch_all(db)
    .await
    .map_err(Error::from)?;
    let v = rows
        .into_iter()
        .map(|row| Document {
            id: row.get("id"),
            metadata: serde_json::from_str(row.get("metadata")).expect("metadata json"),
        })
        .collect::<Vec<Document>>();
    Ok(v)
}

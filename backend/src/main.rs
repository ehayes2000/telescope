use anyhow::{Error, Result};
use axum::extract::{Query, State};
use axum::http::{Method, StatusCode};
use axum::routing::get;
use axum::serve::Listener;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use sqlx::Connection;
use sqlx::Executor;
use sqlx::Row;
use sqlx::{SqliteConnection, SqlitePool, sqlite::Sqlite, sqlite::SqliteConnectOptions};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

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
        .route("/find", get(handle_find))
        .with_state(context)
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:5050")
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
) -> Result<Json<Vec<String>>, StatusCode> {
    find(params.phrase, &*context.connection)
        .await
        .map_err(|err| {
            eprintln!("something went wrong {:#?}", err);
            StatusCode::INTERNAL_SERVER_ERROR
        })
        .map(Json)
}

async fn find<'e, D>(phrase: String, db: D) -> Result<Vec<String>>
where
    D: Executor<'e, Database = Sqlite>,
{
    let rows = sqlx::query(
        r#"SELECT id FROM text_index
        WHERE body MATCH $1
        ORDER BY rank
        "#,
    )
    .bind(phrase)
    .fetch_all(db)
    .await
    .map_err(Error::from)?;
    let v = rows
        .into_iter()
        .map(|row| row.get("id"))
        .collect::<Vec<String>>();
    Ok(v)
}

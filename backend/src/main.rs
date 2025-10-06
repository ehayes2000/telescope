use anyhow::{Error, Result};
use aws_config::BehaviorVersion;
use aws_sdk_s3::operation::get_object::GetObjectError;
use aws_sdk_s3::types::Error as SdkError;
use aws_sdk_s3::{
    Client, config::Config, config::Credentials, config::Region, config::endpoint::Endpoint,
};
use axum::extract::{Path, Query, State};
use axum::http::{Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::Executor;
use sqlx::Row;
use sqlx::{SqlitePool, sqlite::Sqlite, sqlite::SqliteConnectOptions};
use std::sync::Arc;
use tokio::io::AsyncReadExt;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use url::Url;

mod config;
mod websocket;

use config::BucketConfig;
use config::PORT;

const DB: &str = "search_index/text.db";

#[derive(Clone)]
struct Context {
    connection: Arc<SqlitePool>,
    s3_client: Client,
    bucket_name: String,
}

#[tokio::main]
async fn main() {
    let bucket_conf = BucketConfig::from_env();

    let config = aws_sdk_s3::Config::builder()
        .region(Region::new("auto")) // R2 ignores region, but still required
        .endpoint_url(&bucket_conf.s3_endpoint)
        .credentials_provider(Credentials::new(
            bucket_conf.access_key_id,
            bucket_conf.secret_access_key,
            None,
            None,
            "loaded-from-custom",
        ))
        .behavior_version(BehaviorVersion::latest())
        .build();

    let options = SqliteConnectOptions::new().filename(DB);
    let db = SqlitePool::connect_with(options)
        .await
        .expect("db connection");

    let context = Context {
        s3_client: Client::from_conf(config),
        connection: Arc::new(db),
        bucket_name: bucket_conf.bucket_name.clone(),
    };

    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_origin(Any);

    let app = Router::new()
        .route("/api/find", get(handle_find))
        .route("/api/document", get(handle_get_document))
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct DocumentQueryParam {
    pub id: String,
}

async fn handle_get_document(
    State(context): State<Context>,
    Query(params): Query<DocumentQueryParam>,
) -> Result<Response, StatusCode> {
    get_document(params.id, &context)
        .await
        .map_err(|err| {
            eprintln!("something went wrong {:#?}", err);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

async fn get_document(id: String, context: &Context) -> Result<Response> {
    let object = context
        .s3_client
        .get_object()
        .bucket(&context.bucket_name)
        .key(&id)
        .send()
        .await
        .map_err(Error::from)?;

    let mut body = Vec::new();
    object
        .body
        .into_async_read()
        .read_to_end(&mut body)
        .await
        .map_err(Error::from)?;

    Ok((StatusCode::OK, body).into_response())
}

use anyhow::{Error, Result};
use sqlx::Connection;
use sqlx::Row;
use sqlx::{SqliteConnection, sqlite::SqliteConnectOptions};

const DB: &str = "search_index/text.db";

#[tokio::main]
async fn main() {
    let options = SqliteConnectOptions::new().filename(DB);
    let mut db = SqliteConnection::connect_with(&options)
        .await
        .expect("db connection");
    let mut args = std::env::args();
    let search_phrase = args.nth(1).expect("search phrase");
    let studies = find(search_phrase, &mut db).await.expect("find result");
    println!("{:#?}", studies);
}

async fn find(phrase: String, db: &mut SqliteConnection) -> Result<Vec<String>> {
    let rows = sqlx::query("SELECT id FROM text_index WHERE body MATCH $1")
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

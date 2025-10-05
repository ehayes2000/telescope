use crate::config::WS_PORT;
use axum::http::HeaderMap;
use futures::{SinkExt, StreamExt};
use reqwest_eventsource::Event;
use reqwest_eventsource::RequestBuilderExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use tokio::net::TcpStream;
use tokio::select;
use tokio::sync::mpsc::{UnboundedSender, unbounded_channel};
use tokio_tungstenite::{WebSocketStream, accept_async, tungstenite::Message};

pub async fn socket_server() {
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", WS_PORT))
        .await
        .expect("failed to bind websocket listener");
    println!("socket server listening on {}", WS_PORT);

    loop {
        let Ok((stream, _)) = listener.accept().await else {
            eprintln!("connection failed");
            continue;
        };

        let Ok(ws) = accept_async(stream).await else {
            eprintln!("websocket connection failed");
            continue;
        };

        tokio::spawn(handle_connection(ws));
    }
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "lowercase", tag = "type")]
pub enum IncomingMessage {
    Proxy(ProxyRequest),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProxyRequest {
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Value,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "lowercase", tag = "type")]
pub enum OutgoingMessage {
    Proxy(ProxyResponse),
    Err { reason: String },
}

fn err<T: Into<String>>(s: T) -> OutgoingMessage {
    OutgoingMessage::Err { reason: s.into() }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProxyResponse {
    data: Value,
}

async fn handle_connection(mut ws: WebSocketStream<TcpStream>) {
    let (tx, mut rx) = unbounded_channel::<OutgoingMessage>();

    loop {
        // yea this is balls
        select! {
            inbound = ws.next()=> match inbound {
                Some(Ok(message)) =>{
                    let Ok(text) = message.to_text() else {
                        let err_message = OutgoingMessage::Err{reason:"Could not decode message as utf8".into()};
                        let err_message = serde_json::to_string(&err_message).expect("serialize outgoing error");
                        if ws.send(Message::text(err_message)).await.is_err() {
                            eprintln!("failed ot send outgoing error");
                            return;
                        }
                        continue;
                    };
                    let Ok(message) = serde_json::from_str::<IncomingMessage>(text) else {
                        let err_message = OutgoingMessage::Err{reason: "Uknown message type".into()};
                        let err_message = serde_json::to_string(&err_message).expect("serialize outgoing error");
                        if ws.send(Message::text(err_message)).await.is_err() {
                             eprintln!("failed ot send outgoing error");
                             return;
                        }
                        return;
                    };
                    handle_message(tx.clone(), message).await
                }
                Some(Err(err)) => {
                    eprintln!("bad message {:?}", err);
                    continue;
                }
                None => {
                    println!("connection closed");
                    return;
                }
            },
            outbound = rx.recv() => {
                let serialized = serde_json::to_string(&outbound).expect("serialize outbound");
                if ws.send(Message::text(serialized)).await.is_err() {
                    eprintln!("failed to send outgoing message");
                    return;
                }
            }
        }
    }
}

async fn handle_message(sender: UnboundedSender<OutgoingMessage>, message: IncomingMessage) {
    match message {
        IncomingMessage::Proxy(proxy) => handle_proxy(sender, proxy).await,
    }
}

const ALLOWED_HOSTS: [&str; 1] = ["https://api.openai.com/v1/completions"];

async fn handle_proxy(tx: UnboundedSender<OutgoingMessage>, request: ProxyRequest) {
    if ALLOWED_HOSTS.contains(&request.url.as_str()) {
        let _ = tx.send(err("unknown host"));
        return;
    }

    let map = request
        .headers
        .clone()
        .into_iter()
        .collect::<HashMap<_, _>>();
    let Ok(headers): Result<HeaderMap, axum::http::Error> = HeaderMap::try_from(&map) else {
        let _ = tx.send(err("unknown headers"));
        return;
    };

    let mut event_source = reqwest::Client::new()
        .post(&request.url)
        .headers(headers)
        .json(&request.body)
        .eventsource()
        .expect("event source");

    while let Some(ev) = event_source.next().await {
        match ev {
            Err(e) => {
                if let Err(_) = tx.send(err("bad response")) {
                    eprintln!("{:?}", e);
                    return;
                }
            }
            Ok(event) => match event {
                Event::Message(message) => {
                    if message.data == "[DONE]" {
                        break;
                    }

                    match serde_json::from_str::<Value>(&message.data) {
                        Ok(okgoodyes) => {
                            if tx
                                .send(OutgoingMessage::Proxy(ProxyResponse { data: okgoodyes }))
                                .is_err()
                            {
                                return;
                            }
                        }
                        Err(_) => {
                            if tx.send(err("unexpected response")).is_err() {
                                return;
                            }
                        }
                    }
                }
                Event::Open => continue,
            },
        }
    }
}

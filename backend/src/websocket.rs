use crate::config::WS_PORT;
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use serde_json::json;
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
    pub host: String,
    pub headers: Vec<(String, String)>,
    pub body: Value,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "lowercase", tag = "type")]
pub enum OutgoingMessage {
    Proxy(ProxyResponse),
    Err { reason: String },
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
    println!("HANDLE MESSAGE {:?}", message);
    let json = json! ({"hehe": "xd"});
    let c = sender.send(OutgoingMessage::Proxy(ProxyResponse { data: json }));
}

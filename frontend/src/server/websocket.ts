const WS_URL =
  import.meta.env.MODE === "development" ? "ws://localhost:5055" : "todo";

// const WS_URL = "wss://demo.piesocket.com/v3/channel_123?api_key=VCXCEuvhGcBDP7XhiJJUDvR1e1D3eiVjgZ9VRiaV&notify_self"

const ws = new WebSocket(WS_URL)
ws.addEventListener("error", (e) => console.error("error", e))
ws.addEventListener("close", (e) => console.error("close", e))
ws.addEventListener("open", (e) => {
  ws.send(JSON.stringify({ type: "proxy",
    host: "balls",
    headers: [],
    body: {
      fart: true
    }
  }));
})
ws.addEventListener("message", (e) => console.error("message", e))

// const WS_URL =
// 	import.meta.env.MODE === "development" ? "ws://localhost:5055" : "todo";

// const ws = new WebSocket(WS_URL);
// ws.addEventListener("error", (e) => console.error("error", e));
// ws.addEventListener("close", (e) => console.error("close", e));
// ws.addEventListener("open", (e) => {
// 	ws.send(
// 		JSON.stringify({
// 			type: "proxy",
// 			host: "balls",
// 			headers: [],
// 			body: {
// 				fart: true,
// 			},
// 		}),
// 	);
// });
// ws.addEventListener("message", (e) => console.error("message", e));

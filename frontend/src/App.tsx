import { Router, Route, A } from "@solidjs/router";
import { SearchPage } from "./Search";
import { Chat } from "./Chat";

function Layout(props: any) {
	return (
		<div class="min-h-screen min-w-screen max-w-screen bg-black relative">
			<nav class="flex gap-4 p-2 absolute text-sm">
				<A href="/search" class="!text-green-400 hover:!text-green-400/20" activeClass="underline">
					Search
				</A>
				<A href="/chat" class="!text-green-400 hover:!text-green-400/20" activeClass="underline">
					Chat
				</A>
			</nav>
			{props.children}
		</div>
	);
}

function App() {
	return (
		<Router root={Layout}>
			<Route path="/search" component={SearchPage} />
			<Route path="/chat" component={Chat} />
			<Route path="/" component={Chat} />
		</Router>
	);
}

export default App;

import { createSignal, For, Show } from "solid-js";
import {
	type Author,
	type Document,
	type SearchArgs,
	type SearchResult,
	search,
} from "./server";
import { apiKey, sendMessage, keyErr, setApiKey } from "./server/chat";
import { useDebounce } from "./util";

const [searchResults, setSearchResults] = createSignal<SearchResult>();

const setSearch = async (args: SearchArgs) => {
	if (args.phrase.length === 0) return;
	const r = await search(args);
	setSearchResults(r);
};

const debouncedSearch = useDebounce(setSearch, 300);

function App() {
	return (
		<div class="min-h-screen max-w-screen bg-black flex items-center flex-col overflow-x-clip p-2">
			{/*<Search />
			<Results />*/}
			<Chat />
		</div>
	);
}

function Search() {
	return (
		<div>
			<input
				type="text"
				placeholder="Search"
				class="border border-green-400 px-2 py-1 focus:outline-none w-[400px]"
				onKeyUp={(e) => debouncedSearch({ phrase: e.currentTarget.value })}
			/>
		</div>
	);
}

function Results() {
	const results = () => {
		const r = searchResults();
		if (!r) return;
		if (r.type === "ok") {
			return r;
		}
		return;
	};
	return (
		<div class="flex flex-col gap-2 p-2 overflow-clip">
			<Show when={results()}>
				{(results) => (
					<For each={results().data}>
						{(data) => <FoundDoc document={data} />}
					</For>
				)}
			</Show>
		</div>
	);
}

function FoundDoc(props: { document: Document }) {
	const formatDate = (s: string): string => {
		const date = new Date(s);
		const day = date.getDate();
		const formatted = new Intl.DateTimeFormat("en-US", {
			month: "long",
			year: "numeric",
		})
			.format(date)
			.replace(/(\w+) (\d+)/, `$1 ${day}, $2`);

		return formatted;
	};

	const Author = (p: { name: Author }) => (
		<span class="px-1 py-0.5 bg-gray-900 flex-0">{p.name.surname}</span>
	);
	return (
		<div
			class="border border-green-400 py-1 px-2 max-w-[400px] flex flex-col gap-1 hover:bg-green-400/20"
			onClick={() => window.open(`https://pmc.ncbi.nlm.nih.gov/articles/${props.document.id}/`)}
		>
			<h1 class="text-lg text-wrap px-1">{props.document.metadata.title}</h1>
			<h2 class="text-sm font-mono px-1">
				{formatDate(props.document.metadata.publishedDate)}
			</h2>

			<div class="flex items-end w-full justify-between">
				<div class="text-sm flex gap-1 flex-wrap">
					{/*{props.document.metadata.authors.map(name => <span class="bg-gray">{name.surname}</span>)}*/}
					<For each={props.document.metadata.authors}>
						{(author) => <Author name={author} />}
					</For>
				</div>
				<footer class="text-right font-mono text-xs italic py-0.5 px-1">
					{props.document.id}
				</footer>
			</div>
		</div>
	);
}

function Chat() {
	return <ApiKey />;

}

function ChatInput() {

}

function ApiKey() {
	const secretKey = () => {
		const v = apiKey();
		if (!v) return "";
		return Array.from(v)
			.map((_) => "*")
			.join("");
	};

	return (
		<div>
			<div class="!text-green-400 text-xs font-mono"> API KEY</div>
			<input
				class="px-2 py-1 focus:outline-none border border-green-400 w-[400px] h-[40px] text-sm italic font-mono"
				value={secretKey()}
				placeholder="OPEN_AI_API_KEY"
				type="text"
				onInput={(e) => setApiKey(e.currentTarget.value)}
			/>
		</div>
	);
}

export default App;

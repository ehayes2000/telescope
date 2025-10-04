import { createSignal, For, Show } from "solid-js";
import { err, ok, type Result } from "./types";
import { useDebounce } from "./util";

const BASE_URL =
	import.meta.env.MODE === "development" ? "http://localhost:5050" : "todo";

type DocumentId = string;
type SearchResult = Result<DocumentId[], string>;
type SearchArgs = { phrase: string };

const [searchResults, setSearchResults] = createSignal<SearchResult>();

async function search(args: SearchArgs): Promise<SearchResult> {
	try {
		const response = await fetch(`${BASE_URL}/find?phrase=${args.phrase}`);
		if (!response.ok) return err(response.statusText);
		const docs: DocumentId[] = await response.json();
		return ok(docs);
	} catch (e) {
		return err(JSON.stringify(e));
	}
}

const setSearch = async (args: SearchArgs) => {
	if (args.phrase.length === 0) return;
	const r = await search(args);
	setSearchResults(r);
};

const debouncedSearch = useDebounce(setSearch, 300);

function App() {
	return (
		<div class="w-screen h-screen bg-black">
			<Search />
			<Results />
		</div>
	);
}

function Search() {
	return (
		<div>
			<input
				type="text"
				class="border border-green-400 px-2 py-1 focus:outline-none"
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
		<div>
			<Show when={results()}>
				{(results) => (
					<div>
						<For each={results().data}>{(data) => <div> {data} </div>}</For>
					</div>
				)}
			</Show>
		</div>
	);
}

export default App;

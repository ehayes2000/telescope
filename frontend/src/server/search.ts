import { err, ok, type Result } from "../types";

const BASE_URL =
	import.meta.env.MODE === "development" ? "http://localhost:5050" : "todo";

export interface Author {
	surname: string;
	givenNames: string;
}

export interface Metadata {
	title: string;
	authors: Author[];
	publishedDate: string;
}

export type Document = {
	id: string;
	metadata: Metadata;
};

export type SearchResult = Result<Document[], string>;
export type SearchArgs = { phrase: string };

export async function search(args: SearchArgs): Promise<SearchResult> {
	try {
		const response = await fetch(`${BASE_URL}/find?phrase=${args.phrase}`);
		if (!response.ok) return err(response.statusText);
		const docs: Document[] = await response.json();
		return ok(docs);
	} catch (e) {
		return err(JSON.stringify(e));
	}
}

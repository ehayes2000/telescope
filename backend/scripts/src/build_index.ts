import { Database } from "bun:sqlite";
import { mkdir, readdir, readFile, rmdir } from "node:fs/promises";
import { $ } from "bun";
import { buildMetadata } from "./build_metadata";

console.log("Building index");

try {
	await rmdir("../search_index", { recursive: true });
} finally {
	await mkdir("../search_index/raw", { recursive: true });
}

console.log("copying raw files");
await $`cp -r out/ ../search_index/raw/`;
await $`rm -rf ../search_index/raw/raw`;
await buildMetadata();
console.log("done");

const db = new Database("../search_index/text.db");

db.run("CREATE VIRTUAL TABLE text_index USING fts5(body, id)");
db.run("CREATE TABLE metadata (id TEXT PRIMARY KEY, metadata TEXT)");

// Index .nxml files
const rawDir = "../search_index/raw";

const files: [string, string][] = (await readdir(rawDir, { recursive: true }))
	.filter((file) => file.endsWith(".nxml"))
	.map((file) => [`${rawDir}/${file}`, file.split("/").at(-2)!]);

const insert = db.prepare("INSERT INTO text_index (body, id) VALUES (?, ?)");
const insertMetadata = db.prepare(
	"INSERT INTO metadata (id, metadata) VALUES (?, ?)",
);

console.log("Building search index");
let indexed = 0;
for (const [file, id] of files) {
	console.log(`Indexing ${++indexed}`);
	const content = await readFile(file, "utf-8");
	insert.run(content, id);

	const metadataPath = `${rawDir}/${id}/metadata.json`;
	try {
		const metadataContent = await readFile(metadataPath, "utf-8");
		insertMetadata.run(id, metadataContent);
	} catch (err) {
		console.warn(`No metadata found for ${id}`);
	}
}

import { Database } from "bun:sqlite";
import { mkdir, readdir, readFile, rmdir } from "node:fs/promises";
import { $, sleep } from "bun";

console.log("Building index");

try {
	await rmdir("../search_index", { recursive: true });
} finally {
	await mkdir("../search_index/raw", { recursive: true });
	sleep(1000);
}

console.log("copying raw files");
await $`cp -r out/ ../search_index/raw/`;
await $`rm -rf ../search_index/raw/raw`;

console.log("done");
const db = new Database("../search_index/text.db");

db.run("CREATE VIRTUAL TABLE text_index USING fts5(body, id)");

// Index .nxml files
const rawDir = "../search_index/raw";

const files: [string, string][] = (await readdir(rawDir, { recursive: true }))
	.filter((file) => file.endsWith(".nxml"))
	.map((file) => [`${rawDir}/${file}`, file.split("/").at(-2)!]);

console.log(files);

const insert = db.prepare("INSERT INTO text_index (body, id) VALUES (?, ?)");

console.log("Building index");
let indexed = 0;
for (const [file, id] of files) {
	console.log(`Indexing ${indexed}`);
	const content = await readFile(file, "utf-8");
	insert.run(content, id);
	indexed++;
}

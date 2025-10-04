import { mkdir, rmdir } from "node:fs/promises";

try {
	await rmdir("out", { recursive: true });
} catch {}
await mkdir("out");
await mkdir("out/tar");

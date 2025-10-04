import { $ } from "bun";

/// docs at - https://pmc.ncbi.nlm.nih.gov/tools/oa-service/
const OUTPUT_DIR = "out";
const NIH_API_BASE = "https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi";

const regex = /<link\s+[^>]*href="([^"]+)"[^>]*\/>/;

type Result = { type: "err"; reason: string } | { type: "ok" };

const err = (reason: string): Result => ({ type: "err", reason });
const ok = (): Result => ({
	type: "ok",
});

function tarFile(href: string): string {
	return href.split("/").at(-1) ?? href;
}

async function fetchium(id: string): Promise<Result> {
	const endpoint = `${NIH_API_BASE}?id=${id}&format=tgz`;
	const xmlResponse = await fetch(endpoint);
	if (!xmlResponse.ok) return err("API error fetching ID");
	const xml = await xmlResponse.text();
	if (xml.length === 0) return err("No Xml Content");
	const match = xml.match(regex);
	const href = match ? match[1] : null;
	if (!href) return err("No Href Found");
	const fName = tarFile(href);
	await $`curl ${href} --output ${OUTPUT_DIR}/tar/${fName}`;
	await $`tar -xzf ${OUTPUT_DIR}/tar/${fName} -C ${OUTPUT_DIR}/`;
	return ok();
}

function urlId(url: string): string {
	return url.split("/").at(-2)!;
}

async function downloadAll() {
	const f = await Bun.file("SB_publication_PMC.csv");
	const csv = await f.text();
	const lines = csv.split("\n").slice(1);
	let good = 0;
	for (const line in lines) {
		console.log(`Downloading ${line}/${lines.length}\n${lines[line]}`);
		const [, url] = lines[line]!.split(",");
		if (!url) {
			console.log("No Url -- Skipping");
			continue;
		}
		const id = urlId(url);
		try {
			const r = await fetchium(id);
			if (r.type === "ok") {
				console.log("ok");
				good++;
			} else {
				console.log("err", r.reason);
			}
		} catch (e) {
			console.log("err - fail", JSON.stringify(e));
		}
	}
	console.log(`downloaded ${good}/${lines.length}`);
}

downloadAll();

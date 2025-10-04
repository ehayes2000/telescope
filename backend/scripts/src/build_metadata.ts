import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

interface Author {
	surname: string;
	givenNames: string;
}

interface PaperMetadata {
	title: string;
	authors: Author[];
	publishedDate: string;
}

/**
 * Extracts text content from an XML node
 */
function getTextContent(xmlString: string, tagName: string): string | null {
	const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
	const match = xmlString.match(regex);
	return match ? match[1].replace(/<[^>]+>/g, "").trim() : null;
}

/**
 * Extracts all matches of a pattern from XML
 */
function getAllMatches(xmlString: string, pattern: RegExp): RegExpMatchArray[] {
	const matches: RegExpMatchArray[] = [];
	let match;
	while ((match = pattern.exec(xmlString)) !== null) {
		matches.push(match);
	}
	return matches;
}

/**
 * Parses publication date from <pub-date> tags
 * Prioritizes pub-type="epub" if available
 */
function parsePublicationDate(xmlString: string): string | null {
	// Try to find epub publication date first
	const epubPubDateRegex =
		/<pub-date[^>]*pub-type="epub"[^>]*>([\s\S]*?)<\/pub-date>/i;
	let pubDateMatch = xmlString.match(epubPubDateRegex);

	// Fall back to first pub-date if epub not found
	if (!pubDateMatch) {
		const anyPubDateRegex = /<pub-date[^>]*>([\s\S]*?)<\/pub-date>/i;
		pubDateMatch = xmlString.match(anyPubDateRegex);
	}

	if (!pubDateMatch) return null;

	const pubDateSection = pubDateMatch[1];
	const day = getTextContent(pubDateSection, "day");
	const month = getTextContent(pubDateSection, "month");
	const year = getTextContent(pubDateSection, "year");

	if (!year) return null;

	// Format as YYYY-MM-DD (pad with zeros if needed)
	const paddedMonth = month ? month.padStart(2, "0") : "01";
	const paddedDay = day ? day.padStart(2, "0") : "01";

	return `${year}-${paddedMonth}-${paddedDay}`;
}

/**
 * Parses authors from <contrib-group> section
 */
function parseAuthors(xmlString: string): Author[] {
	const authors: Author[] = [];

	// Find the contrib-group section
	const contribGroupRegex = /<contrib-group[^>]*>([\s\S]*?)<\/contrib-group>/i;
	const contribGroupMatch = xmlString.match(contribGroupRegex);

	if (!contribGroupMatch) return authors;

	const contribGroupSection = contribGroupMatch[1];

	// Find all contrib elements with contrib-type="author"
	const contribRegex =
		/<contrib[^>]*contrib-type="author"[^>]*>([\s\S]*?)<\/contrib>/gi;
	const contribMatches = getAllMatches(contribGroupSection, contribRegex);

	for (const match of contribMatches) {
		const contribSection = match[1];

		// Extract surname and given-names from within <name> tag
		const surname = getTextContent(contribSection, "surname");
		const givenNames = getTextContent(contribSection, "given-names");

		if (surname) {
			authors.push({
				surname,
				givenNames: givenNames || "",
			});
		}
	}

	return authors;
}

/**
 * Parses title from <article-title> tag
 */
function parseTitle(xmlString: string): string | null {
	const title = getTextContent(xmlString, "article-title");
	return title;
}

/**
 * Parses metadata from an NXML file
 */
async function parseNxmlFile(filePath: string): Promise<PaperMetadata | null> {
	try {
		const content = await readFile(filePath, "utf-8");

		const title = parseTitle(content);
		const authors = parseAuthors(content);
		const publishedDate = parsePublicationDate(content);

		if (!title) {
			console.warn(`No title found in ${filePath}`);
			return null;
		}

		return {
			title,
			authors,
			publishedDate: publishedDate || "unknown",
		};
	} catch (error) {
		console.error(`Error parsing ${filePath}:`, error);
		return null;
	}
}

/**
 * Recursively finds all .nxml files in a directory
 */
async function findNxmlFiles(dir: string): Promise<string[]> {
	const nxmlFiles: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			const subFiles = await findNxmlFiles(fullPath);
			nxmlFiles.push(...subFiles);
		} else if (entry.name.endsWith(".nxml")) {
			nxmlFiles.push(fullPath);
		}
	}

	return nxmlFiles;
}

/**
 * Main function to build metadata for all papers
 */
async function buildMetadata() {
	console.log("Building metadata");
	const searchIndexDir = join(process.cwd(), "..", "search_index");

	const nxmlFiles = await findNxmlFiles(searchIndexDir);

	const metadataMap: Record<string, PaperMetadata> = {};

	for (const filePath of nxmlFiles) {
		const metadata = await parseNxmlFile(filePath);

		if (metadata) {
			const dirName = filePath.split("/").slice(-2, -1)[0];
			metadataMap[dirName] = metadata;

			const metadataPath = join(filePath, "..", "metadata.json");
			await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
		}
	}

	// Write consolidated metadata file
	const outputPath = join(searchIndexDir, "all_metadata.json");
	await writeFile(outputPath, JSON.stringify(metadataMap, null, 2));
	console.log("Metadata built");
}

// Run if called directly
if (import.meta.main) {
	buildMetadata().catch(console.error);
}

export { parseNxmlFile, buildMetadata };

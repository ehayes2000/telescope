
const BASE_URL =
	import.meta.env.MODE === "development" ? "http://localhost:5050" : "";

export async function readFile(id: string): Promise<string | undefined> {
  try {
    const response = await fetch(`${BASE_URL}/api/text?id=${id}`);
    if (!response.ok) return
    const text = await response.text();
    return "TEST TEXT"
  } catch (e) {
    return
  }
}

import { listSavedLayers, readSavedLayer, saveLayer } from "@/lib/harness/layers";
export const dynamic = "force-dynamic";
const failure = (error: unknown, status: number) => Response.json({ error: error instanceof Error ? error.message : String(error) }, { status });
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    return Response.json(id ? { layer: readSavedLayer(id) } : { layers: listSavedLayers() });
  } catch (error) { return failure(error, 422); }
}
export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") return failure(new Error("Cross-site saves are not allowed."), 403);
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 65536) return failure(new Error("Saved layer request is too large."), 413);
    return Response.json({ layer: saveLayer(JSON.parse(text)) }, { status: 201 });
  } catch (error) { return failure(error, 422); }
}

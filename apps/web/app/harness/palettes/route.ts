import { palettes, PaletteConflict, PaletteNotFound } from "@/lib/harness/palettes";
export const dynamic = "force-dynamic";
const failure = (error: unknown) => Response.json({ error: error instanceof Error ? error.message : "Palette request failed." }, { status: error instanceof PaletteConflict ? 409 : error instanceof PaletteNotFound ? 404 : 422 });
export async function GET() {
  try { return Response.json({ palettes: palettes.list() }); } catch (error) { return failure(error); }
}
async function mutate(request: Request, method: "POST" | "PUT" | "DELETE") {
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") return Response.json({ error: "Cross-site changes are not allowed." }, { status: 403 });
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 8192) return Response.json({ error: "Palette request is too large." }, { status: 413 });
    const input: unknown = JSON.parse(text);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Provide a palette object.");
    const body = input as Record<string, unknown>;
    if (method === "DELETE") { palettes.remove(body); return Response.json({ ok: true }); }
    return Response.json({ palette: method === "POST" ? palettes.create(body) : palettes.update(body) }, { status: method === "POST" ? 201 : 200 });
  } catch (error) { return failure(error); }
}
export const POST = (request: Request) => mutate(request, "POST");
export const PUT = (request: Request) => mutate(request, "PUT");
export const DELETE = (request: Request) => mutate(request, "DELETE");

import { generatePalette } from "@/lib/harness/palette-generation";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") return Response.json({ error: "Cross-site generation is not allowed." }, { status: 403 });
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 12288) return Response.json({ error: "Palette prompt is too large." }, { status: 413 });
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(90000)]);
    return Response.json({ palette: await generatePalette(JSON.parse(text), signal) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not generate a palette. Your colors are unchanged." }, { status: 422 });
  }
}

import { readFileSync } from "node:fs";
import { artifactFilePath, verifyArtifact } from "@/lib/harness/store";
import { HarnessError } from "@/lib/harness/core";

/** Serves verified preview rasters to the studio compositor by opaque artifact handle. */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ hash: string }> },
): Promise<Response> {
  const { hash } = await context.params;
  try {
    const manifest = verifyArtifact(hash);
    if (manifest.kind !== "image")
      return Response.json({ error: "that handle is not an image artifact" }, { status: 400 });
    const bytes = readFileSync(artifactFilePath(hash, "image.png"));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "image/png",
        "content-length": String(bytes.length),
        "cache-control": "public, max-age=31536000, immutable",
        "x-render-manifest": manifest.inputsHash ?? "",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof HarnessError ? error.diagnostic : String(error) },
      { status: 404 },
    );
  }
}

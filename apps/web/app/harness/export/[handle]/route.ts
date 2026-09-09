import { readFileSync } from "node:fs";
import { exportPath } from "@/lib/harness/export";

/** Downloads a prepared export bundle by its content handle. */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await context.params,
    path = exportPath(handle);
  if (!path) return Response.json({ error: "unknown export handle" }, { status: 404 });
  const bytes = readFileSync(path);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/zip",
      "content-length": String(bytes.length),
      "content-disposition": `attachment; filename="procedurals-export-${handle.slice(0, 12)}.zip"`,
    },
  });
}

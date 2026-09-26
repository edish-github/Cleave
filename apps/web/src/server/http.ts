import "server-only";
import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { databaseConfigured } from "./db/client";
import { runnerFromRequest } from "./runner-auth";

export function jsonError(message: string, status: number, details?: string[]) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

/** The request body as text, gunzipped when needed. Errors come back as ready responses. */
export async function readText(request: Request, maxBytes: number): Promise<{ text: string } | { response: NextResponse }> {
  let raw = Buffer.from(await request.arrayBuffer());
  if (raw.byteLength > maxBytes) return { response: jsonError(`Body is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`, 413) };
  if ((request.headers.get("content-encoding") ?? "").includes("gzip") || (raw[0] === 0x1f && raw[1] === 0x8b)) {
    try {
      raw = gunzipSync(raw, { maxOutputLength: maxBytes * 4 });
    } catch {
      return { response: jsonError("Body is marked gzip but couldn't be decompressed.", 400) };
    }
  }
  return { text: raw.toString("utf8") };
}

/** Parsed JSON body; an empty body reads as `{}`. */
export async function readJson(request: Request, maxBytes: number): Promise<{ data: unknown } | { response: NextResponse }> {
  const body = await readText(request, maxBytes);
  if ("response" in body) return body;
  if (!body.text.trim()) return { data: {} };
  try {
    return { data: JSON.parse(body.text) };
  } catch {
    return { response: jsonError("Body is not valid JSON.", 400) };
  }
}

/** The runner behind `Authorization: Bearer clv_…`, or the response to send instead. */
export async function requireRunner(request: Request) {
  if (!databaseConfigured) return { response: jsonError("This deployment has no database, so it can't store runs.", 503) } as const;
  const runner = await runnerFromRequest(request);
  if (!runner) return { response: jsonError("Missing or invalid runner token. Create one in Settings → Bob & runners.", 401) } as const;
  return { runner } as const;
}

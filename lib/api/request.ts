import { NextResponse } from "next/server";
import { z } from "zod";

const MAX_JSON_BODY_BYTES = 16 * 1024;

export type ParsedJson<T> =
  | { data: T; response?: never }
  | { data?: never; response: NextResponse };

export async function parseJsonBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema
): Promise<ParsedJson<z.infer<TSchema>>> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    return {
      response: NextResponse.json({ error: "Request body is too large" }, { status: 413 }),
    };
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) {
      return {
        response: NextResponse.json({ error: "Request body is too large" }, { status: 413 }),
      };
    }
    body = JSON.parse(text);
  } catch {
    return {
      response: NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      response: NextResponse.json(
        { error: "Validation error", details: result.error.flatten() },
        { status: 400 }
      ),
    };
  }

  return { data: result.data };
}

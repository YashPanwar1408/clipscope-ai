import { NextResponse } from "next/server";
import {
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/auth/server";

export function apiErrorResponse(error: unknown, fallback = "Request failed") {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

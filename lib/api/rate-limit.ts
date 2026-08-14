import "server-only";

// Simple in-memory rate limiter for demo purposes.
// In production, use Redis or a dedicated rate limiting service.
const requestCounts = new Map<string, { count: number; resetTime: number }>();

const DEFAULT_LIMIT = 60; // requests per minute
const WINDOW_MS = 60_000; // 1 minute

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

export function checkRateLimit(
  identifier: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = WINDOW_MS
): RateLimitResult {
  const now = Date.now();
  const existing = requestCounts.get(identifier);

  if (!existing || now > existing.resetTime) {
    // Reset window
    requestCounts.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: existing.resetTime };
  }

  existing.count++;
  return { allowed: true, remaining: limit - existing.count, resetTime: existing.resetTime };
}

// Clean up expired entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of requestCounts.entries()) {
      if (now > value.resetTime) {
        requestCounts.delete(key);
      }
    }
  }, WINDOW_MS);
}

// Extract identifier from request (IP or user ID)
export function getRateLimitIdentifier(userId: string | null, ip: string | null): string {
  return userId ? `user:${userId}` : ip ? `ip:${ip}` : "anonymous";
}

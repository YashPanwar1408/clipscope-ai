import "server-only";

// SSRF protection: allow only trusted domains
const ALLOWED_DOMAINS = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "instagram.com",
  "www.instagram.com",
  "api.rapidapi.com",
  "instagram-looter2.p.rapidapi.com",
  "googleapis.com",
  "www.googleapis.com",
];

export class SSRFError extends Error {
  constructor(message = "Untrusted domain") {
    super(message);
    this.name = "SSRFError";
  }
}

/**
 * Validates that a URL is from a trusted domain to prevent SSRF attacks.
 * Only allows whitelisted domains.
 */
export function validateTrustedUrl(url: string): URL {
  try {
    const parsed = new URL(url);

    // Block private/internal IP ranges
    const hostname = parsed.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      hostname.startsWith("169.254.") ||
      hostname.startsWith("::1") ||
      hostname.startsWith("[::")
    ) {
      throw new SSRFError("Private or loopback addresses are not allowed");
    }

    // Check domain whitelist
    const domain = hostname.replace(/^www\./, "");
    const isAllowed = ALLOWED_DOMAINS.some((allowed) => {
      const allowedBase = allowed.replace(/^www\./, "");
      return domain === allowedBase || domain.endsWith(`.${allowedBase}`);
    });

    if (!isAllowed) {
      throw new SSRFError(`Domain ${hostname} is not in the trusted list`);
    }

    // Only allow HTTPS for production
    if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") {
      throw new SSRFError("Only HTTPS URLs are allowed in production");
    }

    return parsed;
  } catch (err) {
    if (err instanceof SSRFError) throw err;
    throw new SSRFError("Invalid URL format");
  }
}

/**
 * Fetch with SSRF protection and timeout
 */
export async function safeFetch(url: string, options?: RequestInit, timeoutMs = 15000): Promise<Response> {
  const validatedUrl = validateTrustedUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(validatedUrl.toString(), {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

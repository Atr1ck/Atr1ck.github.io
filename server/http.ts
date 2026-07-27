import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAppOrigin, isSecureCookie } from "./config.js";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}
export function allowMethods(
  request: VercelRequest,
  response: VercelResponse,
  methods: string[],
): boolean {
  if (request.method && methods.includes(request.method)) return true;

  response.setHeader("Allow", methods.join(", "));
  response.status(405).json({ error: "Method not allowed" });
  return false;
}

export function parseCookies(request: VercelRequest): Record<string, string> {
  const header = request.headers.cookie;
  if (!header) return {};

  return Object.fromEntries(
    header.split(";").flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator < 0) return [];
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      return [[name, decodeURIComponent(value)]];
    }),
  );
}

export function serializeCookie(
  name: string,
  value: string,
  options: { maxAge?: number; httpOnly?: boolean } = {},
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
  ];

  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (isSecureCookie()) parts.push("Secure");
  if (typeof options.maxAge === "number") parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  return parts.join("; ");
}

export function clearCookie(name: string): string {
  return serializeCookie(name, "", { maxAge: 0 });
}

export function assertSameOrigin(request: VercelRequest): void {
  const origin = request.headers.origin;
  if (!origin || origin !== getAppOrigin()) {
    throw new HttpError(403, "Invalid request origin");
  }
}

export function sendError(response: VercelResponse, error: unknown): void {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message, details: error.details });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Internal server error" });
}

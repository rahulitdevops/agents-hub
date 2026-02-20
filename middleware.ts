/**
 * Next.js Middleware — Dashboard Authentication
 *
 * FIX: Auth on dashboard (Low priority fix).
 *
 * Protects the dashboard with HTTP Basic Auth.
 * Set DASHBOARD_PASSWORD in your .env to enable.
 * If DASHBOARD_PASSWORD is not set, the dashboard is open (dev mode).
 *
 * Usage:
 *   DASHBOARD_PASSWORD=mypassword in .env
 *   Browser will prompt for username/password on first visit.
 *   Username: any value (e.g. "admin")
 *   Password: value of DASHBOARD_PASSWORD
 *
 * API routes (/api/*) are excluded — they use their own validation.
 * Static assets (_next/*) are also excluded.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;

  // No password configured → open access (dev mode)
  if (!password || password.trim() === "") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Skip auth for API routes — they validate their own inputs
  // Skip for static Next.js assets
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Check for Basic Auth header
  const authHeader = request.headers.get("authorization");

  if (authHeader && authHeader.startsWith("Basic ")) {
    try {
      const base64 = authHeader.slice(6);
      const decoded = Buffer.from(base64, "base64").toString("utf-8");
      const colonIndex = decoded.indexOf(":");
      if (colonIndex !== -1) {
        const suppliedPassword = decoded.slice(colonIndex + 1);
        if (suppliedPassword === password) {
          return NextResponse.next();
        }
      }
    } catch {
      // Malformed auth header — fall through to 401
    }
  }

  // No valid credentials — prompt for Basic Auth
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Agents Hub — Enter your dashboard password"',
    },
  });
}

export const config = {
  // Match all routes except static files
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};

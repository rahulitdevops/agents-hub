/**
 * API Route Authentication Helper
 *
 * Validates requests to API routes using either:
 * 1. Bearer token (OPENCLAW_GATEWAY_TOKEN)
 * 2. Basic Auth (same as dashboard DASHBOARD_PASSWORD)
 * 3. Same-origin requests from the dashboard (no auth needed)
 *
 * Usage in route handlers:
 *   const authError = validateApiRequest(request);
 *   if (authError) return authError;
 */

import { NextRequest, NextResponse } from "next/server";

export function validateApiRequest(request: NextRequest): NextResponse | null {
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
  const dashboardPassword = process.env.DASHBOARD_PASSWORD;

  // If no auth is configured at all, allow everything (dev mode)
  if (!gatewayToken && !dashboardPassword) return null;

  // Check Bearer token (for programmatic API access)
  const authHeader = request.headers.get("authorization");
  if (authHeader && gatewayToken) {
    if (authHeader === `Bearer ${gatewayToken}`) return null;
  }

  // Check Basic Auth (same as dashboard)
  if (authHeader?.startsWith("Basic ") && dashboardPassword) {
    try {
      const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
      const colonIdx = decoded.indexOf(":");
      if (colonIdx !== -1 && decoded.slice(colonIdx + 1) === dashboardPassword) {
        return null;
      }
    } catch {
      // Malformed — fall through
    }
  }

  // Check Referer/Origin — allow same-origin requests from the dashboard
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  if (host) {
    const hostOrigin = `http://${host}`;
    const hostOriginHttps = `https://${host}`;
    if (
      origin === hostOrigin ||
      origin === hostOriginHttps ||
      referer?.startsWith(hostOrigin) ||
      referer?.startsWith(hostOriginHttps)
    ) {
      return null; // Same-origin dashboard request
    }
  }

  // No valid auth found
  return NextResponse.json(
    { error: "Unauthorized", message: "Provide a Bearer token or Basic Auth credentials" },
    { status: 401 }
  );
}

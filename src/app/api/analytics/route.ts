import { NextResponse } from "next/server";
import { runtime } from "@/lib/openclaw-runtime";

// GET /api/analytics
export async function GET() {
  return NextResponse.json({
    summary: runtime.getSummary(),
    timeseries: runtime.getAnalytics(),
    gateway: runtime.getGatewayStatus(),
  });
}

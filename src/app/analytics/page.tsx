import { runtime } from "@/lib/openclaw-runtime";
import { AnalyticsClient } from "./client";

export default function AnalyticsPage() {
  const analytics = runtime.getAnalytics();
  const summary = runtime.getSummary();
  return <AnalyticsClient analytics={analytics} summary={summary} />;
}

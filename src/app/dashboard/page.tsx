import { runtime } from "@/lib/openclaw-runtime";
import { DashboardClient } from "./client";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const summary = runtime.getSummary();
  const agents = runtime.getAgents();
  const tasks = runtime.getTasks({ limit: 5 });
  const analytics = runtime.getAnalytics();

  return <DashboardClient summary={summary} agents={agents} recentTasks={tasks} analytics={analytics} />;
}

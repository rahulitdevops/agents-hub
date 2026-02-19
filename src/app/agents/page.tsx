import { runtime } from "@/lib/openclaw-runtime";
import { AgentsClient } from "./client";

export const dynamic = "force-dynamic";

export default function AgentsPage() {
  const agents = runtime.getAgents();
  return <AgentsClient agents={agents} />;
}

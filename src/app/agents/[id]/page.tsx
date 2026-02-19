import { runtime } from "@/lib/openclaw-runtime";
import { notFound } from "next/navigation";
import { AgentDetailClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = runtime.getAgent(id);
  if (!agent) notFound();
  const tasks = runtime.getTasks({ agentId: id, limit: 10 });
  return <AgentDetailClient agent={agent} tasks={tasks} />;
}

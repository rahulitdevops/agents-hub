import { runtime } from "@/lib/openclaw-runtime";
import { TasksClient } from "./client";

export default function TasksPage() {
  const tasks = runtime.getTasks({});
  const agents = runtime.getAgents();
  return <TasksClient tasks={tasks} agents={agents} />;
}

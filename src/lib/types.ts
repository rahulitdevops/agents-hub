// ─── Core Types ──────────────────────────────────────────────────────────────

export type AgentStatus = "running" | "paused" | "error" | "stopped" | "deploying";
export type AgentRole = "director" | "worker" | "specialist";
export type TaskStatus = "queued" | "parked" | "running" | "completed" | "failed" | "cancelled";
export type TaskPriority = "critical" | "high" | "medium" | "low";
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

// Fixed ID for the default Director agent (Groot)
export const GROOT_AGENT_ID = "groot";

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  source: "bundled" | "clawhub" | "workspace";
}

export interface AgentChannel {
  type: "whatsapp" | "telegram" | "discord" | "slack" | "webchat" | "api";
  enabled: boolean;
  config: Record<string, string>;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  role: AgentRole;
  avatar: string;
  model: string;
  status: AgentStatus;
  thinking: ThinkingLevel;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  skills: AgentSkill[];
  channels: AgentChannel[];
  rateLimit: number;
  maxConcurrency: number;
  timeout: number;
  retryPolicy: "exponential" | "linear" | "none";
  maxRetries: number;
  dmPolicy: "pairing" | "open" | "closed";
  platformAccess: string[]; // Platform IDs this agent can access, ["*"] = all
  createdAt: string;
  updatedAt: string;
  // Runtime metrics
  metrics: AgentMetrics;
}

export interface AgentMetrics {
  uptime: string;
  cpu: number;
  memory: number;
  tasksCompleted: number;
  tasksQueued: number;
  avgResponseTime: number;
  errorRate: number;
  lastActive: string;
  tokensUsed: number;
  totalCost: number;
}

export interface Task {
  id: string;
  agentId: string;
  agentName: string;
  type: string;
  status: TaskStatus;
  priority: TaskPriority;
  input: string;
  output: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration: string;
  tokensUsed: number;
  cost: number;
  metadata?: Record<string, unknown>;
}

export interface AnalyticsDataPoint {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
  errors: number;
  avgLatency: number;
}

export interface GatewayEvent {
  type: "agent_started" | "agent_stopped" | "agent_error" | "task_created" | "task_completed" | "task_failed" | "message_received" | "message_sent";
  agentId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface OpenClawGatewayConfig {
  url: string;
  port: number;
  agents: string[];
}

// ─── Platform Integrations ─────────────────────────────────────────────────

export interface PlatformIntegration {
  id: string;          // Unique instance ID (e.g. "aws-abc123")
  platform: string;    // Platform key matching template (e.g. "aws", "github")
  label: string;       // Display name
  credentials: Record<string, string>;  // field key → value (e.g. { accessKeyId: "AKIA...", secretAccessKey: "..." })
  enabled: boolean;
}

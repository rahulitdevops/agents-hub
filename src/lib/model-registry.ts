/**
 * Model Registry — centralized, metadata-rich model definitions.
 *
 * This is the single source of truth for all models available in the platform.
 * To add a new model: add one object to MODEL_REGISTRY. Nothing else needs changing.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ModelTier = "flagship" | "standard" | "fast" | "reasoning";

export type ModelCapability =
  | "thinking"       // Extended thinking / chain-of-thought
  | "vision"         // Image / multimodal input
  | "reasoning"      // Specialized reasoning (o1, r1 style)
  | "fast"           // Optimized for low latency
  | "long-context"   // >128K context window
  | "code"           // Strong coding ability
  | "multilingual";  // Strong multilingual support

export type AgentRoleHint = "director" | "worker" | "specialist";

export interface ModelDef {
  /** Canonical ID in "provider/model-name" format — stored as-is in AgentConfig.model */
  id: string;
  /** Human-readable name shown in the UI */
  displayName: string;
  /** Provider key — MUST match keys in PROVIDER_TEMPLATES (settings.ts) */
  provider: "anthropic" | "openai" | "google" | "deepseek" | "groq" | "mistral" | "ollama";
  /** Context window in tokens */
  contextWindow: number;
  /** Formatted label for display — e.g. "200K", "1M" */
  contextWindowLabel: string;
  /** Visual tier badge */
  tier: ModelTier;
  /** Capability flags shown as pills in the model card */
  capabilities: ModelCapability[];
  /** One-line description for the model card */
  description: string;
  /** Concise recommended use cases text */
  recommendedFor: string;
  /** Agent roles this model is highlighted for */
  recommendedRoles: AgentRoleHint[];
  /** Whether this model supports the thinking/extended-thinking parameter */
  supportsThinking: boolean;
}

// ─── The Registry ─────────────────────────────────────────────────────────────
// Add a new model here — it will automatically appear everywhere in the UI.

export const MODEL_REGISTRY: ModelDef[] = [
  // ── Anthropic ────────────────────────────────────────────────────────────────
  {
    id: "anthropic/claude-opus-4-6",
    displayName: "Claude Opus 4.6",
    provider: "anthropic",
    contextWindow: 200000,
    contextWindowLabel: "200K",
    tier: "flagship",
    capabilities: ["thinking", "vision", "code", "multilingual", "long-context"],
    description: "Most capable Claude. Best for complex orchestration and director roles.",
    recommendedFor: "Director orchestration, high-stakes multi-step tasks",
    recommendedRoles: ["director"],
    supportsThinking: true,
  },
  {
    id: "anthropic/claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    provider: "anthropic",
    contextWindow: 200000,
    contextWindowLabel: "200K",
    tier: "standard",
    capabilities: ["thinking", "vision", "code", "multilingual", "long-context"],
    description: "Latest Sonnet — best balance of intelligence and speed. Recommended for most agents.",
    recommendedFor: "General purpose workers, balanced performance and cost",
    recommendedRoles: ["worker", "specialist"],
    supportsThinking: true,
  },
  {
    id: "anthropic/claude-sonnet-4-5",
    displayName: "Claude Sonnet 4.5",
    provider: "anthropic",
    contextWindow: 200000,
    contextWindowLabel: "200K",
    tier: "standard",
    capabilities: ["thinking", "vision", "code", "multilingual", "long-context"],
    description: "Previous Sonnet generation. Reliable for production workloads.",
    recommendedFor: "Stable production agents, general purpose tasks",
    recommendedRoles: ["worker", "specialist"],
    supportsThinking: true,
  },
  {
    id: "anthropic/claude-haiku-4-5",
    displayName: "Claude Haiku 4.5",
    provider: "anthropic",
    contextWindow: 200000,
    contextWindowLabel: "200K",
    tier: "fast",
    capabilities: ["fast", "vision", "code"],
    description: "Fastest Claude. Ideal for high-volume, low-latency sub-tasks.",
    recommendedFor: "High-volume workers, fast classification, simple transforms",
    recommendedRoles: ["worker"],
    supportsThinking: false,
  },

  // ── OpenAI ───────────────────────────────────────────────────────────────────
  {
    id: "openai/gpt-4o",
    displayName: "GPT-4o",
    provider: "openai",
    contextWindow: 128000,
    contextWindowLabel: "128K",
    tier: "flagship",
    capabilities: ["vision", "code", "multilingual"],
    description: "OpenAI flagship multimodal model. Strong vision and code.",
    recommendedFor: "Vision tasks, multimodal analysis, code generation",
    recommendedRoles: ["specialist"],
    supportsThinking: false,
  },
  {
    id: "openai/gpt-4o-mini",
    displayName: "GPT-4o mini",
    provider: "openai",
    contextWindow: 128000,
    contextWindowLabel: "128K",
    tier: "fast",
    capabilities: ["fast", "vision", "code"],
    description: "Cost-efficient GPT-4o variant. Great for lightweight workers.",
    recommendedFor: "Cost-sensitive workers, rapid lightweight processing",
    recommendedRoles: ["worker"],
    supportsThinking: false,
  },

  // ── Google ───────────────────────────────────────────────────────────────────
  {
    id: "google/gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    provider: "google",
    contextWindow: 1000000,
    contextWindowLabel: "1M",
    tier: "fast",
    capabilities: ["fast", "vision", "long-context", "multilingual"],
    description: "Fastest Gemini with massive 1M context. Great for long documents.",
    recommendedFor: "Long document analysis, fast multimodal processing",
    recommendedRoles: ["specialist", "worker"],
    supportsThinking: false,
  },
  {
    id: "google/gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro",
    provider: "google",
    contextWindow: 2000000,
    contextWindowLabel: "2M",
    tier: "standard",
    capabilities: ["vision", "long-context", "multilingual", "code"],
    description: "Largest context window available. Exceptional for large codebases.",
    recommendedFor: "Entire codebase analysis, long-running research tasks",
    recommendedRoles: ["specialist"],
    supportsThinking: false,
  },

  // ── DeepSeek ─────────────────────────────────────────────────────────────────
  {
    id: "deepseek/deepseek-r1",
    displayName: "DeepSeek R1",
    provider: "deepseek",
    contextWindow: 64000,
    contextWindowLabel: "64K",
    tier: "reasoning",
    capabilities: ["reasoning", "code", "multilingual"],
    description: "Dedicated reasoning model. Excels at math, logic, problem solving.",
    recommendedFor: "Mathematical reasoning, logic chains, structured problem solving",
    recommendedRoles: ["specialist"],
    supportsThinking: false,
  },

  // ── Groq ─────────────────────────────────────────────────────────────────────
  {
    id: "groq/llama-3.3-70b-versatile",
    displayName: "Llama 3.3 70B",
    provider: "groq",
    contextWindow: 128000,
    contextWindowLabel: "128K",
    tier: "fast",
    capabilities: ["fast", "code", "multilingual"],
    description: "Llama 3.3 70B via Groq ultra-fast LPU inference.",
    recommendedFor: "High-throughput workers, rapid iteration, cost-effective compute",
    recommendedRoles: ["worker"],
    supportsThinking: false,
  },

  // ── Mistral ──────────────────────────────────────────────────────────────────
  {
    id: "mistral/mistral-large-latest",
    displayName: "Mistral Large",
    provider: "mistral",
    contextWindow: 128000,
    contextWindowLabel: "128K",
    tier: "standard",
    capabilities: ["code", "multilingual"],
    description: "Mistral's best model. Strong multilingual and coding performance.",
    recommendedFor: "Multilingual tasks, European language support, code generation",
    recommendedRoles: ["specialist", "worker"],
    supportsThinking: false,
  },
];

// ─── Derived Exports ──────────────────────────────────────────────────────────

/** Drop-in replacement for the old MODELS string array */
export const MODEL_IDS: string[] = MODEL_REGISTRY.map((m) => m.id);

/** Look up a ModelDef by its ID string */
export function getModelDef(id: string): ModelDef | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

/** Get all models recommended for a given agent role */
export function getRecommendedModels(role: AgentRoleHint): ModelDef[] {
  return MODEL_REGISTRY.filter((m) => m.recommendedRoles.includes(role));
}

/** Tier badge display config */
export const TIER_CONFIG: Record<ModelTier, { label: string; classes: string }> = {
  flagship:  { label: "Flagship",  classes: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  standard:  { label: "Standard",  classes: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  fast:      { label: "Fast",      classes: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  reasoning: { label: "Reasoning", classes: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
};

/** Provider display config — icon letter, gradient, label */
export const PROVIDER_DISPLAY: Record<string, { label: string; icon: string; gradient: string }> = {
  anthropic: { label: "Anthropic", icon: "A", gradient: "from-orange-500 to-amber-600" },
  openai:    { label: "OpenAI",    icon: "O", gradient: "from-emerald-500 to-green-600" },
  google:    { label: "Google",    icon: "G", gradient: "from-blue-500 to-indigo-600" },
  deepseek:  { label: "DeepSeek", icon: "D", gradient: "from-cyan-500 to-blue-600" },
  groq:      { label: "Groq",     icon: "Q", gradient: "from-purple-500 to-violet-600" },
  mistral:   { label: "Mistral",  icon: "M", gradient: "from-rose-500 to-pink-600" },
  ollama:    { label: "Ollama",   icon: "L", gradient: "from-slate-500 to-slate-600" },
};

/** Capability pill display config */
export const CAPABILITY_DISPLAY: Record<ModelCapability, { label: string; icon: string }> = {
  thinking:       { label: "Thinking",     icon: "🧠" },
  vision:         { label: "Vision",       icon: "👁" },
  reasoning:      { label: "Reasoning",    icon: "🔬" },
  fast:           { label: "Fast",         icon: "⚡" },
  "long-context": { label: "Long ctx",     icon: "📄" },
  code:           { label: "Code",         icon: "{}" },
  multilingual:   { label: "Multilingual", icon: "🌐" },
};

/** Canonical provider display order in the picker */
export const PROVIDER_ORDER = [
  "anthropic",
  "openai",
  "google",
  "deepseek",
  "groq",
  "mistral",
  "ollama",
] as const;

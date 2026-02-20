import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { PlatformIntegration, ChannelIntegration } from "./types";

const SETTINGS_PATH = join(process.cwd(), "data", "settings.json");

// Shared volume path for gateway auth profiles
const OPENCLAW_CONFIG_DIR = "/app/openclaw-config";
const AGENT_AUTH_DIR = join(OPENCLAW_CONFIG_DIR, "agents", "main", "agent");

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProviderConfig {
  id: string;
  provider: string;
  label: string;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  authMode?: "api_key" | "subscription"; // For Anthropic: API key vs Claude subscription token
}

export interface PlatformSettings {
  gatewayUrl: string;
  gatewayPort: string;
  providers: ProviderConfig[];
  platformIntegrations: PlatformIntegration[];
  channelIntegrations: ChannelIntegration[];
}

// Known provider templates for the UI
export const PROVIDER_TEMPLATES: Record<string, { label: string; placeholder: string; helpUrl: string; prefix: string }> = {
  anthropic: {
    label: "Anthropic",
    placeholder: "sk-ant-api03-xxxxx...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    prefix: "sk-ant-",
  },
  openai: {
    label: "OpenAI",
    placeholder: "sk-xxxxx...",
    helpUrl: "https://platform.openai.com/api-keys",
    prefix: "sk-",
  },
  google: {
    label: "Google AI (Gemini)",
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/apikey",
    prefix: "AIza",
  },
  deepseek: {
    label: "DeepSeek",
    placeholder: "sk-xxxxx...",
    helpUrl: "https://platform.deepseek.com/api_keys",
    prefix: "sk-",
  },
  groq: {
    label: "Groq",
    placeholder: "gsk_xxxxx...",
    helpUrl: "https://console.groq.com/keys",
    prefix: "gsk_",
  },
  mistral: {
    label: "Mistral AI",
    placeholder: "xxxxx...",
    helpUrl: "https://console.mistral.ai/api-keys",
    prefix: "",
  },
  ollama: {
    label: "Ollama (Local)",
    placeholder: "ollama-local",
    helpUrl: "https://ollama.com",
    prefix: "",
  },
};

const DEFAULT_SETTINGS: PlatformSettings = {
  gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789",
  gatewayPort: process.env.OPENCLAW_GATEWAY_PORT || "18789",
  providers: [],
  platformIntegrations: [],
  channelIntegrations: [],
};

// ─── Settings persistence ───────────────────────────────────────────────────

export function loadSettings(): PlatformSettings {
  try {
    if (existsSync(SETTINGS_PATH)) {
      const raw = readFileSync(SETTINGS_PATH, "utf-8");
      const parsed = JSON.parse(raw);

      // Migrate old format → new format and persist it
      if (!parsed.providers && (parsed.anthropicApiKey || parsed.openaiApiKey)) {
        const providers: ProviderConfig[] = [];
        if (parsed.anthropicApiKey) {
          providers.push({
            id: "anthropic-default",
            provider: "anthropic",
            label: "Anthropic",
            apiKey: parsed.anthropicApiKey,
            enabled: true,
          });
        }
        if (parsed.openaiApiKey) {
          providers.push({
            id: "openai-default",
            provider: "openai",
            label: "OpenAI",
            apiKey: parsed.openaiApiKey,
            enabled: true,
          });
        }
        const migrated: PlatformSettings = {
          gatewayUrl: parsed.gatewayUrl || DEFAULT_SETTINGS.gatewayUrl,
          gatewayPort: parsed.gatewayPort || DEFAULT_SETTINGS.gatewayPort,
          providers,
          platformIntegrations: [],
          channelIntegrations: [],
        };
        // Persist the migrated format so we don't re-migrate on every read
        try {
          writeFileSync(SETTINGS_PATH, JSON.stringify(migrated, null, 2), "utf-8");
          console.log("[settings] Migrated old format to new provider format");
        } catch {
          // non-critical — will try again next read
        }
        return migrated;
      }

      const merged = { ...DEFAULT_SETTINGS, ...parsed };
      // Ensure platformIntegrations and channelIntegrations exist (backward compat)
      if (!merged.platformIntegrations) merged.platformIntegrations = [];
      if (!merged.channelIntegrations) merged.channelIntegrations = [];
      return merged;
    }
  } catch {
    // fall through
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: PlatformSettings) {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

// ─── Auth profile sync ─────────────────────────────────────────────────────

/**
 * Sync all enabled provider API keys to auth-profiles.json.
 * Written to two locations:
 *   1. /app/openclaw-config/ — shared Docker volume (gateway reads this)
 *   2. /root/.openclaw/     — local path for `openclaw agent --local` mode
 */
export function syncAuthProfiles(settings: PlatformSettings) {
  const profiles: Record<string, unknown> = {};

  for (const p of settings.providers) {
    if (!p.enabled || !p.apiKey) continue;

    const profileKey = `${p.provider}:${p.id}`;
    // Use type:"token" to match openclaw.json auth.profiles (mode:"token")
    // If types don't match, openclaw's profile resolver filters the profile out
    const profile: Record<string, unknown> = {
      type: "token",
      provider: p.provider,
      token: p.apiKey,
    };

    if (p.baseUrl) {
      profile.baseUrl = p.baseUrl;
    }

    profiles[profileKey] = profile;

    // Also write as the "default" profile for the provider
    // so openclaw picks it up automatically
    if (!profiles[`${p.provider}:default`]) {
      profiles[`${p.provider}:default`] = { ...profile };
    }
  }

  const authStore = { version: 1, profiles };
  const content = JSON.stringify(authStore, null, 2);

  const paths = [
    AGENT_AUTH_DIR,
    "/root/.openclaw/agents/main/agent",
  ];

  for (const dir of paths) {
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const filePath = join(dir, "auth-profiles.json");
      writeFileSync(filePath, content, "utf-8");
      console.log("[settings] Synced auth-profiles.json to", filePath);
    } catch (err) {
      console.error("[settings] Failed to sync auth-profiles.json to", dir, err);
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••••";
  return "••••••" + key.slice(-4);
}

export function maskProviders(providers: ProviderConfig[]): ProviderConfig[] {
  return providers.map((p) => ({
    ...p,
    apiKey: maskKey(p.apiKey),
  }));
}

/**
 * Mask credential values in platform integrations (same pattern as maskProviders).
 */
export function maskPlatformIntegrations(integrations: PlatformIntegration[]): PlatformIntegration[] {
  return integrations.map((p) => ({
    ...p,
    credentials: Object.fromEntries(
      Object.entries(p.credentials).map(([k, v]) => [k, maskKey(v)])
    ),
  }));
}

/**
 * Mask credential values in channel integrations (same pattern as platform integrations).
 */
export function maskChannelIntegrations(integrations: ChannelIntegration[]): ChannelIntegration[] {
  return integrations.map((c) => ({
    ...c,
    credentials: Object.fromEntries(
      Object.entries(c.credentials).map(([k, v]) => [k, maskKey(v)])
    ),
  }));
}

/**
 * Get an API key by provider name.
 * Used by the chat API to read keys from multi-provider settings.
 */
export function getApiKeyForProvider(provider: string): string {
  const settings = loadSettings();
  const match = settings.providers.find((p) => p.provider === provider && p.enabled && p.apiKey);
  return match?.apiKey || "";
}

/**
 * Load just the platform integrations (with real credentials) for env var resolution.
 */
export function loadPlatformIntegrations(): PlatformIntegration[] {
  const settings = loadSettings();
  return settings.platformIntegrations || [];
}

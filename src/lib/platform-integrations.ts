/**
 * Platform Integration Templates
 *
 * Defines the available platforms (AWS, GCP, Vercel, etc.) with their
 * credential fields, icons, colors, and environment variable mappings.
 * Used by the Settings UI and the worker dispatch pipeline.
 */

import type { PlatformIntegration } from "./types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PlatformField {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password" | "url";
  required: boolean;
}

export interface PlatformTemplate {
  key: string;
  label: string;
  icon: string;
  color: string;       // Tailwind gradient classes
  description: string;
  fields: PlatformField[];
  envMapping: Record<string, string>;  // credential field key → env var name
}

// ─── Platform Templates ─────────────────────────────────────────────────────

export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  {
    key: "aws",
    label: "AWS",
    icon: "☁️",
    color: "from-amber-500 to-orange-600",
    description: "Amazon Web Services — EC2, S3, Lambda, ECS, CloudFormation",
    fields: [
      { key: "accessKeyId", label: "Access Key ID", placeholder: "AKIA...", type: "text", required: true },
      { key: "secretAccessKey", label: "Secret Access Key", placeholder: "wJalrXUtnFEMI...", type: "password", required: true },
      { key: "region", label: "Default Region", placeholder: "us-east-1", type: "text", required: false },
    ],
    envMapping: {
      accessKeyId: "AWS_ACCESS_KEY_ID",
      secretAccessKey: "AWS_SECRET_ACCESS_KEY",
      region: "AWS_DEFAULT_REGION",
    },
  },
  {
    key: "gcp",
    label: "Google Cloud",
    icon: "🌐",
    color: "from-blue-500 to-indigo-600",
    description: "Google Cloud Platform — Compute, Storage, BigQuery, GKE",
    fields: [
      { key: "serviceAccountKey", label: "Service Account Key (JSON)", placeholder: '{"type":"service_account",...}', type: "password", required: true },
      { key: "projectId", label: "Project ID", placeholder: "my-project-123", type: "text", required: false },
    ],
    envMapping: {
      serviceAccountKey: "GOOGLE_APPLICATION_CREDENTIALS_JSON",
      projectId: "GCP_PROJECT_ID",
    },
  },
  {
    key: "vercel",
    label: "Vercel",
    icon: "▲",
    color: "from-slate-600 to-slate-800",
    description: "Vercel — Deployments, serverless functions, edge config",
    fields: [
      { key: "token", label: "API Token", placeholder: "Bearer ...", type: "password", required: true },
    ],
    envMapping: {
      token: "VERCEL_TOKEN",
    },
  },
  {
    key: "supabase",
    label: "Supabase",
    icon: "⚡",
    color: "from-emerald-500 to-green-600",
    description: "Supabase — Postgres, Auth, Storage, Realtime, Edge Functions",
    fields: [
      { key: "url", label: "Project URL", placeholder: "https://xyzproject.supabase.co", type: "url", required: true },
      { key: "serviceRoleKey", label: "Service Role Key", placeholder: "eyJhbGciOiJIUzI1NiIs...", type: "password", required: true },
    ],
    envMapping: {
      url: "SUPABASE_URL",
      serviceRoleKey: "SUPABASE_SERVICE_ROLE_KEY",
    },
  },
  {
    key: "github",
    label: "GitHub",
    icon: "🐙",
    color: "from-gray-600 to-gray-800",
    description: "GitHub — Repos, Issues, PRs, Actions, Packages",
    fields: [
      { key: "token", label: "Personal Access Token", placeholder: "ghp_xxxxxxxxxxxx...", type: "password", required: true },
    ],
    envMapping: {
      token: "GITHUB_TOKEN",
    },
  },
  {
    key: "slack",
    label: "Slack",
    icon: "💬",
    color: "from-purple-500 to-violet-600",
    description: "Slack — Send messages, manage channels, read threads",
    fields: [
      { key: "botToken", label: "Bot Token", placeholder: "xoxb-...", type: "password", required: true },
      { key: "appToken", label: "App Token (optional)", placeholder: "xapp-...", type: "password", required: false },
    ],
    envMapping: {
      botToken: "SLACK_BOT_TOKEN",
      appToken: "SLACK_APP_TOKEN",
    },
  },
  {
    key: "dockerhub",
    label: "Docker Hub",
    icon: "🐳",
    color: "from-sky-500 to-blue-600",
    description: "Docker Hub — Push/pull images, manage repositories",
    fields: [
      { key: "username", label: "Username", placeholder: "myuser", type: "text", required: true },
      { key: "password", label: "Access Token", placeholder: "dckr_pat_...", type: "password", required: true },
    ],
    envMapping: {
      username: "DOCKER_USERNAME",
      password: "DOCKER_PASSWORD",
    },
  },
  {
    key: "cloudflare",
    label: "Cloudflare",
    icon: "🔶",
    color: "from-orange-400 to-red-500",
    description: "Cloudflare — Workers, Pages, DNS, R2, D1",
    fields: [
      { key: "apiToken", label: "API Token", placeholder: "xxxxxxxxxxxxxxxxxxxx", type: "password", required: true },
      { key: "accountId", label: "Account ID", placeholder: "abc123def456...", type: "text", required: false },
    ],
    envMapping: {
      apiToken: "CLOUDFLARE_API_TOKEN",
      accountId: "CLOUDFLARE_ACCOUNT_ID",
    },
  },
];

// ─── Channel Templates ──────────────────────────────────────────────────────

export const CHANNEL_TEMPLATES: PlatformTemplate[] = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: "📱",
    color: "from-green-500 to-emerald-600",
    description: "WhatsApp Business API — receive and send messages via Meta Cloud API",
    fields: [
      { key: "phoneNumberId", label: "Phone Number ID", placeholder: "1234567890...", type: "text", required: true },
      { key: "accessToken", label: "Permanent Access Token", placeholder: "EAAxxxxxxx...", type: "password", required: true },
      { key: "verifyToken", label: "Webhook Verify Token", placeholder: "my-secret-verify-token", type: "text", required: true },
      { key: "businessAccountId", label: "Business Account ID", placeholder: "9876543210", type: "text", required: false },
    ],
    envMapping: {
      phoneNumberId: "WHATSAPP_PHONE_NUMBER_ID",
      accessToken: "WHATSAPP_ACCESS_TOKEN",
      verifyToken: "WHATSAPP_VERIFY_TOKEN",
      businessAccountId: "WHATSAPP_BUSINESS_ACCOUNT_ID",
    },
  },
  {
    key: "slack",
    label: "Slack",
    icon: "💬",
    color: "from-purple-500 to-violet-600",
    description: "Slack Bot — receive and respond to messages in Slack workspaces",
    fields: [
      { key: "botToken", label: "Bot Token", placeholder: "xoxb-...", type: "password", required: true },
      { key: "signingSecret", label: "Signing Secret", placeholder: "abc123def456...", type: "password", required: true },
      { key: "appToken", label: "App Token (Socket Mode)", placeholder: "xapp-...", type: "password", required: false },
    ],
    envMapping: {
      botToken: "SLACK_BOT_TOKEN",
      signingSecret: "SLACK_SIGNING_SECRET",
      appToken: "SLACK_APP_TOKEN",
    },
  },
];

// ─── Lookup helpers ─────────────────────────────────────────────────────────

/** Get a platform template by key */
export function getPlatformTemplate(key: string): PlatformTemplate | undefined {
  return PLATFORM_TEMPLATES.find((t) => t.key === key);
}

/** Get all platform templates as a map keyed by platform key */
export function getPlatformTemplateMap(): Record<string, PlatformTemplate> {
  const map: Record<string, PlatformTemplate> = {};
  for (const t of PLATFORM_TEMPLATES) {
    map[t.key] = t;
  }
  return map;
}

/** Get a channel template by key */
export function getChannelTemplate(key: string): PlatformTemplate | undefined {
  return CHANNEL_TEMPLATES.find((t) => t.key === key);
}

/** Get all channel templates as a map keyed by channel key */
export function getChannelTemplateMap(): Record<string, PlatformTemplate> {
  const map: Record<string, PlatformTemplate> = {};
  for (const t of CHANNEL_TEMPLATES) {
    map[t.key] = t;
  }
  return map;
}

// ─── Environment Variable Resolution ────────────────────────────────────────

/**
 * Resolve a platform integration's credentials to environment variable key-value pairs.
 * Only includes fields that have non-empty values.
 *
 * Example: For an AWS integration with accessKeyId="AKIA..." and region="us-east-1",
 * returns: { AWS_ACCESS_KEY_ID: "AKIA...", AWS_DEFAULT_REGION: "us-east-1" }
 */
export function resolvePlatformEnv(integration: PlatformIntegration): Record<string, string> {
  const template = getPlatformTemplate(integration.platform);
  if (!template) return {};

  const env: Record<string, string> = {};
  for (const [fieldKey, value] of Object.entries(integration.credentials)) {
    if (!value || value.startsWith("••••")) continue; // Skip empty or masked values
    const envVar = template.envMapping[fieldKey];
    if (envVar) {
      env[envVar] = value;
    }
  }
  return env;
}

/**
 * Resolve all platform env vars for a given agent based on their platformAccess list.
 * If platformAccess includes "*", the agent gets all enabled platform credentials.
 */
export function resolveAgentPlatformEnv(
  platformAccess: string[],
  integrations: PlatformIntegration[],
): Record<string, string> {
  const hasWildcard = platformAccess.includes("*");
  const env: Record<string, string> = {};

  for (const integration of integrations) {
    if (!integration.enabled) continue;
    if (!hasWildcard && !platformAccess.includes(integration.platform)) continue;

    const platformEnv = resolvePlatformEnv(integration);
    Object.assign(env, platformEnv);
  }

  return env;
}

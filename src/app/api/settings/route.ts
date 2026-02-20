import { NextRequest, NextResponse } from "next/server";
import {
  loadSettings,
  saveSettings,
  syncAuthProfiles,
  maskProviders,
  maskPlatformIntegrations,
  maskChannelIntegrations,
  PROVIDER_TEMPLATES,
  type ProviderConfig,
} from "@/lib/settings";
import { PLATFORM_TEMPLATES, CHANNEL_TEMPLATES } from "@/lib/platform-integrations";
import type { PlatformIntegration, ChannelIntegration } from "@/lib/types";

// ─── Routes ─────────────────────────────────────────────────────────────────

// GET /api/settings
export async function GET() {
  const settings = loadSettings();
  return NextResponse.json({
    ...settings,
    providers: maskProviders(settings.providers),
    platformIntegrations: maskPlatformIntegrations(settings.platformIntegrations || []),
    channelIntegrations: maskChannelIntegrations(settings.channelIntegrations || []),
    providerTemplates: PROVIDER_TEMPLATES,
    platformTemplates: PLATFORM_TEMPLATES,
    channelTemplates: CHANNEL_TEMPLATES,
  });
}

// POST /api/settings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const current = loadSettings();

    // Build updated providers list, preserving existing keys if masked value sent
    let updatedProviders: ProviderConfig[] = current.providers;

    if (Array.isArray(body.providers)) {
      updatedProviders = body.providers.map((incoming: ProviderConfig) => {
        const existing = current.providers.find((p) => p.id === incoming.id);

        return {
          id: incoming.id,
          provider: incoming.provider,
          label: incoming.label || incoming.provider,
          apiKey: incoming.apiKey && !incoming.apiKey.startsWith("••••")
            ? incoming.apiKey
            : existing?.apiKey || "",
          baseUrl: incoming.baseUrl,
          enabled: incoming.enabled ?? true,
          authMode: incoming.authMode || existing?.authMode,
        };
      });
    }

    // Build updated platform integrations, preserving existing credentials if masked
    let updatedIntegrations: PlatformIntegration[] = current.platformIntegrations || [];

    if (Array.isArray(body.platformIntegrations)) {
      updatedIntegrations = body.platformIntegrations.map((incoming: PlatformIntegration) => {
        const existing = (current.platformIntegrations || []).find((p) => p.id === incoming.id);

        // Smart merge credentials: preserve existing value if incoming is masked
        const mergedCredentials: Record<string, string> = {};
        for (const [fieldKey, value] of Object.entries(incoming.credentials || {})) {
          if (value && !value.startsWith("••••")) {
            mergedCredentials[fieldKey] = value;
          } else {
            mergedCredentials[fieldKey] = existing?.credentials?.[fieldKey] || "";
          }
        }

        return {
          id: incoming.id,
          platform: incoming.platform,
          label: incoming.label || incoming.platform,
          credentials: mergedCredentials,
          enabled: incoming.enabled ?? true,
        };
      });
    }

    // Build updated channel integrations, preserving existing credentials if masked
    let updatedChannels: ChannelIntegration[] = current.channelIntegrations || [];

    if (Array.isArray(body.channelIntegrations)) {
      updatedChannels = body.channelIntegrations.map((incoming: ChannelIntegration) => {
        const existing = (current.channelIntegrations || []).find((c) => c.id === incoming.id);

        // Smart merge credentials: preserve existing value if incoming is masked
        const mergedCredentials: Record<string, string> = {};
        for (const [fieldKey, value] of Object.entries(incoming.credentials || {})) {
          if (value && !value.startsWith("••••")) {
            mergedCredentials[fieldKey] = value;
          } else {
            mergedCredentials[fieldKey] = existing?.credentials?.[fieldKey] || "";
          }
        }

        return {
          id: incoming.id,
          channel: incoming.channel,
          label: incoming.label || incoming.channel,
          credentials: mergedCredentials,
          enabled: incoming.enabled ?? true,
        };
      });
    }

    const updated = {
      gatewayUrl: body.gatewayUrl ?? current.gatewayUrl,
      gatewayPort: body.gatewayPort ?? current.gatewayPort,
      providers: updatedProviders,
      platformIntegrations: updatedIntegrations,
      channelIntegrations: updatedChannels,
    };

    saveSettings(updated);
    syncAuthProfiles(updated);

    return NextResponse.json({
      success: true,
      settings: {
        ...updated,
        providers: maskProviders(updated.providers),
        platformIntegrations: maskPlatformIntegrations(updated.platformIntegrations),
        channelIntegrations: maskChannelIntegrations(updated.channelIntegrations),
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

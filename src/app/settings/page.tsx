"use client";

import { useState, useEffect } from "react";

interface ProviderConfig {
  id: string;
  provider: string;
  label: string;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  authMode?: "api_key" | "subscription";
}

interface ProviderTemplate {
  label: string;
  placeholder: string;
  helpUrl: string;
  prefix: string;
}

interface PlatformField {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password" | "url";
  required: boolean;
}

interface PlatformTemplateInfo {
  key: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  fields: PlatformField[];
}

interface PlatformIntegrationConfig {
  id: string;
  platform: string;
  label: string;
  credentials: Record<string, string>;
  enabled: boolean;
}

interface ChannelIntegrationConfig {
  id: string;
  channel: string;
  label: string;
  credentials: Record<string, string>;
  enabled: boolean;
}

interface Settings {
  gatewayUrl: string;
  gatewayPort: string;
  providers: ProviderConfig[];
  platformIntegrations: PlatformIntegrationConfig[];
  channelIntegrations: ChannelIntegrationConfig[];
  providerTemplates?: Record<string, ProviderTemplate>;
  platformTemplates?: PlatformTemplateInfo[];
  channelTemplates?: PlatformTemplateInfo[];
}

const PROVIDER_ICONS: Record<string, string> = {
  anthropic: "A",
  openai: "O",
  google: "G",
  deepseek: "D",
  groq: "Q",
  mistral: "M",
  ollama: "L",
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "from-orange-500 to-amber-600",
  openai: "from-emerald-500 to-green-600",
  google: "from-blue-500 to-indigo-600",
  deepseek: "from-cyan-500 to-blue-600",
  groq: "from-purple-500 to-violet-600",
  mistral: "from-rose-500 to-pink-600",
  ollama: "from-slate-500 to-slate-600",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    gatewayUrl: "ws://127.0.0.1:18789",
    gatewayPort: "18789",
    providers: [],
    platformIntegrations: [],
    channelIntegrations: [],
  });
  const [templates, setTemplates] = useState<Record<string, ProviderTemplate>>({});
  const [platformTemplates, setPlatformTemplates] = useState<PlatformTemplateInfo[]>([]);
  const [channelTemplates, setChannelTemplates] = useState<PlatformTemplateInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gatewayStatus, setGatewayStatus] = useState<"checking" | "online" | "offline">("checking");
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [visiblePlatformFields, setVisiblePlatformFields] = useState<Set<string>>(new Set());
  const [visibleChannelFields, setVisibleChannelFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          gatewayUrl: data.gatewayUrl,
          gatewayPort: data.gatewayPort,
          providers: data.providers || [],
          platformIntegrations: data.platformIntegrations || [],
          channelIntegrations: data.channelIntegrations || [],
        });
        if (data.providerTemplates) {
          setTemplates(data.providerTemplates);
        }
        if (data.platformTemplates) {
          setPlatformTemplates(data.platformTemplates);
        }
        if (data.channelTemplates) {
          setChannelTemplates(data.channelTemplates);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    setGatewayStatus("checking");
    fetch("/api/analytics")
      .then((r) => setGatewayStatus(r.ok ? "online" : "offline"))
      .catch(() => setGatewayStatus("offline"));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings({
          gatewayUrl: data.settings.gatewayUrl,
          gatewayPort: data.settings.gatewayPort,
          providers: data.settings.providers || [],
          platformIntegrations: data.settings.platformIntegrations || [],
          channelIntegrations: data.settings.channelIntegrations || [],
        });
        setSaved(true);
        setVisibleKeys(new Set());
        setVisiblePlatformFields(new Set());
        setVisibleChannelFields(new Set());
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  }

  // ─── LLM Provider helpers ──────────────────────────────────────────────

  function addProvider(providerKey: string) {
    const tmpl = templates[providerKey];
    const id = `${providerKey}-${Date.now().toString(36)}`;
    const newProvider: ProviderConfig = {
      id,
      provider: providerKey,
      label: tmpl?.label || providerKey,
      apiKey: "",
      baseUrl: providerKey === "ollama" ? "http://host.docker.internal:11434/v1" : undefined,
      enabled: true,
      authMode: providerKey === "anthropic" ? "subscription" : undefined,
    };
    setSettings((prev) => ({
      ...prev,
      providers: [...prev.providers, newProvider],
    }));
    setShowAddProvider(false);
    setVisibleKeys((prev) => new Set(prev).add(id));
  }

  function updateProvider(id: string, updates: Partial<ProviderConfig>) {
    setSettings((prev) => ({
      ...prev,
      providers: prev.providers.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
  }

  function removeProvider(id: string) {
    setSettings((prev) => ({
      ...prev,
      providers: prev.providers.filter((p) => p.id !== id),
    }));
  }

  function toggleKeyVisibility(id: string) {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ─── Platform Integration helpers ──────────────────────────────────────

  function addPlatform(platformKey: string) {
    const tmpl = platformTemplates.find((t) => t.key === platformKey);
    if (!tmpl) return;
    const id = `${platformKey}-${Date.now().toString(36)}`;
    const credentials: Record<string, string> = {};
    for (const field of tmpl.fields) {
      credentials[field.key] = "";
    }
    const newIntegration: PlatformIntegrationConfig = {
      id,
      platform: platformKey,
      label: tmpl.label,
      credentials,
      enabled: true,
    };
    setSettings((prev) => ({
      ...prev,
      platformIntegrations: [...prev.platformIntegrations, newIntegration],
    }));
    setShowAddPlatform(false);
    for (const field of tmpl.fields) {
      setVisiblePlatformFields((prev) => new Set(prev).add(`${id}:${field.key}`));
    }
  }

  function updatePlatformIntegration(id: string, updates: Partial<PlatformIntegrationConfig>) {
    setSettings((prev) => ({
      ...prev,
      platformIntegrations: prev.platformIntegrations.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
  }

  function updatePlatformCredential(integrationId: string, fieldKey: string, value: string) {
    setSettings((prev) => ({
      ...prev,
      platformIntegrations: prev.platformIntegrations.map((p) =>
        p.id === integrationId
          ? { ...p, credentials: { ...p.credentials, [fieldKey]: value } }
          : p
      ),
    }));
  }

  function removePlatform(id: string) {
    setSettings((prev) => ({
      ...prev,
      platformIntegrations: prev.platformIntegrations.filter((p) => p.id !== id),
    }));
  }

  function togglePlatformFieldVisibility(fieldId: string) {
    setVisiblePlatformFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }

  // ─── Channel Integration helpers ──────────────────────────────────────

  function addChannel(channelKey: string) {
    const tmpl = channelTemplates.find((t) => t.key === channelKey);
    if (!tmpl) return;
    const id = `${channelKey}-${Date.now().toString(36)}`;
    const credentials: Record<string, string> = {};
    for (const field of tmpl.fields) {
      credentials[field.key] = "";
    }
    const newChannel: ChannelIntegrationConfig = {
      id,
      channel: channelKey,
      label: tmpl.label,
      credentials,
      enabled: true,
    };
    setSettings((prev) => ({
      ...prev,
      channelIntegrations: [...prev.channelIntegrations, newChannel],
    }));
    setShowAddChannel(false);
    for (const field of tmpl.fields) {
      setVisibleChannelFields((prev) => new Set(prev).add(`${id}:${field.key}`));
    }
  }

  function updateChannelIntegration(id: string, updates: Partial<ChannelIntegrationConfig>) {
    setSettings((prev) => ({
      ...prev,
      channelIntegrations: prev.channelIntegrations.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
  }

  function updateChannelCredential(channelId: string, fieldKey: string, value: string) {
    setSettings((prev) => ({
      ...prev,
      channelIntegrations: prev.channelIntegrations.map((c) =>
        c.id === channelId
          ? { ...c, credentials: { ...c.credentials, [fieldKey]: value } }
          : c
      ),
    }));
  }

  function removeChannel(id: string) {
    setSettings((prev) => ({
      ...prev,
      channelIntegrations: prev.channelIntegrations.filter((c) => c.id !== id),
    }));
  }

  function toggleChannelFieldVisibility(fieldId: string) {
    setVisibleChannelFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }

  // Providers already added
  const addedProviderKeys = new Set(settings.providers.map((p) => p.provider));
  const availableProviders = Object.entries(templates).filter(
    ([key]) => !addedProviderKeys.has(key)
  );

  // Platforms already added
  const addedPlatformKeys = new Set(settings.platformIntegrations.map((p) => p.platform));
  const availablePlatforms = platformTemplates.filter(
    (t) => !addedPlatformKeys.has(t.key)
  );

  // Channels already added
  const addedChannelKeys = new Set(settings.channelIntegrations.map((c) => c.channel));
  const availableChannels = channelTemplates.filter(
    (t) => !addedChannelKeys.has(t.key)
  );

  const hasAnyKey = settings.providers.some((p) => p.apiKey && p.enabled);

  // Build base URL for webhook display
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Platform Settings</h2>
        <p className="text-slate-400 text-sm mt-1">Configure your gateway, LLM providers, and platform integrations.</p>
      </div>

      {/* Gateway Status */}
      <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
        <h3 className="text-slate-900 font-semibold">Gateway</h3>
        <div className="flex items-center gap-2 text-sm">
          {gatewayStatus === "checking" && (
            <>
              <div className="w-2.5 h-2.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-500">Checking...</span>
            </>
          )}
          {gatewayStatus === "online" && (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-600">Gateway Online</span>
            </>
          )}
          {gatewayStatus === "offline" && (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-red-500">Gateway Offline</span>
            </>
          )}
        </div>
      </section>

      {/* LLM Providers */}
      <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-slate-900 font-semibold">LLM Providers</h3>
            <p className="text-slate-500 text-xs mt-0.5">Add API keys for the model providers you want to use.</p>
          </div>
          <button
            onClick={() => setShowAddProvider(!showAddProvider)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Provider
          </button>
        </div>

        {showAddProvider && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
            {availableProviders.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-2">All providers already added.</p>
            ) : (
              availableProviders.map(([key, tmpl]) => (
                <button
                  key={key}
                  onClick={() => addProvider(key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${PROVIDER_COLORS[key] || "from-slate-500 to-slate-600"} flex items-center justify-center text-white text-xs font-bold`}>
                    {PROVIDER_ICONS[key] || key[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-slate-900 text-sm font-medium">{tmpl.label}</div>
                    <div className="text-slate-500 text-xs">
                      <a href={tmpl.helpUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600/70 hover:text-brand-600">
                        Get API key &rarr;
                      </a>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        <div className="space-y-3">
          {settings.providers.map((provider) => {
            const tmpl = templates[provider.provider];
            const isKeyVisible = visibleKeys.has(provider.id);
            const isNewKey = !provider.apiKey.startsWith("\u2022");

            return (
              <div key={provider.id} className={`border rounded-xl p-4 transition-all ${provider.enabled ? "border-slate-200 bg-white shadow-sm" : "border-slate-200 bg-slate-50 opacity-60"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${PROVIDER_COLORS[provider.provider] || "from-slate-500 to-slate-600"} flex items-center justify-center text-white text-xs font-bold`}>
                      {PROVIDER_ICONS[provider.provider] || provider.provider[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-slate-900 text-sm font-medium">{provider.label}</div>
                      <div className="text-slate-400 text-[10px] font-mono">{provider.provider}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateProvider(provider.id, { enabled: !provider.enabled })} className={`relative w-9 h-5 rounded-full transition-colors ${provider.enabled ? "bg-emerald-600" : "bg-slate-300"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${provider.enabled ? "translate-x-4" : ""}`} />
                    </button>
                    <button onClick={() => removeProvider(provider.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Remove provider">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    </button>
                  </div>
                </div>

                {provider.provider === "anthropic" && (
                  <div className="mb-3">
                    <label className="block text-xs text-slate-500 mb-1.5">Authentication Method</label>
                    <div className="flex gap-2">
                      <button onClick={() => updateProvider(provider.id, { authMode: "subscription", apiKey: "" })} className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${(provider.authMode || "api_key") === "subscription" ? "border-brand-500 bg-brand-50 text-brand-600" : "border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300"}`}>
                        <div className="flex items-center gap-1.5"><span>🔐</span><span>Claude Subscription</span></div>
                        <p className="text-[10px] mt-0.5 opacity-60">Use your Claude Pro/Team plan</p>
                      </button>
                      <button onClick={() => updateProvider(provider.id, { authMode: "api_key", apiKey: "" })} className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${(provider.authMode || "api_key") === "api_key" ? "border-brand-500 bg-brand-50 text-brand-600" : "border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300"}`}>
                        <div className="flex items-center gap-1.5"><span>🔑</span><span>API Key</span></div>
                        <p className="text-[10px] mt-0.5 opacity-60">Pay-per-use API access</p>
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      {provider.provider === "anthropic" && (provider.authMode || "api_key") === "subscription" ? "Setup Token" : "API Key"}
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={isKeyVisible ? "text" : "password"}
                          placeholder={provider.provider === "anthropic" && (provider.authMode || "api_key") === "subscription" ? "sk-ant-oat01-xxxxx..." : tmpl?.placeholder || "Enter API key..."}
                          value={provider.apiKey}
                          onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-brand-500 font-mono pr-10"
                        />
                        <button onClick={() => toggleKeyVisibility(provider.id)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" title={isKeyVisible ? "Hide key" : "Show key"}>
                          {isKeyVisible ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          )}
                        </button>
                      </div>
                    </div>
                    {provider.provider === "anthropic" && (provider.authMode || "api_key") === "subscription" ? (
                      <div className="mt-1.5 space-y-1">
                        <p className="text-[10px] text-slate-500 leading-relaxed">To use your Claude subscription, generate a setup token:</p>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-[11px] text-brand-600">claude setup-token</div>
                        <p className="text-[10px] text-slate-400">
                          Run this in your terminal (requires{" "}
                          <a href="https://claude.ai/download" target="_blank" rel="noopener noreferrer" className="text-brand-600/70 hover:text-brand-600 underline underline-offset-2">Claude Desktop</a>
                          ), then paste the token above.
                        </p>
                      </div>
                    ) : tmpl?.helpUrl ? (
                      <p className="text-[10px] text-slate-400 mt-1">
                        Get your key from{" "}
                        <a href={tmpl.helpUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600/70 hover:text-brand-600 underline underline-offset-2">
                          {tmpl.helpUrl.replace(/^https?:\/\//, "").split("/")[0]}
                        </a>
                      </p>
                    ) : null}
                  </div>

                  {(provider.provider === "ollama" || provider.baseUrl) && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Base URL</label>
                      <input type="text" placeholder="http://localhost:11434/v1" value={provider.baseUrl || ""} onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-brand-500 font-mono" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mt-3 text-[10px]">
                  {provider.apiKey && !isNewKey ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-emerald-600">Key configured</span></>
                  ) : provider.apiKey && isNewKey ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /><span className="text-amber-600">Unsaved changes</span></>
                  ) : (
                    <><span className="w-1.5 h-1.5 rounded-full bg-slate-300" /><span className="text-slate-400">No key set</span></>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {settings.providers.length === 0 && (
          <div className="text-center py-8">
            <div className="text-slate-400 text-3xl mb-2">🔑</div>
            <p className="text-slate-500 text-sm">No providers configured yet.</p>
            <p className="text-slate-400 text-xs mt-1">Click &quot;Add Provider&quot; to get started.</p>
          </div>
        )}

        {settings.providers.length > 0 && !hasAnyKey && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
            <span className="text-amber-500 mt-0.5 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            </span>
            <p className="text-xs text-amber-700 leading-relaxed">No API keys configured. The chat agent will not work until you add at least one provider key and save.</p>
          </div>
        )}
      </section>

      {/* ─── Platform Integrations ──────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-slate-900 font-semibold">Platform Integrations</h3>
            <p className="text-slate-500 text-xs mt-0.5">Configure access credentials for cloud platforms and services. Assign access per agent.</p>
          </div>
          <button
            onClick={() => setShowAddPlatform(!showAddPlatform)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Platform
          </button>
        </div>

        {showAddPlatform && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
            {availablePlatforms.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-2">All platforms already added.</p>
            ) : (
              availablePlatforms.map((tmpl) => (
                <button key={tmpl.key} onClick={() => addPlatform(tmpl.key)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors text-left">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tmpl.color} flex items-center justify-center text-sm`}>{tmpl.icon}</div>
                  <div>
                    <div className="text-slate-900 text-sm font-medium">{tmpl.label}</div>
                    <div className="text-slate-500 text-xs">{tmpl.description}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        <div className="space-y-3">
          {settings.platformIntegrations.map((integration) => {
            const tmpl = platformTemplates.find((t) => t.key === integration.platform);
            if (!tmpl) return null;

            const hasAnyCredential = Object.values(integration.credentials).some((v) => v && v.length > 0);
            const hasNewValue = Object.values(integration.credentials).some((v) => v && !v.startsWith("\u2022"));

            return (
              <div key={integration.id} className={`border rounded-xl p-4 transition-all ${integration.enabled ? "border-slate-200 bg-white shadow-sm" : "border-slate-200 bg-slate-50 opacity-60"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tmpl.color} flex items-center justify-center text-sm`}>{tmpl.icon}</div>
                    <div>
                      <div className="text-slate-900 text-sm font-medium">{integration.label}</div>
                      <div className="text-slate-400 text-[10px]">{tmpl.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updatePlatformIntegration(integration.id, { enabled: !integration.enabled })} className={`relative w-9 h-5 rounded-full transition-colors ${integration.enabled ? "bg-emerald-600" : "bg-slate-300"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${integration.enabled ? "translate-x-4" : ""}`} />
                    </button>
                    <button onClick={() => removePlatform(integration.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Remove platform">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {tmpl.fields.map((field) => {
                    const fieldId = `${integration.id}:${field.key}`;
                    const isVisible = visiblePlatformFields.has(fieldId);
                    const value = integration.credentials[field.key] || "";

                    return (
                      <div key={field.key}>
                        <label className="block text-xs text-slate-500 mb-1">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        <div className="relative">
                          <input
                            type={field.type === "password" && !isVisible ? "password" : "text"}
                            placeholder={field.placeholder}
                            value={value}
                            onChange={(e) => updatePlatformCredential(integration.id, field.key, e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-brand-500 font-mono pr-10"
                          />
                          {field.type === "password" && (
                            <button onClick={() => togglePlatformFieldVisibility(fieldId)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" title={isVisible ? "Hide" : "Show"}>
                              {isVisible ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5 mt-3 text-[10px]">
                  {hasAnyCredential && !hasNewValue ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-emerald-600">Configured</span></>
                  ) : hasNewValue ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /><span className="text-amber-600">Unsaved changes</span></>
                  ) : (
                    <><span className="w-1.5 h-1.5 rounded-full bg-slate-300" /><span className="text-slate-400">No credentials set</span></>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {settings.platformIntegrations.length === 0 && (
          <div className="text-center py-8">
            <div className="text-slate-400 text-3xl mb-2">🔌</div>
            <p className="text-slate-500 text-sm">No platform integrations configured yet.</p>
            <p className="text-slate-400 text-xs mt-1">Click &quot;Add Platform&quot; to connect AWS, GCP, GitHub, and more.</p>
          </div>
        )}
      </section>

      {/* ─── Channel Integrations ──────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-slate-900 font-semibold">Channel Integrations</h3>
            <p className="text-slate-500 text-xs mt-0.5">Connect messaging channels to receive and respond to messages from WhatsApp, Slack, and more.</p>
          </div>
          <button
            onClick={() => setShowAddChannel(!showAddChannel)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Channel
          </button>
        </div>

        {showAddChannel && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
            {availableChannels.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-2">All channels already added.</p>
            ) : (
              availableChannels.map((tmpl) => (
                <button key={tmpl.key} onClick={() => addChannel(tmpl.key)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors text-left">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tmpl.color} flex items-center justify-center text-sm`}>{tmpl.icon}</div>
                  <div>
                    <div className="text-slate-900 text-sm font-medium">{tmpl.label}</div>
                    <div className="text-slate-500 text-xs">{tmpl.description}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Built-in WebChat indicator */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-sm">💬</div>
            <div>
              <span className="text-slate-900 text-sm font-medium">WebChat</span>
              <p className="text-slate-400 text-[10px]">Built-in chat interface</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-600">Active</span>
          </div>
        </div>

        <div className="space-y-3">
          {settings.channelIntegrations.map((channel) => {
            const tmpl = channelTemplates.find((t) => t.key === channel.channel);
            if (!tmpl) return null;

            const hasAnyCredential = Object.values(channel.credentials).some((v) => v && v.length > 0);
            const hasNewValue = Object.values(channel.credentials).some((v) => v && !v.startsWith("\u2022"));
            const webhookUrl = `${baseUrl}/api/webhooks/${channel.channel}`;

            return (
              <div key={channel.id} className={`border rounded-xl p-4 transition-all ${channel.enabled ? "border-slate-200 bg-white shadow-sm" : "border-slate-200 bg-slate-50 opacity-60"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tmpl.color} flex items-center justify-center text-sm`}>{tmpl.icon}</div>
                    <div>
                      <div className="text-slate-900 text-sm font-medium">{channel.label}</div>
                      <div className="text-slate-400 text-[10px]">{tmpl.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateChannelIntegration(channel.id, { enabled: !channel.enabled })} className={`relative w-9 h-5 rounded-full transition-colors ${channel.enabled ? "bg-emerald-600" : "bg-slate-300"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${channel.enabled ? "translate-x-4" : ""}`} />
                    </button>
                    <button onClick={() => removeChannel(channel.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Remove channel">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {tmpl.fields.map((field) => {
                    const fieldId = `${channel.id}:${field.key}`;
                    const isVisible = visibleChannelFields.has(fieldId);
                    const value = channel.credentials[field.key] || "";

                    return (
                      <div key={field.key}>
                        <label className="block text-xs text-slate-500 mb-1">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        <div className="relative">
                          <input
                            type={field.type === "password" && !isVisible ? "password" : "text"}
                            placeholder={field.placeholder}
                            value={value}
                            onChange={(e) => updateChannelCredential(channel.id, field.key, e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-brand-500 font-mono pr-10"
                          />
                          {field.type === "password" && (
                            <button onClick={() => toggleChannelFieldVisibility(fieldId)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" title={isVisible ? "Hide" : "Show"}>
                              {isVisible ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Webhook URL display */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <label className="block text-xs text-slate-500 mb-1">
                      Webhook URL
                      <span className="text-slate-400 ml-1 font-normal">(paste this in your {channel.channel === "whatsapp" ? "Meta App Dashboard" : "Slack App Settings"})</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600 text-xs font-mono select-all truncate">
                        {webhookUrl}
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(webhookUrl); }}
                        className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 transition-colors"
                        title="Copy webhook URL"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {channel.channel === "whatsapp"
                        ? "Add this URL as the Callback URL in your Meta App Dashboard under WhatsApp > Configuration."
                        : "Add this URL as the Request URL in your Slack App under Event Subscriptions."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-3 text-[10px]">
                  {hasAnyCredential && !hasNewValue ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-emerald-600">Configured</span></>
                  ) : hasNewValue ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /><span className="text-amber-600">Unsaved changes</span></>
                  ) : (
                    <><span className="w-1.5 h-1.5 rounded-full bg-slate-300" /><span className="text-slate-400">No credentials set</span></>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {settings.channelIntegrations.length === 0 && (
          <div className="text-center py-6">
            <p className="text-slate-400 text-xs">Click &quot;Add Channel&quot; to connect WhatsApp, Slack, and more.</p>
          </div>
        )}
      </section>

      {/* Save */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm text-emerald-600 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            Settings saved &amp; synced to gateway
          </span>
        )}
        <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

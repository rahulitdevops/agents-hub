"use client";

/**
 * ModelPicker — rich model selection component.
 *
 * Replaces plain <select> dropdowns with a card-based picker grouped by provider.
 * Two variants:
 *   - "expanded": Full card grid, used in agent edit form (spans full grid row)
 *   - "compact":  Trigger button + floating dropdown, used in agent create form
 *
 * Fetches /api/settings on mount to determine which providers are configured.
 * Models from unconfigured providers are shown dimmed with a setup hint.
 */

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  MODEL_REGISTRY,
  TIER_CONFIG,
  PROVIDER_DISPLAY,
  CAPABILITY_DISPLAY,
  PROVIDER_ORDER,
  getModelDef,
  type ModelDef,
  type AgentRoleHint,
} from "@/lib/model-registry";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ModelPickerProps {
  value: string;
  onChange: (modelId: string) => void;
  agentRole?: AgentRoleHint;
  variant?: "compact" | "expanded";
  disabled?: boolean;
}

// ─── Model Card ───────────────────────────────────────────────────────────────

function ModelCard({
  model,
  selected,
  recommended,
  configured,
  onClick,
  compact,
}: {
  model: ModelDef;
  selected: boolean;
  recommended: boolean;
  configured: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const tierCfg = TIER_CONFIG[model.tier];

  return (
    <button
      type="button"
      disabled={!configured}
      onClick={onClick}
      className={cn(
        "relative text-left rounded-xl border transition-all duration-150 w-full",
        compact ? "p-2.5" : "p-3",
        selected
          ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/10"
          : configured
            ? "border-slate-700/50 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900/80"
            : "border-slate-800/50 bg-slate-900/30 opacity-50 cursor-not-allowed",
      )}
    >
      {/* Recommended badge */}
      {recommended && configured && (
        <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-semibold leading-none">
          Recommended
        </span>
      )}

      {/* Selected indicator dot */}
      {selected && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" />
      )}

      {/* Model name */}
      <div className={cn("font-semibold text-white leading-tight", compact ? "text-xs pr-4" : "text-sm pr-16")}>
        {model.displayName}
      </div>

      {/* Tier badge */}
      <div className="mt-1.5">
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", tierCfg.classes)}>
          {tierCfg.label}
        </span>
      </div>

      {/* Description — hide in compact mode to save space */}
      {!compact && (
        <p className="text-slate-400 text-xs mt-2 leading-relaxed line-clamp-2">
          {model.description}
        </p>
      )}

      {/* Context window */}
      <div className={cn("flex items-center gap-1 text-slate-500", compact ? "mt-1.5 text-[10px]" : "mt-2 text-[10px]")}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {model.contextWindowLabel} ctx
      </div>

      {/* Capability pills */}
      {!compact && (
        <div className="flex flex-wrap gap-1 mt-2">
          {model.capabilities.map((cap) => {
            const capCfg = CAPABILITY_DISPLAY[cap];
            return (
              <span
                key={cap}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50"
              >
                {capCfg.icon} {capCfg.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Not configured warning */}
      {!configured && (
        <div className="mt-2 text-[10px] text-amber-500/80 flex items-center gap-1">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Configure API key in Settings
        </div>
      )}
    </button>
  );
}

// ─── Provider Group ───────────────────────────────────────────────────────────

function ProviderGroup({
  providerKey,
  models,
  selectedValue,
  agentRole,
  configuredProviders,
  onSelect,
  compact,
}: {
  providerKey: string;
  models: ModelDef[];
  selectedValue: string;
  agentRole?: AgentRoleHint;
  configuredProviders: string[];
  onSelect: (modelId: string) => void;
  compact?: boolean;
}) {
  const display = PROVIDER_DISPLAY[providerKey];
  if (!display || models.length === 0) return null;
  const isConfigured = configuredProviders.includes(providerKey);

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {/* Provider header */}
      <div className="flex items-center gap-2">
        <div className={cn(
          "flex-shrink-0 flex items-center justify-center rounded-lg bg-gradient-to-br font-bold text-white",
          compact ? "w-5 h-5 text-[9px]" : "w-6 h-6 text-[10px]",
          display.gradient,
        )}>
          {display.icon}
        </div>
        <span className={cn("font-medium text-slate-300", compact ? "text-xs" : "text-sm")}>
          {display.label}
        </span>
        {!isConfigured && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500/80 border border-amber-500/20">
            Not configured
          </span>
        )}
      </div>

      {/* Model cards grid */}
      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            selected={selectedValue === model.id}
            recommended={!!agentRole && model.recommendedRoles.includes(agentRole)}
            configured={isConfigured}
            onClick={() => isConfigured && onSelect(model.id)}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Inner Grid — shared between both variants ────────────────────────────────

function ModelGrid({
  selectedValue,
  agentRole,
  configuredProviders,
  onSelect,
  compact,
}: {
  selectedValue: string;
  agentRole?: AgentRoleHint;
  configuredProviders: string[];
  onSelect: (modelId: string) => void;
  compact?: boolean;
}) {
  // Group models by provider in PROVIDER_ORDER
  const grouped = PROVIDER_ORDER.reduce<Record<string, ModelDef[]>>((acc, key) => {
    const models = MODEL_REGISTRY.filter((m) => m.provider === key);
    if (models.length > 0) acc[key] = models;
    return acc;
  }, {});

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {PROVIDER_ORDER.map((providerKey) => {
        const models = grouped[providerKey];
        if (!models) return null;
        return (
          <ProviderGroup
            key={providerKey}
            providerKey={providerKey}
            models={models}
            selectedValue={selectedValue}
            agentRole={agentRole}
            configuredProviders={configuredProviders}
            onSelect={onSelect}
            compact={compact}
          />
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ModelPicker({
  value,
  onChange,
  agentRole,
  variant = "compact",
  disabled = false,
}: ModelPickerProps) {
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch configured providers from settings
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.providers)) {
          const active = (data.providers as Array<{ provider: string; enabled: boolean; apiKey?: string }>)
            .filter((p) => p.enabled && p.apiKey && p.apiKey.length > 0)
            .map((p) => p.provider);
          setConfiguredProviders(active);
        }
      })
      .catch(() => {});
  }, []);

  // Close compact dropdown on outside click
  useEffect(() => {
    if (variant !== "compact" || !open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [variant, open]);

  const selectedModel = getModelDef(value);
  const selectedProvider = selectedModel?.provider ?? value.split("/")[0] ?? "anthropic";
  const providerDisplay = PROVIDER_DISPLAY[selectedProvider];

  // ── Expanded variant ───────────────────────────────────────────────────────
  if (variant === "expanded") {
    return (
      <div className={cn("space-y-4", disabled && "opacity-60 pointer-events-none")}>
        <ModelGrid
          selectedValue={value}
          agentRole={agentRole}
          configuredProviders={configuredProviders}
          onSelect={onChange}
        />
      </div>
    );
  }

  // ── Compact variant ────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className={cn("relative", disabled && "opacity-60 pointer-events-none")}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm
                   flex items-center justify-between gap-2
                   focus:outline-none focus:border-orange-500 hover:border-slate-600 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Provider icon */}
          {providerDisplay && (
            <div className={cn(
              "flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center",
              "bg-gradient-to-br text-white font-bold text-[9px]",
              providerDisplay.gradient,
            )}>
              {providerDisplay.icon}
            </div>
          )}
          {/* Model name */}
          <span className="truncate text-sm">
            {selectedModel?.displayName ?? value}
          </span>
          {/* Tier badge */}
          {selectedModel && (
            <span className={cn(
              "flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded border font-medium",
              TIER_CONFIG[selectedModel.tier].classes,
            )}>
              {TIER_CONFIG[selectedModel.tier].label}
            </span>
          )}
        </div>
        {/* Chevron */}
        <svg
          className={cn("w-4 h-4 flex-shrink-0 text-slate-400 transition-transform", open && "rotate-180")}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Floating dropdown panel */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1
                        max-h-[480px] overflow-y-auto
                        bg-slate-900 border border-slate-700 rounded-xl
                        shadow-xl shadow-black/50 p-3">
          <ModelGrid
            selectedValue={value}
            agentRole={agentRole}
            configuredProviders={configuredProviders}
            onSelect={(modelId) => {
              onChange(modelId);
              setOpen(false);
            }}
            compact
          />
        </div>
      )}
    </div>
  );
}

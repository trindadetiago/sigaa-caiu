"use client";

import { useState } from "react";
import type { Layers, LayerInfo, LayerStatus } from "@/lib/types";
import { timeAgo, formatMs } from "@/lib/utils";

interface Props {
  layers?: Layers;
}

interface LayerDef {
  key: keyof Layers;
  label: string;
}

const LAYER_DEFS: LayerDef[] = [
  { key: "reachability", label: "Acesso ao servidor" },
  { key: "portal", label: "Portal publico" },
  { key: "loginForm", label: "Tela de login" },
  { key: "loginE2e", label: "Login completo" },
];

function statusIcon(status: LayerStatus): string {
  switch (status) {
    case "online":
      return "✓";
    case "degraded":
      return "~";
    case "offline":
      return "✗";
    default:
      return "·";
  }
}

function statusDotColor(status: LayerStatus): string {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "degraded":
      return "bg-yellow-500";
    case "offline":
      return "bg-red-500";
    default:
      return "bg-neutral-400";
  }
}

function statusText(status: LayerStatus): string {
  switch (status) {
    case "online":
      return "OK";
    case "degraded":
      return "Lento";
    case "offline":
      return "Falhou";
    default:
      return "N/A";
  }
}

function statusTextColor(status: LayerStatus): string {
  switch (status) {
    case "online":
      return "text-green-500";
    case "degraded":
      return "text-yellow-500";
    case "offline":
      return "text-red-500";
    default:
      return "text-neutral-400";
  }
}

function LayerRow({ def, info }: { def: LayerDef; info: LayerInfo | null }) {
  if (!info) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0">
        <span className="text-neutral-400">{def.label}</span>
        <span className="text-neutral-500 text-sm">sem dados</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${statusDotColor(info.status)}`} />
        <span className="text-neutral-300">{def.label}</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className={statusTextColor(info.status)}>
          {statusText(info.status)}
        </span>
        {info.responseTimeMs != null && info.responseTimeMs > 0 && (
          <span className="text-neutral-500">{formatMs(info.responseTimeMs)}</span>
        )}
        <span className="text-neutral-600">{timeAgo(info.timestamp)}</span>
      </div>
    </div>
  );
}

export function LayerDetails({ layers }: Props) {
  const [open, setOpen] = useState(false);

  if (!layers) return null;

  return (
    <div className="w-full max-w-md mx-auto mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-1 mx-auto"
      >
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        Detalhes tecnicos
      </button>

      {open && (
        <div className="mt-3 bg-neutral-900 rounded-lg px-4 py-2 border border-neutral-800">
          {LAYER_DEFS.map((def) => (
            <LayerRow key={def.key} def={def} info={layers[def.key]} />
          ))}
        </div>
      )}
    </div>
  );
}

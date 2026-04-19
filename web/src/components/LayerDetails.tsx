"use client";

import { useState } from "react";
import type { Layers, LayerInfo, LayerStatus, HistoryResponse } from "@/lib/types";
import { timeAgo, formatMs } from "@/lib/utils";
import { LayerResponseChart } from "@/components/LayerResponseChart";

type Period = "24h" | "7d" | "30d";

interface Props {
  layers?: Layers;
  histories?: Record<Period, HistoryResponse | null>;
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
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-neutral-300" />
          <span className="text-neutral-400 text-sm">{def.label}</span>
        </div>
        <span className="text-neutral-300 text-xs">sem dados</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${statusDotColor(info.status)}`} />
        <span className="text-neutral-600 text-sm">{def.label}</span>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className={`font-medium ${statusTextColor(info.status)}`}>
          {statusText(info.status)}
        </span>
        {info.responseTimeMs != null && info.responseTimeMs > 0 && (
          <span className="text-neutral-400 tabular-nums w-14 text-right">{formatMs(info.responseTimeMs)}</span>
        )}
        <span className="text-neutral-300 w-16 text-right">{timeAgo(info.timestamp)}</span>
      </div>
    </div>
  );
}

export function LayerDetails({ layers, histories }: Props) {
  const [open, setOpen] = useState(false);

  if (!layers) return null;

  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
      >
        <span>Detalhes tecnicos</span>
        <svg
          className={`w-4 h-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-neutral-200">
          <div className="px-4 divide-y divide-neutral-100">
            {LAYER_DEFS.map((def) => (
              <LayerRow key={def.key} def={def} info={layers[def.key]} />
            ))}
          </div>

          {histories && (
            <div className="border-t border-neutral-200 p-4">
              <LayerResponseChart histories={histories} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

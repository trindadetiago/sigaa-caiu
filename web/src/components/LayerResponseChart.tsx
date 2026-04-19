"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { HistoryResponse } from "@/lib/types";

type Period = "24h" | "7d" | "30d";

interface Props {
  histories: Record<Period, HistoryResponse | null>;
}

const LAYERS = [
  { key: "reachability_ms", label: "Servidor", color: "#22c55e" },
  { key: "portal_ms", label: "Portal", color: "#3b82f6" },
  { key: "login_form_ms", label: "Login", color: "#a855f7" },
  { key: "login_e2e_ms", label: "Login E2E", color: "#f97316" },
] as const;

function formatTime(timestamp: string, period: Period): string {
  const date = new Date(timestamp);
  const options: Intl.DateTimeFormatOptions =
    period === "24h"
      ? { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }
      : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" };
  return date.toLocaleString("pt-BR", options);
}

function formatMs(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
}

export function LayerResponseChart({ histories }: Props) {
  const [period, setPeriod] = useState<Period>("24h");
  const history = histories[period];

  const data =
    history?.checks.map((c) => ({
      time: formatTime(c.timestamp, period),
      reachability_ms: c.reachability_ms ?? null,
      portal_ms: c.portal_ms ?? null,
      login_form_ms: c.login_form_ms ?? null,
      login_e2e_ms: c.login_e2e_ms ?? null,
    })) ?? [];

  // Only show layers that have at least one data point.
  const activeLayers = LAYERS.filter((l) =>
    data.some((d) => d[l.key] != null)
  );

  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-neutral-700">
          Tempo de resposta por camada
        </h3>
        <div className="flex gap-1">
          {(["24h", "7d", "30d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                period === p
                  ? "bg-neutral-200 text-neutral-900"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 || activeLayers.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-neutral-400 text-sm">
          Sem dados para este periodo
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatMs(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, name) => {
                const v = Number(value);
                const layer = LAYERS.find((l) => l.key === name);
                return [formatMs(v), layer?.label ?? String(name)];
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: "#737373" }}
              formatter={(value: string) => {
                const layer = LAYERS.find((l) => l.key === value);
                return layer?.label ?? value;
              }}
            />
            {activeLayers.map((layer) => (
              <Line
                key={layer.key}
                type="monotone"
                dataKey={layer.key}
                stroke={layer.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { UptimeStats } from "@/components/UptimeStats";
import { ResponseTimeChart } from "@/components/ResponseTimeChart";
import { IncidentsList } from "@/components/IncidentsList";
import {
  fetchStatus,
  fetchHistory,
  fetchStats,
  fetchIncidents,
} from "@/lib/api";
import type {
  StatusResponse,
  HistoryResponse,
  StatsResponse,
  Incident,
} from "@/lib/types";

type Period = "24h" | "7d" | "30d";

export default function Home() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [histories, setHistories] = useState<
    Record<Period, HistoryResponse | null>
  >({ "24h": null, "7d": null, "30d": null });
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statusRes, statsRes, incidentsRes, h24, h7d, h30d] =
        await Promise.all([
          fetchStatus(),
          fetchStats(),
          fetchIncidents(),
          fetchHistory("24h"),
          fetchHistory("7d"),
          fetchHistory("30d"),
        ]);

      setStatus(statusRes);
      setStats(statsRes);
      setIncidents(incidentsRes.incidents);
      setHistories({ "24h": h24, "7d": h7d, "30d": h30d });
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">SIGAA Caiu?</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Monitor do SIGAA — UFPB
        </p>
      </header>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-6 text-center text-sm text-red-300">
          Erro ao conectar com a API. Tentando novamente em 60s...
        </div>
      )}

      <div className="space-y-6">
        <StatusBadge data={status} />
        <UptimeStats data={stats} />
        <ResponseTimeChart histories={histories} />
        <IncidentsList incidents={incidents} />
      </div>

      <footer className="text-center mt-12 text-xs text-neutral-600">
        <p>
          Verifica o SIGAA a cada 3 minutos. Dados dos ultimos 90 dias.
        </p>
        <p className="mt-1">
          Feito com carinho por alunos da UFPB
        </p>
      </footer>
    </main>
  );
}

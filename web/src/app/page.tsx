"use client";

import { useEffect, useState, useCallback } from "react";
import { HeroStatus } from "@/components/HeroStatus";
import { LayerDetails } from "@/components/LayerDetails";
import { UptimeBars } from "@/components/UptimeBars";
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
type AllPeriod = Period | "90d";

export default function Home() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [histories, setHistories] = useState<
    Record<AllPeriod, HistoryResponse | null>
  >({ "24h": null, "7d": null, "30d": null, "90d": null });
  const [error, setError] = useState(false);

  // Calculate days since last incident
  const daysSinceLastIncident = incidents && incidents.length > 0
    ? Math.floor((Date.now() - new Date(incidents[0].ended_at || incidents[0].started_at).getTime()) / 86_400_000)
    : incidents
      ? null // no incidents ever
      : null;

  const loadData = useCallback(async () => {
    try {
      const [statusRes, statsRes, incidentsRes, h24, h7d, h30d, h90d] =
        await Promise.all([
          fetchStatus(),
          fetchStats(),
          fetchIncidents(),
          fetchHistory("24h"),
          fetchHistory("7d"),
          fetchHistory("30d"),
          fetchHistory("90d"),
        ]);

      setStatus(statusRes);
      setStats(statsRes);
      setIncidents(incidentsRes.incidents);
      setHistories({ "24h": h24, "7d": h7d, "30d": h30d, "90d": h90d });
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
    <>
      {/* Hero — ocupa a tela inteira */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 relative">
        <HeroStatus data={status} error={error} daysSinceLastIncident={daysSinceLastIncident} incidents={incidents} />

        {/* Seta pra descer */}
        <div className="absolute bottom-8 animate-bounce-subtle text-neutral-400">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <title>Descer</title>
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
          </svg>
        </div>
      </section>

      {/* Detalhes — abaixo da dobra */}
      <section className="max-w-2xl mx-auto px-4 py-16 space-y-10">
        <p className="text-sm text-neutral-400 text-center">
          Monitor do SIGAA (Sistema Integrado de Gestao de Atividades Academicas) da UFPB.
          Verificamos automaticamente se o sistema esta no ar, lento ou fora do ar a cada 3 minutos
          com 4 camadas: acesso ao servidor, portal publico, tela de login e login completo.
        </p>
        <UptimeBars history={histories["90d"]} stats={stats} incidents={incidents} />
        <ResponseTimeChart histories={histories} />
        <LayerDetails layers={status?.layers} histories={histories} />
        <IncidentsList incidents={incidents} />

        <footer className="text-center pt-8 text-xs text-neutral-400 flex flex-col items-center gap-3">
          <p>Verifica o SIGAA a cada 3 minutos</p>
          <div className="flex gap-4">
            <a
              href="https://github.com/trindadetiago/sigaa-caiu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <title>GitHub</title>
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              github.com/trindadetiago/sigaa-caiu
            </a>
            <span className="text-neutral-300">·</span>
            <a
              href="https://api.sigaacaiu.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              api.sigaacaiu.com
            </a>
          </div>
        </footer>
      </section>
    </>
  );
}

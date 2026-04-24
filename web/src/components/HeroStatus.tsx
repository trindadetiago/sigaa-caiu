"use client";

import { useMemo } from "react";
import type { StatusResponse, Incident } from "@/lib/types";
import { formatMs, timeAgo } from "@/lib/utils";

interface Props {
  data: StatusResponse | null;
  error: boolean;
  daysSinceLastIncident: number | null;
  incidents: Incident[] | null;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// "O SIGAA caiu?" → Não! (ta online)
const ONLINE_RESPONSES = [
  { emoji: "👍", text: "Nao!", sub: "Milagrosamente funcionando." },
  { emoji: "👍", text: "Nao, ta no ar!", sub: "Aproveita enquanto dura." },
  { emoji: "🎉", text: "Nao!", sub: "Inacreditavel, mas ta funcionando." },
  { emoji: "👍", text: "Nao, pode ir!", sub: "Corre antes que caia." },
  { emoji: "🙏", text: "Nao!", sub: "Gracas a Deus e a STI." },
  { emoji: "👍", text: "Nao!", sub: "Nao, voce nao ta sonhando." },
];

// "O SIGAA caiu?" → Ainda não, mas ta lento...
const SLOW_RESPONSES = [
  { emoji: "🐌", text: "Ainda nao, mas...", sub: "Ta taaao lento que ja ja cai..." },
  { emoji: "😮‍💨", text: "Nao, mas quase", sub: "Ta mais lento que fila do RU." },
  { emoji: "🐢", text: "Mais ou menos", sub: "Ta funcionando em camara lenta." },
  { emoji: "⏳", text: "Nao... ainda", sub: "Pega um cafe enquanto carrega." },
  { emoji: "🦥", text: "Nao, mas ta arrastando", sub: "Mais lento que matricula em periodo." },
];

// "O SIGAA caiu?" → Sim!
const DOWN_RESPONSES = [
  { emoji: "👎", text: "Sim, caiu", sub: "F no chat. Vai tomar um cafe e volta depois." },
  { emoji: "💀", text: "Sim, morreu", sub: "Descanse em paz, SIGAA." },
  { emoji: "👎", text: "Sim", sub: "Surpresa de ninguem." },
  { emoji: "😭", text: "Sim...", sub: "Era previsivel, ne?" },
  { emoji: "🪦", text: "Sim, foi de base", sub: "Causa da morte: ser o SIGAA." },
];

const CHECKING_RESPONSES = [
  { emoji: "🤔", text: "Hmm...", sub: "Parece que oscilou. Verificando se caiu mesmo..." },
  { emoji: "👀", text: "Calma ai...", sub: "To olhando, parece que deu uma tremida." },
  { emoji: "🔍", text: "Investigando...", sub: "Pode ter sido so um soluço." },
];

const RECOVERING_RESPONSES = [
  { emoji: "🤞", text: "Parece que voltou", sub: "Mas nao confia nao, caiu agora pouco." },
  { emoji: "👀", text: "Voltou... sera?", sub: "Ainda ta quente, fica de olho." },
  { emoji: "😅", text: "Voltou, mas...", sub: "Acabou de cair. Nao bota muita fe nao." },
  { emoji: "⚠️", text: "Ta no ar de novo", sub: "Caiu faz pouco, pode oscilar ainda." },
];

export function HeroStatus({ data, error, daysSinceLastIncident, incidents }: Props) {
  const recentlyRecovered = useMemo(() => {
    if (!incidents || incidents.length === 0) return false;
    const lastIncident = incidents[0];
    if (!lastIncident.ended_at) return false;
    const endedAgo = Date.now() - new Date(lastIncident.ended_at).getTime();
    return endedAgo < 10 * 60 * 1000; // 10 minutes
  }, [incidents]);

  const response = useMemo(() => {
    if (error) return null;
    if (!data || !data.lastCheck) return null;

    const isDown = data.status === "offline" && data.confirmed;
    const isSlow = data.status === "degraded";
    const isChecking = data.status === "offline" && !data.confirmed;

    if (isDown) return pickRandom(DOWN_RESPONSES);
    if (isSlow) return pickRandom(SLOW_RESPONSES);
    if (isChecking) return pickRandom(CHECKING_RESPONSES);
    if (recentlyRecovered) return pickRandom(RECOVERING_RESPONSES);
    return pickRandom(ONLINE_RESPONSES);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.status, data?.confirmed, error, recentlyRecovered]);

  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-6">
          O SIGAA caiu?
        </h1>
        <p className="text-2xl text-neutral-400">
          Sei la, a gente tambem ta com problema
        </p>
        <p className="text-sm text-neutral-400 mt-2">
          Erro ao conectar com o monitor. Tentando novamente...
        </p>
      </div>
    );
  }

  if (!data || !data.lastCheck || !response) {
    return (
      <div className="text-center">
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-6">
          O SIGAA caiu?
        </h1>
        <p className="text-2xl text-neutral-400 animate-pulse">
          Verificando...
        </p>
      </div>
    );
  }

  const statusColor =
    data.status === "offline"
      ? "text-red-500"
      : data.status === "degraded" || recentlyRecovered
        ? "text-yellow-500"
        : "text-green-500";

  return (
    <div className="text-center">
      <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-8">
        O SIGAA caiu?
      </h1>

      <div className="text-6xl sm:text-8xl mb-4">{response.emoji}</div>
      <p className={`text-3xl sm:text-4xl font-bold ${statusColor}`}>
        {response.text}
      </p>
      <p className="text-neutral-500 mt-3 text-lg">
        {response.sub}
        {data.status !== "offline" && data.lastCheck.responseTimeMs > 0 && (
          <> Respondendo em {formatMs(data.lastCheck.responseTimeMs)}</>
        )}
      </p>

      {daysSinceLastIncident !== null && daysSinceLastIncident > 0 && data.status !== "offline" && (
        <p className="mt-6 text-sm text-neutral-400">
          Estamos a <span className="font-semibold text-neutral-600">{daysSinceLastIncident} {daysSinceLastIncident === 1 ? "dia" : "dias"}</span> sem o SIGAA cair
          <span className="ml-1 text-neutral-300">#iLoveSigaa</span>
        </p>
      )}

      <p className="text-xs text-neutral-400 mt-4">
        Ultimo check: {timeAgo(data.lastCheck.timestamp)}
      </p>
    </div>
  );
}

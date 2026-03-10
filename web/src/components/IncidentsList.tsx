"use client";

import type { Incident } from "@/lib/types";
import { formatDateTime, formatDuration } from "@/lib/utils";

interface Props {
  incidents: Incident[] | null;
}

export function IncidentsList({ incidents }: Props) {
  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-neutral-700 mb-3">
        Incidentes recentes
      </h3>

      {incidents === null && (
        <div className="animate-pulse space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-8 bg-neutral-200 rounded" />
          ))}
        </div>
      )}

      {incidents && incidents.length === 0 && (
        <p className="text-sm text-neutral-400 py-4 text-center">
          Nenhum incidente recente
        </p>
      )}

      {incidents && incidents.length > 0 && (
        <div className="space-y-2">
          {incidents.map((inc) => (
            <div
              key={inc.id}
              className="flex items-center justify-between text-sm py-2 border-b border-neutral-200 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-neutral-700">
                  {formatDateTime(inc.started_at)}
                </span>
                {inc.ended_at && (
                  <span className="text-neutral-400">
                    — {formatDateTime(inc.ended_at)}
                  </span>
                )}
                {!inc.ended_at && (
                  <span className="text-red-500 text-xs font-medium">
                    EM ANDAMENTO
                  </span>
                )}
              </div>
              {inc.duration_s && (
                <span className="text-neutral-400 text-xs">
                  {formatDuration(inc.duration_s)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import type { CarenciaAnimal } from "./api";
import { dataHoraSanitaria } from "./rotulos";

export function resumoCarencia(estado: CarenciaAnimal["leite"], agora = Date.now(), prazoZero = false): string {
  if (estado.estado === "NENHUMA") return "Sem aplicações válidas";
  if (estado.estado === "NAO_INFORMADO") return "Carência desconhecida — revisar";
  if (estado.estado === "NAO_APLICAVEL") return "Não se aplica — confirmado";
  if (estado.estado !== "CONHECIDO") return "Carência desconhecida — revisar";
  if (estado.prazoZero || prazoZero) return "Sem carência · prazo zero confirmado";
  return `${new Date(estado.ate).getTime() > agora ? "Vigente até" : "Sem carência · encerrada em"} ${estado.precisaoAproximada ? "≈ " : ""}${dataHoraSanitaria(estado.ate)}`;
}

export function CarenciasSanitarias({ carencia }: { carencia: CarenciaAnimal | null }) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const tick = () => setAgora(Date.now());
    const timer = window.setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", tick); };
  }, []);
  return <section className="rounded-lg border border-border p-3 text-sm" aria-label="Carências sanitárias">
    <h3 className="font-semibold">Carências sanitárias</h3>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">{(["leite", "carne"] as const).map((destino) => {
      return <p key={destino}><strong>{destino === "leite" ? "Leite" : "Abate/carne"}:</strong> {destino === "leite" && carencia?.revisaoLeitePendente ? "Aplicabilidade pendente — revisar" : carencia ? resumoCarencia(carencia[destino], agora) : "Carregando…"}</p>;
    })}</div>
    {carencia?.revisaoLeitePendente && <p className="mt-2 text-ink-3">Finalidade alterada: revise a aplicabilidade da carência de leite.</p>}
    <p className="mt-2 text-xs text-ink-3">Carência é o prazo para leite ou abate. O tratamento e seus lançamentos permanecem no histórico.</p>
  </section>;
}

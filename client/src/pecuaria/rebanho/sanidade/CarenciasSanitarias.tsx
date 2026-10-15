import { useEffect, useState } from "react";
import type { CarenciaAnimal } from "./api";
import { CarenciaIndicador } from "./IndicadoresSanitarios";
export { resumoCarencia } from "./carenciaRotulos";

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
    <div className="pec-carencias-grade">{(["leite", "carne"] as const).map((destino) => {
      return <div className="pec-carencia-bloco" key={destino}><strong>{destino === "leite" ? "Leite" : "Abate/carne"}:</strong> {carencia ? <CarenciaIndicador estado={carencia[destino]} agora={agora} revisao={destino === "leite" && carencia.revisaoLeitePendente} /> : "Carregando…"}</div>;
    })}</div>
    {carencia?.revisaoLeitePendente && <p className="mt-2 text-ink-3">Finalidade alterada: revise a aplicabilidade da carência de leite.</p>}
    <p className="mt-2 text-xs text-ink-3">Carência é o prazo para leite ou abate. O tratamento e seus lançamentos permanecem no histórico.</p>
  </section>;
}

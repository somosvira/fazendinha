import { Clock3, Milk, Beef } from "lucide-react";
import { SecaoFicha } from "../components/SecaoRecolhivel";
import { useEffect, useState } from "react";
import type { CarenciaAnimal } from "./api";
import { CarenciaIndicador } from "./IndicadoresSanitarios";
export { resumoCarencia } from "./carenciaRotulos";

export function CarenciasSanitarias({ carencia, integrado = false }: { carencia: CarenciaAnimal | null; integrado?: boolean }) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const tick = () => setAgora(Date.now());
    const timer = window.setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", tick); };
  }, []);
  const conteudo = <>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">{(["leite", "carne"] as const).map((destino) => {
      const Icone = destino === "leite" ? Milk : Beef;
      return <div key={destino} className="carencia-destino"><Icone size={24} aria-hidden /><p><strong>{destino === "leite" ? "Leite" : "Abate/carne"}:</strong> {destino === "leite" && carencia?.revisaoLeitePendente ? "Aplicabilidade pendente — revisar" : carencia ? <CarenciaIndicador estado={carencia[destino]} agora={agora} revisao={destino === "leite" && carencia.revisaoLeitePendente} /> : "Carregando…"}</p></div>;
    })}</div>
    {carencia?.revisaoAdministracaoPendente ? <p className="mt-2 text-ink-3">Administração não confirmada: revise os dados da aplicação e das carências.</p> : carencia?.revisaoLeitePendente && <p className="mt-2 text-ink-3">Finalidade alterada: revise a aplicabilidade da carência de leite.</p>}
    {!integrado && <p className="mt-2 text-xs text-ink-3">Carência é o prazo para leite ou abate. O tratamento e seus lançamentos permanecem no histórico.</p>}
  </>;
  return integrado ? <div className="carencias-sanitarias carencias-sanitarias-integradas text-sm" aria-label="Carências atuais">{conteudo}</div> : <SecaoFicha className="carencias-sanitarias text-sm" titulo={<span className="ficha-titulo-com-icone"><Clock3 size={20} aria-hidden />Carências sanitárias</span>}>{conteudo}</SecaoFicha>;
}

import { Clock3, Milk, Beef } from "lucide-react";
import { SecaoRecolhivel } from "../components/SecaoRecolhivel";
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
  return <SecaoRecolhivel className="carencias-sanitarias text-sm" titulo={<span className="ficha-titulo-com-icone"><Clock3 size={20} aria-hidden />Carências sanitárias</span>}>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">{(["leite", "carne"] as const).map((destino) => {
      const Icone = destino === "leite" ? Milk : Beef;
      return <div key={destino} className="carencia-destino"><Icone size={24} aria-hidden /><p><strong>{destino === "leite" ? "Leite" : "Abate/carne"}:</strong> {destino === "leite" && carencia?.revisaoLeitePendente ? "Aplicabilidade pendente — revisar" : carencia ? resumoCarencia(carencia[destino], agora) : "Carregando…"}</p></div>;
    })}</div>
    {carencia?.revisaoAdministracaoPendente ? <p className="mt-2 text-ink-3">Administração não confirmada: revise os dados da aplicação e das carências.</p> : carencia?.revisaoLeitePendente && <p className="mt-2 text-ink-3">Finalidade alterada: revise a aplicabilidade da carência de leite.</p>}
    <p className="mt-2 text-xs text-ink-3">Carência é o prazo para leite ou abate. O tratamento e seus lançamentos permanecem no histórico.</p>
  </SecaoRecolhivel>;
}

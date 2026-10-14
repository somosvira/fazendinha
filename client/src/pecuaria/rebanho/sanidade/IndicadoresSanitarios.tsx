import type { CarenciaAnimal } from "./api";
import type { ContagensRodada } from "./rodadas-api";
import { resumoCarencia } from "./carenciaRotulos";

export function EstadoSanitario({ children, tom = "neutro" }: { children: React.ReactNode; tom?: "neutro" | "verde" | "atencao" | "alerta" }) {
  return <span className={`pec-estado pec-estado-${tom}`}>{children}</span>;
}

export function rotuloTarefaSanitaria(situacao: string, previstaPara: string, hoje: string): string {
  if (situacao === "REALIZADA") return "Realizada";
  if (situacao === "DISPENSADA") return "Dispensada";
  if (situacao === "EXECUCAO_CANCELADA") return "Execução cancelada";
  if (situacao === "PENDENTE") return previstaPara.slice(0, 10) < hoje ? "Atrasada" : "Pendente";
  return situacao;
}

export function CarenciaIndicador({ estado, agora, revisao = false }: { estado: CarenciaAnimal["leite"]; agora: number; revisao?: boolean }) {
  const tom = revisao || estado.estado === "NAO_INFORMADO" ? "alerta"
    : estado.estado === "CONHECIDO" ? (!estado.prazoZero && new Date(estado.ate).getTime() > agora ? "atencao" : "verde") : "neutro";
  return <EstadoSanitario tom={tom}>{revisao ? "Aplicabilidade pendente — revisar" : resumoCarencia(estado, agora)}</EstadoSanitario>;
}

export function ContagensEtapa({ contagens: c }: { contagens: ContagensRodada }) {
  return <div className="pec-contagens-etapa" aria-label={`${c.total} previstas · ${c.pendentes} pendentes · ${c.realizadas} realizadas · ${c.dispensadas} dispensadas · ${c.atrasadas} atrasadas · ${c.canceladas ?? 0} canceladas`}><span><strong>{c.total}</strong> previstas</span><span><strong>{c.pendentes}</strong> pendentes</span><span><strong>{c.realizadas}</strong> realizadas</span><span><strong>{c.dispensadas}</strong> dispensadas</span><span><strong>{c.atrasadas}</strong> atrasadas</span><span><strong>{c.canceladas ?? 0}</strong> canceladas</span></div>;
}

export function ResumoPaginaSanitaria({ itens }: { itens: Array<{ nome: string; qtd: number }> }) {
  return <div className="pec-resumo-sanitario-inline" aria-label="Resumo da página sanitária">{itens.map(i => <span key={i.nome}><strong>{i.qtd}</strong> {i.nome}</span>)}<small>Nesta página, nos filtros atuais{itens.some(i => i.nome === "atrasadas") ? ". Atrasadas estão incluídas nas pendentes." : ""}</small></div>;
}

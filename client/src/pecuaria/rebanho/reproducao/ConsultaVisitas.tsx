import { Empty, Pill, TabelaFinanceira, dataBR } from "../../../financeiro/financeiro-ui";
import type { VisitaResumo } from "./visitas-api";
import { ICONES_TABELA } from "../../../components/iconesTabela";

const rotuloSituacao = (status: VisitaResumo["status"]) =>
  status === "ABERTA" ? "Aberta" : status === "ENCERRADA" ? "Encerrada" : status === "PARCIAL" ? "Em andamento" : status;

/** A lista usa somente o resumo autorizado; não presume procedimentos ou animais atendidos. */
export function ConsultaVisitas({ visitas, propriedades, podeLancar, sitioSelecionado, onAbrir }: {
  visitas: VisitaResumo[];
  propriedades: { id: number; nome: string }[];
  podeLancar: boolean;
  sitioSelecionado: boolean;
  onAbrir: (id: string) => void;
}) {
  if (!visitas.length) return <Empty><strong className="block font-semibold text-foreground">{sitioSelecionado ? "Nenhuma visita neste sítio." : "Nenhuma visita nos sítios disponíveis."}</strong><p className="mt-2">{podeLancar ? "Use Nova visita para organizar os animais e preparar o atendimento." : "As visitas preparadas para os sítios aos quais você tem acesso aparecerão aqui."}</p></Empty>;
  return <TabelaFinanceira icone={ICONES_TABELA.visita} rotulo="Visitas veterinárias" itens={visitas}
    chaveDe={v => v.id} onAbrir={v => onAbrir(v.id)} colunas={[
      { chave: "nome", titulo: "Visita", principal: true, celula: v => v.nome },
      { chave: "data", titulo: "Data", celula: v => dataBR(v.data) },
      { chave: "sitio", titulo: "Sítio", celula: v => propriedades.find(p => p.id === v.propriedadeId)?.nome ?? "Sítio não informado" },
      { chave: "responsavel", titulo: "Responsável", celula: v => v.responsavel || "Responsável não informado" },
      { chave: "situacao", titulo: "Situação", celula: v => <Pill tone={v.status === "ENCERRADA" ? "neutral" : "amber"}>{rotuloSituacao(v.status)}</Pill> },
    ]} />;
}

import { getHojeISO as hoje } from "../../../lib/hoje";
import { horarioIatf } from "./CampoDataIatf";
import { useEffect, useState } from "react";
import { CabecalhoTabela, dataBR, Empty, ErrorBox, Panel, Pill } from "../../../financeiro/financeiro-ui";
import { obterSugestoesVisita, type SugestoesVisita } from "./visitas-api";
import { navegarPara } from "../../../router";

const origens: Record<string, string> = {
  DIAGNOSTICO_PENDENTE: "Diagnóstico pendente", TENTATIVA: "Diagnóstico pendente",
  AVALIACAO: "Retorno da avaliação", TAREFA_IATF: "Tarefa IATF", PREVISAO_PARTO: "Previsão de parto",
};
const situacoes: Record<string, string> = {
  PREVISAO_PENDENTE: "Previsão a definir: início sem horário", PENDENTE: "Pendente", PREVISTO: "Previsto",
  ATRASADO: "Atrasado", AGUARDANDO_DIAGNOSTICO: "Aguardando diagnóstico",
};

export function AcompanhamentoReprodutivo({ atualizacao, propriedadeId }: { atualizacao: unknown; propriedadeId?: number }) {
  const [dados, setDados] = useState<SugestoesVisita | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let vigente = true;
    setDados(null); setErro(null); setCarregando(true);
    obterSugestoesVisita(hoje(), {}, propriedadeId)
      .then(d => { if (vigente) setDados(d); })
      .catch(e => { if (vigente) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vigente) setCarregando(false); });
    return () => { vigente = false; };
  }, [atualizacao, propriedadeId]);
  const animais = dados ? Array.isArray(dados.animais) ? dados.animais : dados.animais.animais : [];
  return <Panel><CabecalhoTabela titulo="Retornos e previsões" /><div className="p-4 space-y-3"><ErrorBox erro={erro} />
    <p className="text-sm text-ink-3">Datas informadas de retorno, tarefas IATF e previsão de parto. Ausência de diagnóstico permanece pendente, sem presumir resultado.</p>
    {carregando && <p role="status">Carregando acompanhamento…</p>}
    {!carregando && !erro && dados && !dados.retornos?.length && <Empty><strong className="block font-semibold text-foreground">Nenhum retorno ou previsão com os critérios atuais.</strong><p className="mt-2">A agenda reúne as datas registradas nas avaliações e nas programações. Você também pode preparar uma visita pela seleção livre.</p></Empty>}
    {!carregando && !erro && (dados?.retornos ?? []).map(r => <div key={`${r.origem}-${r.origemId}`} className="grid gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="min-w-0"><button className="break-words text-left underline" onClick={() => navegarPara(r.programacaoId ? `/pecuaria/reproducao?programacaoId=${encodeURIComponent(r.programacaoId)}` : `/pecuaria/reproducao?animalId=${encodeURIComponent(r.animalId)}${r.origem === "PREVISAO_PARTO" ? "&acao=parto" : r.origemConsultavel !== false && r.origemId ? `&fatoId=${encodeURIComponent(r.origemId)}` : ""}`)}>{animais.find(a => a.animalId === r.animalId)?.brinco ?? r.animalId}</button><p className="mt-1 text-ink-3">{origens[r.origem] ?? r.origem}</p></div>
      <div><span className="block text-xs text-ink-3">Data prevista</span>{r.status === "PREVISAO_PENDENTE" ? "Data da etapa a definir" : r.origem === "TAREFA_IATF" && r.data ? horarioIatf(r.data, r.precisaoTemporal) : r.data ? <time dateTime={r.data.slice(0, 10)}>{dataBR(r.data)}</time> : "Data de diagnóstico não informada"}</div>
      <span className="self-start justify-self-start"><Pill tone={r.status === "ATRASADO" ? "red" : r.status === "PREVISTO" ? "neutral" : "amber"}>{situacoes[r.status] ?? r.status}</Pill></span>
    </div>)}
    <button className="underline text-sm" onClick={() => navegarPara("/pecuaria/visitas")}>Preparar ou retomar visita</button>
  </div></Panel>;
}

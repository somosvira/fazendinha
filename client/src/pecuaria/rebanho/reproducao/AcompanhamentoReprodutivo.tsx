import { horarioIatf } from "./CampoDataIatf";
import { useEffect, useState } from "react";
import { CabecalhoTabela, ErrorBox, hoje, Panel } from "../../../financeiro/financeiro-ui";
import { obterSugestoesVisita, type SugestoesVisita } from "./visitas-api";
import { navegarPara } from "../../../router";
export function AcompanhamentoReprodutivo({atualizacao}: {atualizacao: unknown}) {
  const [dados, setDados] = useState<SugestoesVisita | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true;
    obterSugestoesVisita(hoje()).then(d => {if(vigente) {setDados(d); setErro(null);}}).catch(e => {if(vigente) setErro(e.message);});
    return () => {vigente = false;};
  }, [atualizacao]);
  const animais = dados ? Array.isArray(dados.animais) ? dados.animais : dados.animais.animais : [];
  return <Panel><CabecalhoTabela titulo="Retornos e previsões" /><div className="p-4 space-y-3"><ErrorBox erro={erro} />
    <p className="text-sm text-ink-3">Datas informadas de retorno, tarefas IATF e previsão de parto. Ausência de diagnóstico permanece pendente, sem presumir resultado.</p>
    {!dados && !erro && <p role="status">Carregando acompanhamento…</p>}
    {dados && !dados.retornos?.length && <p>Nenhum retorno ou previsão com os critérios atuais.</p>}
    {(dados?.retornos ?? []).map(r => <div key={`${r.origem}-${r.origemId}`} className="flex flex-wrap gap-3 text-sm">
      <button className="underline" onClick={() => navegarPara(r.programacaoId ? `/pecuaria/reproducao?programacaoId=${encodeURIComponent(r.programacaoId)}` : `/pecuaria/reproducao?animalId=${encodeURIComponent(r.animalId)}${r.origem === "PREVISAO_PARTO" ? "&acao=parto" : r.origemConsultavel !== false && r.origemId ? `&fatoId=${encodeURIComponent(r.origemId)}` : ""}`)}>{animais.find(a => a.animalId === r.animalId)?.brinco ?? r.animalId}</button>
      <span>{r.origem === "DIAGNOSTICO_PENDENTE" || r.origem === "TENTATIVA" ? "Diagnóstico pendente" : r.origem === "AVALIACAO" ? "Retorno da avaliação" : r.origem === "TAREFA_IATF" ? "Tarefa IATF" : "Previsão de parto"} · {r.status === "PREVISAO_PENDENTE" ? "Data da etapa a definir" : r.origem === "TAREFA_IATF" && r.data ? horarioIatf(r.data, r.precisaoTemporal) : r.data?.slice(0,10) ?? "Data de diagnóstico não informada"} · {({PREVISAO_PENDENTE:"Previsão a definir: início sem horário",PENDENTE:"Pendente", PREVISTO:"Previsto", ATRASADO:"Atrasado", AGUARDANDO_DIAGNOSTICO:"Aguardando diagnóstico"} as Record<string,string>)[r.status] ?? r.status}</span>
    </div>)}
    <button className="underline text-sm" onClick={() => navegarPara("/pecuaria/visitas")}>Preparar ou retomar visita</button>
  </div></Panel>;
}

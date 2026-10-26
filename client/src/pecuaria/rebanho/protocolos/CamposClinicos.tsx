import { AjudaCampo } from "../../../components/Dica";
import { useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { CamposResultadoExame } from "../sanidade/CamposExame";
import type { TarefaOperacional } from "./api";
import { SeletorClinico } from "./SeletorClinico";
import { obterOpcoesClinicas, type DadosClinicos, type AcompanhamentoClinico } from "./clinica-api";
export type TarefaClinica = TarefaOperacional & { acompanhamento?: AcompanhamentoClinico | null; acoes: TarefaOperacional["acoes"] & { reavaliar?: boolean } };
type Props = { tarefa: TarefaOperacional; dados: DadosClinicos; onChange: (patch: Partial<DadosClinicos>) => void; identificacao?: string };
export function CamposTentativaClinica({ tarefa: t, dados: d, onChange, identificacao }: Props) {
  const rotulo = (v: string) => identificacao ? `${v} · ${identificacao}` : v;
  const seletor = (opcao: "MATERIAL" | "PARTIDA" | "SERVICO" | "REPRODUTOR", nome: string, valor: string, mudar: (id: string) => void) => <SeletorClinico tarefaId={t.id} propriedadeId={t.propriedadeId} opcao={opcao} rotulo={rotulo(nome)} valor={valor} materialId={d.materialId} tipoTentativa={d.tipoTentativa === "COBERTURA" ? undefined : d.tipoTentativa} externo={d.reprodutorExterno} onChange={mudar} />;
  return <div className="grid gap-3">
    <label>{rotulo("Tipo de tentativa")}<select className={classeInput} value={d.tipoTentativa} onChange={e => onChange({ tipoTentativa: e.target.value as DadosClinicos["tipoTentativa"], materialId: "", partidaId: "", quantidade: "", touroId: "", touroExternoId: "", ...(e.target.value === "COBERTURA" ? { origem: "DOCUMENTADA" } : {}) })}><option value="IA">Inseminação artificial</option><option value="TE">Transferência de embrião</option><option value="COBERTURA">Cobertura</option></select></label>
    <label className="relative">{rotulo("Origem do material ou reprodutor")}<select className={classeInput} value={d.origem} onChange={e => onChange({ origem: e.target.value as DadosClinicos["origem"], partidaId: "", operacaoServicoId: "" })}><option value="ESTOQUE">Estoque do sítio</option><option value="SERVICO">Incluso em Serviço</option><option value="DOCUMENTADA">Origem documentada</option></select><span className="absolute right-0 top-0"> <AjudaCampo rotulo="Ajuda sobre a genética da tentativa" texto="A tentativa mantém genética e origem próprias. A confirmação não comprova gestação."/></span></label>
    {d.tipoTentativa === "COBERTURA" ? <><label>{rotulo("Cadastro do reprodutor")}<select className={classeInput} value={String(d.reprodutorExterno)} onChange={e => onChange({ reprodutorExterno: e.target.value === "true", touroId: "", touroExternoId: "" })}><option value="true">Reprodutor externo</option><option value="false">Animal do rebanho</option></select></label>{seletor("REPRODUTOR", "reprodutor", d.reprodutorExterno ? d.touroExternoId : d.touroId, id => onChange(d.reprodutorExterno ? { touroExternoId: id, touroId: "" } : { touroId: id, touroExternoId: "" }))}</> : <>{seletor("MATERIAL", "material genético", d.materialId, materialId => onChange({ materialId, partidaId: "" }))}<label>{rotulo("Quantidade por animal")}<input className={classeInput} type="number" min="0.001" step="0.001" value={d.quantidade} onChange={e => onChange({ quantidade: e.target.value })} /></label>{d.origem === "ESTOQUE" && d.materialId && seletor("PARTIDA", "lote do material", d.partidaId, partidaId => onChange({ partidaId }))}</>}
    {d.origem === "SERVICO" && seletor("SERVICO", "Serviço", d.operacaoServicoId, operacaoServicoId => onChange({ operacaoServicoId }))}
    {d.origem === "DOCUMENTADA" && <label>{rotulo("Justificativa da origem documentada")}<textarea className={classeInput} minLength={5} maxLength={1000} value={d.justificativaSemOrigem} onChange={e => onChange({ justificativaSemOrigem: e.target.value })} /></label>}
    {d.tipoTentativa !== "COBERTURA" && <><label className="flex gap-2"><input type="checkbox" checked={d.cienciaValidadeDesconhecida} onChange={e => onChange({ cienciaValidadeDesconhecida: e.target.checked })} />{rotulo("Confirmo ciência da validade desconhecida, quando aplicável")}</label><label className="flex gap-2"><input type="checkbox" checked={d.documentacaoExcepcional} onChange={e => onChange({ documentacaoExcepcional: e.target.checked })} />{rotulo("Documentar uso excepcional de material vencido")}</label>{d.documentacaoExcepcional && <label>{rotulo("Motivo da documentação excepcional")}<textarea className={classeInput} minLength={5} maxLength={1000} value={d.motivoDocumentacaoExcepcional} onChange={e => onChange({ motivoDocumentacaoExcepcional: e.target.value })} /></label>}</>}

  </div>;
}
export function CamposAvaliacaoClinica({ tarefa: t, dados: d, onChange }: Props) {
  const rotulo = (v: string) => `${v} · ${t.animal.brinco}`;
  return <div className="grid gap-3">
    <label>{rotulo("Resultado da avaliação")}<select className={classeInput} value={d.resultado} onChange={e => onChange({ resultado: e.target.value, ...(e.target.value === "NEGATIVO" ? { sexoFetal: "" } : {}) })}><option value="">Informe o resultado observado</option><option value="POSITIVO">Gestação confirmada</option><option value="NEGATIVO">Gestação não confirmada</option><option value="INCONCLUSIVO">Inconclusivo</option><option value="RECONFIRMACAO">Gestação conhecida reconfirmada</option><option value="SEXAGEM">Sexagem de gestação conhecida</option></select></label>
    <label>{rotulo("Finalidade do exame")}<select className={classeInput} value={d.finalidade} onChange={e => onChange({ finalidade: e.target.value as DadosClinicos["finalidade"] })}><option value="DIAGNOSTICO">Diagnóstico</option><option value="RECONFIRMACAO">Reconfirmação</option><option value="SEXAGEM">Sexagem</option></select></label>
    {d.formato?.campos && <CamposResultadoExame campos={d.formato.campos.filter(c => !["CONCLUSAO_GESTACIONAL", "SEXO_FETAL"].includes(c.codigo))} valores={d.resultados} onChange={resultados => onChange({ resultados })} />}
    <SeletorClinico tarefaId={t.id} propriedadeId={t.propriedadeId} opcao="TENTATIVA" rotulo={rotulo("tentativa de origem")} valor={d.tentativaId} onChange={tentativaId => onChange({ tentativaId })} />
    <SeletorClinico tarefaId={t.id} propriedadeId={t.propriedadeId} opcao="GESTACAO" rotulo={rotulo("gestação conhecida")} valor={d.gestacaoId} onChange={gestacaoId => onChange({ gestacaoId })} />
    <label>{rotulo("Motivo de vínculo desconhecido, se necessário")}<textarea className={classeInput} minLength={5} maxLength={1000} value={d.motivoVinculoDesconhecido} onChange={e => onChange({ motivoVinculoDesconhecido: e.target.value })} /></label>
    <label>{rotulo("Sexo fetal observado")}<select className={classeInput} value={d.sexoFetal} onChange={e => onChange({ sexoFetal: e.target.value })}><option value="">Não informado</option><option value="F">Fêmea</option><option value="M">Macho</option></select></label>
    <label>{rotulo("Retorno definido pelo responsável (opcional)")}<input className={classeInput} type="date" value={d.retornoEm} onChange={e => onChange({ retornoEm: e.target.value })} /></label>
    <label>{rotulo("Previsão de parto informada (opcional)")}<input className={classeInput} type="date" value={d.previsaoParto} onChange={e => onChange({ previsaoParto: e.target.value })} /></label>
    {d.resultado === "INCONCLUSIVO" && <p className="text-sm">O exame inconclusivo permanece como fato. Acompanhamento e nova avaliação preservam esse histórico.</p>}
    <ReavaliacaoClinica tarefa={t} dados={d} onChange={onChange} />
  </div>;
}
function ReavaliacaoClinica({ tarefa, dados, onChange }: Props) {
  const t = tarefa as TarefaClinica;
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState<string | null>(null);
  if (!t.acoes.reavaliar && t.acompanhamento?.estado !== "PENDENTE") return null;
  async function vincular() {
    if (ocupado) return; setOcupado(true); setErro(null);
    try {
      const pagina = await obterOpcoesClinicas(t.id, t.propriedadeId, "TIPO_EXAME", 1, "", dados.tipoExameId || undefined);
      const demanda = pagina.acompanhamento;
      if (!demanda || demanda.estado !== "PENDENTE") throw new Error("O acompanhamento mudou. Feche o editor e atualize esta tarefa.");
      onChange({ demandaAcompanhamentoId: demanda.id, reavaliacao: true, finalidade: demanda.finalidade as DadosClinicos["finalidade"], tentativaId: demanda.tentativaId ?? "", gestacaoId: demanda.gestacaoId ?? "" });
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  return <section className="grid gap-2 border-t border-border pt-3"><p>Há acompanhamento pendente deste animal. A reavaliação cria outro exame e conserva o procedimento anterior.</p><a className="text-sm underline" href={`/pecuaria/reproducao?animalId=${t.animal.id}&participacaoId=${t.participacaoId}&propriedadeId=${t.propriedadeId}`}>Consultar histórico do acompanhamento</a><ErrorBox erro={erro} />{dados.demandaAcompanhamentoId ? <p role="status">Nova avaliação vinculada ao acompanhamento pendente.</p> : <Button secondary type="button" disabled={ocupado} onClick={() => void vincular()}>{ocupado ? "Conferindo acompanhamento…" : "Vincular esta reavaliação"}</Button>}</section>;
}

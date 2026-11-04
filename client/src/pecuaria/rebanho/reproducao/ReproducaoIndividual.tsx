import { Button } from "../../../components/ui/button";
import { listarDemandasAcompanhamento, type ResumoAcompanhamentos } from "./acompanhamento-api";
import { FormParticipacaoIndividual } from "../protocolos/FormParticipacaoIndividual";
import { navegarPara } from "../../../router";
import { useCallback, useEffect, useRef, useState } from "react";
import { HeartPulse, Syringe, GitBranch, Target, History, ClipboardList, CircleDollarSign, Clock } from "lucide-react";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO } from "../../../lib/hoje";
import { CustosDiretos } from "../custos/CustosDiretos";
import { SecaoGeralAnimal } from "../components/SecaoGeralAnimal";
import { obterReproducao, type PainelReprodutivo } from "./api";
import { AcoesReprodutivas } from "./AcoesReprodutivas";
import { DetalheFato } from "./DetalheFato";
import { DemandasAcompanhamento, type DemandaAcompanhamento } from "./DemandasAcompanhamento";
import { ElegibilidadeAnimal } from "./ElegibilidadeAnimal";
import { FormReproducao, type AcaoReprodutiva } from "./FormReproducao";
import { HistoricoReprodutivo, rotulosReprodutivos, type FatoHistorico } from "./HistoricoReprodutivo";
import { ProtocolosReprodutivosAnimal, useHistoricoProtocolosReprodutivos } from "./ProtocolosReprodutivosAnimal";
import { SecaoReproducaoAnimal } from "./SecaoReproducaoAnimal";
import { AcompanhamentoAtualAnimal, separarAcompanhamento } from "./AcompanhamentoAtualAnimal";
import type { MarcoReprodutivo } from "./CirculoMarcosReprodutivos";
import "./reproducao-individual.css";
import { EsqueletoLista } from "../../../components/Esqueleto";

export function motivoIntervaloAusente(rotulo: string, marcos: MarcoReprodutivo[]) {
  const origem = /liberação/i.test(rotulo) ? "LIBERACAO" : /PEV/i.test(rotulo) ? "FIM_PEV" : "PARTO";
  const nomes = { LIBERACAO: "liberação comprovada", FIM_PEV: "fim do PEV", PARTO: "parto registrado", PRIMEIRO_SERVICO: "primeira tentativa" };
  const ausentes = ([origem, "PRIMEIRO_SERVICO"] as const).filter(id => !marcos.some(m => m.id === id && m.data));
  return ausentes.length ? `Sem ${ausentes.map(id => nomes[id]).join(" e ")}` : "Marcos sem sequência cronológica válida";
}

function animalGestacaoVinculada(painel: PainelReprodutivo, tentativaId: string) {
  return painel.animais.some(a => a.gestacao?.tentativaId === tentativaId && a.situacao === "GESTANTE");
}
export type ReproducaoIndividualProps = { animalId: string; propriedadeId?: number | null; podeLancar: boolean; recarregarToken?: number; onSituacao?: (situacao: string | null) => void; onMudou?: () => void };
/** A identidade do contexto desmonta formulários e invalida leituras ao trocar animal/sítio. */
export function ReproducaoIndividual(props: ReproducaoIndividualProps) {
  return <ConteudoReproducao key={`${props.animalId}:${props.propriedadeId ?? "consolidado"}`} {...props}/>;
}
function ConteudoReproducao({ animalId, propriedadeId, podeLancar, recarregarToken = 0, onSituacao, onMudou }: ReproducaoIndividualProps) {
  const [visualHistorico,setVisualHistorico]=useState<"linha"|"tabela">("linha");
  const [revisaoProtocolos, setRevisaoProtocolos] = useState(0);
  const [iniciandoProtocolo, setIniciandoProtocolo] = useState(false);
  const [painel, setPainel] = useState<PainelReprodutivo | null>(null);
  const [resumoDemandas, setResumoDemandas] = useState<ResumoAcompanhamentos | null>(null);
  const [proximaDemanda, setProximaDemanda] = useState<DemandaAcompanhamento | null>(null);
  const [erroDemandas, setErroDemandas] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [acao, setAcao] = useState<AcaoReprodutiva | null>(() => new URLSearchParams(window.location.search).get("acao") === "parto" && podeLancar ? "parto" : null);
  const [demanda, setDemanda] = useState<DemandaAcompanhamento | null>(null);
  const [fato, setFato] = useState<FatoHistorico | null>(null);
  const { eventos: eventosProtocolos, erro: erroHistoricoProtocolos } = useHistoricoProtocolosReprodutivos(animalId, propriedadeId ?? undefined, recarregarToken + revisaoProtocolos);
  const geracao = useRef(0);
  const carregar = useCallback(async () => {
    const g = ++geracao.current;
    setCarregando(true); setErro(null);
    try { const dados = await obterReproducao(animalId, propriedadeId ?? undefined); if (g === geracao.current) setPainel(dados); }
    catch (e) { if (g === geracao.current) setErro(e instanceof Error ? e.message : String(e)); }
    finally { if (g === geracao.current) setCarregando(false); }
  }, [animalId, propriedadeId]);
  useEffect(() => { void carregar(); return () => { geracao.current++; }; }, [carregar, recarregarToken]);
  const fatos: FatoHistorico[] = painel ? [
    ...painel.tentativas.map(f => ({ ...f, grupo: "Tentativa", resultado: (painel.gestacoes ?? []).some(g => g.tentativaId === f.id && g.status !== "ANULADO" && !g.encerradaEm) || animalGestacaoVinculada(painel, f.id) ? "Gestação confirmada" : f.resultado })),
    ...painel.avaliacoes.map(f => ({ ...f, grupo: "Avaliação" })),
    ...painel.partos.map(f => ({ ...f, grupo: "Parto" })),
    ...(painel.situacoesIniciais ?? []).map(f => ({ ...f, tipo: f.situacao, grupo: "Situação inicial" })),
    ...painel.restricoes.map(f => ({ ...f, data: f.data ?? "", grupo: "Restrição" })),
    ...(painel.gestacoes ?? []).flatMap(g => g.animalId ? [
      ...(g.confirmadaEm ? [{ ...g, animalId: g.animalId, data: g.confirmadaEm, tipo: "GESTANTE", grupo: "Gestação", chaveHistorico: `gestacao:confirmacao:${g.id}` }] : []),
      ...(g.encerradaEm ? [{ ...g, animalId: g.animalId, data: g.encerradaEm, tipo: g.tipoEncerramento ?? "ENCERRADA", motivo: g.motivoEncerramento, grupo: "Gestação", chaveHistorico: `gestacao:encerramento:${g.id}` }] : []),
    ] : []),
  ].filter(f => f.animalId === animalId).sort((a, b) => b.data.localeCompare(a.data) || a.id.localeCompare(b.id)) : [];
  useEffect(() => {
    const abrirUrl = () => { const p = new URLSearchParams(window.location.search); const id = p.get("fatoId") ?? p.get("tentativaId"); setFato(id ? fatos.find(f => f.id === id || f.exame?.id === id) ?? null : null); };
    abrirUrl(); window.addEventListener("popstate", abrirUrl); return () => window.removeEventListener("popstate", abrirUrl);
  }, [painel]);
  useEffect(() => {
    let vigente = true; setResumoDemandas(null); setProximaDemanda(null); setErroDemandas(null);
    if (propriedadeId != null && painel?.animais.some(a => a.animalId === animalId)) void listarDemandasAcompanhamento(propriedadeId, animalId, 1, "PENDENTE", "", 1).then(d => { if (vigente) { setResumoDemandas(d.resumo); setProximaDemanda(d.itens[0] ?? null); } }).catch(e => { if (vigente) setErroDemandas(e instanceof Error ? e.message : String(e)); });
    return () => { vigente = false; };
  }, [animalId, propriedadeId, recarregarToken, painel]);
  const animal = painel?.animais.find(a => a.animalId === animalId);
  useEffect(() => { onSituacao?.(carregando || erro ? null : animal?.situacao ?? null); }, [onSituacao, animal?.situacao, carregando, erro]);
  const resumo = animal?.resumoAcompanhamento ?? null;
  const referencia = resumo?.referencia;

  const gestante = animal?.situacao === "GESTANTE";
  const acompanhamento = separarAcompanhamento([...fatos, ...eventosProtocolos], referencia);
  const fecharFato = () => { setFato(null); const url = new URL(window.location.href); url.searchParams.delete("fatoId"); url.searchParams.delete("tentativaId"); window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash); };
  const fechar = () => { setAcao(null); setDemanda(null); const url = new URL(window.location.href); url.searchParams.delete("acao"); window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash); };
  const atualizar = async () => { setRevisaoProtocolos(v => v + 1); await carregar(); onMudou?.(); };
  return <div className="repro-individual">
    <ErrorBox erro={erro}/>{erro && <Button variant="outline" onClick={() => void carregar()}>Tentar novamente</Button>}
    {carregando && <EsqueletoLista label="Carregando reprodução" />}
    {painel && <>
      {animal ? <dl className="repro-metricas repro-metricas-com-icone repro-metricas-duas" aria-label="Resumo reprodutivo">
        <div><dt><HeartPulse aria-hidden="true"/>Situação reprodutiva</dt><dd>{rotulosReprodutivos[animal.situacao] ?? animal.situacao}</dd></div>
        <div><dt><Syringe aria-hidden="true"/>Tentativas no ciclo</dt><dd>{resumo ? resumo.tentativas > 0 ? `${resumo.tentativas}ª tentativa` : "Sem tentativa registrada" : "Contagem não informada"}</dd><small>{gestante ? "Gestação confirmada" : referencia ? `${referencia.tipo === "SITUACAO_INICIAL" ? "Situação inicial" : referencia.tipo === "ABORTO" ? "Aborto registrado" : "Último parto registrado"} · ${formatBRDateISO(referencia.data)}` : resumo ? "Início não comprovado" : "Referência não informada"}</small></div>
      </dl> : <p className="text-sm text-ink-3">Consulta histórica neste sítio; o animal não pertence ao efetivo atual.</p>}
      {(gestante || (painel.gestacoes ?? []).some(g => g.animalId === animalId)) && <AcoesReprodutivas modo="gestacao" painel={painel} animalId={animalId} propriedadeId={propriedadeId ?? undefined} podeLancar={podeLancar} onMudou={atualizar}/>}
      <SecaoGeralAnimal id="acompanhamento-reprodutivo" icon={GitBranch} titulo="Acompanhamento atual" acao={podeLancar ? <div className="flex flex-wrap gap-2"><Button disabled={gestante} title={gestante ? "Indisponível: gestação confirmada" : undefined} onClick={() => {setDemanda(null);setAcao("tentativa");}}>Registrar tentativa</Button><Button onClick={() => {setDemanda(null);setAcao("avaliacao");}}>Avaliação avulsa</Button><Button onClick={() => {setDemanda(null);setAcao("parto");}}>Registrar parto</Button></div> : undefined}>
        {gestante && <p className="text-sm text-ink-3 mb-4">Gestação confirmada · nova tentativa indisponível.</p>}
        {erroHistoricoProtocolos && <p role="alert">Histórico de protocolos não consultado: {erroHistoricoProtocolos}</p>}
        <AcompanhamentoAtualAnimal fatos={acompanhamento.atuais} onAbrir={setFato}/>
      </SecaoGeralAnimal>
      <div id="agendamentos-reprodutivos-animal">
        {erroDemandas && <p role="alert">Acompanhamentos não consultados: {erroDemandas}</p>}
        {animal && propriedadeId != null ? <DemandasAcompanhamento naFicha resumo={resumoDemandas} proxima={proximaDemanda} animalId={animalId} propriedadeId={propriedadeId} painel={painel} podeLancar={podeLancar} atualizacao={recarregarToken} onMudou={atualizar} onAvaliar={d => { setDemanda(d); setAcao("avaliacao"); }}/> : <p>Selecione o sítio para consultar os agendamentos reprodutivos.</p>}
      </div>
      <SecaoGeralAnimal icon={ClipboardList} titulo="Protocolos reprodutivos" id="protocolos-reprodutivos-animal" acao={podeLancar && propriedadeId != null ? <Button disabled={gestante} title={gestante ? "Indisponível: gestação confirmada" : undefined} onClick={() => setIniciandoProtocolo(true)}>Iniciar protocolo individual</Button> : undefined}>
        {iniciandoProtocolo && propriedadeId != null && <FormParticipacaoIndividual animalId={animalId} propriedadeId={propriedadeId} onFechar={() => setIniciandoProtocolo(false)} onSalvo={id => { setIniciandoProtocolo(false); navegarPara(`/pecuaria/reproducao/participacoes/${encodeURIComponent(id)}?sitio=${propriedadeId}&retorno=${encodeURIComponent(window.location.pathname + window.location.search)}`); }} />}
        <ProtocolosReprodutivosAnimal animalId={animalId} propriedadeId={propriedadeId ?? undefined} podeLancar={podeLancar} aoSalvar={() => void atualizar()} revisao={recarregarToken + revisaoProtocolos}/>
      </SecaoGeralAnimal>
      <SecaoGeralAnimal icon={Target} titulo="Aptidão e liberação" id="aptidao-reprodutiva-animal">
        {gestante && <p className="text-sm text-ink-3 mb-4">Gestante — indisponível para nova reprodução. As avaliações e liberações abaixo são antecedentes, não pendências da gestação atual.</p>}
        {animal && (propriedadeId != null ? <ElegibilidadeAnimal naFicha animalId={animalId} propriedadeId={propriedadeId} painel={painel} podeLancar={podeLancar} onMudou={() => void atualizar()}/> : <p>É necessário o sítio comprovado no histórico de localização.</p>)}
        <SecaoReproducaoAnimal titulo="Restrições reprodutivas" icon={HeartPulse} acao={podeLancar ? <Button onClick={() => {setDemanda(null);setAcao("restricao");}}>Registrar restrição</Button> : undefined}>
          <AcoesReprodutivas modo="restricoes" painel={painel} animalId={animalId} propriedadeId={propriedadeId ?? undefined} podeLancar={podeLancar} onMudou={atualizar}/>
        </SecaoReproducaoAnimal>
      </SecaoGeralAnimal>

        <SecaoGeralAnimal id="intervalos-reprodutivos-animal" titulo="Intervalos reprodutivos" icon={Clock}>
          {(painel.marcos?.intervalos ?? []).length ? <dl className="repro-metricas">{painel.marcos!.intervalos!.map(i => <div key={i.rotulo}><dt>{i.rotulo.replace(/primeiro serviço/gi, "primeira tentativa")}</dt><dd>{i.dias == null ? motivoIntervaloAusente(i.rotulo, painel.marcos?.marcos ?? []) : `${i.dias} dias`}</dd></div>)}</dl> : <p>Sem intervalos aferidos.</p>}
          {!!painel.marcos?.pendencias?.length && <div className="repro-pendencias"><h4>Informações a conferir</h4><ul>{painel.marcos.pendencias.map(p => <li key={p}>{p === "Não há início de ciclo comprovado." ? "Não há parto ou situação inicial que comprove o início do acompanhamento." : p}</li>)}</ul></div>}
        </SecaoGeralAnimal>
      <SecaoGeralAnimal icon={History} titulo="Histórico reprodutivo" id="historico-reprodutivo-animal" acao={<div className="flex flex-wrap gap-2"><Button variant={visualHistorico==="linha"?"default":"outline"} aria-pressed={visualHistorico==="linha"} onClick={()=>setVisualHistorico("linha")}>Linha do tempo</Button><Button variant={visualHistorico==="tabela"?"default":"outline"} aria-pressed={visualHistorico==="tabela"} onClick={()=>setVisualHistorico("tabela")}>Tabela</Button>{podeLancar && <Button variant="outline" onClick={() => {setDemanda(null);setAcao("situacao");}}>Registrar situação inicial</Button>}</div>}>
        {erroHistoricoProtocolos && <p role="alert">Histórico de protocolos não consultado: {erroHistoricoProtocolos}</p>}
        {animal && <p className="text-sm text-ink-3 mb-4">{animal.partos} partos no total · {painel.partos.filter(p => p.status !== "ANULADO").length} registros detalhados disponíveis nesta consulta</p>}
        <HistoricoReprodutivo visual={visualHistorico} fatos={acompanhamento.anteriores} animalId={animalId} propriedadeId={propriedadeId ?? undefined} onAbrir={setFato}/>
      </SecaoGeralAnimal>
      {propriedadeId != null && <SecaoGeralAnimal icon={CircleDollarSign} titulo="Custos da reprodução" id="custos-reproducao-animal"><CustosDiretos mediaPorTentativa mostrarTitulo={false} animalId={animalId} propriedadeId={propriedadeId} podeLancar={podeLancar} finalidadeInicial="REPRODUCAO"/></SecaoGeralAnimal>}


    </>}
    {fato && <DetalheFato fato={fato} podeLancar={podeLancar} onFechar={fecharFato} onMudou={() => { fecharFato(); void atualizar(); }}/>}
    {acao && painel && podeLancar && <FormReproducao acao={acao} painel={painel} animalInicial={animalId} propriedadeId={propriedadeId ?? undefined} demandaInicial={demanda ?? undefined} finalidadeInicial={demanda?.finalidade} tipoExameInicial={demanda?.regraSnapshot.tipoExameId ?? undefined} onFechar={fechar} onSalvo={() => { fechar(); void atualizar(); }}/>}
  </div>;
}

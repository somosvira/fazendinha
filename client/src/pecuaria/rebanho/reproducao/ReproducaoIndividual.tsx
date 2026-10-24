import { listarDemandasAcompanhamento, type ResumoAcompanhamentos } from "./acompanhamento-api";
import { ParticipacoesIndividuais } from "../protocolos/ParticipacoesIndividuais";
import { FormParticipacaoIndividual } from "../protocolos/FormParticipacaoIndividual";
import { navegarPara } from "../../../router";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Circle, Syringe } from "lucide-react";
import { Button, ErrorBox, Pill } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO } from "../../../lib/hoje";
import { CustosDiretos } from "../custos/CustosDiretos";
import { MenuAcoesFicha } from "../components/MenuAcoesFicha";
import { SecaoRecolhivel, SecaoFicha } from "../components/SecaoRecolhivel";
import { obterReproducao, type PainelReprodutivo } from "./api";
import { AcoesReprodutivas } from "./AcoesReprodutivas";
import { DetalheFato } from "./DetalheFato";
import { DemandasAcompanhamento, type DemandaAcompanhamento } from "./DemandasAcompanhamento";
import { ElegibilidadeAnimal } from "./ElegibilidadeAnimal";
import { FormReproducao, type AcaoReprodutiva } from "./FormReproducao";
import { HistoricoReprodutivo, rotulosReprodutivos, type FatoHistorico } from "./HistoricoReprodutivo";
import { ProtocolosAnimal } from "./ProtocolosAnimal";
import "./reproducao-individual.css";

export type ReproducaoIndividualProps = { animalId: string; propriedadeId?: number | null; podeLancar: boolean; recarregarToken?: number; onSituacao?: (situacao: string | null) => void };
/** A identidade do contexto desmonta formulários e invalida leituras ao trocar animal/sítio. */
export function ReproducaoIndividual(props: ReproducaoIndividualProps) {
  return <ConteudoReproducao key={`${props.animalId}:${props.propriedadeId ?? "consolidado"}`} {...props}/>;
}
function ConteudoReproducao({ animalId, propriedadeId, podeLancar, recarregarToken = 0, onSituacao }: ReproducaoIndividualProps) {
  const [revisaoProtocolos, setRevisaoProtocolos] = useState(0);
  const [iniciandoProtocolo, setIniciandoProtocolo] = useState(false);
  const [painel, setPainel] = useState<PainelReprodutivo | null>(null);
  const [resumoDemandas, setResumoDemandas] = useState<ResumoAcompanhamentos | null>(null);
  const [erroDemandas, setErroDemandas] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [acao, setAcao] = useState<AcaoReprodutiva | null>(() => new URLSearchParams(window.location.search).get("acao") === "parto" && podeLancar ? "parto" : null);
  const [demanda, setDemanda] = useState<DemandaAcompanhamento | null>(null);
  const [fato, setFato] = useState<FatoHistorico | null>(null);
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
    ...painel.tentativas.map(f => ({ ...f, grupo: "Tentativa" })),
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
    let vigente = true; setResumoDemandas(null); setErroDemandas(null);
    if (propriedadeId != null && painel?.animais.some(a => a.animalId === animalId)) void listarDemandasAcompanhamento(propriedadeId, animalId, 1, "PENDENTE", "", 1).then(d => { if (vigente) setResumoDemandas(d.resumo); }).catch(e => { if (vigente) setErroDemandas(e instanceof Error ? e.message : String(e)); });
    return () => { vigente = false; };
  }, [animalId, propriedadeId, recarregarToken, painel]);
  const animal = painel?.animais.find(a => a.animalId === animalId);
  useEffect(() => { onSituacao?.(carregando || erro ? null : animal?.situacao ?? null); }, [onSituacao, animal?.situacao, carregando, erro]);
  const resumo = animal?.resumoAcompanhamento ?? null;
  const referencia = resumo?.referencia;

  const fecharFato = () => { setFato(null); const url = new URL(window.location.href); url.searchParams.delete("fatoId"); url.searchParams.delete("tentativaId"); window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash); };
  const fechar = () => { setAcao(null); setDemanda(null); const url = new URL(window.location.href); url.searchParams.delete("acao"); window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash); };
  const atualizar = async () => { setRevisaoProtocolos(v => v + 1); await carregar(); };
  return <div className="repro-individual">
    <ErrorBox erro={erro}/>{erro && <Button secondary onClick={() => void carregar()}>Tentar novamente</Button>}
    {carregando && <p role="status">Carregando reprodução…</p>}
    {painel && <>
      {podeLancar && <div className="repro-acoes-diretas" aria-label="Registrar reprodução">
        {([["avaliacao", "Avaliação avulsa"], ["tentativa", "Registrar tentativa"], ["parto", "Registrar parto"]] as const).map(([id, rotulo]) => <Button key={id} secondary onClick={() => { setDemanda(null); setAcao(id); }}>{rotulo}</Button>)}
        <MenuAcoesFicha rotulo="Outros registros" itens={([["situacao", "Registrar situação inicial"], ["restricao", "Registrar restrição"]] as const).map(([id, rotulo]) => ({ id, rotulo, onSelect: () => { setDemanda(null); setAcao(id); } }))}/>
      </div>}
      {animal ? <dl className="repro-ciclo repro-resumo-acompanhamento">
        <div><Circle aria-hidden="true" size={25}/><div><dt>Situação reprodutiva</dt><dd><Pill tone={animal?.situacao === "GESTANTE" ? "green" : "amber"}>{rotulosReprodutivos[animal?.situacao ?? "DESCONHECIDA"] ?? animal?.situacao}</Pill></dd></div></div>
        <div><Syringe aria-hidden="true" size={25}/><div><dt>Tentativas</dt><dd>{resumo ? <>{resumo.tentativas} {referencia ? referencia.tipo === "SITUACAO_INICIAL" ? "desde o início registrado" : "desde o último parto registrado" : "no histórico disponível"}</> : "Contagem não informada"}</dd></div></div>
        <div><CalendarDays aria-hidden="true" size={25}/><div><dt>Referência</dt><dd>{referencia ? `${referencia.tipo === "SITUACAO_INICIAL" ? "Situação inicial" : referencia.tipo === "ABORTO" ? "Aborto registrado" : "Último parto registrado"} · ${formatBRDateISO(referencia.data)}` : resumo ? "Início não comprovado" : "Referência não informada"}</dd></div></div>
      </dl> : <p className="text-sm text-ink-3">Consulta histórica neste sítio; o animal não pertence ao efetivo atual.</p>}
      {erroDemandas ? <p role="alert">Acompanhamentos não consultados: {erroDemandas}</p> : resumoDemandas && resumoDemandas.pendentes > 0 && <p className="text-sm">{resumoDemandas.pendentes} acompanhamento{resumoDemandas.pendentes === 1 ? " pendente" : "s pendentes"}. Consulte os exames e as próximas avaliações abaixo.</p>}
      <SecaoRecolhivel titulo="Protocolos reprodutivos" id="protocolos-reprodutivos-animal" acoes={podeLancar && propriedadeId != null ? <Button secondary onClick={() => setIniciandoProtocolo(true)}>Iniciar protocolo individual</Button> : undefined}>
        {iniciandoProtocolo && propriedadeId != null && <FormParticipacaoIndividual animalId={animalId} propriedadeId={propriedadeId} onFechar={() => setIniciandoProtocolo(false)} onSalvo={id => { setIniciandoProtocolo(false); navegarPara(`/pecuaria/reproducao/participacoes/${encodeURIComponent(id)}?sitio=${propriedadeId}&retorno=${encodeURIComponent(window.location.pathname + window.location.search)}`); }} />}
        <ParticipacoesIndividuais animalId={animalId} tipo="REPRODUTIVO" podeLancar={podeLancar} aoSalvar={()=>{setRevisaoProtocolos(v=>v+1);void carregar();}} revisao={recarregarToken + revisaoProtocolos} propriedadeId={propriedadeId ?? undefined} />
        <ProtocolosAnimal animalId={animalId} propriedadeId={propriedadeId} podeLancar={podeLancar} aoSalvar={()=>{setRevisaoProtocolos(v=>v+1);void carregar();}} revisao={recarregarToken + revisaoProtocolos}/>
      </SecaoRecolhivel>
      <SecaoFicha titulo={animal ? "Aptidão e intervalos" : "Intervalos comprovados"} id="aptidao-reprodutiva-animal">
        {animal && (propriedadeId != null ? <ElegibilidadeAnimal animalId={animalId} propriedadeId={propriedadeId} painel={painel} podeLancar={podeLancar} onMudou={() => void carregar()}/> : <p>É necessário o sítio comprovado no histórico de localização.</p>)}
        <section className="repro-intervalos" aria-label="Intervalos comprovados"><dl>{(painel.marcos?.intervalos ?? []).map(i => <div key={i.rotulo}><dt>{i.rotulo}</dt><dd>{i.dias == null ? "Não aferido" : `${i.dias} dias`}</dd></div>)}</dl>{!painel.marcos?.intervalos?.length && <p>Sem intervalos aferidos.</p>}</section>
        {!!painel.marcos?.pendencias?.length && <section className="repro-pendencias"><h3>Informações a conferir</h3><ul className="mt-2 space-y-2 text-sm">{painel.marcos.pendencias.map(p => <li key={p}>{p === "Não há início de ciclo comprovado." ? "Não há parto ou situação inicial que comprove o início do acompanhamento." : p}</li>)}</ul></section>}
      </SecaoFicha>
      <SecaoFicha titulo="Histórico reprodutivo" id="historico-reprodutivo-animal"><HistoricoReprodutivo fatos={fatos} animalId={animalId} propriedadeId={propriedadeId ?? undefined} onAbrir={setFato}/></SecaoFicha>
      {animal && propriedadeId != null && <SecaoFicha titulo="Acompanhamentos" id="acompanhamentos-reproducao-animal"><DemandasAcompanhamento animalId={animalId} propriedadeId={propriedadeId} painel={painel} podeLancar={podeLancar} atualizacao={recarregarToken} onMudou={atualizar} onAvaliar={d => { setDemanda(d); setAcao("avaliacao"); }}/></SecaoFicha>}
      {propriedadeId != null && <SecaoFicha titulo="Custos diretos" resumo="Reprodução · consultar custos" abertaInicial={false} id="custos-reproducao-animal"><CustosDiretos mostrarTitulo={false} animalId={animalId} propriedadeId={propriedadeId} podeLancar={podeLancar} finalidadeInicial="REPRODUCAO"/></SecaoFicha>}
      {(animal || painel.lactacoes?.some(f => f.animalId === animalId) || painel.partos.some(f => f.animalId === animalId) || painel.gestacoes?.some(f => f.animalId === animalId && f.tipoEncerramento === "PERDA")) && <AcoesReprodutivas painel={painel} animalId={animalId} propriedadeId={propriedadeId ?? undefined} podeLancar={podeLancar} onMudou={atualizar}/>}

    </>}
    {fato && <DetalheFato fato={fato} podeLancar={podeLancar} onFechar={fecharFato} onMudou={() => { fecharFato(); void atualizar(); }}/>}
    {acao && painel && podeLancar && <FormReproducao acao={acao} painel={painel} animalInicial={animalId} propriedadeId={propriedadeId ?? undefined} demandaInicial={demanda ?? undefined} finalidadeInicial={demanda?.finalidade} tipoExameInicial={demanda?.regraSnapshot.tipoExameId ?? undefined} onFechar={fechar} onSalvo={() => { fechar(); void atualizar(); }}/>}
  </div>;
}

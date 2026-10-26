import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { ErrorBox, Pill } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";
import { consultaProtocolo, obterTarefasProtocolo, reqProtocolo } from "../protocolos/api";
import type { PaginaProtocolo } from "../protocolos/EtapasProtocolo";
import type { ParticipanteIatf, TarefaIatf } from "./Iatf";
import { horarioIatf } from "./CampoDataIatf";
import { LinkReproducao } from "./ConsultaReproducaoUI";
import { ProtocoloTimeline } from "./ProtocoloTimeline";

type Participacao = Omit<ParticipanteIatf, "tarefas">;
/** Consulta individual explícita: nenhuma data coletiva substitui a participação. */
export function ParticipacoesProgramacao({ id, propriedadeId, revisao }: { id: string; propriedadeId?: number; revisao: number }) {
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [dados, setDados] = useState<PaginaProtocolo<Participacao> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [aberta, setAberta] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true; setDados(null); setErro(null); setAberta(null);
    reqProtocolo<PaginaProtocolo<Participacao>>(`/programacoes/${encodeURIComponent(id)}/participantes${consultaProtocolo({ pagina, busca })}`, propriedadeId)
      .then(d => { if (vigente) setDados(d); }).catch(e => { if (vigente) setErro(e instanceof Error ? e.message : "Não foi possível consultar as participações."); });
    return () => { vigente = false; };
  }, [id, propriedadeId, pagina, busca, revisao, tentativa]);
  return <section className="repro-participacoes" aria-label="Participações individuais da programação">
    <div className="repro-consulta-titulo"><div><h2>Participações individuais</h2><p>Início efetivo, previsões e realizações de cada animal.</p></div></div>
    <Input aria-label="Buscar animal nas participações" placeholder="Buscar animal nas participações" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }}/>
    <ErrorBox erro={erro}/>{erro ? <Button variant="outline" onClick={() => setTentativa(v => v + 1)}>Atualizar participações individuais</Button> : !dados ? <p role="status">Consultando participações individuais…</p> : <>
      {dados.itens.map(p => <article key={p.id} className="repro-participacao"><header><div><h3>{p.animal?.brinco ?? "Animal"}{p.animal?.nome ? ` · ${p.animal.nome}` : ""}</h3><p>Início efetivo: {p.inicioEfetivo ? horarioIatf(p.inicioEfetivo, p.precisaoInicioEfetivo ?? p.precisaoTemporal) : "Não confirmado"}</p></div><Pill>{p.encerradoEm ? "Participação encerrada" : p.inicioEfetivo ? "Em acompanhamento" : "Início previsto"}</Pill></header>
        {p.motivoEncerramento && <p>{p.motivoEncerramento}</p>}
        <div className="repro-participacao-acoes"><Button variant="outline" aria-expanded={aberta === p.id} onClick={() => setAberta(aberta === p.id ? null : p.id)}>{aberta === p.id ? "Recolher etapas" : "Consultar etapas individuais"}</Button><LinkReproducao botao sitio={propriedadeId} href={`/pecuaria/rebanho/animais/${encodeURIComponent(p.animalId)}?participacaoId=${encodeURIComponent(p.id)}&programacaoId=${encodeURIComponent(id)}&retorno=${encodeURIComponent(window.location.pathname + window.location.search)}#reproducao`}>Ficha do animal</LinkReproducao></div>
        {aberta === p.id && <EtapasParticipacao key={`${p.id}:${propriedadeId}:${revisao}`} participante={p} propriedadeId={propriedadeId}/>}
      </article>)}
      {!dados.total && <p>Nenhuma participação corresponde à busca.</p>}
      {dados.total > dados.porPagina && <Paginacao paginaAtual={dados.pagina} totalPaginas={Math.max(1, Math.ceil(dados.total / dados.porPagina))} totalItens={dados.total} itensPorPagina={dados.porPagina} onPaginaChange={setPagina} rotulo="participações" idSelect="participacoes-individuais-programacao"/>}
    </>}
  </section>;
}
function EtapasParticipacao({ participante, propriedadeId }: { participante: Participacao; propriedadeId?: number }) {
  const [tarefas, setTarefas] = useState<TarefaIatf[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let vigente = true; setTarefas(null); setErro(null);
    async function carregar() {
      const contexto = { participacaoId: participante.id };
      const primeira = await obterTarefasProtocolo(contexto, { pagina: 1 }, propriedadeId);
      const itens = [...primeira.itens];
      for (let pagina = 2; vigente && pagina <= Math.ceil(primeira.total / primeira.porPagina); pagina++) itens.push(...(await obterTarefasProtocolo(contexto, { pagina }, propriedadeId)).itens);
      if (vigente) setTarefas(itens.map((t, i) => ({ ...t.tarefaOrigem, situacaoOperacional: t.situacao, motivoOperacional: t.ultimoEvento?.motivo, etapa: i, previstaEm: t.previstaPara ?? "", previsaoPendente: t.previsaoPendente || !t.previstaPara, precisaoTemporal: t.precisaoTemporal, realizadaEm: t.realizadaEm, precisaoRealizacao: t.precisaoRealizacao })));
    }
    void carregar().catch(e => { if (vigente) setErro(e instanceof Error ? e.message : "Não foi possível consultar as etapas individuais."); });
    return () => { vigente = false; };
  }, [participante.id, propriedadeId, revisao]);
  return <div className="repro-participacao-etapas"><ErrorBox erro={erro}/>{erro ? <Button variant="outline" onClick={() => setRevisao(v => v + 1)}>Atualizar etapas individuais</Button> : tarefas ? <ProtocoloTimeline participante={{ ...participante, tarefas }}/> : <p role="status">Consultando etapas individuais…</p>}</div>;
}

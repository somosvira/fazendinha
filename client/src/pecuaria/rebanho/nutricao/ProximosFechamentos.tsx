import { useCallback, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { reprocessarMensal } from "./mensal-api";
import { Empty, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { EsqueletoTabela } from "../../../components/Esqueleto";
import { formatarDataBR } from "../lib/rotulos";
import { useConsulta } from "./consulta";
import { LinkNutricional, rotaNutricao } from "./componentes";
import { rotaOperacaoNutricional } from "./navegacao";
import { consultarSituacaoFechamentos, MODELOS, type SituacaoLote } from "./situacaoFechamento";

const periodo = (inicio: string, fim: string) => inicio === fim ? formatarDataBR(inicio) : `${formatarDataBR(inicio).slice(0, 5)} a ${formatarDataBR(fim)}`;

/** Processa os dias encerrados de um lote no tipo de fechamento dele (diário ou mensal). */
export function BotaoProcessarDias({ situacao, onProcessado }: { situacao: SituacaoLote; onProcessado: () => void }) {
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState<string | null>(null);
  return <span className="grid justify-items-end gap-1">
    <Button secondary disabled={ocupado} onClick={async () => { setOcupado(true); setErro(null); try { await reprocessarMensal(situacao.resumo.lote.propriedadeId, situacao.resumo.lote.id); onProcessado(); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); } }}>{ocupado ? "Processando…" : "Processar dias"}</Button>
    {erro && <ErrorBox erro={erro} />}
  </span>;
}

const intervalo = (l: SituacaoLote) => l.inicio === l.fim ? formatarDataBR(l.inicio) : `${formatarDataBR(l.inicio).slice(0, 5)} a ${formatarDataBR(l.fim)}`;

/** Cada lote com dieta vigente: até onde foi fechado e o que falta, pelo modelo do lote (período ou mensal). */
export function ProximosFechamentos({ podeLancar, somentePendentes = false, loteId }: { podeLancar: boolean; somentePendentes?: boolean; /** Na página de um lote, mostra só ele. */ loteId?: string }) {
  const consulta = useConsulta(useCallback(consultarSituacaoFechamentos, []));
  const doContexto = consulta.dados?.filter(l => !loteId || l.resumo.lote.id === loteId);
  const linhas = doContexto?.filter(l => !somentePendentes || l.dias > 0 || (l.diarios?.dias ?? 0) > 0) ?? [];
  const pendentes = doContexto?.filter(l => l.dias > 0).length ?? 0;
  const aProcessar = doContexto?.filter(l => (l.diarios?.dias ?? 0) > 0).length ?? 0;
  if (somentePendentes && consulta.dados && !linhas.length) return null;
  const resumo = !consulta.dados ? "Lotes com dieta vigente e o que falta fechar." : [
    pendentes ? `${pendentes} ${pendentes === 1 ? "lote tem" : "lotes têm"} consumo a fechar por período` : "Nenhum período a fechar",
    aProcessar ? `${aProcessar} ${aProcessar === 1 ? "lote tem" : "lotes têm"} dias a processar no tipo de fechamento` : "",
  ].filter(Boolean).join(" · ") + ".";
  return <section className="nutricao-proximos" aria-labelledby={somentePendentes ? "alerta-a-fechar" : "proximos-fechamentos"}>
    <header className="nutricao-proximos-cabecalho"><div><h2 id={somentePendentes ? "alerta-a-fechar" : "proximos-fechamentos"}>{somentePendentes ? "Consumo a fechar" : "Próximos fechamentos"}</h2><p>{resumo}</p></div></header>
    {consulta.carregando ? <EsqueletoTabela label="Carregando próximos fechamentos" colunas={4} linhas={3} /> : consulta.erro ? <p role="alert" className="nutricao-aviso">{consulta.erro}</p> : !linhas.length ? <Panel><Empty>Nenhum lote com dieta vigente. <LinkNutricional href={rotaNutricao({ aba: "lotes" })}>Atribuir uma dieta</LinkNutricional></Empty></Panel> :
      <Panel className="overflow-hidden"><TabelaFinanceira rotulo={somentePendentes ? "Lotes com consumo a fechar" : "Próximos fechamentos por lote"} itens={linhas} chaveDe={l => l.resumo.lote.id} colunas={[
        { chave: "lote", titulo: "Lote", principal: true, celula: l => <><LinkNutricional href={rotaNutricao({ aba: "lotes", loteId: l.resumo.lote.id })}>{l.resumo.lote.nome}</LinkNutricional><p className="nutricao-secundario">{l.resumo.lote.propriedade.nome}</p></> },
        { chave: "dieta", titulo: "Dieta vigente", celula: l => <>{l.resumo.vigente!.dieta.nome}<p className="nutricao-secundario">v{l.resumo.vigente!.dieta.versao} desde {formatarDataBR(l.resumo.vigente!.desde)}</p></> },
        { chave: "ultimo", titulo: "Fechado até", celula: l => l.ultimoFim ? formatarDataBR(l.ultimoFim) : <span className="nutricao-secundario">Nenhum fechamento</span> },
        { chave: "falta", titulo: "A fechar", celula: l => <>
          {l.dias ? <><strong>{l.dias} {l.dias === 1 ? "dia" : "dias"} por período</strong><p className="nutricao-secundario">{intervalo(l)}</p></> : null}
          {l.diarios && (l.diarios.dias ? <><strong className="block">{l.diarios.dias} {l.diarios.dias === 1 ? "dia a processar" : "dias a processar"}</strong><p className="nutricao-secundario">{periodo(l.diarios.inicio, l.diarios.fim)}</p></> : <span className="nutricao-secundario">Processado até {formatarDataBR(l.diarios.fim).slice(0, 5)}</span>)}
          {!l.dias && !l.diarios && <span className="nutricao-secundario">Em dia</span>}
          {l.adocao && <p className="nutricao-secundario" title={l.configuracaoAdocao ? `${MODELOS[l.configuracaoAdocao.modelo].texto} Conferência no dia ${l.configuracaoAdocao.diaConferencia}.` : undefined}>{l.configuracaoAdocao ? MODELOS[l.configuracaoAdocao.modelo].rotulo : "Fechamento configurado"} a partir de {formatarDataBR(l.adocao).slice(0, 5)}</p>}
        </> },
        ...(podeLancar ? [{ chave: "acao", titulo: "Ação", acoes: true, celula: (l: SituacaoLote) => l.dias ? <LinkNutricional className="nutricao-botao-secundario" href={rotaOperacaoNutricional("consumo", l.resumo.lote.id)}>Fechar período</LinkNutricional> : l.diarios?.dias ? <BotaoProcessarDias situacao={l} onProcessado={() => void consulta.carregar()} /> : null }] : []),
      ]} /></Panel>}
  </section>;
}

import { useCallback } from "react";
import { Empty, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { EsqueletoTabela } from "../../../components/Esqueleto";
import { formatarDataBR } from "../lib/rotulos";
import { useConsulta } from "./consulta";
import { LinkNutricional, rotaNutricao } from "./componentes";
import { rotaOperacaoNutricional } from "./navegacao";
import { consultarSituacaoFechamentos, MODELOS, type SituacaoLote } from "./situacaoFechamento";

const intervalo = (l: SituacaoLote) => l.inicio === l.fim ? formatarDataBR(l.inicio) : `${formatarDataBR(l.inicio).slice(0, 5)} a ${formatarDataBR(l.fim)}`;

/** Cada lote com dieta vigente: até onde foi fechado e o que falta, pelo modelo do lote (período ou mensal). */
export function ProximosFechamentos({ podeLancar, somentePendentes = false, loteId }: { podeLancar: boolean; somentePendentes?: boolean; /** Na página de um lote, mostra só ele. */ loteId?: string }) {
  const consulta = useConsulta(useCallback(consultarSituacaoFechamentos, []));
  const doContexto = consulta.dados?.filter(l => !loteId || l.resumo.lote.id === loteId);
  const linhas = doContexto?.filter(l => !somentePendentes || l.dias > 0) ?? [];
  const pendentes = doContexto?.filter(l => l.dias > 0).length ?? 0;
  const mensais = doContexto?.filter(l => l.mensal && l.dias === 0).length ?? 0;
  if (somentePendentes && consulta.dados && !linhas.length) return null;
  const resumo = !consulta.dados ? "Lotes com dieta vigente e o que falta fechar." : [
    pendentes ? `${pendentes} ${pendentes === 1 ? "lote tem" : "lotes têm"} consumo a fechar por período` : "Nenhum período a fechar",
    mensais ? `${mensais} ${mensais === 1 ? "segue" : "seguem"} o tipo de fechamento configurado` : "",
  ].filter(Boolean).join(" · ") + ".";
  return <section className="nutricao-proximos" aria-labelledby={somentePendentes ? "alerta-a-fechar" : "proximos-fechamentos"}>
    <header className="nutricao-proximos-cabecalho"><div><h2 id={somentePendentes ? "alerta-a-fechar" : "proximos-fechamentos"}>{somentePendentes ? "Consumo a fechar" : "Próximos fechamentos"}</h2><p>{resumo}</p></div></header>
    {consulta.carregando ? <EsqueletoTabela label="Carregando próximos fechamentos" colunas={4} linhas={3} /> : consulta.erro ? <p role="alert" className="nutricao-aviso">{consulta.erro}</p> : !linhas.length ? <Panel><Empty>Nenhum lote com dieta vigente. <LinkNutricional href={rotaNutricao({ aba: "lotes" })}>Atribuir uma dieta</LinkNutricional></Empty></Panel> :
      <Panel className="overflow-hidden"><TabelaFinanceira rotulo={somentePendentes ? "Lotes com consumo a fechar" : "Próximos fechamentos por lote"} itens={linhas} chaveDe={l => l.resumo.lote.id} colunas={[
        { chave: "lote", titulo: "Lote", principal: true, celula: l => <><LinkNutricional href={rotaNutricao({ aba: "lotes", loteId: l.resumo.lote.id })}>{l.resumo.lote.nome}</LinkNutricional><p className="nutricao-secundario">{l.resumo.lote.propriedade.nome}</p></> },
        { chave: "dieta", titulo: "Dieta vigente", celula: l => <>{l.resumo.vigente!.dieta.nome}<p className="nutricao-secundario">v{l.resumo.vigente!.dieta.versao} desde {formatarDataBR(l.resumo.vigente!.desde)}</p></> },
        { chave: "ultimo", titulo: "Fechado até", celula: l => l.ultimoFim ? formatarDataBR(l.ultimoFim) : <span className="nutricao-secundario">Nenhum fechamento</span> },
        { chave: "falta", titulo: "A fechar", celula: l => <>
          {l.dias ? <><strong>{l.dias} {l.dias === 1 ? "dia" : "dias"}</strong><p className="nutricao-secundario">{intervalo(l)}</p></> : !l.mensal && <span className="nutricao-secundario">Em dia</span>}
          {l.adocao && <p className="nutricao-secundario" title={l.configuracaoAdocao ? `${MODELOS[l.configuracaoAdocao.modelo].texto} Conferência no dia ${l.configuracaoAdocao.diaConferencia}.` : undefined}>{l.configuracaoAdocao ? MODELOS[l.configuracaoAdocao.modelo].rotulo : "Fechamento configurado"} a partir de {formatarDataBR(l.adocao).slice(0, 5)}</p>}
        </> },
        ...(podeLancar ? [{ chave: "acao", titulo: "Ação", acoes: true, celula: (l: SituacaoLote) => l.dias ? <LinkNutricional className="nutricao-botao-secundario" href={rotaOperacaoNutricional("consumo", l.resumo.lote.id)}>Fechar período</LinkNutricional> : null }] : []),
      ]} /></Panel>}
  </section>;
}

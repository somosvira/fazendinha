import { useCallback } from "react";
import { Empty, hoje, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { EsqueletoTabela } from "../../../components/Esqueleto";
import { formatarDataBR } from "../lib/rotulos";
import { consultarVisaoNutricional, ultimoFechamentoConfirmado, type ResumoNutricional } from "./api";
import { useConsulta } from "./consulta";
import { LinkNutricional, rotaNutricao } from "./componentes";
import { rotaOperacaoNutricional } from "./navegacao";

type Linha = { resumo: ResumoNutricional; ultimoFim: string | null; inicio: string; dias: number };

const somarDia = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const diasEntre = (inicio: string, fim: string) => Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 864e5) + 1;

/** Para cada lote com dieta vigente: até onde o consumo já foi fechado e o período que falta fechar até hoje. */
export function ProximosFechamentos({ podeLancar }: { podeLancar: boolean }) {
  const consulta = useConsulta(useCallback(async (): Promise<Linha[]> => {
    const visao = await consultarVisaoNutricional();
    const comDieta = visao.lotes.filter(r => r.vigente && r.lote.ativo !== false);
    const ultimos = await Promise.all(comDieta.map(r => ultimoFechamentoConfirmado(r.lote.id)));
    const dia = hoje();
    return comDieta.map((resumo, i) => {
      const ultimoFim = ultimos[i]?.fim.slice(0, 10) ?? null;
      const desde = resumo.vigente!.desde.slice(0, 10);
      const inicio = ultimoFim && ultimoFim >= desde ? somarDia(ultimoFim) : desde;
      return { resumo, ultimoFim, inicio, dias: inicio > dia ? 0 : diasEntre(inicio, dia) };
    }).sort((a, b) => b.dias - a.dias);
  }, []));
  const pendentes = consulta.dados?.filter(l => l.dias > 0).length ?? 0;
  return <section className="nutricao-proximos" aria-labelledby="proximos-fechamentos">
    <header className="nutricao-proximos-cabecalho"><div><h2 id="proximos-fechamentos">Próximos fechamentos</h2><p>{consulta.dados ? (pendentes ? `${pendentes} ${pendentes === 1 ? "lote tem" : "lotes têm"} consumo a fechar até hoje.` : "Todos os lotes com dieta estão fechados até hoje.") : "Lotes com dieta vigente e o período que falta fechar."}</p></div></header>
    {consulta.carregando ? <EsqueletoTabela label="Carregando próximos fechamentos" colunas={4} linhas={3} /> : consulta.erro ? <p role="alert" className="nutricao-aviso">{consulta.erro}</p> : !consulta.dados?.length ? <Panel><Empty>Nenhum lote com dieta vigente. <LinkNutricional href={rotaNutricao({ aba: "lotes" })}>Atribuir uma dieta</LinkNutricional></Empty></Panel> :
      <Panel className="overflow-hidden"><TabelaFinanceira rotulo="Próximos fechamentos por lote" itens={consulta.dados} chaveDe={l => l.resumo.lote.id} colunas={[
        { chave: "lote", titulo: "Lote", principal: true, celula: l => <><LinkNutricional href={rotaNutricao({ aba: "lotes", loteId: l.resumo.lote.id })}>{l.resumo.lote.nome}</LinkNutricional><p className="nutricao-secundario">{l.resumo.lote.propriedade.nome}</p></> },
        { chave: "dieta", titulo: "Dieta vigente", celula: l => <>{l.resumo.vigente!.dieta.nome}<p className="nutricao-secundario">v{l.resumo.vigente!.dieta.versao} desde {formatarDataBR(l.resumo.vigente!.desde)}</p></> },
        { chave: "ultimo", titulo: "Fechado até", celula: l => l.ultimoFim ? formatarDataBR(l.ultimoFim) : <span className="nutricao-secundario">Nenhum fechamento</span> },
        { chave: "falta", titulo: "A fechar", celula: l => l.dias ? <><strong>{l.dias} {l.dias === 1 ? "dia" : "dias"}</strong><p className="nutricao-secundario">desde {formatarDataBR(l.inicio)}</p></> : <span className="nutricao-secundario">Em dia</span> },
        ...(podeLancar ? [{ chave: "acao", titulo: "Ação", acoes: true, celula: (l: Linha) => l.dias ? <LinkNutricional className="nutricao-botao-secundario" href={rotaOperacaoNutricional("consumo", l.resumo.lote.id)}>Fechar período</LinkNutricional> : null }] : []),
      ]} /></Panel>}
  </section>;
}

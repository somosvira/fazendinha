import { useEffect, useState, type ReactNode } from "react";
import { SkeletonListaFinanceira } from "./CarregamentoFinanceiro";
import { SelectCampo } from "./SelectCampo";
import { Button } from "@/components/ui/button";
import type { Conta, MovimentoGeral } from "./novo-api";
import { brl, dataBR, Empty, ErrorBox, Panel, Paginacao, TabelaFinanceira } from "./financeiro-ui";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";
import { infoReversao } from "./lib/reversao";

const CAMPO = "mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal";

export type FiltrosExtratoGeral = {
  inicio: string;
  fim: string;
  conta: string;
  instituicao: string;
  natureza?: string;
};

export const FILTROS_EXTRATO_GERAL_INICIAIS: FiltrosExtratoGeral = { inicio: "", fim: "", conta: "", instituicao: "" };

export function filtrarMovimentosExtratoGeral(movimentos: MovimentoGeral[], filtros: FiltrosExtratoGeral): MovimentoGeral[] {
  const { inicio, fim, conta, instituicao, natureza } = filtros;
  return movimentos.filter(m => {
    const data = m.transacao.data.slice(0, 10);
    if (natureza) {
      const tipo = m.transacao.reversaoDe?.tipo ?? m.transacao.tipo;
      const entradaOriginal = m.transacao.tipo === "REVERSAO" ? m.direcao === "SAIDA" : m.direcao === "ENTRADA";
      if (tipo === "TRANSFERENCIA" || !["CONFIRMADA", "REVERTIDA"].includes(m.transacao.status) || (natureza === "recebimentos") !== entradaOriginal) return false;
    }
    return (!inicio || data >= inicio) && (!fim || data <= fim) && (!conta || String(m.contaId) === conta)
      && (!instituicao || (instituicao === "__sem__" ? !m.conta.instituicao : m.conta.instituicao === instituicao));
  });
}

export function ExtratoGeral({ contas, movimentos, filtros, onChangeFiltros, carregando, erro, onAbrir, controles }: {
  controles?: ReactNode;
  contas: Conta[];
  movimentos: MovimentoGeral[];
  filtros: FiltrosExtratoGeral;
  onChangeFiltros: (filtros: FiltrosExtratoGeral) => void;
  carregando: boolean;
  erro: string | null;
  onAbrir: (movimento: MovimentoGeral) => void;
}) {
  const { inicio, fim, conta, instituicao } = filtros;
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), [inicio, fim, conta, instituicao, filtros.natureza, movimentos]);
  const intervaloInvalido = !!inicio && !!fim && inicio > fim;
  const filtrados = filtrarMovimentosExtratoGeral(movimentos, filtros);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / 15));
  const paginaAtual = Math.min(pagina, totalPaginas);
  return <section id="extrato-geral" className="mt-3 min-w-0 scroll-mt-6" aria-labelledby="titulo-extrato-geral">
    <h2 id="titulo-extrato-geral" className="h1 break-words hyphens-auto">Extrato geral</h2>
    <p className="mt-2 break-words text-sm leading-6 text-ink-3">Movimentações de todas as contas da fazenda selecionada, da mais recente à mais antiga. Clique para localizar o registro na conta.</p>
    {controles}
    <Panel tom="info" className="fin-painel mt-3 overflow-hidden">
      <div className="fin-cabecalho grid gap-3 border-b border-border p-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Conta<SelectCampo value={conta} onValueChange={valor => onChangeFiltros({ ...filtros, conta: valor })} className={CAMPO}><option value="">Todas as contas</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}{!c.ativo ? " (inativa)" : ""}</option>)}</SelectCampo></label>
        <label className="text-sm font-medium">Instituição<SelectCampo value={instituicao} onValueChange={valor => onChangeFiltros({ ...filtros, instituicao: valor })} className={CAMPO}><option value="">Todas as instituições</option>{Array.from(new Set(contas.map(c => c.instituicao).filter((i): i is string => !!i))).sort().map(i => <option key={i} value={i}>{i}</option>)}<option value="__sem__">Sem instituição</option></SelectCampo></label>
      </div>
      {filtros.natureza && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4 text-sm"><span>{filtros.natureza === "recebimentos" ? "Recebimentos" : "Pagamentos"} realizados, líquidos de estornos · transferências excluídas</span><Button variant="link" onClick={() => onChangeFiltros({ ...filtros, natureza: undefined })}>Mostrar todas as movimentações</Button></div>}
      <ErrorBox erro={erro} />
      {intervaloInvalido ? <p role="alert" className="p-3">A data final deve ser igual ou posterior à data inicial.</p> : carregando ? <SkeletonListaFinanceira label="Carregando extrato geral" /> : erro ? <p className="p-3">Não foi possível carregar as movimentações.</p> : filtrados.length ? <><Paginacao ocultarControlesPaginaUnica pagina={paginaAtual} totalPaginas={totalPaginas} total={filtrados.length} porPagina={15} rotulo="Paginação do extrato geral" substantivo="movimentos" idSelect="pagina-extrato-geral" onPagina={setPagina} /><TabelaFinanceira cartaoComLinks compacta barraRolagemSuperior rotulo="Extrato geral" itens={filtrados.slice((paginaAtual - 1) * 15, paginaAtual * 15)} chaveDe={m => m.id} onAbrir={onAbrir} colunas={[
        { chave: "data", titulo: "Data", alinhamento: "centro", larguraMinima: 110, celula: m => dataBR(m.transacao.data) },
        { chave: "descricao", titulo: "Movimentação", principal: true, larguraMinima: 220, celula: m => { const reversao = infoReversao(m.transacao); return <><strong>{m.transacao.descricao || m.transacao.tipo.replaceAll("_", " ")}</strong><div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">{m.conta.instituicao && <span>{m.conta.instituicao}</span>}{m.transacao.operacao ? <LinkOperacaoFinanceira id={m.transacao.operacao.id} numero={m.transacao.operacao.numero} /> : <span>Transação avulsa</span>}</div>{m.transacao.status === "REVERTIDA" && <div className="mt-1 text-xs text-ink-3">Revertida</div>}{reversao && <div className="mt-1 text-xs font-medium text-[var(--rural)]">{reversao.detalhe}{reversao.operacaoId != null && reversao.operacaoNumero != null && <> · <LinkOperacaoFinanceira id={reversao.operacaoId} numero={reversao.operacaoNumero} /></>}</div>}</>; } },
        { chave: "conta", titulo: "Conta", alinhamento: "centro", larguraMinima: 160, celula: m => m.conta.nome },
        { chave: "valor", titulo: "Valor", alinhamento: "direita", larguraMinima: 150, celula: m => <span className="whitespace-nowrap font-semibold" style={{ color: m.direcao === "ENTRADA" ? "var(--fin-entrada)" : "var(--fin-saida)" }}><span className="block text-xs font-normal">{m.direcao === "ENTRADA" ? "Entrada" : "Saída"}</span>{m.direcao === "ENTRADA" ? "+" : "−"}{brl(m.valor)}</span> },
      ]} /></> : <Empty>Nenhuma movimentação encontrada para os filtros selecionados.</Empty>}
    </Panel>
  </section>;
}

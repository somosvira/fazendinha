import { useEffect, useState, type ReactNode } from "react";
import { SkeletonListaFinanceira } from "./CarregamentoFinanceiro";
import { SelectCampo } from "./SelectCampo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Conta, MovimentoGeral } from "./novo-api";
import { brl, CabecalhoTabela, dataBR, Empty, ErrorBox, Panel, Paginacao, TabelaFinanceira } from "./financeiro-ui";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";
import { infoReversao } from "./lib/reversao";

const CAMPO = "mt-1.5 w-full rounded-lg border border-border bg-card p-2.5 font-normal";

export type FiltrosExtratoGeral = {
  inicio: string;
  fim: string;
  conta: string;
  instituicao: string;
  natureza?: string;
  busca?: string;
};

export const FILTROS_EXTRATO_GERAL_INICIAIS: FiltrosExtratoGeral = { inicio: "", fim: "", conta: "", instituicao: "" };

export function filtrarMovimentosExtratoGeral(movimentos: MovimentoGeral[], filtros: FiltrosExtratoGeral): MovimentoGeral[] {
  const { inicio, fim, conta, instituicao, natureza, busca } = filtros;
  return movimentos.filter(m => {
    const data = m.transacao.data.slice(0, 10);
    if (natureza) {
      const tipo = m.transacao.reversaoDe?.tipo ?? m.transacao.tipo;
      const entradaOriginal = m.transacao.tipo === "REVERSAO" ? m.direcao === "SAIDA" : m.direcao === "ENTRADA";
      if (tipo === "TRANSFERENCIA" || !["CONFIRMADA", "REVERTIDA"].includes(m.transacao.status) || (natureza === "recebimentos") !== entradaOriginal) return false;
    }
    const termo = busca?.trim().toLocaleLowerCase("pt-BR");
    const texto = [m.transacao.descricao, m.conta.nome, m.conta.instituicao, m.transacao.parceiro?.nome].join(" ").toLocaleLowerCase("pt-BR");
    return (!termo || texto.includes(termo)) && (!inicio || data >= inicio) && (!fim || data <= fim) && (!conta || String(m.contaId) === conta)
      && (!instituicao || (instituicao === "__sem__" ? !m.conta.instituicao : m.conta.instituicao === instituicao));
  });
}

export function FiltrosExtratoGeralControl({ contas, filtros, onChangeFiltros, children }: {
  contas: Conta[];
  filtros: FiltrosExtratoGeral;
  onChangeFiltros: (filtros: FiltrosExtratoGeral) => void;
  children?: ReactNode;
}) {
  const { conta, instituicao } = filtros;
  return <>
      <div className="fin-filtros-barra flex flex-wrap items-end gap-3 p-4">
        <label className="fin-filtro-busca text-sm font-medium">Buscar movimento<Input type="search" placeholder="Descrição, conta ou parceiro" value={filtros.busca ?? ""} onChange={e => onChangeFiltros({ ...filtros, busca: e.target.value })} className={CAMPO} /></label>
        {children}
        <label className="fin-filtro-controle text-sm font-medium">Conta<SelectCampo value={conta} onValueChange={valor => onChangeFiltros({ ...filtros, conta: valor })} className={CAMPO}><option value="">Todas as contas</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}{!c.ativo ? " (inativa)" : ""}</option>)}</SelectCampo></label>
        <label className="fin-filtro-controle text-sm font-medium">Instituição<SelectCampo value={instituicao} onValueChange={valor => onChangeFiltros({ ...filtros, instituicao: valor })} className={CAMPO}><option value="">Todas as instituições</option>{Array.from(new Set(contas.map(c => c.instituicao).filter((i): i is string => !!i))).sort().map(i => <option key={i} value={i}>{i}</option>)}<option value="__sem__">Sem instituição</option></SelectCampo></label>
      </div>
      {filtros.natureza && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4 text-sm"><span>{filtros.natureza === "recebimentos" ? "Recebimentos" : "Pagamentos"} realizados, líquidos de estornos · transferências excluídas</span><Button variant="link" onClick={() => onChangeFiltros({ ...filtros, natureza: undefined })}>Mostrar todas as movimentações</Button></div>}
  </>;
}

export function ExtratoGeral({ contas, movimentos, filtros, onChangeFiltros, carregando, erro, onAbrir, controles, ocultarFiltros = false }: {
  controles?: ReactNode;
  ocultarFiltros?: boolean;
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
  useEffect(() => setPagina(1), [inicio, fim, conta, instituicao, filtros.natureza, filtros.busca, movimentos]);
  const intervaloInvalido = !!inicio && !!fim && inicio > fim;
  const filtrados = filtrarMovimentosExtratoGeral(movimentos, filtros);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / 15));
  const paginaAtual = Math.min(pagina, totalPaginas);
  return <section id="extrato-geral" className="mt-6 min-w-0 scroll-mt-6" aria-label="Extrato geral">
    <Panel tom="info" className="fin-painel overflow-hidden">
      <CabecalhoTabela titulo="Extrato geral" descricao="Movimentações da fazenda, da mais recente à mais antiga. Clique para consultar na conta." />
      {!ocultarFiltros && <FiltrosExtratoGeralControl contas={contas} filtros={filtros} onChangeFiltros={onChangeFiltros}>{controles}</FiltrosExtratoGeralControl>}
      <ErrorBox erro={erro} />
      {intervaloInvalido ? <p role="alert" className="p-3">A data final deve ser igual ou posterior à data inicial.</p> : carregando ? <SkeletonListaFinanceira label="Carregando extrato geral" /> : erro ? <p className="p-3">Não foi possível carregar as movimentações.</p> : filtrados.length ? <><TabelaFinanceira cartaoComLinks compacta barraRolagemSuperior rotulo="Extrato geral" itens={filtrados.slice((paginaAtual - 1) * 15, paginaAtual * 15)} chaveDe={m => m.id} onAbrir={onAbrir} colunas={[
        { chave: "data", titulo: "Data", alinhamento: "centro", larguraMinima: 110, celula: m => dataBR(m.transacao.data) },
        { chave: "descricao", titulo: "Movimentação", principal: true, larguraMinima: 220, celula: m => { const reversao = infoReversao(m.transacao); return <><strong>{m.transacao.descricao || m.transacao.tipo.replaceAll("_", " ")}</strong><div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">{m.conta.instituicao && <span>{m.conta.instituicao}</span>}{m.transacao.operacao ? <LinkOperacaoFinanceira id={m.transacao.operacao.id} numero={m.transacao.operacao.numero} /> : <span>Transação avulsa</span>}</div>{m.transacao.status === "REVERTIDA" && <div className="mt-1 text-xs text-ink-3">Revertida</div>}{reversao && <div className="mt-1 text-xs font-medium text-[var(--fin-pendente)]">{reversao.detalhe}{reversao.operacaoId != null && reversao.operacaoNumero != null && <> · <LinkOperacaoFinanceira id={reversao.operacaoId} numero={reversao.operacaoNumero} /></>}</div>}</>; } },
        { chave: "conta", titulo: "Conta", larguraMinima: 160, celula: m => m.conta.nome },
        { chave: "valor", titulo: "Valor", alinhamento: "direita", larguraMinima: 150, celula: m => <span className="whitespace-nowrap font-semibold" style={{ color: m.direcao === "ENTRADA" ? "var(--fin-entrada)" : "var(--fin-saida)" }}><span className="block text-xs font-normal">{m.direcao === "ENTRADA" ? "Entrada" : "Saída"}</span>{m.direcao === "ENTRADA" ? "+" : "−"}{brl(m.valor)}</span> },
      ]} /><Paginacao ocultarControlesPaginaUnica pagina={paginaAtual} totalPaginas={totalPaginas} total={filtrados.length} porPagina={15} rotulo="Paginação do extrato geral" substantivo="movimentos" idSelect="pagina-extrato-geral" onPagina={setPagina} /></> : <Empty>Nenhuma movimentação encontrada para os filtros selecionados.</Empty>}
    </Panel>
  </section>;
}

import { Button } from "@/components/ui/button";
import type { Conta, MovimentoGeral } from "./novo-api";
import { brl, dataBR, Empty, ErrorBox, Panel, TabelaFinanceira } from "./financeiro-ui";
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

export function ExtratoGeral({ contas, movimentos, filtros, onChangeFiltros, carregando, erro, onAbrir }: {
  contas: Conta[];
  movimentos: MovimentoGeral[];
  filtros: FiltrosExtratoGeral;
  onChangeFiltros: (filtros: FiltrosExtratoGeral) => void;
  carregando: boolean;
  erro: string | null;
  onAbrir: (movimento: MovimentoGeral) => void;
}) {
  const { inicio, fim, conta, instituicao } = filtros;
  const intervaloInvalido = !!inicio && !!fim && inicio > fim;
  const filtrados = filtrarMovimentosExtratoGeral(movimentos, filtros);
  return <section id="extrato-geral" className="mt-8 scroll-mt-6" aria-labelledby="titulo-extrato-geral">
    <h2 id="titulo-extrato-geral" className="font-serif text-2xl">Extrato geral</h2>
    <p className="mt-2 text-sm text-ink-3">Movimentações de todas as contas da fazenda selecionada, da mais recente à mais antiga. Clique para localizar o registro na conta.</p>
    <Panel tom="info" className="fin-painel mt-4 overflow-hidden">
      <div className="fin-cabecalho grid gap-4 border-b border-border p-5 sm:grid-cols-2">
        <label className="text-sm font-medium">Conta<select value={conta} onChange={e => onChangeFiltros({ ...filtros, conta: e.target.value })} className={CAMPO}><option value="">Todas as contas</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}{!c.ativo ? " (inativa)" : ""}</option>)}</select></label>
        <label className="text-sm font-medium">Instituição<select value={instituicao} onChange={e => onChangeFiltros({ ...filtros, instituicao: e.target.value })} className={CAMPO}><option value="">Todas as instituições</option>{Array.from(new Set(contas.map(c => c.instituicao).filter((i): i is string => !!i))).sort().map(i => <option key={i} value={i}>{i}</option>)}<option value="__sem__">Sem instituição</option></select></label>
      </div>
      {filtros.natureza && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4 text-sm"><span>{filtros.natureza === "recebimentos" ? "Recebimentos" : "Pagamentos"} realizados, líquidos de estornos · transferências excluídas</span><Button variant="link" onClick={() => onChangeFiltros({ ...filtros, natureza: undefined })}>Mostrar todas as movimentações</Button></div>}
      <ErrorBox erro={erro} />
      {intervaloInvalido ? <p role="alert" className="p-5">A data final deve ser igual ou posterior à data inicial.</p> : carregando ? <p role="status" className="p-5">Carregando extrato geral…</p> : erro ? <p className="p-5">Não foi possível carregar as movimentações.</p> : filtrados.length ? <TabelaFinanceira rotulo="Extrato geral" itens={filtrados} chaveDe={m => m.id} onAbrir={onAbrir} colunas={[
        { chave: "data", titulo: "Data", alinhamento: "centro", larguraMinima: 110, celula: m => dataBR(m.transacao.data) },
        { chave: "descricao", titulo: "Movimentação", alinhamento: "centro", principal: true, larguraMinima: 220, celula: m => { const reversao = infoReversao(m.transacao); return <><strong>{m.transacao.descricao || m.transacao.tipo.replaceAll("_", " ")}</strong>{m.transacao.status === "REVERTIDA" && <div className="mt-1 text-xs text-ink-3">Revertida</div>}{reversao && <div className="mt-1 text-xs font-medium text-amber-800">{reversao.detalhe}{reversao.operacaoId != null && reversao.operacaoNumero != null && <> · <LinkOperacaoFinanceira id={reversao.operacaoId} numero={reversao.operacaoNumero} /></>}</div>}</>; } },
        { chave: "conta", titulo: "Conta", alinhamento: "centro", larguraMinima: 160, celula: m => m.conta.nome },
        { chave: "instituicao", titulo: "Instituição", alinhamento: "centro", larguraMinima: 140, celula: m => m.conta.instituicao || "—" },
        { chave: "operacao", titulo: "Operação", alinhamento: "centro", larguraMinima: 140, acoes: true, celula: m => m.transacao.operacao ? <LinkOperacaoFinanceira id={m.transacao.operacao.id} numero={m.transacao.operacao.numero} /> : <span className="text-xs text-ink-3">Transação avulsa</span> },
        { chave: "entrada", titulo: "Entrada", alinhamento: "centro", larguraMinima: 130, celula: m => <span className="whitespace-nowrap text-[var(--fin-entrada)]">{m.direcao === "ENTRADA" ? brl(m.valor) : "—"}</span> },
        { chave: "saida", titulo: "Saída", alinhamento: "centro", larguraMinima: 130, celula: m => <span className="whitespace-nowrap text-[var(--fin-saida)]">{m.direcao === "SAIDA" ? brl(m.valor) : "—"}</span> },
      ]} /> : <Empty>Nenhuma movimentação encontrada para os filtros selecionados.</Empty>}
    </Panel>
  </section>;
}

import { useState } from "react";
import type { Conta, MovimentoGeral } from "./novo-api";
import { brl, dataBR, Empty, ErrorBox, Panel, TabelaFinanceira } from "./financeiro-ui";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";

const CAMPO = "mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal";

export function ExtratoGeral({ contas, movimentos, carregando, erro, onAbrir }: {
  contas: Conta[];
  movimentos: MovimentoGeral[];
  carregando: boolean;
  erro: string | null;
  onAbrir: (movimento: MovimentoGeral) => void;
}) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [conta, setConta] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const intervaloInvalido = !!inicio && !!fim && inicio > fim;
  const filtrados = movimentos.filter(m => {
    const data = m.transacao.data.slice(0, 10);
    return (!inicio || data >= inicio) && (!fim || data <= fim) && (!conta || String(m.contaId) === conta)
      && (!instituicao || (instituicao === "__sem__" ? !m.conta.instituicao : m.conta.instituicao === instituicao));
  });
  return <section id="extrato-geral" className="mt-8 scroll-mt-6" aria-labelledby="titulo-extrato-geral">
    <h2 id="titulo-extrato-geral" className="font-serif text-2xl">Extrato geral</h2>
    <p className="mt-2 text-sm text-ink-3">Movimentações de todas as contas da fazenda selecionada, da mais recente à mais antiga. Clique para localizar o registro na conta.</p>
    <Panel className="mt-4 overflow-hidden">
      <div className="grid gap-4 border-b border-border p-5 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium">Data inicial<input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className={CAMPO} /></label>
        <label className="text-sm font-medium">Data final<input type="date" value={fim} onChange={e => setFim(e.target.value)} className={CAMPO} /></label>
        <label className="text-sm font-medium">Conta<select value={conta} onChange={e => setConta(e.target.value)} className={CAMPO}><option value="">Todas as contas</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}{!c.ativo ? " (inativa)" : ""}</option>)}</select></label>
        <label className="text-sm font-medium">Instituição<select value={instituicao} onChange={e => setInstituicao(e.target.value)} className={CAMPO}><option value="">Todas as instituições</option>{Array.from(new Set(contas.map(c => c.instituicao).filter((i): i is string => !!i))).sort().map(i => <option key={i} value={i}>{i}</option>)}<option value="__sem__">Sem instituição</option></select></label>
      </div>
      <ErrorBox erro={erro} />
      {intervaloInvalido ? <p role="alert" className="p-5">A data final deve ser igual ou posterior à data inicial.</p> : carregando ? <p role="status" className="p-5">Carregando extrato geral…</p> : erro ? <p className="p-5">Não foi possível carregar as movimentações.</p> : filtrados.length ? <TabelaFinanceira rotulo="Extrato geral" itens={filtrados} chaveDe={m => m.id} onAbrir={onAbrir} colunas={[
        { chave: "data", titulo: "Data", alinhamento: "centro", larguraMinima: 110, celula: m => dataBR(m.transacao.data) },
        { chave: "descricao", titulo: "Movimentação", alinhamento: "centro", principal: true, larguraMinima: 220, celula: m => <><strong>{m.transacao.descricao || m.transacao.tipo.replaceAll("_", " ")}</strong>{m.transacao.status === "REVERTIDA" && <div className="mt-1 text-xs text-ink-3">Revertida</div>}</> },
        { chave: "conta", titulo: "Conta", alinhamento: "centro", larguraMinima: 160, celula: m => m.conta.nome },
        { chave: "instituicao", titulo: "Instituição", alinhamento: "centro", larguraMinima: 140, celula: m => m.conta.instituicao || "—" },
        { chave: "operacao", titulo: "Operação", alinhamento: "centro", larguraMinima: 140, acoes: true, celula: m => m.transacao.operacao ? <LinkOperacaoFinanceira id={m.transacao.operacao.id} /> : <span className="text-xs text-ink-3">Transação avulsa</span> },
        { chave: "entrada", titulo: "Entrada", alinhamento: "centro", larguraMinima: 130, celula: m => <span className="whitespace-nowrap text-green-800">{m.direcao === "ENTRADA" ? brl(m.valor) : "—"}</span> },
        { chave: "saida", titulo: "Saída", alinhamento: "centro", larguraMinima: 130, celula: m => <span className="whitespace-nowrap">{m.direcao === "SAIDA" ? brl(m.valor) : "—"}</span> },
      ]} /> : <Empty>Nenhuma movimentação encontrada para os filtros selecionados.</Empty>}
    </Panel>
  </section>;
}

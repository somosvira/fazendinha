import type { Conta, MovimentoGeral } from "./novo-api";
import { brl, dataBR, Empty, ErrorBox, Panel, TabelaFinanceira } from "./financeiro-ui";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";
import { CampoData } from "../components/CampoData";
import { CampoSelect } from "../components/CampoSelect";
import { SelectBusca } from "../components/SelectBusca";

export type FiltrosExtratoGeral = {
  inicio: string;
  fim: string;
  conta: string;
  instituicao: string;
};

export const FILTROS_EXTRATO_GERAL_INICIAIS: FiltrosExtratoGeral = { inicio: "", fim: "", conta: "", instituicao: "" };

export function filtrarMovimentosExtratoGeral(movimentos: MovimentoGeral[], filtros: FiltrosExtratoGeral): MovimentoGeral[] {
  const { inicio, fim, conta, instituicao } = filtros;
  return movimentos.filter(m => {
    const data = m.transacao.data.slice(0, 10);
    return (!inicio || data >= inicio) && (!fim || data <= fim) && (!conta || String(m.contaId) === conta)
      && (!instituicao || (instituicao === "__sem__" ? !m.conta.instituicao : m.conta.instituicao === instituicao));
  });
}

/* Usado também no filtro de contas: instituições cadastradas + "sem instituição". */
export function opcoesInstituicao(contas: Pick<Conta, "instituicao">[]) {
  const nomes = Array.from(new Set(contas.map(c => c.instituicao).filter((i): i is string => !!i))).sort();
  return [{ value: "", label: "Todas as instituições" }, ...nomes.map(i => ({ value: i, label: i })), { value: "__sem__", label: "Sem instituição" }];
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
    <Panel className="mt-4 overflow-hidden">
      <div className="grid gap-4 border-b border-border p-5 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium">Data inicial<CampoData aria-label="Data inicial" value={inicio} onChange={v => onChangeFiltros({ ...filtros, inicio: v })} /></label>
        <label className="text-sm font-medium">Data final<CampoData aria-label="Data final" value={fim} onChange={v => onChangeFiltros({ ...filtros, fim: v })} /></label>
        <label className="text-sm font-medium">Conta<SelectBusca aria-label="Conta" value={conta} onValueChange={v => onChangeFiltros({ ...filtros, conta: v })} opcaoVazia="Todas as contas" options={contas.map(c => ({ value: String(c.id), label: `${c.nome}${!c.ativo ? " (inativa)" : ""}` }))} buscaPlaceholder="Buscar conta…" /></label>
        <label className="text-sm font-medium">Instituição<CampoSelect aria-label="Instituição" value={instituicao} onValueChange={v => onChangeFiltros({ ...filtros, instituicao: v })} options={opcoesInstituicao(contas)} /></label>
        {(inicio || fim) && <button type="button" onClick={() => onChangeFiltros({ ...filtros, inicio: "", fim: "" })} className="justify-self-start text-sm font-medium text-ink-3 underline underline-offset-4 hover:text-ink sm:col-span-2 xl:col-span-4">Limpar datas</button>}
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

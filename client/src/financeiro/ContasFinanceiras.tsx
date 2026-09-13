import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, Settings2 } from "lucide-react";
import type { Tab } from "../components/Shell";
import { obterConfiguracoesFinanceiras, obterExtratoConta, transferir, type ConfiguracoesFinanceiras, type Conta, type MovimentoConta } from "./novo-api";
import { brl, Button, type ColunaTabela, dataBR, Empty, ErrorBox, hoje, Modal, PageHeader, PaginaFinanceira, PaginaSemDados, Panel, Pill, TabelaFinanceira } from "./financeiro-ui";

/* Colunas do extrato. Entradas e saídas alinhadas à direita no cabeçalho E na
 * célula; dinheiro nunca quebra no meio (whitespace-nowrap). */
const COLUNAS_EXTRATO: ColunaTabela<MovimentoConta>[] = [
  { chave: "data", titulo: "Data", larguraMinima: 110, celula: (m) => <span className="whitespace-nowrap text-ink-3">{dataBR(m.transacao.data)}</span> },
  { chave: "descricao", titulo: "Descrição", larguraMinima: 260, principal: true, celula: (m) => <><strong className="break-words">{m.transacao.descricao || m.transacao.tipo}</strong><div className="mt-1 break-words text-xs text-ink-3">{m.transacao.formaPagamento?.replaceAll("_", " ") ?? "Movimento financeiro"}{m.transacao.parceiro ? ` · ${m.transacao.parceiro.nome}` : ""}</div></> },
  { chave: "origem", titulo: "Origem", larguraMinima: 150, celula: (m) => <span className="whitespace-nowrap">{m.transacao.operacao ? `OP-${String(m.transacao.operacao.id).padStart(4, "0")}` : "Transação avulsa"}</span> },
  { chave: "entrada", titulo: "Entrada", alinhamento: "direita", larguraMinima: 120, celula: (m) => <span className="whitespace-nowrap font-semibold text-green-800">{m.direcao === "ENTRADA" ? brl(m.valor) : "—"}</span> },
  { chave: "saida", titulo: "Saída", alinhamento: "direita", larguraMinima: 120, celula: (m) => <span className="whitespace-nowrap font-semibold">{m.direcao === "SAIDA" ? brl(m.valor) : "—"}</span> },
];

export function ContasFinanceiras({ onNav }: { onNav: (tab: Tab) => void }) {
  const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null); const [selecionada, setSelecionada] = useState<Conta | null>(null); const [extrato, setExtrato] = useState<MovimentoConta[]>([]); const [erro, setErro] = useState<string | null>(null); const [transferindo, setTransferindo] = useState(false); const [origemId, setOrigemId] = useState(""); const [destinoId, setDestinoId] = useState(""); const [valor, setValor] = useState("");
  const carregar = useCallback(() => obterConfiguracoesFinanceiras().then((cfg) => { setConfig(cfg); setSelecionada((atual) => cfg.contas.find((c) => c.id === atual?.id) ?? cfg.contas.find((c) => c.ativo) ?? cfg.contas[0] ?? null); }).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    let vigente = true;
    setExtrato([]);
    if (selecionada) obterExtratoConta(selecionada.id).then((movimentos) => { if (vigente) setExtrato(movimentos); }).catch((e) => { if (vigente) setErro(e.message); });
    return () => { vigente = false; };
  }, [selecionada]);
  if (!config) return <PaginaSemDados titulo="Contas e extratos" descricao="Selecione uma conta para acompanhar seu saldo e consultar as movimentações." label="Carregando contas" erro={erro} />;
  const saldoGeral = config.contas.filter((c) => c.ativo && c.incluirNoSaldoGeral).reduce((s, c) => s + Number(c.saldoAtual), 0);
  const registrarTransferencia = async (e: FormEvent) => { e.preventDefault(); try { await transferir({ contaOrigemId: Number(origemId), contaDestinoId: Number(destinoId), valor: Number(valor), data: hoje(), descricao: "Transferência entre contas" }); setTransferindo(false); setOrigemId(""); setDestinoId(""); setValor(""); await carregar(); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } };

  return <PaginaFinanceira>
    <PageHeader titulo="Contas e extratos" descricao="Selecione uma conta para acompanhar seu saldo e consultar as movimentações." acao={<div className="flex flex-wrap gap-2"><Button secondary onClick={() => onNav("cadastros")}><Settings2 size={16} /> Gerenciar contas</Button><Button onClick={() => setTransferindo(true)}><ArrowLeftRight size={16} /> Transferir</Button></div>} />
    <ErrorBox erro={erro} />
    <label className="mt-5 block max-w-md text-sm font-medium">Conta para consultar extrato<select className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5" value={selecionada?.id ?? ""} onChange={(e) => setSelecionada(config.contas.find((c) => String(c.id) === e.target.value) ?? null)}><option value="">Selecione uma conta</option>{config.contas.map((c) => <option key={c.id} value={c.id}>{c.nome}{!c.ativo ? " (inativa)" : ""}</option>)}</select></label>
    <p className="mt-3 text-sm text-ink-3">Saldo geral das {config.contas.filter((c) => c.ativo && c.incluirNoSaldoGeral).length} contas consideradas no escopo da fazenda selecionado: <strong className="whitespace-nowrap">{brl(saldoGeral)}</strong></p>
    {selecionada && <Panel className="mt-6 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5"><div className="min-w-0 flex-[1_1_260px]"><div className="eyebrow">Extrato da conta</div><h2 className="mt-1 break-words font-serif text-2xl">{selecionada.nome}</h2><p className="mt-1 break-words text-xs text-ink-3">Abertura em {dataBR(selecionada.dataSaldoAbertura)} com {brl(selecionada.saldoAbertura)}</p></div><div className="min-w-0"><div className="text-xs text-ink-3">Saldo atual da conta</div><div className="mt-1 whitespace-nowrap font-serif text-3xl">{brl(selecionada.saldoAtual)}</div>{!selecionada.incluirNoSaldoGeral && <p className="mt-1 text-xs text-ink-3">Não incluída no saldo geral</p>}</div><Pill tone={selecionada.ativo ? "green" : "neutral"}>{selecionada.ativo ? "Ativa" : "Inativa"}</Pill></div>
      {extrato.length ? <TabelaFinanceira rotulo={`Extrato de ${selecionada.nome}`} itens={extrato} colunas={COLUNAS_EXTRATO} chaveDe={(m) => m.id} classeLinha={(m) => m.transacao.status === "REVERTIDA" ? "opacity-55" : ""} /> : <Empty>Esta conta ainda não possui movimentos.</Empty>}
    </Panel>}

    {transferindo && <Modal titulo="Nova transferência" eyebrow="Entre contas próprias" onClose={() => setTransferindo(false)}><form onSubmit={registrarTransferencia} className="p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Conta de origem<select required value={origemId} onChange={(e) => setOrigemId(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal"><option value="">Selecione</option>{config.contas.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome} · {brl(c.saldoAtual)}</option>)}</select></label><label className="text-sm font-medium">Conta de destino<select required value={destinoId} onChange={(e) => setDestinoId(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal"><option value="">Selecione</option>{config.contas.filter((c) => c.ativo && String(c.id) !== origemId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label><label className="text-sm font-medium sm:col-span-2">Valor<input required min="0.01" step="0.01" type="number" value={valor} onChange={(e) => setValor(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" /></label></div><div className="mt-5 rounded-lg bg-[#eef1e9] p-4 text-sm text-green-900"><strong>Impacto no saldo geral: {brl(0)}</strong><p className="mt-1 text-xs">O valor sairá da origem e entrará no destino na mesma confirmação.</p></div><div className="mt-5 flex justify-end gap-2"><Button secondary onClick={() => setTransferindo(false)}>Cancelar</Button><Button type="submit" disabled={!origemId || !destinoId || Number(valor) <= 0}>Registrar transferência</Button></div></form></Modal>}
  </PaginaFinanceira>;
}

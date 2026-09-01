import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import { criarOperacao, type ConfiguracoesFinanceiras } from "./novo-api";
import { brl, Button, emDias, ErrorBox, hoje, Panel, ReviewLine, TIPO_OPERACAO } from "./financeiro-ui";

export function FormOperacao({ config, onSalvo, onCancelar }: { config: ConfiguracoesFinanceiras; onSalvo: () => void; onCancelar: () => void }) {
  const [tipo, setTipo] = useState("COMPRA_ESTOQUE"); const [condicao, setCondicao] = useState("A_VISTA");
  const [produtoId, setProdutoId] = useState(""); const [descricao, setDescricao] = useState(""); const [quantidade, setQuantidade] = useState("1"); const [valorUnitario, setValorUnitario] = useState("");
  const [parceiroId, setParceiroId] = useState(""); const [categoriaId, setCategoriaId] = useState(""); const [centroCustoId, setCentroCustoId] = useState(""); const [contaId, setContaId] = useState(""); const [data, setData] = useState(hoje()); const [vencimento, setVencimento] = useState(emDias(30)); const [valorAgora, setValorAgora] = useState("");
  const [salvando, setSalvando] = useState(false); const [erro, setErro] = useState<string | null>(null);
  const produto = config.produtos.find((p) => p.id === Number(produtoId)); const total = Number(quantidade || 0) * Number(valorUnitario || 0); const agora = condicao === "A_VISTA" ? total : Number(valorAgora || 0); const futuro = Math.max(0, total - agora);
  const categorias = config.gruposCategorias.flatMap((g) => g.categorias.map((c) => ({ ...c, grupo: g.nome })));
  const estoque = ["COMPRA_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "PRODUCAO"].includes(tipo); const venda = tipo === "VENDA";

  const submit = async (e: FormEvent) => { e.preventDefault(); setErro(null); setSalvando(true); try {
    const financeiro = condicao === "A_VISTA" ? { condicao, contaId: Number(contaId), formaPagamento: "PIX" }
      : condicao === "A_PRAZO" ? { condicao, parcelas: [{ valor: total, dataVencimento: vencimento }] }
        : condicao === "PARCIAL" ? { condicao, contaId: Number(contaId), valorPago: agora, formaPagamento: "PIX", parcelas: [{ valor: futuro, dataVencimento: vencimento }] }
          : { condicao: "SEM_EFEITO_FINANCEIRO" };
    await criarOperacao({ tipo, data, descricao, parceiroId: parceiroId ? Number(parceiroId) : undefined, categoriaId: categoriaId ? Number(categoriaId) : undefined, centroCustoId: centroCustoId ? Number(centroCustoId) : undefined, itens: [{ produtoId: produtoId ? Number(produtoId) : undefined, descricao: descricao || produto?.nome || "Item da operação", quantidade: Number(quantidade), unidade: produto?.unidade ?? "un", valorUnitario: Number(valorUnitario), estocavel: estoque && !!produto?.estocavel }], financeiro });
    onSalvo();
  } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setSalvando(false); } };

  return <Panel className="mt-6 overflow-hidden">
    <div className="flex items-start justify-between border-b border-border bg-[#f4f2e9] p-5"><div><div className="eyebrow">Registro orientado</div><h2 className="mt-1 font-serif text-2xl">Nova operação</h2><p className="mt-1 text-sm text-ink-3">Informe o fato uma vez e revise os efeitos antes de confirmar.</p></div><button onClick={onCancelar} aria-label="Fechar nova operação" className="rounded-lg p-2 text-ink-3 hover:bg-white"><X size={18} /></button></div>
    <form onSubmit={submit} className="grid xl:grid-cols-[1fr_320px]">
      <div className="p-5 md:p-6"><ErrorBox erro={erro} /><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm font-medium">Tipo de operação<select className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" value={tipo} onChange={(e) => setTipo(e.target.value)}>{Object.entries(TIPO_OPERACAO).filter(([k]) => !["TRANSFERENCIA_FINANCEIRA", "TRANSFERENCIA_ESTOQUE", "APORTE", "RETIRADA"].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-sm font-medium">Data<input required type="date" className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" value={data} onChange={(e) => setData(e.target.value)} /></label>
        <label className="text-sm font-medium">{venda ? "Cliente" : "Fornecedor ou parceiro"}<select className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" value={parceiroId} onChange={(e) => setParceiroId(e.target.value)}><option value="">Não informado</option>{config.parceiros.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
        <label className="text-sm font-medium">Produto{estoque && " *"}<select required={estoque} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" value={produtoId} onChange={(e) => { setProdutoId(e.target.value); const p = config.produtos.find((x) => x.id === Number(e.target.value)); if (p) { setDescricao(p.nome); setValorUnitario(p.custoUnitario ?? ""); } }}><option value="">Sem produto físico</option>{config.produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
        <label className="text-sm font-medium md:col-span-2">Descrição<input required className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" placeholder="Ex.: compra mensal de ração" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
        <label className="text-sm font-medium">Quantidade<input required min="0.001" step="0.001" type="number" className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></label>
        <label className="text-sm font-medium">Valor unitário<input required min="0" step="0.01" type="number" className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" value={valorUnitario} onChange={(e) => setValorUnitario(e.target.value)} /></label>
        <label className="text-sm font-medium">Condição<select className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" value={condicao} onChange={(e) => setCondicao(e.target.value)}><option value="A_VISTA">À vista</option><option value="A_PRAZO">A prazo</option><option value="PARCIAL">Parte agora, parte depois</option><option value="SEM_EFEITO_FINANCEIRO">Sem efeito financeiro</option></select></label>
        {(condicao === "A_VISTA" || condicao === "PARCIAL") && <label className="text-sm font-medium">Conta<select required className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" value={contaId} onChange={(e) => setContaId(e.target.value)}><option value="">Selecione</option>{config.contas.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>}
        {condicao === "PARCIAL" && <label className="text-sm font-medium">Valor realizado agora<input required min="0.01" max={Math.max(total - 0.01, 0)} step="0.01" type="number" className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" value={valorAgora} onChange={(e) => setValorAgora(e.target.value)} /></label>}
        {(condicao === "A_PRAZO" || condicao === "PARCIAL") && <label className="text-sm font-medium">Vencimento<input required type="date" className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></label>}
        <label className="text-sm font-medium">Categoria<select className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}><option value="">Sem categoria</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.grupo} · {c.nome}</option>)}</select></label>
        <label className="text-sm font-medium">Centro de custo<select className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" value={centroCustoId} onChange={(e) => setCentroCustoId(e.target.value)}><option value="">Sem centro de custo</option>{config.centrosCusto.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      </div></div>
      <aside className="border-t border-border bg-[#1f2b21] p-6 text-white xl:border-l xl:border-t-0"><div className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">Revisão dos efeitos</div><div className="mt-3 font-serif text-3xl">{brl(total)}</div><div className="mt-5 space-y-3 text-sm leading-5">
        <ReviewLine>Registrar {TIPO_OPERACAO[tipo]?.toLowerCase()}.</ReviewLine>
        {estoque && <ReviewLine tone="brown">Adicionar {quantidade || 0} {produto?.unidade ?? "un"} ao estoque.</ReviewLine>}
        {condicao === "A_VISTA" && <ReviewLine>Registrar {venda ? "recebimento" : "pagamento"} integral de {brl(total)}.</ReviewLine>}
        {condicao === "A_PRAZO" && <ReviewLine tone="amber">Criar conta {venda ? "a receber" : "a pagar"} de {brl(total)}. O saldo não muda agora.</ReviewLine>}
        {condicao === "PARCIAL" && <><ReviewLine>Realizar {brl(agora)} agora.</ReviewLine><ReviewLine tone="amber">Criar compromisso de {brl(futuro)}.</ReviewLine></>}
        {condicao === "SEM_EFEITO_FINANCEIRO" && <ReviewLine tone="neutral">Nenhuma conta financeira será movimentada.</ReviewLine>}
      </div><div className="mt-8 border-t border-white/10 pt-5"><Button type="submit" disabled={salvando || total <= 0 || (condicao === "PARCIAL" && (agora <= 0 || futuro <= 0))} className="w-full !bg-[#e9e3d2] !text-[#1f2b21]">{salvando ? "Confirmando…" : "Confirmar operação"}</Button><p className="mt-3 text-center text-[11px] leading-4 text-[#aeb9aa]">A confirmação cria somente os efeitos descritos acima.</p></div></aside>
    </form>
  </Panel>;
}

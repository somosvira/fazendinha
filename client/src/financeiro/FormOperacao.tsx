import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import { FileText, Paperclip, Plus, Trash2, X } from "lucide-react";
import { anexarDocumentoOperacao, criarOperacao, type ConfiguracoesFinanceiras } from "./novo-api";
import { brl, Button, emDias, ErrorBox, hoje, Modal, ReviewLine, TIPO_OPERACAO } from "./financeiro-ui";

type Condicao = "A_VISTA" | "A_PRAZO" | "PARCIAL" | "SEM_EFEITO_FINANCEIRO";
type ModoValor = "UNITARIO" | "TOTAL";
type ItemForm = { id: number; produtoId: string; descricao: string; quantidade: string; unidade: string; modoValor: ModoValor; valorUnitario: string; valorTotal: string };
type ParcelaForm = { id: number; valor: string; vencimento: string };
type AnexoForm = { id: number; arquivo: File; tipo: string; numero: string };

const TIPOS_COM_ITENS = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "VENDA", "AJUSTE_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO"]);
const TIPOS_COM_ESTOQUE = new Set(["COMPRA_ESTOQUE", "VENDA", "AJUSTE_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO"]);
const TIPOS_FINANCEIROS = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "DEVOLUCAO"]);
const TIPOS_COM_PARCEIRO = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "DEVOLUCAO"]);
const FORMAS_PAGAMENTO = { PIX: "Pix", TRANSFERENCIA_BANCARIA: "Transferência bancária", BOLETO: "Boleto", DINHEIRO: "Dinheiro", CARTAO: "Cartão", CHEQUE: "Cheque", DEBITO_AUTOMATICO: "Débito automático", OUTRO: "Outro" };
const TIPOS_DOCUMENTO = { NOTA_FISCAL: "Nota fiscal", BOLETO: "Boleto", CONTRATO: "Contrato", RECIBO: "Recibo", COMPROVANTE: "Comprovante", JUSTIFICATIVA: "Justificativa", OUTRO: "Outro" };
const CAMPO = "mt-1.5 w-full rounded-lg border border-[#d8cfbb] bg-white px-3 py-2.5 font-normal text-ink outline-none transition focus:border-[#6f7d68] focus:ring-2 focus:ring-[#6f7d68]/15";
const SELECT = `${CAMPO} cursor-pointer`;
const normalizarMoeda = (valor: string) => valor === "" ? "" : Number(valor).toFixed(2);

let proximoId = 1;
const novoItem = (): ItemForm => ({ id: proximoId++, produtoId: "", descricao: "", quantidade: "1", unidade: "un", modoValor: "UNITARIO", valorUnitario: "", valorTotal: "" });
const novaParcela = (indice = 0): ParcelaForm => ({ id: proximoId++, valor: "", vencimento: emDias(30 * (indice + 1)) });
const totalItem = (item: ItemForm) => item.modoValor === "TOTAL" ? Number(item.valorTotal || 0) : Number(item.quantidade || 0) * Number(item.valorUnitario || 0);
const parceiroLabel = (tipo: string) => tipo === "VENDA" ? "Cliente" : tipo === "DEVOLUCAO" ? "Fornecedor da devolução" : "Fornecedor ou parceiro";

export function FormOperacao({ config, onSalvo, onCancelar }: { config: ConfiguracoesFinanceiras; onSalvo: (aviso?: string) => void; onCancelar: () => void }) {
  const [tipo, setTipo] = useState("COMPRA_ESTOQUE");
  const [condicao, setCondicao] = useState<Condicao>("A_VISTA");
  const [descricao, setDescricao] = useState("");
  const [valorOperacao, setValorOperacao] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([novoItem()]);
  const [parceiroId, setParceiroId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [contaId, setContaId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [data, setData] = useState(hoje());
  const [valorAgora, setValorAgora] = useState("");
  const [parcelas, setParcelas] = useState<ParcelaForm[]>([novaParcela()]);
  const [anexos, setAnexos] = useState<AnexoForm[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const comItens = TIPOS_COM_ITENS.has(tipo);
  const movimentaEstoque = TIPOS_COM_ESTOQUE.has(tipo);
  const permiteFinanceiro = TIPOS_FINANCEIROS.has(tipo);
  const exigeParceiro = TIPOS_COM_PARCEIRO.has(tipo);
  const entradaFinanceira = tipo === "VENDA" || tipo === "DEVOLUCAO";
  const total = comItens ? itens.reduce((soma, item) => soma + totalItem(item), 0) : Number(valorOperacao || 0);
  const realizadoAgora = condicao === "A_VISTA" ? total : Number(valorAgora || 0);
  const totalParcelas = parcelas.reduce((soma, parcela) => soma + Number(parcela.valor || 0), 0);
  const saldoFuturo = Math.max(0, total - realizadoAgora);
  const categorias = config.gruposCategorias.flatMap((grupo) => grupo.categorias.map((categoria) => ({ ...categoria, grupo: grupo.nome })));
  const parceiros = useMemo(() => config.parceiros.filter((parceiro) => {
    if (!parceiro.ativo) return false;
    if (tipo === "VENDA") return ["CLIENTE", "AMBOS", "OUTRO"].includes(parceiro.tipo);
    if (exigeParceiro) return ["FORNECEDOR", "AMBOS", "OUTRO"].includes(parceiro.tipo);
    return true;
  }), [config.parceiros, exigeParceiro, tipo]);

  const atualizarItem = (id: number, patch: Partial<ItemForm>) => setItens((atuais) => atuais.map((item) => item.id === id ? { ...item, ...patch } : item));
  const alterarProduto = (id: number, produtoId: string) => {
    const produto = config.produtos.find((item) => item.id === Number(produtoId));
    atualizarItem(id, produto ? { produtoId, descricao: produto.nome, unidade: produto.unidade, valorUnitario: produto.custoUnitario ?? "" } : { produtoId });
  };
  const alterarTipo = (novoTipo: string) => {
    setTipo(novoTipo);
    setParceiroId("");
    if (!TIPOS_FINANCEIROS.has(novoTipo)) setCondicao("SEM_EFEITO_FINANCEIRO");
    else if (condicao === "SEM_EFEITO_FINANCEIRO") setCondicao("A_VISTA");
  };
  const alterarCondicao = (novaCondicao: Condicao) => {
    setCondicao(novaCondicao);
    if (novaCondicao === "A_PRAZO") setParcelas([{ ...novaParcela(), valor: total ? total.toFixed(2) : "" }]);
    if (novaCondicao === "PARCIAL") {
      const metade = total / 2;
      setValorAgora(metade ? metade.toFixed(2) : "");
      setParcelas([{ ...novaParcela(), valor: metade ? (total - metade).toFixed(2) : "" }]);
    }
  };
  const selecionarAnexos = (evento: ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(evento.target.files ?? []);
    const permitidas = new Set(["pdf", "xml", "jpg", "jpeg", "png", "webp"]);
    const invalidos = arquivos.filter((arquivo) => arquivo.size > 10 * 1024 * 1024 || !permitidas.has(arquivo.name.split(".").pop()?.toLowerCase() ?? ""));
    if (invalidos.length) setErro(`Alguns arquivos não foram adicionados por formato ou tamanho inválido: ${invalidos.map((arquivo) => arquivo.name).join(", ")}`);
    const validos = arquivos.filter((arquivo) => !invalidos.includes(arquivo));
    setAnexos((atuais) => [...atuais, ...validos.map((arquivo) => ({ id: proximoId++, arquivo, tipo: "NOTA_FISCAL", numero: "" }))]);
    evento.target.value = "";
  };

  const itensValidos = !comItens || itens.every((item) => item.descricao.trim() && Number(item.quantidade) > 0 && (!movimentaEstoque || item.produtoId));
  const parcelasValidas = condicao === "A_PRAZO" ? parcelas.length > 0 && Math.abs(totalParcelas - total) < 0.01
    : condicao === "PARCIAL" ? realizadoAgora > 0 && saldoFuturo > 0 && parcelas.length > 0 && Math.abs(totalParcelas - saldoFuturo) < 0.01 : true;
  const contaValida = !["A_VISTA", "PARCIAL"].includes(condicao) || !!contaId;
  const podeConfirmar = descricao.trim().length >= 2 && (!exigeParceiro || !!parceiroId) && itensValidos && contaValida && parcelasValidas && (total > 0 || (!permiteFinanceiro && total >= 0));

  const submit = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!podeConfirmar) return;
    setErro(null);
    setSalvando(true);
    try {
      const financeiro = condicao === "A_VISTA" ? { condicao, contaId: Number(contaId), formaPagamento }
        : condicao === "A_PRAZO" ? { condicao, parcelas: parcelas.map((parcela) => ({ valor: Number(parcela.valor), dataVencimento: parcela.vencimento })) }
          : condicao === "PARCIAL" ? { condicao, contaId: Number(contaId), valorPago: realizadoAgora, formaPagamento, parcelas: parcelas.map((parcela) => ({ valor: Number(parcela.valor), dataVencimento: parcela.vencimento })) }
            : { condicao: "SEM_EFEITO_FINANCEIRO" };
      const operacao = await criarOperacao({
        tipo, data, descricao: descricao.trim(), valorTotal: comItens ? undefined : total,
        parceiroId: parceiroId ? Number(parceiroId) : undefined,
        categoriaId: categoriaId ? Number(categoriaId) : undefined,
        centroCustoId: centroCustoId ? Number(centroCustoId) : undefined,
        itens: comItens ? itens.map((item) => {
          const produto = config.produtos.find((produtoAtual) => produtoAtual.id === Number(item.produtoId));
          const quantidade = Number(item.quantidade);
          const valorUnitario = item.modoValor === "TOTAL" ? Number(item.valorTotal) / quantidade : Number(item.valorUnitario);
          return { produtoId: item.produtoId ? Number(item.produtoId) : undefined, descricao: item.descricao.trim(), quantidade, unidade: item.unidade || produto?.unidade || "un", valorUnitario, estocavel: movimentaEstoque && !!produto?.estocavel };
        }) : [], financeiro,
      });
      const falhas: string[] = [];
      for (const anexo of anexos) {
        try { await anexarDocumentoOperacao(operacao.id, anexo); }
        catch (falha) { falhas.push(`${anexo.arquivo.name}: ${falha instanceof Error ? falha.message : String(falha)}`); }
      }
      onSalvo(falhas.length ? `A operação OP-${String(operacao.id).padStart(4, "0")} foi criada, mas alguns anexos falharam: ${falhas.join("; ")}` : undefined);
    } catch (falha) { setErro(falha instanceof Error ? falha.message : String(falha)); }
    finally { setSalvando(false); }
  };

  return <Modal titulo="Nova operação" eyebrow="Registro orientado" onClose={onCancelar} width="max-w-[1240px]" semCabecalho>
    <form onSubmit={submit} className="grid h-full min-h-0 overflow-y-auto xl:grid-cols-[minmax(0,1fr)_330px] xl:overflow-hidden">
      <div className="space-y-7 p-5 md:p-7 xl:min-h-0 xl:overflow-y-auto">
        <ErrorBox erro={erro} />
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Identificação</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-medium">Tipo de operação<select aria-label="Tipo de operação" className={SELECT} value={tipo} onChange={(e) => alterarTipo(e.target.value)}>{Object.entries(TIPO_OPERACAO).filter(([chave]) => !["TRANSFERENCIA_FINANCEIRA", "TRANSFERENCIA_ESTOQUE", "APORTE", "RETIRADA"].includes(chave)).map(([chave, nome]) => <option key={chave} value={chave}>{nome}</option>)}</select></label>
            <label className="text-sm font-medium">Data<input aria-label="Data" required type="date" className={CAMPO} value={data} onChange={(e) => setData(e.target.value)} /></label>
            {exigeParceiro && <label className="text-sm font-medium">{parceiroLabel(tipo)} *<select aria-label={parceiroLabel(tipo)} required className={SELECT} value={parceiroId} onChange={(e) => setParceiroId(e.target.value)}><option value="">Selecione</option>{parceiros.map((parceiro) => <option key={parceiro.id} value={parceiro.id}>{parceiro.nome}</option>)}</select></label>}
            <label className="text-sm font-medium md:col-span-2 xl:col-span-3">Descrição *<textarea aria-label="Descrição" required maxLength={240} className={`${CAMPO} min-h-20`} placeholder={tipo === "SERVICO" ? "Ex.: manutenção preventiva do trator" : "Descreva o objetivo da operação"} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
          </div>
        </section>
        {comItens ? <ItensOperacao itens={itens} setItens={setItens} config={config} movimentaEstoque={movimentaEstoque} atualizarItem={atualizarItem} alterarProduto={alterarProduto} /> : <section><h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Valor do serviço</h3><label className="block max-w-xs text-sm font-medium">Valor total *<input aria-label="Valor total da operação" required min="0.01" step="0.01" type="number" className={CAMPO} value={valorOperacao} onChange={(e) => setValorOperacao(e.target.value)} onBlur={(e) => setValorOperacao(normalizarMoeda(e.target.value))} /></label></section>}
        <section><h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Classificação</h3><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Categoria<select aria-label="Categoria" className={SELECT} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}><option value="">Sem categoria</option>{categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.grupo} · {categoria.nome}</option>)}</select></label><label className="text-sm font-medium">Centro de custo<select aria-label="Centro de custo" className={SELECT} value={centroCustoId} onChange={(e) => setCentroCustoId(e.target.value)}><option value="">Sem centro de custo</option>{config.centrosCusto.map((centro) => <option key={centro.id} value={centro.id}>{centro.nome}</option>)}</select></label></div></section>
        <EfeitoFinanceiro permite={permiteFinanceiro} condicao={condicao} alterarCondicao={alterarCondicao} contaId={contaId} setContaId={setContaId} formaPagamento={formaPagamento} setFormaPagamento={setFormaPagamento} config={config} valorAgora={valorAgora} setValorAgora={setValorAgora} total={total} parcelas={parcelas} setParcelas={setParcelas} parcelasValidas={parcelasValidas} saldoFuturo={saldoFuturo} />
        <Documentos anexos={anexos} setAnexos={setAnexos} selecionarAnexos={selecionarAnexos} />
      </div>
      <aside className="relative flex flex-col border-t border-border bg-[#1f2b21] p-6 text-white xl:min-h-0 xl:border-l xl:border-t-0"><button type="button" onClick={onCancelar} aria-label="Fechar" className="absolute right-4 top-4 rounded-lg p-2 text-[#aeb9aa] transition hover:bg-white/10 hover:text-white"><X size={18} /></button><div className="pr-8"><div className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">Revisão dos efeitos</div><div className="mt-3 font-serif text-3xl">{brl(total)}</div><div className="mt-5 space-y-3 text-sm leading-5"><ReviewLine>Registrar {TIPO_OPERACAO[tipo]?.toLowerCase()}.</ReviewLine>{movimentaEstoque && <ReviewLine tone="brown">Gerar {itens.length} movimento{itens.length === 1 ? "" : "s"} físico{itens.length === 1 ? "" : "s"} de estoque.</ReviewLine>}{condicao === "A_VISTA" && <ReviewLine>Registrar {entradaFinanceira ? "recebimento" : "pagamento"} integral de {brl(total)}.</ReviewLine>}{condicao === "A_PRAZO" && <ReviewLine tone="amber">Criar {parcelas.length} compromisso{parcelas.length === 1 ? "" : "s"} {entradaFinanceira ? "a receber" : "a pagar"}, totalizando {brl(totalParcelas)}. O saldo não muda agora.</ReviewLine>}{condicao === "PARCIAL" && <><ReviewLine>Registrar {entradaFinanceira ? "recebimento" : "pagamento"} de {brl(realizadoAgora)} agora.</ReviewLine><ReviewLine tone="amber">Criar {parcelas.length} compromisso{parcelas.length === 1 ? "" : "s"} para o saldo de {brl(totalParcelas)}.</ReviewLine></>}{condicao === "SEM_EFEITO_FINANCEIRO" && <ReviewLine tone="neutral">Nenhuma conta financeira ou compromisso será movimentado.</ReviewLine>}{anexos.length > 0 && <ReviewLine tone="neutral">Anexar {anexos.length} documento{anexos.length === 1 ? "" : "s"} à operação.</ReviewLine>}</div></div><div className="mt-8 border-t border-white/10 pt-5 xl:mt-auto"><p className="mb-3 text-center text-[11px] leading-4 text-[#aeb9aa]">A confirmação cria somente os efeitos descritos acima.</p><Button type="submit" disabled={salvando || !podeConfirmar} className="w-full !bg-[#e9e3d2] !text-[#1f2b21]">{salvando ? "Confirmando…" : "Confirmar operação"}</Button></div></aside>
    </form>
  </Modal>;
}

function ItensOperacao({ itens, setItens, config, movimentaEstoque, atualizarItem, alterarProduto }: { itens: ItemForm[]; setItens: React.Dispatch<React.SetStateAction<ItemForm[]>>; config: ConfiguracoesFinanceiras; movimentaEstoque: boolean; atualizarItem: (id: number, patch: Partial<ItemForm>) => void; alterarProduto: (id: number, produtoId: string) => void }) {
  return <section>
    <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Itens da operação</h3><p className="mt-1 text-xs text-ink-3">Informe o valor unitário ou alterne para o valor total de cada item.</p></div><Button type="button" secondary onClick={() => setItens((atuais) => [...atuais, novoItem()])}><Plus size={15} /> Adicionar item</Button></div>
    <div className="space-y-3">{itens.map((item, indice) => {
      const produto = config.produtos.find((produtoAtual) => produtoAtual.id === Number(item.produtoId));
      const unidade = produto?.unidade ?? item.unidade;
      return <div key={item.id} className="rounded-xl border border-border bg-[#faf9f4] p-4">
        <div className="mb-3 flex items-center justify-between"><strong className="text-sm">Item {indice + 1}</strong>{itens.length > 1 && <button type="button" aria-label={`Remover item ${indice + 1}`} onClick={() => setItens((atuais) => atuais.filter((atual) => atual.id !== item.id))} className="rounded-lg p-1.5 text-red-700 hover:bg-red-50"><Trash2 size={16} /></button>}</div>
        <div className="grid gap-4 md:grid-cols-[minmax(200px,0.8fr)_minmax(0,2fr)]">
          <label className="text-sm font-medium">Produto{movimentaEstoque && " *"}<select aria-label={`Produto do item ${indice + 1}`} required={movimentaEstoque} className={SELECT} value={item.produtoId} onChange={(e) => alterarProduto(item.id, e.target.value)}><option value="">{movimentaEstoque ? "Selecione" : "Sem produto cadastrado"}</option>{config.produtos.map((produtoAtual) => <option key={produtoAtual.id} value={produtoAtual.id}>{produtoAtual.nome}</option>)}</select></label>
          <label className="text-sm font-medium">Descrição do item *<input aria-label={`Descrição do item ${indice + 1}`} required className={CAMPO} value={item.descricao} onChange={(e) => atualizarItem(item.id, { descricao: e.target.value })} /></label>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.1fr]">
          <label className="text-sm font-medium">Quantidade *<div className="mt-1.5 flex"><input aria-label={`Quantidade do item ${indice + 1}`} required min="0.001" step="0.001" type="number" className="min-w-0 flex-1 rounded-l-lg border border-[#d8cfbb] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#6f7d68] focus:ring-2 focus:ring-[#6f7d68]/15" value={item.quantidade} onChange={(e) => atualizarItem(item.id, { quantidade: e.target.value })} /><span aria-label={`Unidade do item ${indice + 1}`} className="inline-flex min-w-14 items-center justify-center rounded-r-lg border border-l-0 border-[#d8cfbb] bg-[#f0ede4] px-3 text-sm text-ink-3">{unidade || "un"}</span></div></label>
          <label className="text-sm font-medium">Base do valor<select aria-label={`Base do valor do item ${indice + 1}`} className={SELECT} value={item.modoValor} onChange={(e) => atualizarItem(item.id, { modoValor: e.target.value as ModoValor })}><option value="UNITARIO">Valor unitário</option><option value="TOTAL">Valor total do item</option></select></label>
          {item.modoValor === "UNITARIO" ? <label className="text-sm font-medium">Valor unitário *<input aria-label={`Valor unitário do item ${indice + 1}`} required min="0" step="0.01" type="number" className={CAMPO} value={item.valorUnitario} onChange={(e) => atualizarItem(item.id, { valorUnitario: e.target.value })} onBlur={(e) => atualizarItem(item.id, { valorUnitario: normalizarMoeda(e.target.value) })} /></label> : <label className="text-sm font-medium">Valor total do item *<input aria-label={`Valor total do item ${indice + 1}`} required min="0" step="0.01" type="number" className={CAMPO} value={item.valorTotal} onChange={(e) => atualizarItem(item.id, { valorTotal: e.target.value })} onBlur={(e) => atualizarItem(item.id, { valorTotal: normalizarMoeda(e.target.value) })} /></label>}
          <div className="self-end rounded-lg border border-[#e5dfd0] bg-white px-3 py-2.5 text-sm"><span className="text-ink-3">Total do item</span><strong className="float-right">{brl(totalItem(item))}</strong></div>
        </div>
      </div>;
    })}</div>
  </section>;
}

function EfeitoFinanceiro({ permite, condicao, alterarCondicao, contaId, setContaId, formaPagamento, setFormaPagamento, config, valorAgora, setValorAgora, total, parcelas, setParcelas, parcelasValidas, saldoFuturo }: { permite: boolean; condicao: Condicao; alterarCondicao: (condicao: Condicao) => void; contaId: string; setContaId: (id: string) => void; formaPagamento: string; setFormaPagamento: (forma: string) => void; config: ConfiguracoesFinanceiras; valorAgora: string; setValorAgora: (valor: string) => void; total: number; parcelas: ParcelaForm[]; setParcelas: React.Dispatch<React.SetStateAction<ParcelaForm[]>>; parcelasValidas: boolean; saldoFuturo: number }) {
  return <section><h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Efeito financeiro</h3>{permite ? <div className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Condição<select aria-label="Condição financeira" className={SELECT} value={condicao} onChange={(e) => alterarCondicao(e.target.value as Condicao)}><option value="A_VISTA">Liquidação integral na operação</option><option value="A_PRAZO">Liquidação integral a prazo</option><option value="PARCIAL">Liquidação parcial com saldo a prazo</option><option value="SEM_EFEITO_FINANCEIRO">Sem movimentação financeira</option></select></label>{(condicao === "A_VISTA" || condicao === "PARCIAL") && <><label className="text-sm font-medium">Conta financeira *<select aria-label="Conta financeira" required className={SELECT} value={contaId} onChange={(e) => setContaId(e.target.value)}><option value="">Selecione</option>{config.contas.filter((conta) => conta.ativo).map((conta) => <option key={conta.id} value={conta.id}>{conta.nome}</option>)}</select></label><label className="text-sm font-medium">Forma de liquidação<select aria-label="Forma de liquidação" className={SELECT} value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>{Object.entries(FORMAS_PAGAMENTO).map(([chave, nome]) => <option key={chave} value={chave}>{nome}</option>)}</select></label></> }</div>{condicao === "PARCIAL" && <label className="block max-w-xs text-sm font-medium">Valor liquidado na operação *<input aria-label="Valor liquidado na operação" required min="0.01" max={Math.max(total - 0.01, 0)} step="0.01" type="number" className={CAMPO} value={valorAgora} onChange={(e) => setValorAgora(e.target.value)} /></label>}{(condicao === "A_PRAZO" || condicao === "PARCIAL") && <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><strong className="text-sm">Parcelas do compromisso</strong><p className="mt-1 text-xs text-ink-3">Cada parcela será criada como um compromisso vinculado a esta operação.</p></div><Button type="button" secondary onClick={() => setParcelas((atuais) => [...atuais, novaParcela(atuais.length)])}><Plus size={15} /> Parcela</Button></div><div className="space-y-3">{parcelas.map((parcela, indice) => <div key={parcela.id} className="grid items-end gap-3 sm:grid-cols-[80px_1fr_1fr_40px]"><strong className="pb-2.5 text-sm">{indice + 1}/{parcelas.length}</strong><label className="text-sm font-medium">Valor<input aria-label={`Valor da parcela ${indice + 1}`} required min="0.01" step="0.01" type="number" className={CAMPO} value={parcela.valor} onChange={(e) => setParcelas((atuais) => atuais.map((atual) => atual.id === parcela.id ? { ...atual, valor: e.target.value } : atual))} /></label><label className="text-sm font-medium">Vencimento<input aria-label={`Vencimento da parcela ${indice + 1}`} required type="date" className={CAMPO} value={parcela.vencimento} onChange={(e) => setParcelas((atuais) => atuais.map((atual) => atual.id === parcela.id ? { ...atual, vencimento: e.target.value } : atual))} /></label><button type="button" disabled={parcelas.length === 1} aria-label={`Remover parcela ${indice + 1}`} onClick={() => setParcelas((atuais) => atuais.filter((atual) => atual.id !== parcela.id))} className="mb-1 rounded-lg p-2 text-red-700 hover:bg-red-50 disabled:opacity-30"><Trash2 size={16} /></button></div>)}</div>{!parcelasValidas && <p className="mt-3 text-xs font-medium text-red-700">A soma das parcelas deve corresponder a {brl(condicao === "PARCIAL" ? saldoFuturo : total)}.</p>}</div>}</div> : <div className="rounded-lg bg-[#eef1e9] p-4 text-sm text-green-900"><strong>Sem movimentação financeira</strong><p className="mt-1 text-xs leading-5">Este tipo registra somente o efeito físico ou de valorização. Nenhuma conta ou compromisso será criado.</p></div>}</section>;
}

function Documentos({ anexos, setAnexos, selecionarAnexos }: { anexos: AnexoForm[]; setAnexos: React.Dispatch<React.SetStateAction<AnexoForm[]>>; selecionarAnexos: (evento: ChangeEvent<HTMLInputElement>) => void }) {
  return <section><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Documentos</h3><p className="mt-1 text-xs text-ink-3">PDF, XML, JPG, PNG ou WEBP, com até 10 MB por arquivo.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-[#faf9f4]"><Paperclip size={15} /> Anexar<input aria-label="Anexar documentos" type="file" multiple accept=".pdf,.xml,.jpg,.jpeg,.png,.webp,application/pdf,application/xml,text/xml,image/jpeg,image/png,image/webp" className="sr-only" onChange={selecionarAnexos} /></label></div>{anexos.length ? <div className="space-y-2">{anexos.map((anexo) => <div key={anexo.id} className="grid items-center gap-3 rounded-lg border border-border p-3 md:grid-cols-[minmax(0,1fr)_180px_160px_36px]"><div className="flex min-w-0 items-center gap-3"><FileText size={18} className="shrink-0 text-ink-3" /><div className="min-w-0"><div className="truncate text-sm font-medium">{anexo.arquivo.name}</div><div className="text-xs text-ink-3">{(anexo.arquivo.size / 1024 / 1024).toFixed(2)} MB</div></div></div><select aria-label={`Tipo do documento ${anexo.arquivo.name}`} className={`${SELECT} mt-0 p-2 text-sm`} value={anexo.tipo} onChange={(e) => setAnexos((atuais) => atuais.map((atual) => atual.id === anexo.id ? { ...atual, tipo: e.target.value } : atual))}>{Object.entries(TIPOS_DOCUMENTO).map(([chave, nome]) => <option key={chave} value={chave}>{nome}</option>)}</select><input aria-label={`Número do documento ${anexo.arquivo.name}`} placeholder="Número (opcional)" className="rounded-lg border border-[#d8cfbb] bg-white p-2 text-sm outline-none focus:border-[#6f7d68] focus:ring-2 focus:ring-[#6f7d68]/15" value={anexo.numero} onChange={(e) => setAnexos((atuais) => atuais.map((atual) => atual.id === anexo.id ? { ...atual, numero: e.target.value } : atual))} /><button type="button" aria-label={`Remover documento ${anexo.arquivo.name}`} onClick={() => setAnexos((atuais) => atuais.filter((atual) => atual.id !== anexo.id))} className="rounded-lg p-2 text-red-700 hover:bg-red-50"><Trash2 size={16} /></button></div>)}</div> : <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-ink-3">Nenhum documento anexado.</div>}</section>;
}

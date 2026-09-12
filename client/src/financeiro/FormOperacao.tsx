import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { anexarDocumentoOperacao, anexarDocumentoRascunho, atualizarDocumentoRascunho, confirmarRascunhoOperacao, criarOperacao, descartarRascunhoOperacao, removerDocumentoRascunho, salvarRascunhoOperacao, type ConfiguracoesFinanceiras, type DocumentoFinanceiro, type Operacao, type RascunhoOperacao } from "./novo-api";
import { brl, Button, emDias, ErrorBox, hoje, ReviewLine, TIPO_OPERACAO } from "./financeiro-ui";
import { FORMAS_PAGAMENTO, parceiroCompativel, parcelasSugeridas } from "./lib/parceiros";

type Condicao = "A_VISTA" | "A_PRAZO" | "PARCIAL" | "SEM_EFEITO_FINANCEIRO";
type ModoValor = "UNITARIO" | "TOTAL";
type ItemForm = { id: number; produtoId: string; descricao: string; quantidade: string; unidade: string; modoValor: ModoValor; valorUnitario: string; valorTotal: string };
type ParcelaForm = { id: number; valor: string; vencimento: string };
type AnexoForm = { id: number; arquivo: File; tipo: string; numero: string };
type EstadoFormulario = {
  tipo: string; condicao: Condicao; descricao: string; valorOperacao: string; itens: ItemForm[];
  parceiroId: string; categoriaId: string; centroCustoId: string; contaId: string;
  formaPagamento: string; data: string; valorAgora: string; parcelas: ParcelaForm[];
};

const TIPOS_COM_ITENS = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "VENDA", "AJUSTE_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO"]);
const TIPOS_COM_ESTOQUE = new Set(["COMPRA_ESTOQUE", "VENDA", "AJUSTE_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO"]);
const TIPOS_FINANCEIROS = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "DEVOLUCAO"]);
const TIPOS_COM_PARCEIRO = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "DEVOLUCAO"]);
const TIPOS_DOCUMENTO = { NOTA_FISCAL: "Nota fiscal", BOLETO: "Boleto", CONTRATO: "Contrato", RECIBO: "Recibo", COMPROVANTE: "Comprovante", JUSTIFICATIVA: "Justificativa", OUTRO: "Outro" };
const CAMPO = "mt-1.5 w-full rounded-lg border border-[#d8cfbb] bg-white px-3 py-2.5 font-normal text-ink outline-none transition focus:border-[#6f7d68] focus:ring-2 focus:ring-[#6f7d68]/15";
const SELECT = `${CAMPO} cursor-pointer`;
const normalizarMoeda = (valor: string) => valor === "" ? "" : Number(valor).toFixed(2);

let proximoId = 1;
const novoItem = (): ItemForm => ({ id: proximoId++, produtoId: "", descricao: "", quantidade: "1", unidade: "un", modoValor: "UNITARIO", valorUnitario: "", valorTotal: "" });
const novaParcela = (indice = 0): ParcelaForm => ({ id: proximoId++, valor: "", vencimento: emDias(30 * (indice + 1)) });
const totalItem = (item: ItemForm) => item.modoValor === "TOTAL" ? Number(item.valorTotal || 0) : Number(item.quantidade || 0) * Number(item.valorUnitario || 0);
const parceiroLabel = (tipo: string) => tipo === "VENDA" ? "Cliente" : tipo === "SERVICO" ? "Prestador de serviço" : tipo === "DEVOLUCAO" ? "Fornecedor da devolução" : "Fornecedor ou parceiro";

export function FormOperacao({ config, rascunho = null, condicaoInicial, tipoInicial, operacaoBase = null, onSalvo }: { config: ConfiguracoesFinanceiras; rascunho?: RascunhoOperacao | null; condicaoInicial?: Condicao; tipoInicial?: string; operacaoBase?: Operacao | null; onSalvo: (operacao: Operacao, aviso?: string) => void }) {
  const inicial = (!operacaoBase ? rascunho?.dados.formulario : null) as Partial<EstadoFormulario> | null;
  const transacaoBase = operacaoBase?.transacoes.find((item) => item.tipo !== "REVERSAO");
  const temCompromissos = !!operacaoBase?.compromissos.length;
  const condicaoBase: Condicao = inicial?.condicao ?? (!operacaoBase ? condicaoInicial ?? "A_VISTA" : transacaoBase && temCompromissos ? "PARCIAL" : temCompromissos ? "A_PRAZO" : transacaoBase ? "A_VISTA" : "SEM_EFEITO_FINANCEIRO");
  const [tipo, setTipo] = useState(inicial?.tipo ?? operacaoBase?.tipo ?? tipoInicial ?? "COMPRA_ESTOQUE");
  const [condicao, setCondicao] = useState<Condicao>(condicaoBase);
  const [descricao, setDescricao] = useState(inicial?.descricao ?? (operacaoBase ? `Correção da OP-${String(operacaoBase.id).padStart(4, "0")} — ${operacaoBase.descricao ?? TIPO_OPERACAO[operacaoBase.tipo]}` : ""));
  const [valorOperacao, setValorOperacao] = useState(inicial?.valorOperacao ?? operacaoBase?.valorTotal ?? "");
  const [itens, setItens] = useState<ItemForm[]>(() => inicial?.itens ?? (operacaoBase?.itens.length ? operacaoBase.itens.map((item) => ({ id: proximoId++, produtoId: item.produtoId ? String(item.produtoId) : "", descricao: item.descricao, quantidade: item.quantidade, unidade: item.unidade, modoValor: "UNITARIO", valorUnitario: item.valorUnitario, valorTotal: item.valorTotal })) : [novoItem()]));
  const [parceiroId, setParceiroId] = useState(inicial?.parceiroId ?? (operacaoBase?.parceiro?.id ? String(operacaoBase.parceiro.id) : ""));
  const [categoriaId, setCategoriaId] = useState(inicial?.categoriaId ?? (operacaoBase?.categoriaId ? String(operacaoBase.categoriaId) : ""));
  const [centroCustoId, setCentroCustoId] = useState(inicial?.centroCustoId ?? (operacaoBase?.centroCustoId ? String(operacaoBase.centroCustoId) : ""));
  const [contaId, setContaId] = useState(inicial?.contaId ?? (transacaoBase?.movimentos?.[0]?.contaId ? String(transacaoBase.movimentos[0].contaId) : ""));
  const [formaPagamento, setFormaPagamento] = useState(inicial?.formaPagamento ?? transacaoBase?.formaPagamento ?? "PIX");
  const [data, setData] = useState(inicial?.data ?? hoje());
  const [valorAgora, setValorAgora] = useState(inicial?.valorAgora ?? (condicaoBase === "PARCIAL" ? transacaoBase?.valorTotal ?? "" : ""));
  const [parcelas, setParcelas] = useState<ParcelaForm[]>(() => inicial?.parcelas ?? (operacaoBase?.compromissos.length ? operacaoBase.compromissos.map((item) => ({ id: proximoId++, valor: item.valorOriginal, vencimento: item.dataVencimento.slice(0, 10) })) : [novaParcela()]));
  const [anexos, setAnexos] = useState<AnexoForm[]>([]);
  const [documentosSalvos, setDocumentosSalvos] = useState<DocumentoFinanceiro[]>(rascunho?.documentos ?? []);
  const [salvando, setSalvando] = useState(false);
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);
  const [confirmarSugestao, setConfirmarSugestao] = useState(false);
  const [estadoSalvamento, setEstadoSalvamento] = useState<"ALTERADO" | "SALVANDO" | "SALVO" | "ERRO">(rascunho ? "SALVO" : "ALTERADO");
  const versaoRef = useRef(rascunho?.versao);
  const salvamentoEmCursoRef = useRef<Promise<RascunhoOperacao> | null>(null);
  const iniciouRef = useRef(false);
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
  const parceiros = useMemo(() => config.parceiros.filter((parceiro) => parceiroCompativel(parceiro, tipo)), [config.parceiros, tipo]);
  const parceiroSelecionado = parceiros.find((parceiro) => String(parceiro.id) === parceiroId);
  const parceiroInvalido = exigeParceiro && !!parceiroId && !parceiroSelecionado;
  const sugestaoParcelas = parcelasSugeridas(total, data, parceiroSelecionado?.prazosPagamento ?? []);
  const aplicarSugestao = () => {
    if (!parceiroSelecionado) return;
    if (parceiroSelecionado.formaPagamentoPreferida) setFormaPagamento(parceiroSelecionado.formaPagamentoPreferida);
    if (parceiroSelecionado.condicaoPagamentoPreferida === "A_VISTA") setCondicao("A_VISTA");
    if (parceiroSelecionado.condicaoPagamentoPreferida === "A_PRAZO" && sugestaoParcelas.length) {
      setCondicao("A_PRAZO");
      setParcelas(sugestaoParcelas.map((parcela) => ({ ...parcela, id: proximoId++ })));
    }
    setConfirmarSugestao(false);
  };

  const estadoFormulario = useMemo<EstadoFormulario>(() => ({
    tipo, condicao, descricao, valorOperacao, itens, parceiroId, categoriaId, centroCustoId,
    contaId, formaPagamento, data, valorAgora, parcelas,
  }), [tipo, condicao, descricao, valorOperacao, itens, parceiroId, categoriaId, centroCustoId, contaId, formaPagamento, data, valorAgora, parcelas]);
  const operacaoRascunho = useMemo(() => {
    const financeiro = condicao === "A_VISTA" ? { condicao, contaId: Number(contaId), formaPagamento }
      : condicao === "A_PRAZO" ? { condicao, parcelas: parcelas.map((parcela) => ({ valor: Number(parcela.valor), dataVencimento: parcela.vencimento })) }
        : condicao === "PARCIAL" ? { condicao, contaId: Number(contaId), valorPago: realizadoAgora, formaPagamento, parcelas: parcelas.map((parcela) => ({ valor: Number(parcela.valor), dataVencimento: parcela.vencimento })) }
          : { condicao: "SEM_EFEITO_FINANCEIRO" };
    return {
      tipo, data, descricao: descricao.trim(), valorTotal: comItens ? undefined : total,
      parceiroId: parceiroId ? Number(parceiroId) : undefined, categoriaId: categoriaId ? Number(categoriaId) : undefined,
      centroCustoId: centroCustoId ? Number(centroCustoId) : undefined, corrigeOperacaoId: operacaoBase?.id,
      itens: comItens ? itens.map((item) => {
        const produto = config.produtos.find((produtoAtual) => produtoAtual.id === Number(item.produtoId));
        const quantidade = Number(item.quantidade); const valorItem = Number(item.valorTotal);
        return { produtoId: item.produtoId ? Number(item.produtoId) : undefined, descricao: item.descricao.trim(), quantidade, unidade: item.unidade || produto?.unidade || "un", valorUnitario: item.modoValor === "TOTAL" ? (quantidade ? valorItem / quantidade : 0) : Number(item.valorUnitario), estocavel: movimentaEstoque && !!produto?.estocavel };
      }) : [], financeiro,
    };
  }, [categoriaId, centroCustoId, comItens, condicao, config.produtos, contaId, data, descricao, formaPagamento, itens, movimentaEstoque, operacaoBase?.id, parceiroId, parcelas, realizadoAgora, tipo, total]);
  const dadosRascunho = useMemo(() => ({ formulario: estadoFormulario, operacao: operacaoRascunho }), [estadoFormulario, operacaoRascunho]);
  const temConteudoRascunho = useMemo(() => !!(
    documentosSalvos.length || descricao.trim() || valorOperacao || parceiroId || categoriaId || centroCustoId || contaId || valorAgora
    || itens.some((item) => item.produtoId || item.descricao.trim() || item.valorUnitario || item.valorTotal || item.quantidade !== "1")
    || parcelas.some((parcela) => parcela.valor)
  ), [categoriaId, centroCustoId, contaId, descricao, documentosSalvos.length, itens, parceiroId, parcelas, valorAgora, valorOperacao]);

  const persistirRascunho = async () => {
    if (salvamentoEmCursoRef.current) await salvamentoEmCursoRef.current.catch(() => undefined);
    setEstadoSalvamento("SALVANDO");
    const requisicao = salvarRascunhoOperacao(dadosRascunho, versaoRef.current);
    salvamentoEmCursoRef.current = requisicao;
    try {
      const salvo = await requisicao;
      versaoRef.current = salvo.versao; setEstadoSalvamento("SALVO"); return salvo;
    } catch (falha) {
      setEstadoSalvamento("ERRO"); throw falha;
    } finally {
      if (salvamentoEmCursoRef.current === requisicao) salvamentoEmCursoRef.current = null;
    }
  };

  useEffect(() => {
    if (operacaoBase) return;
    if (!iniciouRef.current) { iniciouRef.current = true; return; }
    setEstadoSalvamento("ALTERADO");
    const timer = window.setTimeout(() => { void persistirRascunho().catch((falha) => setErro(falha instanceof Error ? falha.message : String(falha))); }, 800);
    return () => window.clearTimeout(timer);
    // O payload memorizado representa integralmente o estado editavel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosRascunho, operacaoBase]);

  const atualizarItem = (id: number, patch: Partial<ItemForm>) => setItens((atuais) => atuais.map((item) => item.id === id ? { ...item, ...patch } : item));
  const alterarProduto = (id: number, produtoId: string) => {
    const produto = config.produtos.find((item) => item.id === Number(produtoId));
    atualizarItem(id, produto ? { produtoId, descricao: produto.nome, unidade: produto.unidade, valorUnitario: produto.custoUnitario ?? "" } : { produtoId });
  };
  const alterarTipo = (novoTipo: string) => {
    setTipo(novoTipo);
    if (parceiroSelecionado && !parceiroCompativel(parceiroSelecionado, novoTipo)) {
      setParceiroId("");
      setErro("Selecione um parceiro com papel compatível com o novo tipo de operação.");
    }
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
  const selecionarAnexos = async (evento: ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(evento.target.files ?? []);
    const permitidas = new Set(["pdf", "xml", "jpg", "jpeg", "png", "webp"]);
    const invalidos = arquivos.filter((arquivo) => arquivo.size > 10 * 1024 * 1024 || !permitidas.has(arquivo.name.split(".").pop()?.toLowerCase() ?? ""));
    if (invalidos.length) setErro(`Alguns arquivos não foram adicionados por formato ou tamanho inválido: ${invalidos.map((arquivo) => arquivo.name).join(", ")}`);
    const validos = arquivos.filter((arquivo) => !invalidos.includes(arquivo));
    if (operacaoBase) setAnexos((atuais) => [...atuais, ...validos.map((arquivo) => ({ id: proximoId++, arquivo, tipo: "NOTA_FISCAL", numero: "" }))]);
    else if (validos.length) {
      try {
        await persistirRascunho();
        for (const arquivo of validos) {
          const documento = await anexarDocumentoRascunho({ arquivo, tipo: "NOTA_FISCAL" });
          setDocumentosSalvos((atuais) => [...atuais, documento]);
        }
      } catch (falha) { setErro(falha instanceof Error ? falha.message : String(falha)); }
    }
    evento.target.value = "";
  };

  const itensValidos = !comItens || itens.every((item) => item.descricao.trim() && Number(item.quantidade) > 0 && (!movimentaEstoque || item.produtoId));
  const parcelasValidas = condicao === "A_PRAZO" ? parcelas.length > 0 && Math.abs(totalParcelas - total) < 0.01
    : condicao === "PARCIAL" ? realizadoAgora > 0 && saldoFuturo > 0 && parcelas.length > 0 && Math.abs(totalParcelas - saldoFuturo) < 0.01 : true;
  const contaValida = !["A_VISTA", "PARCIAL"].includes(condicao) || !!contaId;
  const podeConfirmar = tipo !== "AJUSTE_ESTOQUE" && descricao.trim().length >= 2 && (!exigeParceiro || !!parceiroSelecionado) && itensValidos && contaValida && parcelasValidas && (total > 0 || (!permiteFinanceiro && total >= 0));

  const submit = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!podeConfirmar) return;
    setErro(null);
    setSalvando(true);
    try {
      let operacao: Operacao;
      if (operacaoBase) operacao = await criarOperacao(operacaoRascunho);
      else {
        const salvo = await persistirRascunho();
        operacao = await confirmarRascunhoOperacao(salvo.versao);
      }
      const falhas: string[] = [];
      for (const anexo of anexos) {
        try { await anexarDocumentoOperacao(operacao.id, anexo); }
        catch (falha) { falhas.push(`${anexo.arquivo.name}: ${falha instanceof Error ? falha.message : String(falha)}`); }
      }
      onSalvo(operacao, falhas.length ? `A operação OP-${String(operacao.id).padStart(4, "0")} foi criada, mas alguns anexos falharam: ${falhas.join("; ")}` : undefined);
    } catch (falha) { setErro(falha instanceof Error ? falha.message : String(falha)); }
    finally { setSalvando(false); }
  };

  const limparRascunho = async () => {
    setConfirmarLimpeza(false);
    setSalvando(true); setErro(null);
    try { await descartarRascunhoOperacao(); window.location.reload(); }
    catch (falha) { setErro(falha instanceof Error ? falha.message : String(falha)); setSalvando(false); }
  };

  const removerDocumentoSalvo = async (id: number) => {
    try { await removerDocumentoRascunho(id); setDocumentosSalvos((atuais) => atuais.filter((documento) => documento.id !== id)); }
    catch (falha) { setErro(falha instanceof Error ? falha.message : String(falha)); }
  };
  const atualizarDocumentoSalvo = async (id: number, patch: { tipo?: string; numero?: string | null }) => {
    setDocumentosSalvos((atuais) => atuais.map((documento) => documento.id === id ? { ...documento, ...patch } : documento));
    try { const atualizado = await atualizarDocumentoRascunho(id, patch); setDocumentosSalvos((atuais) => atuais.map((documento) => documento.id === id ? atualizado : documento)); }
    catch (falha) { setErro(falha instanceof Error ? falha.message : String(falha)); }
  };

  return <div className="shell-wide pb-10">
    {tipo === "AJUSTE_ESTOQUE" && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-4">Ajustes de contagem são feitos na tela de <a href="/pecuaria/estoque" className="underline">Estoque</a>. Este rascunho não será confirmado como operação financeira.</p>}
    <div className="mb-5 flex min-h-[82px] flex-wrap items-center justify-between gap-4 border-b border-border pb-5 pt-3"><div><div className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Registro orientado</div><h1 className="mt-1 font-serif text-3xl text-ink md:text-4xl">{operacaoBase ? "Criar operação de correção" : "Nova operação"}</h1></div>{!operacaoBase && temConteudoRascunho && <div className="flex items-center gap-3"><span aria-live="polite" className={`text-xs font-medium ${estadoSalvamento === "ERRO" ? "text-red-700" : "text-ink-3"}`}>{estadoSalvamento === "SALVANDO" ? "Salvando…" : estadoSalvamento === "SALVO" ? "Rascunho salvo" : estadoSalvamento === "ERRO" ? "Falha ao salvar" : "Alterações não salvas"}</span><Button type="button" secondary disabled={salvando} onClick={() => setConfirmarLimpeza(true)}>Limpar rascunho</Button></div>}</div>
    <form onSubmit={submit} className="grid min-h-[calc(100vh-180px)] overflow-hidden rounded-xl border border-border bg-white xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-7 p-5 md:p-7 xl:min-h-0 xl:overflow-y-auto">
        <ErrorBox erro={erro} />
        {operacaoBase && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950"><strong>Nova operação baseada na OP-{String(operacaoBase.id).padStart(4, "0")}</strong><p className="mt-1 text-xs">Revise todos os dados e efeitos antes de confirmar. A operação cancelada permanecerá preservada no histórico.</p></div>}
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Identificação</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-medium">Tipo de operação<select aria-label="Tipo de operação" className={SELECT} value={tipo} onChange={(e) => alterarTipo(e.target.value)}>{tipo === "AJUSTE_ESTOQUE" && <option value="AJUSTE_ESTOQUE" disabled>Ajuste de estoque — use Estoque</option>}{Object.entries(TIPO_OPERACAO).filter(([chave]) => !["AJUSTE_ESTOQUE", "TRANSFERENCIA_FINANCEIRA", "TRANSFERENCIA_ESTOQUE", "APORTE", "RETIRADA"].includes(chave)).map(([chave, nome]) => <option key={chave} value={chave}>{nome}</option>)}</select></label>
            <label className="text-sm font-medium">Data<input aria-label="Data" required type="date" className={CAMPO} value={data} onChange={(e) => setData(e.target.value)} /></label>
            {exigeParceiro && <label className="text-sm font-medium">{parceiroLabel(tipo)} *<select aria-label={parceiroLabel(tipo)} required className={SELECT} value={parceiroId} onChange={(e) => setParceiroId(e.target.value)}><option value="">Selecione</option>{parceiros.map((parceiro) => <option key={parceiro.id} value={parceiro.id}>{parceiro.nome}</option>)}</select></label>}
            <label className="text-sm font-medium md:col-span-2 xl:col-span-3">Descrição *<textarea aria-label="Descrição" required maxLength={240} className={`${CAMPO} min-h-20`} placeholder={tipo === "SERVICO" ? "Ex.: manutenção preventiva do trator" : "Descreva o objetivo da operação"} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
          </div>
        </section>
        {comItens ? <ItensOperacao itens={itens} setItens={setItens} config={config} movimentaEstoque={movimentaEstoque} atualizarItem={atualizarItem} alterarProduto={alterarProduto} /> : <section><h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Valor do serviço</h3><label className="block max-w-xs text-sm font-medium">Valor total *<input aria-label="Valor total da operação" required min="0.01" step="0.01" type="number" className={CAMPO} value={valorOperacao} onChange={(e) => setValorOperacao(e.target.value)} onBlur={(e) => setValorOperacao(normalizarMoeda(e.target.value))} /></label></section>}
        <section><h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Classificação</h3><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Categoria<select aria-label="Categoria" className={SELECT} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}><option value="">Sem categoria</option>{categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.grupo} · {categoria.nome}</option>)}</select></label><label className="text-sm font-medium">Centro de custo<select aria-label="Centro de custo" className={SELECT} value={centroCustoId} onChange={(e) => setCentroCustoId(e.target.value)}><option value="">Sem centro de custo</option>{config.centrosCusto.map((centro) => <option key={centro.id} value={centro.id}>{centro.nome}</option>)}</select></label></div></section>
        {parceiroInvalido && <p role="alert" className="text-sm text-red-700">O parceiro deste rascunho está inativo ou não tem um papel compatível. Selecione outro parceiro antes de confirmar.</p>}
        {permiteFinanceiro && parceiroSelecionado && (parceiroSelecionado.formaPagamentoPreferida || parceiroSelecionado.condicaoPagamentoPreferida) && <div className="rounded-lg border border-border p-4 text-sm">
          <p>Preferência de {parceiroSelecionado.nome}: {[parceiroSelecionado.formaPagamentoPreferida && FORMAS_PAGAMENTO[parceiroSelecionado.formaPagamentoPreferida], parceiroSelecionado.condicaoPagamentoPreferida === "A_VISTA" ? "à vista" : parceiroSelecionado.condicaoPagamentoPreferida === "A_PRAZO" ? `a prazo (${parceiroSelecionado.prazosPagamento?.join(" / ")} dias)` : null].filter(Boolean).join(" · ")}.</p>
          <p className="my-2 text-xs text-ink-3">É apenas uma sugestão. Você pode escolher outras condições livremente.{parceiroSelecionado.condicaoPagamentoPreferida === "A_PRAZO" && !sugestaoParcelas.length && " Informe o valor e a data para calcular as parcelas."}</p>
          <Button type="button" secondary disabled={salvando || (parceiroSelecionado.condicaoPagamentoPreferida === "A_PRAZO" && !sugestaoParcelas.length)} onClick={() => setConfirmarSugestao(true)}>Usar sugestão</Button>
        </div>}
        <EfeitoFinanceiro permite={permiteFinanceiro} condicao={condicao} alterarCondicao={alterarCondicao} contaId={contaId} setContaId={setContaId} formaPagamento={formaPagamento} setFormaPagamento={setFormaPagamento} config={config} valorAgora={valorAgora} setValorAgora={setValorAgora} total={total} parcelas={parcelas} setParcelas={setParcelas} parcelasValidas={parcelasValidas} saldoFuturo={saldoFuturo} />
        <Documentos anexos={anexos} setAnexos={setAnexos} documentosSalvos={documentosSalvos} atualizarDocumentoSalvo={atualizarDocumentoSalvo} removerDocumentoSalvo={removerDocumentoSalvo} selecionarAnexos={selecionarAnexos} />
      </div>
      <aside className="flex flex-col border-t border-border bg-[#1f2b21] p-6 text-white xl:sticky xl:top-0 xl:max-h-screen xl:border-l xl:border-t-0"><div><div className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">Revisão dos efeitos</div><div className="mt-3 font-serif text-3xl">{brl(total)}</div>{comItens && <div className="mt-5 border-y border-white/10 py-4"><div className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">Itens da operação</div><div className="space-y-2">{itens.map((item) => { const produto = config.produtos.find((produtoAtual) => produtoAtual.id === Number(item.produtoId)); return <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-xs leading-4"><div className="min-w-0"><div className="truncate font-medium text-white">{produto?.nome || item.descricao || "Produto não selecionado"}</div><div className="text-[#aeb9aa]">{Number(item.quantidade || 0).toLocaleString("pt-BR")} {produto?.unidade || item.unidade || "un"}</div></div><strong className="self-center whitespace-nowrap text-white">{brl(totalItem(item))}</strong></div>; })}</div></div>}<div className="mt-5 space-y-3 text-sm leading-5"><ReviewLine>Registrar {TIPO_OPERACAO[tipo]?.toLowerCase()}.</ReviewLine>{movimentaEstoque && <ReviewLine tone="brown">Gerar {itens.length} movimento{itens.length === 1 ? "" : "s"} físico{itens.length === 1 ? "" : "s"} de estoque.</ReviewLine>}{condicao === "A_VISTA" && <ReviewLine>Registrar {entradaFinanceira ? "recebimento" : "pagamento"} integral de {brl(total)}.</ReviewLine>}{condicao === "A_PRAZO" && <ReviewLine tone="amber">Criar {parcelas.length} compromisso{parcelas.length === 1 ? "" : "s"} {entradaFinanceira ? "a receber" : "a pagar"}, totalizando {brl(totalParcelas)}. O saldo não muda agora.</ReviewLine>}{condicao === "PARCIAL" && <><ReviewLine>Registrar {entradaFinanceira ? "recebimento" : "pagamento"} de {brl(realizadoAgora)} agora.</ReviewLine><ReviewLine tone="amber">Criar {parcelas.length} compromisso{parcelas.length === 1 ? "" : "s"} para o saldo de {brl(totalParcelas)}.</ReviewLine></>}{condicao === "SEM_EFEITO_FINANCEIRO" && <ReviewLine tone="neutral">Nenhuma conta financeira ou compromisso será movimentado.</ReviewLine>}{(anexos.length + documentosSalvos.length) > 0 && <ReviewLine tone="neutral">Anexar {anexos.length + documentosSalvos.length} documento{anexos.length + documentosSalvos.length === 1 ? "" : "s"} à operação.</ReviewLine>}</div></div><div className="mt-auto border-t border-white/10 pt-5"><p className="mb-3 text-center text-[11px] leading-4 text-[#aeb9aa]">A confirmação cria somente os efeitos descritos acima.</p><Button type="submit" disabled={salvando || !podeConfirmar} className="w-full !bg-[#e9e3d2] !text-[#1f2b21]">{salvando ? "Confirmando…" : "Confirmar operação"}</Button></div></aside>
    </form>
    <ConfirmDialog open={confirmarSugestao} title="Usar a sugestão do parceiro?" message="As condições sugeridas substituirão as condições e parcelas correspondentes já preenchidas. Depois você poderá editá-las livremente." confirmLabel="Aplicar sugestão" onConfirm={aplicarSugestao} onCancel={() => setConfirmarSugestao(false)} />
    <ConfirmDialog
      open={confirmarLimpeza}
      title="Limpar rascunho?"
      message="Todos os dados preenchidos e documentos anexados a este rascunho serão apagados. Esta ação não poderá ser desfeita."
      confirmLabel="Limpar rascunho"
      cancelLabel="Manter rascunho"
      tone="danger"
      onCancel={() => setConfirmarLimpeza(false)}
      onConfirm={() => { void limparRascunho(); }}
    />
  </div>;
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

function Documentos({ anexos, setAnexos, documentosSalvos, atualizarDocumentoSalvo, removerDocumentoSalvo, selecionarAnexos }: { anexos: AnexoForm[]; setAnexos: React.Dispatch<React.SetStateAction<AnexoForm[]>>; documentosSalvos: DocumentoFinanceiro[]; atualizarDocumentoSalvo: (id: number, patch: { tipo?: string; numero?: string | null }) => void; removerDocumentoSalvo: (id: number) => void; selecionarAnexos: (evento: ChangeEvent<HTMLInputElement>) => void }) {
  const vazio = !anexos.length && !documentosSalvos.length;
  return <section><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Documentos</h3><p className="mt-1 text-xs text-ink-3">PDF, XML, JPG, PNG ou WEBP, com até 10 MB por arquivo.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-[#faf9f4]"><Paperclip size={15} /> Anexar<input aria-label="Anexar documentos" type="file" multiple accept=".pdf,.xml,.jpg,.jpeg,.png,.webp,application/pdf,application/xml,text/xml,image/jpeg,image/png,image/webp" className="sr-only" onChange={selecionarAnexos} /></label></div>{!vazio ? <div className="space-y-2">{documentosSalvos.map((documento) => <div key={`salvo-${documento.id}`} className="grid items-center gap-3 rounded-lg border border-border p-3 md:grid-cols-[minmax(0,1fr)_180px_160px_36px]"><div className="flex min-w-0 items-center gap-3"><FileText size={18} className="shrink-0 text-ink-3" /><div className="min-w-0"><div className="truncate text-sm font-medium">{documento.nome}</div><div className="text-xs text-ink-3">Salvo no rascunho</div></div></div><select aria-label={`Tipo do documento ${documento.nome}`} className={`${SELECT} mt-0 p-2 text-sm`} value={documento.tipo} onChange={(e) => atualizarDocumentoSalvo(documento.id, { tipo: e.target.value })}>{Object.entries(TIPOS_DOCUMENTO).map(([chave, nome]) => <option key={chave} value={chave}>{nome}</option>)}</select><input aria-label={`Número do documento ${documento.nome}`} placeholder="Número (opcional)" className="rounded-lg border border-[#d8cfbb] bg-white p-2 text-sm" value={documento.numero ?? ""} onChange={(e) => atualizarDocumentoSalvo(documento.id, { numero: e.target.value })} /><button type="button" aria-label={`Remover documento ${documento.nome}`} onClick={() => removerDocumentoSalvo(documento.id)} className="rounded-lg p-2 text-red-700 hover:bg-red-50"><Trash2 size={16} /></button></div>)}{anexos.map((anexo) => <div key={anexo.id} className="grid items-center gap-3 rounded-lg border border-border p-3 md:grid-cols-[minmax(0,1fr)_180px_160px_36px]"><div className="flex min-w-0 items-center gap-3"><FileText size={18} className="shrink-0 text-ink-3" /><div className="min-w-0"><div className="truncate text-sm font-medium">{anexo.arquivo.name}</div><div className="text-xs text-ink-3">{(anexo.arquivo.size / 1024 / 1024).toFixed(2)} MB</div></div></div><select aria-label={`Tipo do documento ${anexo.arquivo.name}`} className={`${SELECT} mt-0 p-2 text-sm`} value={anexo.tipo} onChange={(e) => setAnexos((atuais) => atuais.map((atual) => atual.id === anexo.id ? { ...atual, tipo: e.target.value } : atual))}>{Object.entries(TIPOS_DOCUMENTO).map(([chave, nome]) => <option key={chave} value={chave}>{nome}</option>)}</select><input aria-label={`Número do documento ${anexo.arquivo.name}`} placeholder="Número (opcional)" className="rounded-lg border border-[#d8cfbb] bg-white p-2 text-sm outline-none focus:border-[#6f7d68] focus:ring-2 focus:ring-[#6f7d68]/15" value={anexo.numero} onChange={(e) => setAnexos((atuais) => atuais.map((atual) => atual.id === anexo.id ? { ...atual, numero: e.target.value } : atual))} /><button type="button" aria-label={`Remover documento ${anexo.arquivo.name}`} onClick={() => setAnexos((atuais) => atuais.filter((atual) => atual.id !== anexo.id))} className="rounded-lg p-2 text-red-700 hover:bg-red-50"><Trash2 size={16} /></button></div>)}</div> : <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-ink-3">Nenhum documento anexado.</div>}</section>;
}

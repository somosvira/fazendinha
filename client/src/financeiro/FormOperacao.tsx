import { type ChangeEvent, type DragEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Paperclip, Plus, Trash2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { CampoData } from "../components/CampoData";
import { CampoSelect } from "../components/CampoSelect";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SelectBusca } from "../components/SelectBusca";
import { EfeitosCondicao, EfeitosTipoOperacao } from "./EfeitosIlustrados";
import { EXPLICACAO_BASE_VALOR, EXPLICACAO_CLASSIFICACAO, EXPLICACAO_CONDICAO, EXPLICACAO_TIPO } from "./lib/explicacoes";
import { anexarDocumentoOperacao, anexarDocumentoRascunho, atualizarDocumentoRascunho, confirmarRascunhoOperacao, criarOperacao, descartarRascunhoOperacao, removerDocumentoRascunho, salvarRascunhoOperacao, type ConfiguracoesFinanceiras, type DocumentoFinanceiro, type Operacao, type RascunhoOperacao } from "./novo-api";
import { brl, Button, emDias, ErrorBox, hoje, ReviewLine, TIPO_OPERACAO } from "./financeiro-ui";
import { FORMAS_PAGAMENTO, parceiroCompativel, parcelasSugeridas } from "./lib/parceiros";
import { marcarEdicaoRascunho } from "./rascunhoAtivo";

type Condicao = "A_VISTA" | "A_PRAZO" | "PARCIAL" | "SEM_EFEITO_FINANCEIRO";
type ModoValor = "UNITARIO" | "TOTAL";
type ItemForm = { categoriaId: string; classificacao: string; id: number; produtoId: string; descricao: string; quantidade: string; unidade: string; modoValor: ModoValor; valorUnitario: string; valorTotal: string };
type ParcelaForm = { id: number; valor: string; vencimento: string };
type AnexoForm = { id: number; arquivo: File; tipo: string; numero: string };
type EstadoFormulario = {
  tipo: string; condicao: Condicao; descricao: string; valorOperacao: string; itens: ItemForm[];
  classificacao?: string; centroEscolhidoManualmente?: boolean; parceiroId: string; categoriaId: string; centroCustoId: string; contaId: string;
  formaPagamento: string; data: string; valorAgora: string; parcelas: ParcelaForm[];
};

const TIPOS_COM_ITENS = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "VENDA", "AJUSTE_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO"]);
const TIPOS_COM_ESTOQUE = new Set(["COMPRA_ESTOQUE", "VENDA", "AJUSTE_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO"]);
const TIPOS_FINANCEIROS = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "DEVOLUCAO"]);
const TIPOS_COM_PARCEIRO = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "DEVOLUCAO"]);
const TIPOS_DOCUMENTO = { NOTA_FISCAL: "Nota fiscal", BOLETO: "Boleto", CONTRATO: "Contrato", RECIBO: "Recibo", COMPROVANTE: "Comprovante", JUSTIFICATIVA: "Justificativa", OUTRO: "Outro" };
const CAMPO = "mt-1.5 w-full rounded-lg border border-input bg-white px-3 py-2.5 font-normal text-ink outline-none transition hover:border-ink-3/50 focus:border-outros focus:ring-2 focus:ring-outros/20";
const TIPOS_OCULTOS = new Set(["AJUSTE_ESTOQUE", "TRANSFERENCIA_FINANCEIRA", "TRANSFERENCIA_ESTOQUE", "APORTE", "RETIRADA"]);
const ACEITOS = new Set(["pdf", "xml", "jpg", "jpeg", "png", "webp"]);
const ACCEPT = ".pdf,.xml,.jpg,.jpeg,.png,.webp,application/pdf,application/xml,text/xml,image/jpeg,image/png,image/webp";
const OPCOES_CLASSIFICACAO = [
  { value: "", label: "Não classificada", descricao: EXPLICACAO_CLASSIFICACAO[""] },
  { value: "CUSTEIO", label: "Custeio", descricao: EXPLICACAO_CLASSIFICACAO.CUSTEIO },
  { value: "INVESTIMENTO", label: "Investimento", descricao: EXPLICACAO_CLASSIFICACAO.INVESTIMENTO },
];
const OPCOES_BASE_VALOR = [
  { value: "UNITARIO", label: "Valor unitário", descricao: EXPLICACAO_BASE_VALOR.UNITARIO },
  { value: "TOTAL", label: "Valor total do item", descricao: EXPLICACAO_BASE_VALOR.TOTAL },
];
const NOME_CONDICAO: Record<Condicao, string> = {
  A_VISTA: "Liquidação integral na operação",
  A_PRAZO: "Liquidação integral a prazo",
  PARCIAL: "Liquidação parcial com saldo a prazo",
  SEM_EFEITO_FINANCEIRO: "Sem movimentação financeira",
};
const OPCOES_CONDICAO = (Object.keys(NOME_CONDICAO) as Condicao[]).map((value) => ({ value, label: NOME_CONDICAO[value], descricao: EXPLICACAO_CONDICAO[value].descricao }));
const OPCOES_FORMA = Object.entries(FORMAS_PAGAMENTO).map(([value, label]) => ({ value, label }));
const OPCOES_DOCUMENTO = Object.entries(TIPOS_DOCUMENTO).map(([value, label]) => ({ value, label }));
const normalizarMoeda = (valor: string) => valor === "" ? "" : Number(valor).toFixed(2);

let proximoId = 1;
const novoItem = (): ItemForm => ({ id: proximoId++, categoriaId: "", classificacao: "", produtoId: "", descricao: "", quantidade: "1", unidade: "un", modoValor: "UNITARIO", valorUnitario: "", valorTotal: "" });
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
  const [itens, setItens] = useState<ItemForm[]>(() => inicial?.itens ?? (operacaoBase?.itens.length ? operacaoBase.itens.map((item) => ({ id: proximoId++, categoriaId: String(item.categoriaId ?? ""), classificacao: item.classificacao ?? "", produtoId: item.produtoId ? String(item.produtoId) : "", descricao: item.descricao, quantidade: item.quantidade, unidade: item.unidade, modoValor: "UNITARIO", valorUnitario: item.valorUnitario, valorTotal: item.valorTotal })) : [novoItem()]));
  const [parceiroId, setParceiroId] = useState(inicial?.parceiroId ?? (operacaoBase?.parceiro?.id ? String(operacaoBase.parceiro.id) : ""));
  const [classificacao, setClassificacao] = useState(inicial?.classificacao ?? operacaoBase?.classificacao ?? "");
  const [centroEscolhidoManualmente, setCentroEscolhidoManualmente] = useState(inicial?.centroEscolhidoManualmente ?? (!!inicial?.centroCustoId || !!operacaoBase?.centroCustoId));
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
  const [enviandoDocumentos, setEnviandoDocumentos] = useState(false);
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
  const categorias = config.categorias.filter((categoria) => categoria.ativo);
  const opcoesCategoria = categorias.map((categoria) => ({ value: String(categoria.id), label: categoria.nome }));
  const parceiros = useMemo(() => config.parceiros.filter((parceiro) => parceiroCompativel(parceiro, tipo)), [config.parceiros, tipo]);
  const parceiroSelecionado = parceiros.find((parceiro) => String(parceiro.id) === parceiroId);
  const opcoesTipo = Object.entries(TIPO_OPERACAO)
    .filter(([chave]) => !TIPOS_OCULTOS.has(chave) || (chave === "AJUSTE_ESTOQUE" && tipo === chave))
    .map(([chave, nome]) => ({ value: chave, label: chave === "AJUSTE_ESTOQUE" ? "Ajuste de estoque — use Estoque" : nome, descricao: EXPLICACAO_TIPO[chave]?.descricao, disabled: chave === "AJUSTE_ESTOQUE" }));
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
    tipo, condicao, descricao, valorOperacao, itens, parceiroId, categoriaId, classificacao, centroEscolhidoManualmente, centroCustoId,
    contaId, formaPagamento, data, valorAgora, parcelas,
  }), [tipo, condicao, descricao, valorOperacao, itens, parceiroId, categoriaId, classificacao, centroEscolhidoManualmente, centroCustoId, contaId, formaPagamento, data, valorAgora, parcelas]);
  const operacaoRascunho = useMemo(() => {
    const financeiro = condicao === "A_VISTA" ? { condicao, contaId: Number(contaId), formaPagamento }
      : condicao === "A_PRAZO" ? { condicao, parcelas: parcelas.map((parcela) => ({ valor: Number(parcela.valor), dataVencimento: parcela.vencimento })) }
        : condicao === "PARCIAL" ? { condicao, contaId: Number(contaId), valorPago: realizadoAgora, formaPagamento, parcelas: parcelas.map((parcela) => ({ valor: Number(parcela.valor), dataVencimento: parcela.vencimento })) }
          : { condicao: "SEM_EFEITO_FINANCEIRO" };
    return {
      tipo, data, descricao: descricao.trim(), valorTotal: comItens ? undefined : total,
      parceiroId: parceiroId ? Number(parceiroId) : undefined, categoriaId: !comItens && categoriaId ? Number(categoriaId) : undefined, classificacao: !comItens ? classificacao || null : undefined,
      centroCustoId: centroCustoId ? Number(centroCustoId) : undefined, corrigeOperacaoId: operacaoBase?.id,
      itens: comItens ? itens.map((item) => {
        const produto = config.produtos.find((produtoAtual) => produtoAtual.id === Number(item.produtoId));
        const quantidade = Number(item.quantidade); const valorItem = Number(item.valorTotal);
        return { categoriaId: item.categoriaId ? Number(item.categoriaId) : null, classificacao: item.classificacao || null, produtoId: item.produtoId ? Number(item.produtoId) : undefined, descricao: item.descricao.trim(), quantidade, unidade: item.unidade || produto?.unidade || "un", valorUnitario: item.modoValor === "TOTAL" ? (quantidade ? valorItem / quantidade : 0) : Number(item.valorUnitario), estocavel: movimentaEstoque && !!produto?.estocavel };
      }) : [], financeiro,
    };
  }, [classificacao, categoriaId, centroCustoId, comItens, condicao, config.produtos, contaId, data, descricao, formaPagamento, itens, movimentaEstoque, operacaoBase?.id, parceiroId, parcelas, realizadoAgora, tipo, total]);
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
  // Acende o atalho "Trabalho ativo" da sidebar enquanto o rascunho está na tela.
  useEffect(() => (operacaoBase ? undefined : marcarEdicaoRascunho()), [operacaoBase]);

  const atualizarItem = (id: number, patch: Partial<ItemForm>) => setItens((atuais) => atuais.map((item) => item.id === id ? { ...item, ...patch } : item));
  const centrosSugeridos = [...new Set(itens.flatMap((item) => {
    const centro = config.produtos.find((p) => p.id === Number(item.produtoId))?.centroCustoId;
    return centro && config.centrosCusto.some((c) => c.id === centro && c.ativo) ? [String(centro)] : [];
  }))];
  const sugestaoCentro = centrosSugeridos.length === 1 ? centrosSugeridos[0] : "";
  useEffect(() => { if (!centroEscolhidoManualmente && comItens) setCentroCustoId(sugestaoCentro); }, [sugestaoCentro, centroEscolhidoManualmente, comItens]);
  const alterarProduto = (id: number, produtoId: string) => {
    const produto = config.produtos.find((item) => item.id === Number(produtoId));
    const categoria = categorias.find((c) => c.id === produto?.categoriaId);
    atualizarItem(id, produto ? { produtoId, descricao: produto.nome, unidade: produto.unidade, valorUnitario: produto.custoUnitario ?? "", categoriaId: String(categoria?.id ?? ""), classificacao: categoria?.classificacao ?? "" } : { produtoId, categoriaId: "", classificacao: "" });
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
  const adicionarArquivos = async (arquivos: File[]) => {
    const invalidos = arquivos.filter((arquivo) => arquivo.size > 10 * 1024 * 1024 || !ACEITOS.has(arquivo.name.split(".").pop()?.toLowerCase() ?? ""));
    if (invalidos.length) setErro(`Alguns arquivos não foram adicionados por formato ou tamanho inválido: ${invalidos.map((arquivo) => arquivo.name).join(", ")}`);
    const validos = arquivos.filter((arquivo) => !invalidos.includes(arquivo));
    if (operacaoBase) setAnexos((atuais) => [...atuais, ...validos.map((arquivo) => ({ id: proximoId++, arquivo, tipo: "NOTA_FISCAL", numero: "" }))]);
    else if (validos.length) {
      setEnviandoDocumentos(true);
      try {
        await persistirRascunho();
        for (const arquivo of validos) {
          const documento = await anexarDocumentoRascunho({ arquivo, tipo: "NOTA_FISCAL" });
          setDocumentosSalvos((atuais) => [...atuais, documento]);
        }
      } catch (falha) { setErro(falha instanceof Error ? falha.message : String(falha)); }
      finally { setEnviandoDocumentos(false); }
    }
  };
  const selecionarAnexos = (evento: ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(evento.target.files ?? []);
    evento.target.value = "";
    void adicionarArquivos(arquivos);
  };

  const resumoCategorias = comItens ? Object.entries(itens.reduce<Record<string, number>>((acc, item) => {
    const nome = categorias.find((c) => c.id === Number(item.categoriaId))?.nome ?? "Sem categoria";
    acc[nome] = (acc[nome] ?? 0) + Math.round(totalItem(item) * 100); return acc;
  }, {})) : [[categorias.find((c) => c.id === Number(categoriaId))?.nome ?? "Sem categoria", Math.round(total * 100)]] as [string, number][];
  const itensValidos = !comItens || itens.every((item) => item.descricao.trim() && Number(item.quantidade) > 0 && (!movimentaEstoque || item.produtoId));
  const parcelasValidas = condicao === "A_PRAZO" ? parcelas.length > 0 && Math.abs(totalParcelas - total) < 0.01
    : condicao === "PARCIAL" ? realizadoAgora > 0 && saldoFuturo > 0 && parcelas.length > 0 && Math.abs(totalParcelas - saldoFuturo) < 0.01 : true;
  const contaValida = !["A_VISTA", "PARCIAL"].includes(condicao) || !!contaId;
  const podeConfirmar = (!comItens || centrosSugeridos.length <= 1 || !!centroCustoId) && tipo !== "AJUSTE_ESTOQUE" && descricao.trim().length >= 2 && (!exigeParceiro || !!parceiroSelecionado) && itensValidos && contaValida && parcelasValidas && (total > 0 || (!permiteFinanceiro && total >= 0));

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
    <div className="mb-5 flex min-h-[82px] flex-wrap items-center justify-between gap-4 border-b border-border pb-5 pt-3"><div><div className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Registro orientado</div><h1 className="mt-1 font-serif text-3xl text-ink md:text-4xl">{operacaoBase ? "Criar operação de correção" : "Nova operação"}</h1></div>{!operacaoBase && temConteudoRascunho && <div className="flex items-center gap-3"><span aria-live="polite" className={`text-xs font-medium ${estadoSalvamento === "ERRO" ? "text-red-700" : "text-ink-3"}`}>{estadoSalvamento === "SALVANDO" ? "Salvando…" : estadoSalvamento === "SALVO" ? "Rascunho salvo" : estadoSalvamento === "ERRO" ? "Falha ao salvar" : "Alterações não salvas"}</span><Button type="button" secondary disabled={salvando} onClick={() => setConfirmarLimpeza(true)}>Limpar rascunho</Button></div>}</div>
    <form onSubmit={submit} className="grid min-h-[calc(100vh-180px)] overflow-hidden rounded-xl border border-border bg-white xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-7 p-5 md:p-7 xl:min-h-0 xl:overflow-y-auto">
        <ErrorBox erro={erro} />
        {operacaoBase && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950"><strong>Nova operação baseada na OP-{String(operacaoBase.id).padStart(4, "0")}</strong><p className="mt-1 text-xs">Revise todos os dados e efeitos antes de confirmar. A operação cancelada permanecerá preservada no histórico.</p></div>}
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Identificação</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-medium">Tipo de operação<CampoSelect aria-label="Tipo de operação" value={tipo} onValueChange={alterarTipo} options={opcoesTipo} previa={(valor) => <EfeitosTipoOperacao tipo={valor} nome={TIPO_OPERACAO[valor] ?? ""} />} />{EXPLICACAO_TIPO[tipo] && <span className="mt-1.5 block text-xs font-normal leading-5 text-ink-3">{EXPLICACAO_TIPO[tipo].explicacao}</span>}</label>
            <label className="text-sm font-medium">Data<CampoData aria-label="Data" value={data} onChange={setData} /></label>
            {exigeParceiro && <label className="text-sm font-medium">{parceiroLabel(tipo)} *<SelectBusca aria-label={parceiroLabel(tipo)} value={parceiroId} onValueChange={setParceiroId} options={parceiros.map((parceiro) => ({ value: String(parceiro.id), label: parceiro.nome }))} buscaPlaceholder="Buscar parceiro…" vazioTexto="Nenhum parceiro compatível encontrado." /></label>}
            <label className="text-sm font-medium md:col-span-2 xl:col-span-3">Descrição *<textarea aria-label="Descrição" required maxLength={240} className={`${CAMPO} min-h-20`} placeholder={tipo === "SERVICO" ? "Ex.: manutenção preventiva do trator" : "Descreva o objetivo da operação"} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
          </div>
        </section>
        {comItens ? <ItensOperacao itens={itens} setItens={setItens} config={config} movimentaEstoque={movimentaEstoque} atualizarItem={atualizarItem} alterarProduto={alterarProduto} /> : <section><h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Valor do serviço</h3><label className="block max-w-xs text-sm font-medium">Valor total *<input aria-label="Valor total da operação" required min="0.01" step="0.01" type="number" className={CAMPO} value={valorOperacao} onChange={(e) => setValorOperacao(e.target.value)} onBlur={(e) => setValorOperacao(normalizarMoeda(e.target.value))} /></label></section>}
        <section><h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Classificação</h3><div className="grid gap-4 md:grid-cols-2">{!comItens && <label className="text-sm font-medium">Categoria<SelectBusca aria-label="Categoria" value={categoriaId} onValueChange={(valor) => { setCategoriaId(valor); setClassificacao(categorias.find((c) => c.id === Number(valor))?.classificacao ?? ""); }} opcaoVazia="Sem categoria" options={opcoesCategoria} buscaPlaceholder="Buscar categoria…" /></label>}{!comItens && <label className="text-sm font-medium">Classificação<CampoSelect aria-label="Classificação" value={classificacao} onValueChange={setClassificacao} options={OPCOES_CLASSIFICACAO} /></label>}<label className="text-sm font-medium">Centro de custo<SelectBusca aria-label="Centro de custo" value={centroCustoId} onValueChange={(valor) => { setCentroEscolhidoManualmente(true); setCentroCustoId(valor); }} opcaoVazia="Sem centro de custo" options={config.centrosCusto.filter((centro) => centro.ativo).map((centro) => ({ value: String(centro.id), label: centro.nome }))} buscaPlaceholder="Buscar centro de custo…" /></label></div></section>
        {comItens && centrosSugeridos.length > 1 && !centroCustoId && <p className="text-sm text-amber-800">Os produtos sugerem áreas diferentes. Escolha o centro de custo desta operação.</p>}
        {parceiroInvalido && <p role="alert" className="text-sm text-red-700">O parceiro deste rascunho está inativo ou não tem um papel compatível. Selecione outro parceiro antes de confirmar.</p>}
        {permiteFinanceiro && parceiroSelecionado && (parceiroSelecionado.formaPagamentoPreferida || parceiroSelecionado.condicaoPagamentoPreferida) && <div className="rounded-lg border border-border p-4 text-sm">
          <p>Preferência de {parceiroSelecionado.nome}: {[parceiroSelecionado.formaPagamentoPreferida && FORMAS_PAGAMENTO[parceiroSelecionado.formaPagamentoPreferida], parceiroSelecionado.condicaoPagamentoPreferida === "A_VISTA" ? "à vista" : parceiroSelecionado.condicaoPagamentoPreferida === "A_PRAZO" ? `a prazo (${parceiroSelecionado.prazosPagamento?.join(" / ")} dias)` : null].filter(Boolean).join(" · ")}.</p>
          <p className="my-2 text-xs text-ink-3">É apenas uma sugestão. Você pode escolher outras condições livremente.{parceiroSelecionado.condicaoPagamentoPreferida === "A_PRAZO" && !sugestaoParcelas.length && " Informe o valor e a data para calcular as parcelas."}</p>
          <Button type="button" secondary disabled={salvando || (parceiroSelecionado.condicaoPagamentoPreferida === "A_PRAZO" && !sugestaoParcelas.length)} onClick={() => setConfirmarSugestao(true)}>Usar sugestão</Button>
        </div>}
        <EfeitoFinanceiro permite={permiteFinanceiro} condicao={condicao} alterarCondicao={alterarCondicao} contaId={contaId} setContaId={setContaId} formaPagamento={formaPagamento} setFormaPagamento={setFormaPagamento} config={config} valorAgora={valorAgora} setValorAgora={setValorAgora} total={total} parcelas={parcelas} setParcelas={setParcelas} parcelasValidas={parcelasValidas} saldoFuturo={saldoFuturo} />
        <Documentos anexos={anexos} setAnexos={setAnexos} documentosSalvos={documentosSalvos} atualizarDocumentoSalvo={atualizarDocumentoSalvo} removerDocumentoSalvo={removerDocumentoSalvo} selecionarAnexos={selecionarAnexos} soltarArquivos={(arquivos) => { void adicionarArquivos(arquivos); }} enviando={enviandoDocumentos} />
      </div>
      <aside className="flex flex-col border-t border-border bg-[#1f2b21] p-6 text-white xl:sticky xl:top-0 xl:max-h-screen xl:border-l xl:border-t-0"><div><div className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">Revisão dos efeitos</div><div className="mt-3 font-serif text-3xl">{brl(total)}</div>{comItens && <div className="mt-5 border-y border-white/10 py-4"><div className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">Itens da operação</div><div className="space-y-2">{itens.map((item) => { const produto = config.produtos.find((produtoAtual) => produtoAtual.id === Number(item.produtoId)); return <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-xs leading-4"><div className="min-w-0"><div className="truncate font-medium text-white">{produto?.nome || item.descricao || "Produto não selecionado"}</div><div className="text-[#aeb9aa]">{Number(item.quantidade || 0).toLocaleString("pt-BR")} {produto?.unidade || item.unidade || "un"}</div></div><strong className="self-center whitespace-nowrap text-white">{brl(totalItem(item))}</strong></div>; })}</div></div>}<div className="mt-4 space-y-2 text-xs"><p className="font-semibold text-[#aeb9aa]">Valores por categoria</p>{resumoCategorias.map(([nome, centavos]) => <div key={nome} className="flex justify-between gap-3"><span>{nome}</span><strong>{brl(centavos / 100)}</strong></div>)}</div><div className="mt-5 space-y-3 text-sm leading-5"><ReviewLine>Registrar {TIPO_OPERACAO[tipo]?.toLowerCase()}.</ReviewLine>{movimentaEstoque && <ReviewLine tone="brown">Gerar {itens.length} movimento{itens.length === 1 ? "" : "s"} físico{itens.length === 1 ? "" : "s"} de estoque.</ReviewLine>}{condicao === "A_VISTA" && <ReviewLine>Registrar {entradaFinanceira ? "recebimento" : "pagamento"} integral de {brl(total)}.</ReviewLine>}{condicao === "A_PRAZO" && <ReviewLine tone="amber">Criar {parcelas.length} compromisso{parcelas.length === 1 ? "" : "s"} {entradaFinanceira ? "a receber" : "a pagar"}, totalizando {brl(totalParcelas)}. O saldo não muda agora.</ReviewLine>}{condicao === "PARCIAL" && <><ReviewLine>Registrar {entradaFinanceira ? "recebimento" : "pagamento"} de {brl(realizadoAgora)} agora.</ReviewLine><ReviewLine tone="amber">Criar {parcelas.length} compromisso{parcelas.length === 1 ? "" : "s"} para o saldo de {brl(totalParcelas)}.</ReviewLine></>}{condicao === "SEM_EFEITO_FINANCEIRO" && <ReviewLine tone="neutral">Nenhuma conta financeira ou compromisso será movimentado.</ReviewLine>}{(anexos.length + documentosSalvos.length) > 0 && <ReviewLine tone="neutral">Anexar {anexos.length + documentosSalvos.length} documento{anexos.length + documentosSalvos.length === 1 ? "" : "s"} à operação.</ReviewLine>}</div></div><div className="mt-auto border-t border-white/10 pt-5"><p className="mb-3 text-center text-[11px] leading-4 text-[#aeb9aa]">A confirmação cria somente os efeitos descritos acima.</p><Button type="submit" disabled={salvando || !podeConfirmar} className="w-full !bg-[#e9e3d2] !text-[#1f2b21]">{salvando ? "Confirmando…" : "Confirmar operação"}</Button></div></aside>
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
  const opcoesProduto = config.produtos.map((produto) => ({ value: String(produto.id), label: produto.nome }));
  const opcoesCategoria = config.categorias.filter((c) => c.ativo).map((c) => ({ value: String(c.id), label: c.nome }));
  return <section>
    <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Itens da operação</h3><p className="mt-1 text-xs text-ink-3">Informe o valor unitário ou alterne para o valor total de cada item.</p></div><Button type="button" secondary onClick={() => setItens((atuais) => [...atuais, novoItem()])}><Plus size={15} /> Adicionar item</Button></div>
    <div className="space-y-3">{itens.map((item, indice) => {
      const produto = config.produtos.find((produtoAtual) => produtoAtual.id === Number(item.produtoId));
      const unidade = produto?.unidade ?? item.unidade;
      return <div key={item.id} className="rounded-xl border border-border bg-[#faf9f4] p-4">
        <div className="mb-3 flex items-center justify-between"><strong className="text-sm">Item {indice + 1}</strong>{itens.length > 1 && <button type="button" aria-label={`Remover item ${indice + 1}`} onClick={() => setItens((atuais) => atuais.filter((atual) => atual.id !== item.id))} className="rounded-lg p-1.5 text-red-700 hover:bg-red-50"><Trash2 size={16} /></button>}</div>
        <div className="grid gap-4 md:grid-cols-[minmax(200px,0.8fr)_minmax(0,2fr)]">
          <label className="text-sm font-medium">Produto{movimentaEstoque && " *"}<SelectBusca aria-label={`Produto do item ${indice + 1}`} value={item.produtoId} onValueChange={(valor) => alterarProduto(item.id, valor)} opcaoVazia={movimentaEstoque ? undefined : "Sem produto cadastrado"} options={opcoesProduto} buscaPlaceholder="Buscar produto…" vazioTexto="Nenhum produto encontrado." /></label>
          <label className="text-sm font-medium">Descrição do item *<input aria-label={`Descrição do item ${indice + 1}`} required className={CAMPO} value={item.descricao} onChange={(e) => atualizarItem(item.id, { descricao: e.target.value })} /></label>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">Categoria<SelectBusca aria-label={`Categoria do item ${indice + 1}`} value={item.categoriaId ?? ""} onValueChange={(valor) => { const categoria = config.categorias.find((c) => c.id === Number(valor)); atualizarItem(item.id, { categoriaId: valor, classificacao: categoria?.classificacao ?? "" }); }} opcaoVazia="Sem categoria" options={opcoesCategoria} buscaPlaceholder="Buscar categoria…" /></label>
          <label className="text-sm font-medium">Classificação<CampoSelect aria-label={`Classificação do item ${indice + 1}`} value={item.classificacao ?? ""} onValueChange={(valor) => atualizarItem(item.id, { classificacao: valor })} options={OPCOES_CLASSIFICACAO} /></label>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.1fr]">
          <label className="text-sm font-medium">Quantidade *<div className="mt-1.5 flex"><input aria-label={`Quantidade do item ${indice + 1}`} required min="0.001" step="0.001" type="number" className="min-w-0 flex-1 rounded-l-lg border border-[#d8cfbb] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#6f7d68] focus:ring-2 focus:ring-[#6f7d68]/15" value={item.quantidade} onChange={(e) => atualizarItem(item.id, { quantidade: e.target.value })} /><span aria-label={`Unidade do item ${indice + 1}`} className="inline-flex min-w-14 items-center justify-center rounded-r-lg border border-l-0 border-[#d8cfbb] bg-[#f0ede4] px-3 text-sm text-ink-3">{unidade || "un"}</span></div></label>
          <label className="text-sm font-medium">Base do valor<CampoSelect aria-label={`Base do valor do item ${indice + 1}`} value={item.modoValor} onValueChange={(valor) => atualizarItem(item.id, { modoValor: valor as ModoValor })} options={OPCOES_BASE_VALOR} /></label>
          {item.modoValor === "UNITARIO" ? <label className="text-sm font-medium">Valor unitário *<input aria-label={`Valor unitário do item ${indice + 1}`} required min="0" step="0.01" type="number" className={CAMPO} value={item.valorUnitario} onChange={(e) => atualizarItem(item.id, { valorUnitario: e.target.value })} onBlur={(e) => atualizarItem(item.id, { valorUnitario: normalizarMoeda(e.target.value) })} /></label> : <label className="text-sm font-medium">Valor total do item *<input aria-label={`Valor total do item ${indice + 1}`} required min="0" step="0.01" type="number" className={CAMPO} value={item.valorTotal} onChange={(e) => atualizarItem(item.id, { valorTotal: e.target.value })} onBlur={(e) => atualizarItem(item.id, { valorTotal: normalizarMoeda(e.target.value) })} /></label>}
          <div className="self-end rounded-lg border border-[#e5dfd0] bg-white px-3 py-2.5 text-sm"><span className="text-ink-3">Total do item</span><strong className="float-right">{brl(totalItem(item))}</strong></div>
        </div>
      </div>;
    })}</div>
  </section>;
}

function EfeitoFinanceiro({ permite, condicao, alterarCondicao, contaId, setContaId, formaPagamento, setFormaPagamento, config, valorAgora, setValorAgora, total, parcelas, setParcelas, parcelasValidas, saldoFuturo }: { permite: boolean; condicao: Condicao; alterarCondicao: (condicao: Condicao) => void; contaId: string; setContaId: (id: string) => void; formaPagamento: string; setFormaPagamento: (forma: string) => void; config: ConfiguracoesFinanceiras; valorAgora: string; setValorAgora: (valor: string) => void; total: number; parcelas: ParcelaForm[]; setParcelas: React.Dispatch<React.SetStateAction<ParcelaForm[]>>; parcelasValidas: boolean; saldoFuturo: number }) {
  return <section><h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Efeito financeiro</h3>{permite ? <div className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Condição<CampoSelect aria-label="Condição financeira" value={condicao} onValueChange={(valor) => alterarCondicao(valor as Condicao)} options={OPCOES_CONDICAO} previa={(valor) => <EfeitosCondicao condicao={valor} nome={NOME_CONDICAO[valor as Condicao] ?? ""} />} /></label>{(condicao === "A_VISTA" || condicao === "PARCIAL") && <><label className="text-sm font-medium">Conta financeira *<SelectBusca aria-label="Conta financeira" value={contaId} onValueChange={setContaId} options={config.contas.filter((conta) => conta.ativo).map((conta) => ({ value: String(conta.id), label: conta.nome }))} buscaPlaceholder="Buscar conta…" vazioTexto="Nenhuma conta ativa encontrada." /></label><label className="text-sm font-medium">Forma de liquidação<CampoSelect aria-label="Forma de liquidação" value={formaPagamento} onValueChange={setFormaPagamento} options={OPCOES_FORMA} /></label></> }</div>{condicao === "PARCIAL" && <label className="block max-w-xs text-sm font-medium">Valor liquidado na operação *<input aria-label="Valor liquidado na operação" required min="0.01" max={Math.max(total - 0.01, 0)} step="0.01" type="number" className={CAMPO} value={valorAgora} onChange={(e) => setValorAgora(e.target.value)} /></label>}{(condicao === "A_PRAZO" || condicao === "PARCIAL") && <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><strong className="text-sm">Parcelas do compromisso</strong><p className="mt-1 text-xs text-ink-3">Cada parcela será criada como um compromisso vinculado a esta operação.</p></div><Button type="button" secondary onClick={() => setParcelas((atuais) => [...atuais, novaParcela(atuais.length)])}><Plus size={15} /> Parcela</Button></div><div className="space-y-3">{parcelas.map((parcela, indice) => <div key={parcela.id} className="grid items-end gap-3 sm:grid-cols-[80px_1fr_1fr_40px]"><strong className="pb-2.5 text-sm">{indice + 1}/{parcelas.length}</strong><label className="text-sm font-medium">Valor<input aria-label={`Valor da parcela ${indice + 1}`} required min="0.01" step="0.01" type="number" className={CAMPO} value={parcela.valor} onChange={(e) => setParcelas((atuais) => atuais.map((atual) => atual.id === parcela.id ? { ...atual, valor: e.target.value } : atual))} /></label><label className="text-sm font-medium">Vencimento<CampoData aria-label={`Vencimento da parcela ${indice + 1}`} value={parcela.vencimento} onChange={(valor) => setParcelas((atuais) => atuais.map((atual) => atual.id === parcela.id ? { ...atual, vencimento: valor } : atual))} /></label><button type="button" disabled={parcelas.length === 1} aria-label={`Remover parcela ${indice + 1}`} onClick={() => setParcelas((atuais) => atuais.filter((atual) => atual.id !== parcela.id))} className="mb-1 rounded-lg p-2 text-red-700 hover:bg-red-50 disabled:opacity-30"><Trash2 size={16} /></button></div>)}</div>{!parcelasValidas && <p className="mt-3 text-xs font-medium text-red-700">A soma das parcelas deve corresponder a {brl(condicao === "PARCIAL" ? saldoFuturo : total)}.</p>}</div>}</div> : <div className="rounded-lg bg-[#eef1e9] p-4 text-sm text-green-900"><strong>Sem movimentação financeira</strong><p className="mt-1 text-xs leading-5">Este tipo registra somente o efeito físico ou de valorização. Nenhuma conta ou compromisso será criado.</p></div>}</section>;
}

type DocumentoLinha = { chave: string; nome: string; detalhe: string; tipo: string; numero: string; alterarTipo: (tipo: string) => void; alterarNumero: (numero: string) => void; remover: () => void };

function Documentos({ anexos, setAnexos, documentosSalvos, atualizarDocumentoSalvo, removerDocumentoSalvo, selecionarAnexos, soltarArquivos, enviando }: { anexos: AnexoForm[]; setAnexos: React.Dispatch<React.SetStateAction<AnexoForm[]>>; documentosSalvos: DocumentoFinanceiro[]; atualizarDocumentoSalvo: (id: number, patch: { tipo?: string; numero?: string | null }) => void; removerDocumentoSalvo: (id: number) => void; selecionarAnexos: (evento: ChangeEvent<HTMLInputElement>) => void; soltarArquivos: (arquivos: File[]) => void; enviando: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  const profundidade = useRef(0);
  const [arrastando, setArrastando] = useState(false);
  const vazio = !anexos.length && !documentosSalvos.length;
  const trazArquivos = (evento: DragEvent) => Array.from(evento.dataTransfer?.types ?? []).includes("Files");
  const aoEntrar = (evento: DragEvent) => { if (!trazArquivos(evento)) return; evento.preventDefault(); profundidade.current += 1; setArrastando(true); };
  const aoPassar = (evento: DragEvent) => { if (!trazArquivos(evento)) return; evento.preventDefault(); evento.dataTransfer.dropEffect = "copy"; };
  const aoSair = (evento: DragEvent) => { if (!trazArquivos(evento)) return; profundidade.current = Math.max(0, profundidade.current - 1); if (!profundidade.current) setArrastando(false); };
  const aoSoltar = (evento: DragEvent) => { evento.preventDefault(); profundidade.current = 0; setArrastando(false); const arquivos = Array.from(evento.dataTransfer?.files ?? []); if (arquivos.length) soltarArquivos(arquivos); };
  const linhas: DocumentoLinha[] = [
    ...documentosSalvos.map((documento) => ({ chave: `salvo-${documento.id}`, nome: documento.nome, detalhe: "Salvo no rascunho", tipo: documento.tipo, numero: documento.numero ?? "", alterarTipo: (tipo: string) => atualizarDocumentoSalvo(documento.id, { tipo }), alterarNumero: (numero: string) => atualizarDocumentoSalvo(documento.id, { numero }), remover: () => removerDocumentoSalvo(documento.id) })),
    ...anexos.map((anexo) => ({ chave: `novo-${anexo.id}`, nome: anexo.arquivo.name, detalhe: `${(anexo.arquivo.size / 1024 / 1024).toFixed(2)} MB`, tipo: anexo.tipo, numero: anexo.numero, alterarTipo: (tipo: string) => setAnexos((atuais) => atuais.map((atual) => atual.id === anexo.id ? { ...atual, tipo } : atual)), alterarNumero: (numero: string) => setAnexos((atuais) => atuais.map((atual) => atual.id === anexo.id ? { ...atual, numero } : atual)), remover: () => setAnexos((atuais) => atuais.filter((atual) => atual.id !== anexo.id)) })),
  ];
  return <section onDragEnter={aoEntrar} onDragOver={aoPassar} onDragLeave={aoSair} onDrop={aoSoltar}>
    <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Documentos</h3><p className="mt-1 text-xs text-ink-3">PDF, XML, JPG, PNG ou WEBP, com até 10 MB por arquivo.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold transition hover:bg-[color:var(--bg)]"><Paperclip size={15} /> Anexar<input ref={entrada} aria-label="Anexar documentos" type="file" multiple accept={ACCEPT} className="sr-only" onChange={selecionarAnexos} /></label></div>
    {!vazio && <ul className="mb-3 space-y-2">{linhas.map((linha) => <li key={linha.chave} className="grid items-center gap-3 rounded-lg border border-border bg-white p-3 md:grid-cols-[minmax(0,1fr)_180px_170px_36px]">
      <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-ink-3"><FileText size={17} /></span><div className="min-w-0"><div className="truncate text-sm font-medium">{linha.nome}</div><div className="text-xs text-ink-3">{linha.detalhe}</div></div></div>
      <CampoSelect aria-label={`Tipo do documento ${linha.nome}`} className="mt-0 py-2" value={linha.tipo} onValueChange={linha.alterarTipo} options={OPCOES_DOCUMENTO} />
      <input aria-label={`Número do documento ${linha.nome}`} placeholder="Número (opcional)" className={`${CAMPO} mt-0 py-2 text-sm`} value={linha.numero} onChange={(e) => linha.alterarNumero(e.target.value)} />
      <button type="button" aria-label={`Remover documento ${linha.nome}`} onClick={linha.remover} className="justify-self-end rounded-lg p-2 text-red-700 transition hover:bg-red-50"><Trash2 size={16} /></button>
    </li>)}</ul>}
    <button
      type="button"
      data-slot="zona-soltar"
      aria-label="Arraste os arquivos para cá ou clique para escolher"
      onClick={() => entrada.current?.click()}
      className={cn(
        "flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outros/30",
        vazio ? "flex-col px-6 py-8" : "px-4 py-3",
        arrastando ? "border-outros bg-[color:var(--outros-soft)]" : "border-border bg-[color:var(--bg)]/60 hover:border-ink-3/40 hover:bg-[color:var(--bg)]",
      )}
    >
      <span className={cn("grid shrink-0 place-items-center rounded-full bg-white text-ink-3 shadow-sm transition", vazio ? "size-12" : "size-8", arrastando && "text-outros motion-safe:animate-bounce")}><UploadCloud size={vazio ? 22 : 16} aria-hidden="true" /></span>
      <span className={cn("flex flex-col", vazio ? "items-center" : "items-start text-left")}>
        <span className="text-sm font-semibold text-ink">{arrastando ? "Solte para anexar" : enviando ? "Enviando documentos…" : vazio ? "Arraste os arquivos para cá" : "Arraste mais arquivos para cá"}</span>
        {!arrastando && <span className="text-xs text-ink-3">ou <span className="font-semibold text-ink-2 underline decoration-ink-3/40 underline-offset-2">clique para escolher</span></span>}
      </span>
    </button>
  </section>;
}

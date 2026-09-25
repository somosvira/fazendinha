import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, FileText, Loader2, Paperclip, Plus, Trash2, Wand2 } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { getPropriedadeAtiva } from "../propriedadeScope";
import { listarPropriedades } from "@/api/propriedades";
import { anexarDocumentoOperacao, anexarDocumentoRascunho, ApiError, atualizarDocumentoRascunho, confirmarRascunhoOperacao, criarOperacao, descartarRascunhoOperacao, registrarAjusteEstoque, removerDocumentoRascunho, salvarRascunhoOperacao, simularParcelasOperacao, type ConfiguracoesFinanceiras, type DocumentoFinanceiro, type Operacao, type RascunhoOperacao, type SimulacaoParcelas } from "./novo-api";
import { brl, Button, emDias, ErrorBox, hoje, ReviewLine, TIPO_OPERACAO } from "./financeiro-ui";
import { FORMAS_PAGAMENTO, parceiroCompativel, parcelasSugeridas } from "./lib/parceiros";
import { deCentavos, paraCentavos, somarParcelas, type FrequenciaParcelas } from "./lib/parcelas";
import { marcarEdicaoRascunho } from "./rascunhoAtivo";
import { listarSaldos, obterCustoMedio, obterUltimoPreco, type SaldoDTO, type UltimoPrecoDTO } from "../estoque/api";
import { rotuloUnidade } from "../lib/unidades";

type Condicao = "A_VISTA" | "A_PRAZO" | "PARCIAL" | "SEM_EFEITO_FINANCEIRO";
type ModoValor = "UNITARIO" | "TOTAL";
type ItemForm = { categoriaId: string; classificacao: string; centroCustoId: string; id: number; produtoId: string; descricao: string; quantidade: string; unidade: string; modoValor: ModoValor; valorUnitario: string; valorTotal: string };
type ParcelaForm = { id: number; valor: string; vencimento: string };
type AnexoForm = { id: number; arquivo: File; tipo: string; numero: string };
type AnexoEnviando = { id: number; nome: string; tamanho: number };
type EstadoFormulario = {
  tipo: string; condicao: Condicao; descricao: string; valorOperacao: string; itens: ItemForm[];
  classificacao?: string; centroEscolhidoManualmente?: boolean; parceiroId: string; categoriaId: string; centroCustoId: string; contaId: string;
  centroCustoPorItem?: boolean;
  formaPagamento: string; data: string; valorAgora: string; parcelas: ParcelaForm[];
  geradorParcelas?: { quantidade: string; frequencia: FrequenciaParcelas; primeiroVencimento: string };
};

// AJUSTE_ESTOQUE fica de fora dos dois conjuntos de propósito: ele não tem itens
// livres — é uma contagem de UM produto (saldo lido × quantidade contada) e vai
// para POST /estoque/ajustes, não para o fluxo de rascunho/itens das demais.
const TIPO_AJUSTE = "AJUSTE_ESTOQUE";
const MSG_CONFLITO_SALDO = "O estoque mudou desde que você abriu esta tela. Atualize o saldo e confira a diferença.";
const MAX_QTD_AJUSTE = 999999999.999; // mesmo limite do servidor (ajusteContagemSchema)
const TIPOS_COM_ITENS = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "VENDA", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO"]);
const TIPOS_COM_ESTOQUE = new Set(["COMPRA_ESTOQUE", "VENDA", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO"]);
const TIPOS_FINANCEIROS = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "DEVOLUCAO"]);
const TIPOS_COM_PARCEIRO = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "DEVOLUCAO"]);
const TIPOS_DOCUMENTO = { NOTA_FISCAL: "Nota fiscal", BOLETO: "Boleto", CONTRATO: "Contrato", RECIBO: "Recibo", COMPROVANTE: "Comprovante", JUSTIFICATIVA: "Justificativa", OUTRO: "Outro" };
const CAMPO = "mt-1.5 w-full rounded-lg border border-[#d8cfbb] bg-white px-3 py-2.5 font-normal text-ink outline-none transition focus:border-[#6f7d68] focus:ring-2 focus:ring-[#6f7d68]/15";
const SELECT = `${CAMPO} cursor-pointer`;
const normalizarMoeda = (valor: string) => valor === "" ? "" : Number(valor).toFixed(2);
// valorUnitario do item é Decimal(14,4) no server — normalizarMoeda (2 casas)
// truncaria insumos fracionários (ex.: R$ 0,1234/un ou R$ 0,00045/g) para
// "0.12"/"0.00", fazendo o usuário confirmar um valor errado (ou, em
// INVENTARIO_INICIAL/BONIFICACAO, criar entrada de valor 0 fora do custo
// médio). Preserva até 4 casas, mas nunca menos que 2.
const normalizarPreco = (valor: string | number) => {
  if (valor === "" || valor === null || valor === undefined) return "";
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "";
  let texto = numero.toFixed(4).replace(/0+$/, "");
  if (texto.endsWith(".")) texto += "00";
  else {
    const casas = texto.split(".")[1]?.length ?? 0;
    if (casas < 2) texto += "0".repeat(2 - casas);
  }
  return texto;
};
// O cadastro não guarda preço: ao escolher o produto, estas operações sugerem o
// valor unitário da última compra (venda e produção têm outra base de valor).
const SUGERE_ULTIMO_PRECO = new Set(["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO"]);
const fmtQuantidade = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const fmtDiferenca = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3, signDisplay: "exceptZero" });
const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
// brl() (financeiro-ui.tsx) sempre arredonda para 2 casas — insuficiente para
// insumos valorizados por unidade fracionária (ex.: R$ 0,0045/mL). Mostra 2
// casas quando o valor "fecha" nelas e até 4 quando não fecha.
const brlPreciso = (valor: string | number) => {
  const numero = Number(valor);
  const fechaEmDuasCasas = Math.abs(numero - Math.round(numero * 100) / 100) < 1e-9;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: fechaEmDuasCasas ? 2 : 4 }).format(numero);
};

let proximoId = 1;
const novoItem = (): ItemForm => ({ id: proximoId++, categoriaId: "", classificacao: "", centroCustoId: "", produtoId: "", descricao: "", quantidade: "1", unidade: "un", modoValor: "UNITARIO", valorUnitario: "", valorTotal: "" });
const novaParcela = (indice = 0): ParcelaForm => ({ id: proximoId++, valor: "", vencimento: emDias(30 * (indice + 1)) });
const totalItem = (item: ItemForm) => item.modoValor === "TOTAL" ? Number(item.valorTotal || 0) : Number(item.quantidade || 0) * Number(item.valorUnitario || 0);
const parceiroLabel = (tipo: string) => tipo === "VENDA" ? "Cliente" : tipo === "SERVICO" ? "Prestador de serviço" : tipo === "DEVOLUCAO" ? "Fornecedor da devolução" : "Fornecedor ou parceiro";

/** Mensagem de erro de campo, sempre com o mesmo destaque: ícone + texto em vermelho. */
function CampoErro({ id, className = "mt-1.5", children }: { id?: string; className?: string; children: React.ReactNode }) {
  return <span id={id} role="alert" className={`flex items-start gap-1.5 text-xs font-semibold text-red-700 ${className}`}><CircleAlert size={14} className="mt-px shrink-0" aria-hidden /><span>{children}</span></span>;
}

export function FormOperacao({ config, rascunho = null, condicaoInicial, tipoInicial, produtoInicial, operacaoBase = null, onSalvo }: { config: ConfiguracoesFinanceiras; rascunho?: RascunhoOperacao | null; condicaoInicial?: Condicao; tipoInicial?: string; /** Produto pré-selecionado no tipo Ajuste de estoque (atalho da tela de Estoque). */ produtoInicial?: number; operacaoBase?: Operacao | null; onSalvo: (operacao: Pick<Operacao, "id">, aviso?: string) => void }) {
  // Aberto pelo atalho do Estoque (tipoInicial = ajuste): ignora o conteúdo do
  // rascunho — o ajuste não usa rascunho e não deve herdar/atropelar o dele.
  const atalhoAjuste = !operacaoBase && tipoInicial === TIPO_AJUSTE;
  const inicial = (!operacaoBase && !atalhoAjuste ? rascunho?.dados.formulario : null) as Partial<EstadoFormulario> | null;
  const transacaoBase = operacaoBase?.transacoes.find((item) => item.tipo !== "REVERSAO");
  const temCompromissos = !!operacaoBase?.compromissos.length;
  const condicaoBase: Condicao = inicial?.condicao ?? (!operacaoBase ? condicaoInicial ?? (tipoInicial && !TIPOS_FINANCEIROS.has(tipoInicial) ? "SEM_EFEITO_FINANCEIRO" : "A_VISTA") : transacaoBase && temCompromissos ? "PARCIAL" : temCompromissos ? "A_PRAZO" : transacaoBase ? "A_VISTA" : "SEM_EFEITO_FINANCEIRO");
  const [tipo, setTipo] = useState(inicial?.tipo ?? operacaoBase?.tipo ?? tipoInicial ?? "COMPRA_ESTOQUE");
  const [condicao, setCondicao] = useState<Condicao>(condicaoBase);
  const [descricao, setDescricao] = useState(inicial?.descricao ?? (operacaoBase ? `Correção da OP-${String(operacaoBase.id).padStart(4, "0")} — ${operacaoBase.descricao ?? TIPO_OPERACAO[operacaoBase.tipo]}` : ""));
  const [valorOperacao, setValorOperacao] = useState(inicial?.valorOperacao ?? operacaoBase?.valorTotal ?? "");
  // Rascunhos salvos antes do centro de custo por item existir podem trazer
  // `itens` sem `centroCustoId` (campo ausente, não ""): normaliza na
  // hidratação pra manter os <select> controlados e a validação de "item não
  // estocável sem centro efetivo" consistente com o fluxo de edição manual.
  const [itens, setItens] = useState<ItemForm[]>(() => inicial?.itens
    ? inicial.itens.map((item) => ({ ...item, centroCustoId: item.centroCustoId ?? "" }))
    : (operacaoBase?.itens.length ? operacaoBase.itens.map((item) => ({ id: proximoId++, categoriaId: String(item.categoriaId ?? ""), classificacao: item.classificacao ?? "", centroCustoId: String(item.centroCustoId ?? ""), produtoId: item.produtoId ? String(item.produtoId) : "", descricao: item.descricao, quantidade: item.quantidade, unidade: item.unidade, modoValor: "UNITARIO", valorUnitario: item.valorUnitario, valorTotal: item.valorTotal })) : [novoItem()]));
  const [ultimosPrecos, setUltimosPrecos] = useState<Record<number, UltimoPrecoDTO & { produtoId: string }>>({});
  // Marca, por item, para qual (produto, fornecedor) o valor unitário atual foi
  // sugerido — usado para saber se ainda é seguro sobrescrevê-lo quando o
  // fornecedor da operação muda (ver efeito abaixo). Só o parceiroId muda entre
  // buscas repetidas; o produto já dispara uma sugestão nova em `alterarProduto`.
  const [sugestaoValor, setSugestaoValor] = useState<Record<number, { parceiroId: string; produtoId: string; valor: string }>>({});
  // Custo médio atual do produto — apoio exibido só quando não há última compra
  // (sem preencher o campo). Guardado por item porque cada item pode ter um
  // produto diferente.
  const [custosMedios, setCustosMedios] = useState<Record<number, number | null>>({});
  const [parceiroId, setParceiroId] = useState(inicial?.parceiroId ?? (operacaoBase?.parceiro?.id ? String(operacaoBase.parceiro.id) : ""));
  const [classificacao, setClassificacao] = useState(inicial?.classificacao ?? operacaoBase?.classificacao ?? "");
  const [centroEscolhidoManualmente, setCentroEscolhidoManualmente] = useState(inicial?.centroEscolhidoManualmente ?? (!!inicial?.centroCustoId || !!operacaoBase?.centroCustoId));
  const [categoriaId, setCategoriaId] = useState(inicial?.categoriaId ?? (operacaoBase?.categoriaId ? String(operacaoBase.categoriaId) : ""));
  const [centroCustoId, setCentroCustoId] = useState(inicial?.centroCustoId ?? (operacaoBase?.centroCustoId ? String(operacaoBase.centroCustoId) : ""));
  const [porItem, setPorItem] = useState(inicial?.centroCustoPorItem ?? itens.some((item) => item.centroCustoId));
  const [contaId, setContaId] = useState(inicial?.contaId ?? (transacaoBase?.movimentos?.[0]?.contaId ? String(transacaoBase.movimentos[0].contaId) : ""));
  const [formaPagamento, setFormaPagamento] = useState(inicial?.formaPagamento ?? transacaoBase?.formaPagamento ?? "PIX");
  const [data, setData] = useState(inicial?.data ?? hoje());
  const [valorAgora, setValorAgora] = useState(inicial?.valorAgora ?? (condicaoBase === "PARCIAL" ? transacaoBase?.valorTotal ?? "" : ""));
  const [parcelas, setParcelas] = useState<ParcelaForm[]>(() => inicial?.parcelas ?? (operacaoBase?.compromissos.length ? operacaoBase.compromissos.map((item) => ({ id: proximoId++, valor: item.valorOriginal, vencimento: item.dataVencimento.slice(0, 10) })) : [novaParcela()]));
  const [geradorParcelas, setGeradorParcelas] = useState(() => {
    const salvo = inicial?.geradorParcelas;
    return {
      quantidade: salvo?.quantidade ?? String(Math.max(1, inicial?.parcelas?.length ?? operacaoBase?.compromissos.length ?? 1)),
      // Rascunhos salvos antes da remoção da frequência "Personalizada" podem
      // trazer esse valor do banco — o <select> só oferece SEMANAL/MENSAL, e
      // mandar o valor antigo pra API quebra com 422. Valida aqui na volta.
      frequencia: salvo?.frequencia === "SEMANAL" ? "SEMANAL" as const : "MENSAL" as const,
      primeiroVencimento: salvo?.primeiroVencimento ?? inicial?.parcelas?.[0]?.vencimento ?? operacaoBase?.compromissos[0]?.dataVencimento.slice(0, 10) ?? emDias(30),
    };
  });
  const [anexos, setAnexos] = useState<AnexoForm[]>([]);
  const [documentosSalvos, setDocumentosSalvos] = useState<DocumentoFinanceiro[]>(rascunho?.documentos ?? []);
  const [anexosEnviando, setAnexosEnviando] = useState<AnexoEnviando[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);
  const [confirmarSugestao, setConfirmarSugestao] = useState(false);
  const [estadoSalvamento, setEstadoSalvamento] = useState<"ALTERADO" | "SALVANDO" | "SALVO" | "ERRO">(rascunho ? "SALVO" : "ALTERADO");
  const versaoRef = useRef(rascunho?.versao);
  const salvamentoEmCursoRef = useRef<Promise<RascunhoOperacao> | null>(null);
  const iniciouRef = useRef(false);
  const [erro, setErro] = useState<string | null>(null);
  const erroConfirmacaoRef = useRef<HTMLDivElement>(null);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);
  const [campoInvalido, setCampoInvalido] = useState<string | null>(null);
  const [simulacao, setSimulacao] = useState<{ assinatura: string; resultado: SimulacaoParcelas } | null>(null);
  // Ajuste de estoque: o saldo lido (`saldos`) é o `saldoEsperado` enviado; se ele
  // mudar no servidor antes da confirmação, o POST responde CONFLITO.
  const [ajusteProdutoId, setAjusteProdutoId] = useState(produtoInicial ? String(produtoInicial) : "");
  const [quantidadeContada, setQuantidadeContada] = useState("");
  const [saldos, setSaldos] = useState<SaldoDTO[] | null>(null);
  const [saldosCarregando, setSaldosCarregando] = useState(false);
  const [saldosErro, setSaldosErro] = useState<string | null>(null);
  const saldosPedidoRef = useRef(0);
  const ehAjuste = tipo === TIPO_AJUSTE;
  // Sem sítio ativo e com mais de um sítio, o saldo lido soma todos os sítios mas o
  // ajuste é gravado em um só: o `saldoEsperado` nunca bateria (loop de CONFLITO).
  const [totalSitios, setTotalSitios] = useState<number | null>(null);
  useEffect(() => {
    if (!ehAjuste || getPropriedadeAtiva() != null || totalSitios !== null) return;
    let ativo = true;
    listarPropriedades().then((lista) => { if (ativo) setTotalSitios(Array.isArray(lista) ? lista.filter((p) => p.ativo).length : 0); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [ehAjuste, totalSitios]);
  const ajusteConsolidado = ehAjuste && getPropriedadeAtiva() == null && (totalSitios ?? 0) >= 2;

  const carregarSaldos = async () => {
    const pedido = ++saldosPedidoRef.current;
    setSaldosCarregando(true); setSaldosErro(null);
    try {
      const lista = await listarSaldos();
      if (pedido === saldosPedidoRef.current) setSaldos(lista);
    } catch (falha) {
      if (pedido === saldosPedidoRef.current) setSaldosErro(falha instanceof Error ? falha.message : String(falha));
    } finally {
      if (pedido === saldosPedidoRef.current) setSaldosCarregando(false);
    }
  };
  useEffect(() => {
    if (ehAjuste && saldos === null) void carregarSaldos();
    // Só ao entrar no tipo Ajuste; recargas seguintes são explícitas ("Atualizar saldo").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehAjuste]);
  const saldoProduto = saldos?.find((saldo) => String(saldo.produtoId) === ajusteProdutoId) ?? null;
  const contadaNumero = quantidadeContada.trim() === "" ? NaN : Number(quantidadeContada);
  const contadaMilesimos = Math.round(contadaNumero * 1000);
  // Até 3 casas (o servidor exige múltiplo de 0,001) e dentro do limite.
  const contadaValida = Number.isFinite(contadaNumero) && contadaNumero >= 0 && contadaNumero <= MAX_QTD_AJUSTE && Math.abs(contadaNumero * 1000 - contadaMilesimos) < 1e-6;
  const diferencaMilesimos = saldoProduto && contadaValida ? contadaMilesimos - Math.round(saldoProduto.saldo * 1000) : null;
  const ajusteSemDiferenca = diferencaMilesimos !== null && Math.abs(diferencaMilesimos / 1000) < 0.0005;
  const unidadeAjuste = saldoProduto ? rotuloUnidade(saldoProduto.unidade) : "";
  const ajustePronto = !!saldoProduto && contadaValida && !ajusteSemDiferenca && descricao.trim().length >= 5;

  const comItens = TIPOS_COM_ITENS.has(tipo);
  const movimentaEstoque = TIPOS_COM_ESTOQUE.has(tipo);
  const permiteFinanceiro = TIPOS_FINANCEIROS.has(tipo);
  const exigeParceiro = TIPOS_COM_PARCEIRO.has(tipo);
  const entradaFinanceira = tipo === "VENDA" || tipo === "DEVOLUCAO";
  // O backend arredonda cada item antes de somá-los; repetir a mesma ordem
  // evita validar na tela uma distribuição de parcelas que o servidor rejeita.
  const centavosTotal = comItens
    ? itens.reduce((soma, item) => soma + Math.round(totalItem(item) * 100), 0)
    : Math.round(Number(valorOperacao || 0) * 100);
  const total = centavosTotal / 100;
  const realizadoAgora = condicao === "A_VISTA" ? total : Number(valorAgora || 0);
  const centavosParcelas = parcelas.reduce((soma, parcela) => soma + Math.round(Number(parcela.valor || 0) * 100), 0);
  const totalParcelas = centavosParcelas / 100;
  // Quem decide se o item mexe no estoque é o tipo da operação: em tipo com
  // estoque, todo item com produto gera movimento físico.
  const movimentosEstoque = movimentaEstoque ? itens.filter((item) => !!item.produtoId).length : 0;
  const saldoFuturo = Math.max(0, total - realizadoAgora);
  const entradaSimulacao = useMemo(() => ({
    itens: comItens ? itens.map((item) => item.modoValor === "TOTAL"
      ? { quantidade: item.quantidade, valorTotal: item.valorTotal }
      : { quantidade: item.quantidade, valorUnitario: item.valorUnitario }) : [],
    valorTotal: comItens ? undefined : valorOperacao,
    valorPagoAgora: condicao === "PARCIAL" ? valorAgora : undefined,
  }), [comItens, itens, valorAgora, valorOperacao, condicao]);
  const assinaturaSimulacao = JSON.stringify(entradaSimulacao);
  const simulacaoAtual = simulacao?.assinatura === assinaturaSimulacao ? simulacao.resultado : null;
  const totalFinanceiro = simulacaoAtual ? Number(simulacaoAtual.totalOperacao) : total;
  const saldoFuturoFinanceiro = simulacaoAtual ? Number(simulacaoAtual.saldoAPrazo) : saldoFuturo;
  const categorias = config.categorias.filter((categoria) => categoria.ativo);
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
      // Mantém a grade (quantidade/vencimento) em sincronia, caso o usuário
      // abra o popover "Gerar parcelas" depois de aplicar a sugestão.
      setGeradorParcelas((atual) => ({ ...atual, quantidade: String(sugestaoParcelas.length), primeiroVencimento: sugestaoParcelas[0]?.vencimento ?? atual.primeiroVencimento }));
    }
    setConfirmarSugestao(false);
  };

  const estadoFormulario = useMemo<EstadoFormulario>(() => ({
    tipo, condicao, descricao, valorOperacao, itens, parceiroId, categoriaId, classificacao, centroEscolhidoManualmente, centroCustoId,
    centroCustoPorItem: porItem,
    contaId, formaPagamento, data, valorAgora, parcelas, geradorParcelas,
  }), [tipo, condicao, descricao, valorOperacao, itens, parceiroId, categoriaId, classificacao, centroEscolhidoManualmente, centroCustoId, porItem, contaId, formaPagamento, data, valorAgora, parcelas, geradorParcelas]);
  const operacaoRascunho = useMemo(() => {
    const financeiro = condicao === "A_VISTA" ? { condicao, contaId: Number(contaId), formaPagamento }
      : condicao === "A_PRAZO" ? { condicao, parcelas: parcelas.map((parcela) => ({ valor: parcela.valor, dataVencimento: parcela.vencimento })) }
        : condicao === "PARCIAL" ? { condicao, contaId: Number(contaId), valorPago: valorAgora, formaPagamento, parcelas: parcelas.map((parcela) => ({ valor: parcela.valor, dataVencimento: parcela.vencimento })) }
          : { condicao: "SEM_EFEITO_FINANCEIRO" };
    return {
      tipo, data, descricao: descricao.trim(), valorTotal: comItens ? undefined : valorOperacao,
      parceiroId: parceiroId ? Number(parceiroId) : undefined, categoriaId: !comItens && categoriaId ? Number(categoriaId) : undefined, classificacao: !comItens ? classificacao || null : undefined,
      centroCustoId: centroCustoId ? Number(centroCustoId) : undefined, corrigeOperacaoId: operacaoBase?.id,
      itens: comItens ? itens.map((item) => {
        const produto = config.produtos.find((produtoAtual) => produtoAtual.id === Number(item.produtoId));
        const centroEfetivo = porItem ? item.centroCustoId : "";
        return { categoriaId: item.categoriaId ? Number(item.categoriaId) : null, classificacao: item.classificacao || null, centroCustoId: centroEfetivo ? Number(centroEfetivo) : null, produtoId: item.produtoId ? Number(item.produtoId) : undefined, descricao: item.descricao.trim(), quantidade: item.quantidade, unidade: item.unidade || (produto ? rotuloUnidade(produto.unidade) : "un"), ...(item.modoValor === "TOTAL" ? { valorTotal: item.valorTotal } : { valorUnitario: item.valorUnitario }), estocavel: movimentaEstoque && !!item.produtoId };
      }) : [], financeiro,
    };
  }, [classificacao, categoriaId, centroCustoId, porItem, comItens, condicao, config.produtos, contaId, data, descricao, formaPagamento, itens, movimentaEstoque, operacaoBase?.id, parceiroId, parcelas, tipo, valorAgora, valorOperacao]);
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
    // Ajuste de estoque não usa rascunho: o estado dele (produto, contagem, saldo
    // lido) é efêmero — o saldo lido envelhece e restaurá-lo geraria um
    // `saldoEsperado` velho. Sem autosave, o rascunho existente fica intocado.
    // Instância aberta pelo atalho do Estoque também nunca salva: `versaoRef` vem do
    // rascunho real e um autosave com o form quase vazio o sobrescreveria.
    if (ehAjuste || atalhoAjuste) return;
    setEstadoSalvamento("ALTERADO");
    const timer = window.setTimeout(() => { void persistirRascunho().catch((falha) => setErro(falha instanceof Error ? falha.message : String(falha))); }, 800);
    return () => window.clearTimeout(timer);
    // O payload memorizado representa integralmente o estado editavel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosRascunho, operacaoBase, ehAjuste, atalhoAjuste]);
  // Acende o atalho "Trabalho ativo" da sidebar enquanto o rascunho está na tela.
  useEffect(() => (operacaoBase || ehAjuste || atalhoAjuste ? undefined : marcarEdicaoRascunho()), [operacaoBase, ehAjuste, atalhoAjuste]);

  const atualizarItem = (id: number, patch: Partial<ItemForm>) => {
    setItens((atuais) => atuais.map((item) => item.id === id ? { ...item, ...patch } : item));
    limparCampoInvalido(`item-${id}`);
  };
  // Centro único sugerido a partir do produto de cada item (quando o produto
  // aponta para exatamente um centro ativo). Usado para pré-preencher tanto o
  // centro da operação (modo Único) quanto o centro de cada item (modo Por item).
  const centroUnicoDoProduto = (produtoId: string) => {
    const centros = (config.produtos.find((p) => p.id === Number(produtoId))?.centroCustoIds ?? [])
      .filter((centro) => config.centrosCusto.some((c) => c.id === centro && c.ativo));
    return centros.length === 1 ? String(centros[0]) : "";
  };
  const centrosSugeridos = [...new Set(itens.map((item) => centroUnicoDoProduto(item.produtoId)).filter(Boolean))];
  const sugestaoCentro = centrosSugeridos.length === 1 ? centrosSugeridos[0] : "";
  const produtosDivergentes = centrosSugeridos.length > 1;
  useEffect(() => { if (!centroEscolhidoManualmente && comItens) setCentroCustoId(sugestaoCentro); }, [sugestaoCentro, centroEscolhidoManualmente, comItens]);
  // No ajuste, o produto escolhido sugere seu centro único (mesma regra dos itens).
  useEffect(() => {
    if (ehAjuste && !centroEscolhidoManualmente) setCentroCustoId(ajusteProdutoId ? centroUnicoDoProduto(ajusteProdutoId) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehAjuste, ajusteProdutoId, centroEscolhidoManualmente]);
  // No modo Único, o centro de cada item é sempre ignorado (a operação inteira usa
  // um único centro); mantemos o valor limpo para não vazar no payload enviado.
  const centroEfetivoItem = (item: ItemForm) => porItem ? item.centroCustoId : "";
  const alterarModoCentro = (novoPorItem: boolean) => {
    setPorItem(novoPorItem);
    if (!novoPorItem) {
      setItens((atuais) => atuais.map((item) => ({ ...item, centroCustoId: "" })));
    } else {
      // Deixa "" (não o centro da operação) quando o produto não tem centro
      // único: o item continua herdando do padrão da operação (null no payload),
      // sem transformar essa herança em uma escolha explícita e "congelada".
      setItens((atuais) => atuais.map((item) => ({ ...item, centroCustoId: centroUnicoDoProduto(item.produtoId) })));
    }
  };
  // Busca a sugestão de preço (última compra do produto, preferindo o
  // fornecedor informado); sem histórico, busca o custo médio atual só como
  // apoio informativo. `valorAntesDaBusca`/`sugestaoAnterior` são capturados no
  // momento da chamada: o campo só é sobrescrito se, quando a resposta chegar,
  // ele ainda estiver vazio ou com o valor da última sugestão aplicada — nunca
  // um valor que o usuário tenha digitado nesse meio-tempo.
  const buscarSugestaoPreco = (itemId: number, produtoId: string, parceiroBusca: string, valorAntesDaBusca: string, sugestaoAnterior?: { produtoId: string; valor: string }) => {
    if (!SUGERE_ULTIMO_PRECO.has(tipo)) return;
    obterUltimoPreco(Number(produtoId), parceiroBusca ? Number(parceiroBusca) : undefined).then((ultimo) => {
      if (!ultimo?.valorUnitario) {
        // Sem compra anterior: sem sugestão pra preencher — mostra o custo médio
        // atual como texto de apoio (não altera o campo).
        setUltimosPrecos(({ [itemId]: _descartado, ...resto }) => resto);
        obterCustoMedio(Number(produtoId)).then((resultado) => {
          setCustosMedios((atuais) => ({ ...atuais, [itemId]: resultado?.custoMedio ?? null }));
        }).catch(() => { /* apoio opcional: falha de rede não bloqueia o formulário */ });
        return;
      }
      const valorFormatado = normalizarPreco(ultimo.valorUnitario);
      const podeSobrescrever = valorAntesDaBusca === "" || (sugestaoAnterior?.produtoId === produtoId && valorAntesDaBusca === sugestaoAnterior.valor);
      if (podeSobrescrever) {
        // Segunda checagem (contra o valor atual, não o capturado) cobre o caso
        // raro de o usuário digitar algo entre o início e o fim desta busca.
        setItens((atuais) => atuais.map((item) => item.id === itemId && item.produtoId === produtoId && item.valorUnitario === valorAntesDaBusca ? { ...item, valorUnitario: valorFormatado } : item));
      }
      setUltimosPrecos((atuais) => ({ ...atuais, [itemId]: { ...ultimo, produtoId } }));
      setCustosMedios(({ [itemId]: _descartado, ...resto }) => resto);
      setSugestaoValor((atuais) => ({ ...atuais, [itemId]: { parceiroId: parceiroBusca, produtoId, valor: valorFormatado } }));
    }).catch(() => { /* sugestão é opcional: falha de rede não bloqueia o preenchimento */ });
  };
  const alterarProduto = (id: number, produtoId: string) => {
    const produto = config.produtos.find((item) => item.id === Number(produtoId));
    const categoria = categorias.find((c) => c.id === produto?.categoriaId);
    atualizarItem(id, produto ? { produtoId, descricao: produto.nome, unidade: rotuloUnidade(produto.unidade), valorUnitario: "", categoriaId: String(categoria?.id ?? ""), classificacao: categoria?.classificacao ?? "", centroCustoId: centroUnicoDoProduto(produtoId) } : { produtoId, categoriaId: "", classificacao: "", centroCustoId: "" });
    setUltimosPrecos(({ [id]: _descartado, ...resto }) => resto);
    setCustosMedios(({ [id]: _descartado, ...resto }) => resto);
    setSugestaoValor(({ [id]: _descartado, ...resto }) => resto);
    if (!produto) return;
    buscarSugestaoPreco(id, produtoId, parceiroId, "");
  };
  // O fornecedor da operação mudou depois que algum item já tinha uma sugestão
  // de preço: refaz a busca para o novo fornecedor. Só reage à troca do
  // parceiro — itens/sugestaoValor mudam como efeito colateral desta mesma
  // busca (buscarSugestaoPreco), então incluí-los nas deps criaria um loop.
  useEffect(() => {
    itens.forEach((item) => {
      if (!item.produtoId) return;
      const sugestao = sugestaoValor[item.id];
      if (!sugestao || sugestao.produtoId !== item.produtoId || sugestao.parceiroId === parceiroId) return;
      buscarSugestaoPreco(item.id, item.produtoId, parceiroId, item.valorUnitario, sugestao);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parceiroId]);
  const alterarTipo = (novoTipo: string) => {
    if (atalhoAjuste) return;
    setTipo(novoTipo);
    if (parceiroSelecionado && !parceiroCompativel(parceiroSelecionado, novoTipo)) {
      setParceiroId("");
      if (TIPOS_COM_PARCEIRO.has(novoTipo)) setErro("Selecione um parceiro com papel compatível com o novo tipo de operação.");
    }
    if (!TIPOS_FINANCEIROS.has(novoTipo)) setCondicao("SEM_EFEITO_FINANCEIRO");
    else if (condicao === "SEM_EFEITO_FINANCEIRO") setCondicao("A_VISTA");
  };
  // A grade de parcelas só muda quando o usuário pede — clicando em "Gerar
  // parcelas" ou editando uma linha — nunca como efeito colateral de trocar a
  // condição, então não há risco de perder dados já preenchidos aqui.
  const alterarCondicao = (novaCondicao: Condicao) => {
    setCondicao(novaCondicao);
    if (novaCondicao === "PARCIAL") {
      const totalCentavos = paraCentavos(total.toFixed(2)) ?? Math.round(total * 100);
      const metadeCentavos = Math.floor(totalCentavos / 2);
      setValorAgora(metadeCentavos ? deCentavos(metadeCentavos) : "");
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
      // Linhas provisórias: o envio (rascunho + upload direto + confirmação) demora,
      // e sem elas o usuário acha que o clique em "Anexar" não fez nada.
      const pendentes = validos.map((arquivo) => ({ id: proximoId++, nome: arquivo.name, tamanho: arquivo.size }));
      setAnexosEnviando((atuais) => [...atuais, ...pendentes]);
      try {
        await persistirRascunho();
        for (const [indice, arquivo] of validos.entries()) {
          try {
            const documento = await anexarDocumentoRascunho({ arquivo, tipo: "NOTA_FISCAL" });
            setDocumentosSalvos((atuais) => [...atuais, documento]);
          } finally {
            setAnexosEnviando((atuais) => atuais.filter((atual) => atual.id !== pendentes[indice].id));
          }
        }
      } catch (falha) { setErro(falha instanceof Error ? falha.message : String(falha)); }
      finally { setAnexosEnviando((atuais) => atuais.filter((atual) => !pendentes.some((pendente) => pendente.id === atual.id))); }
    }
    evento.target.value = "";
  };

  const resumoCategorias = comItens ? Object.entries(itens.reduce<Record<string, number>>((acc, item) => {
    const nome = categorias.find((c) => c.id === Number(item.categoriaId))?.nome ?? "Sem categoria";
    acc[nome] = (acc[nome] ?? 0) + Math.round(totalItem(item) * 100); return acc;
  }, {})) : [[categorias.find((c) => c.id === Number(categoriaId))?.nome ?? "Sem categoria", Math.round(total * 100)]] as [string, number][];
  const resumoCentros = comItens && porItem ? Object.entries(itens.reduce<Record<string, number>>((acc, item) => {
    const idEfetivo = centroEfetivoItem(item) || centroCustoId;
    const nome = config.centrosCusto.find((c) => String(c.id) === idEfetivo)?.nome ?? "Sem centro";
    acc[nome] = (acc[nome] ?? 0) + Math.round(totalItem(item) * 100); return acc;
  }, {})) : [];
  const itensValidos = !comItens || itens.every((item) => item.descricao.trim() && Number(item.quantidade) > 0 && (!movimentaEstoque || item.produtoId));
  const totalParcelasEmCentavos = somarParcelas(parcelas);
  const somaParcelasConfere = condicao === "A_PRAZO" ? parcelas.length > 0 && totalParcelasEmCentavos === paraCentavos(totalFinanceiro.toFixed(2))
    : condicao === "PARCIAL" ? realizadoAgora > 0 && saldoFuturoFinanceiro > 0 && parcelas.length > 0 && totalParcelasEmCentavos === paraCentavos(saldoFuturoFinanceiro.toFixed(2)) : true;
  // A soma fechar não basta: uma parcela em branco (valor 0) passa na soma mas a
  // API a rejeita. Cada parcela precisa de valor > 0 e de vencimento.
  const parcelaIncompleta = condicao === "A_PRAZO" || condicao === "PARCIAL"
    ? parcelas.find((parcela) => !((paraCentavos(parcela.valor) ?? 0) > 0) || !parcela.vencimento)
    : undefined;
  const parcelasValidas = somaParcelasConfere && !parcelaIncompleta;
  const contaValida = !["A_VISTA", "PARCIAL"].includes(condicao) || !!contaId;
  // Marca o campo apontado pela API (`ApiError.campo`) ou pela validação local
  // ao tentar confirmar, sem depender só do alerta geral.
  const classeCampoErro = (campo: string) => campoInvalido === campo ? " border-red-400 ring-2 ring-red-200" : "";
  const limparCampoInvalido = (campo: string) => { if (campoInvalido === campo) setCampoInvalido(null); };
  const itemInvalidoId = campoInvalido?.startsWith("item-") ? Number(campoInvalido.slice(5)) : null;
  // Item não estocável precisa de um centro de custo efetivo: o próprio (modo Por
  // item) ou o da operação (fallback em ambos os modos, já que no modo Único o
  // centro do item é sempre "").
  const itemCentroInvalido = (index: number, item: ItemForm) => {
    if (!comItens) return false;
    const estocavel = movimentaEstoque && !!item.produtoId;
    if (estocavel) return false;
    return !(centroEfetivoItem(item) || centroCustoId);
  };
  const podeConfirmar = ehAjuste ? ajustePronto : (!comItens || itens.every((item, i) => !itemCentroInvalido(i, item))) && descricao.trim().length >= 2 && (!exigeParceiro || !!parceiroSelecionado) && itensValidos && contaValida && parcelasValidas && (total > 0 || (!permiteFinanceiro && total >= 0));

  // No modo Único não existe select por item — o único jeito de resolver uma
  // pendência de centro de custo (local ou vinda do servidor) é preencher o
  // centro padrão da operação, então é ele que recebe o foco; no modo Por item
  // o próprio select do item é destacado. Também usado para mapear o `campo`
  // de erro que a API devolve (`itens.<i>.centroCustoId`), já que nesse caso o
  // servidor não sabe em qual modo o formulário está.
  const mapearCampoCentro = (campo: string): { campo: string; elementId: string } => {
    const indiceItem = campo.match(/^itens\.(\d+)\.centroCustoId$/)?.[1];
    if (indiceItem !== undefined && !porItem) return { campo: "centroCustoId", elementId: "campo-centroCustoId" };
    if (indiceItem !== undefined) return { campo, elementId: `campo-itens-${indiceItem}-centroCustoId` };
    return { campo, elementId: `campo-${campo}` };
  };

  // Em vez de manter o botão desabilitado até tudo estar certo, deixamos o
  // usuário clicar e, se faltar algo, achamos o primeiro campo com problema
  // (na ordem em que aparecem na tela) pra rolar e focar nele — em vez de
  // deixar o usuário procurando o que falta preencher.
  const encontrarPrimeiroCampoInvalido = (): { campo: string; elementId: string } | null => {
    if (ehAjuste) {
      if (!saldoProduto) return { campo: "ajusteProduto", elementId: "campo-ajusteProduto" };
      if (!contadaValida) return { campo: "quantidadeContada", elementId: "campo-quantidadeContada" };
      if (descricao.trim().length < 5) return { campo: "descricao", elementId: "campo-descricao" };
      return null;
    }
    if (exigeParceiro && !parceiroSelecionado) return { campo: "parceiroId", elementId: "campo-parceiroId" };
    if (descricao.trim().length < 2) return { campo: "descricao", elementId: "campo-descricao" };
    if (comItens) {
      const itemInvalido = itens.find((item) => !item.descricao.trim() || !(Number(item.quantidade) > 0) || (movimentaEstoque && !item.produtoId));
      if (itemInvalido) return { campo: `item-${itemInvalido.id}`, elementId: `item-${itemInvalido.id}` };
      const indiceCentroInvalido = itens.findIndex((item, i) => itemCentroInvalido(i, item));
      if (indiceCentroInvalido !== -1) return mapearCampoCentro(`itens.${indiceCentroInvalido}.centroCustoId`);
    } else if (permiteFinanceiro && !(total > 0)) {
      return { campo: "valorOperacao", elementId: "campo-valorOperacao" };
    }
    if (!contaValida) return { campo: "contaId", elementId: "campo-contaId" };
    if (condicao === "PARCIAL" && !(realizadoAgora > 0)) return { campo: "valorAgora", elementId: "campo-valorAgora" };
    if (parcelaIncompleta) {
      const chave = `${(paraCentavos(parcelaIncompleta.valor) ?? 0) > 0 ? "parcela-vencimento" : "parcela-valor"}-${parcelaIncompleta.id}`;
      return { campo: chave, elementId: chave };
    }
    if (!parcelasValidas) return { campo: "parcelas", elementId: "secao-parcelas" };
    return null;
  };

  const submit = async (evento: FormEvent) => {
    evento.preventDefault();
    if (anexosEnviando.length || ajusteConsolidado) return;
    if (!podeConfirmar) {
      const invalido = encontrarPrimeiroCampoInvalido();
      if (invalido) {
        setCampoInvalido(invalido.campo);
        const elemento = document.getElementById(invalido.elementId);
        elemento?.scrollIntoView({ behavior: "smooth", block: "center" });
        elemento?.focus?.();
      }
      return;
    }
    setErroConfirmacao(null);
    setCampoInvalido(null);
    setSalvando(true);
    try {
      if (ehAjuste && saldoProduto) {
        const resultado = await registrarAjusteEstoque({ produtoId: saldoProduto.produtoId, quantidadeContada: contadaMilesimos / 1000, saldoEsperado: Math.round(saldoProduto.saldo * 1000) / 1000, observacao: descricao.trim(), centroCustoId: centroCustoId ? Number(centroCustoId) : undefined });
        onSalvo({ id: resultado.operacaoId });
        return;
      }
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
    } catch (falha) {
      if (ehAjuste && falha instanceof ApiError && falha.code === "CONFLITO") {
        // Saldo mudou: recarrega para o usuário reconferir a nova diferença antes de reconfirmar.
        setErroConfirmacao(MSG_CONFLITO_SALDO);
        void carregarSaldos();
        return;
      }
      const mensagem = falha instanceof Error ? falha.message : String(falha);
      setErroConfirmacao(mensagem);
      setErro(mensagem);
      if (falha instanceof ApiError && falha.campo) {
        // Erros de centro de custo por item (`itens.<i>.centroCustoId`) recebem o
        // mesmo tratamento da validação local: no modo Único esse select nem
        // existe na tela, então o campo e o foco vão para o centro da operação.
        const ehErroDeCentro = /^itens\.\d+\.centroCustoId$/.test(falha.campo);
        const mapeado = ehErroDeCentro ? mapearCampoCentro(falha.campo) : { campo: falha.campo, elementId: `campo-${falha.campo}` };
        setCampoInvalido(mapeado.campo);
        if (ehErroDeCentro) {
          const elemento = document.getElementById(mapeado.elementId);
          elemento?.scrollIntoView({ behavior: "smooth", block: "center" });
          elemento?.focus?.();
        }
      }
    } finally { setSalvando(false); }
  };

  useEffect(() => { if (erroConfirmacao) erroConfirmacaoRef.current?.focus(); }, [erroConfirmacao]);

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

  const campoDescricao = <label className="text-sm font-medium md:col-span-2 xl:col-span-3">{ehAjuste ? "Justificativa do ajuste *" : "Descrição *"}<textarea id="campo-descricao" aria-label={ehAjuste ? "Justificativa do ajuste" : "Descrição"} aria-invalid={campoInvalido === "descricao" || undefined} aria-describedby={campoInvalido === "descricao" ? "erro-descricao" : undefined} required maxLength={ehAjuste ? 200 : 240} className={`${CAMPO} min-h-20${classeCampoErro("descricao")}`} placeholder={ehAjuste ? "Ex.: contagem física do inventário de setembro" : tipo === "SERVICO" ? "Ex.: manutenção preventiva do trator" : "Descreva o objetivo da operação"} value={descricao} onChange={(e) => { setDescricao(e.target.value); limparCampoInvalido("descricao"); }} />{campoInvalido === "descricao" && <CampoErro id="erro-descricao">{ehAjuste ? "Informe a justificativa do ajuste (pelo menos 5 caracteres)." : "Descreva a operação (pelo menos 2 caracteres)."}</CampoErro>}</label>;
  const secaoAjuste = <section>
    <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Contagem de estoque</h3>
    {ajusteConsolidado ? <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950">Selecione uma fazenda no seletor do topo para ajustar o estoque — o ajuste é feito em uma fazenda por vez.</p> : <>
    <p className="mb-4 max-w-2xl text-xs leading-5 text-ink-3">Informe a quantidade realmente contada. O sistema calcula a diferença contra o saldo atual e registra o ajuste, sem efeito financeiro, na data de hoje.</p>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <label className="text-sm font-medium">Produto *<select id="campo-ajusteProduto" aria-label="Produto" aria-invalid={campoInvalido === "ajusteProduto" || undefined} aria-describedby={campoInvalido === "ajusteProduto" ? "erro-ajusteProduto" : undefined} required disabled={saldosCarregando && saldos === null} className={SELECT + classeCampoErro("ajusteProduto")} value={ajusteProdutoId} onChange={(e) => { setAjusteProdutoId(e.target.value); limparCampoInvalido("ajusteProduto"); }}><option value="">{saldosCarregando && saldos === null ? "Carregando saldos…" : "Selecione"}</option>{saldos?.map((saldo) => <option key={saldo.produtoId} value={saldo.produtoId}>{saldo.nome}{saldo.ativo === false ? " (inativo)" : ""}</option>)}</select>{campoInvalido === "ajusteProduto" && <CampoErro id="erro-ajusteProduto">Selecione o produto que será contado.</CampoErro>}</label>
      <div className="text-sm font-medium">Saldo atual<div className="mt-1.5 flex items-center gap-3"><output aria-label="Saldo atual" className="inline-flex min-h-[42px] flex-1 items-center rounded-lg border border-[#e5dfd0] bg-[#f0ede4] px-3 py-2.5 font-normal text-ink">{saldoProduto ? `${fmtQuantidade(saldoProduto.saldo)} ${unidadeAjuste}` : "—"}</output><button type="button" disabled={saldosCarregando} onClick={() => { void carregarSaldos(); }} className="whitespace-nowrap text-xs font-semibold text-[#4d5a47] underline underline-offset-2 disabled:opacity-50">{saldosCarregando ? "Atualizando…" : "Atualizar saldo"}</button></div></div>
      <label className="text-sm font-medium">Quantidade contada *<div className="mt-1.5 flex"><input id="campo-quantidadeContada" aria-label="Quantidade contada" aria-invalid={campoInvalido === "quantidadeContada" || undefined} aria-describedby={campoInvalido === "quantidadeContada" ? "erro-quantidadeContada" : undefined} required min="0" max={MAX_QTD_AJUSTE} step="0.001" type="number" className={`min-w-0 flex-1 rounded-l-lg border border-[#d8cfbb] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#6f7d68] focus:ring-2 focus:ring-[#6f7d68]/15${classeCampoErro("quantidadeContada")}`} value={quantidadeContada} onChange={(e) => { setQuantidadeContada(e.target.value); limparCampoInvalido("quantidadeContada"); }} /><span aria-hidden className="inline-flex min-w-14 items-center justify-center rounded-r-lg border border-l-0 border-[#d8cfbb] bg-[#f0ede4] px-3 text-sm text-ink-3">{unidadeAjuste || "un"}</span></div>{campoInvalido === "quantidadeContada" && <CampoErro id="erro-quantidadeContada">{quantidadeContada.trim() === "" ? "Informe a quantidade contada." : "Informe um número entre 0 e 999.999.999,999, com até 3 casas decimais."}</CampoErro>}</label>
    </div>
    <div role="status" aria-label="Diferença do ajuste" className={`mt-4 rounded-lg border px-4 py-3 text-sm ${ajusteSemDiferenca ? "border-amber-200 bg-amber-50 text-amber-950" : "border-[#e5dfd0] bg-[#faf9f4]"}`}>{diferencaMilesimos === null ? <span className="text-ink-3">Selecione o produto e informe a quantidade contada para ver a diferença.</span> : ajusteSemDiferenca ? <strong>Nenhum ajuste necessário: a quantidade contada é igual ao saldo atual.</strong> : <>Diferença: <strong>{fmtDiferenca(diferencaMilesimos / 1000)} {unidadeAjuste}</strong> <span className="text-ink-3">({diferencaMilesimos > 0 ? "entrada" : "saída"} de ajuste)</span></>}</div>
    {saldosErro && <CampoErro className="mt-3">{saldosErro}</CampoErro>}
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{campoDescricao}</div>
    </>}
  </section>;
  return <div className="shell-wide pb-10">
    <div className="mb-5 flex min-h-[82px] flex-wrap items-center justify-between gap-4 border-b border-border pb-5 pt-3"><div><div className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Registro orientado</div><h1 className="mt-1 font-serif text-3xl text-ink md:text-4xl">{operacaoBase ? "Criar operação de correção" : "Nova operação"}</h1></div>{!operacaoBase && !ehAjuste && !atalhoAjuste && temConteudoRascunho && <div className="flex items-center gap-3"><span aria-live="polite" className={`text-xs font-medium ${estadoSalvamento === "ERRO" ? "text-red-700" : "text-ink-3"}`}>{estadoSalvamento === "SALVANDO" ? "Salvando…" : estadoSalvamento === "SALVO" ? "Rascunho salvo" : estadoSalvamento === "ERRO" ? "Falha ao salvar" : "Alterações não salvas"}</span><Button type="button" secondary disabled={salvando} onClick={() => setConfirmarLimpeza(true)}>Limpar rascunho</Button></div>}</div>
    {/* noValidate: a validação é 100% nossa (encontrarPrimeiroCampoInvalido) —
     * sem isso, a validação nativa do navegador bloqueia o evento de submit
     * antes do nosso onSubmit rodar sempre que um campo `required` estiver
     * vazio (ou, pior, quando um <select required> perde a opção selecionada
     * — o valor no DOM cai para "" e o navegador trata como vazio), o que
     * impediria exatamente o comportamento de rolar+focar que construímos. */}
    <form onSubmit={submit} noValidate className="grid min-h-[calc(100vh-180px)] overflow-hidden rounded-xl border border-border bg-white xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-7 p-5 md:p-7 xl:min-h-0 xl:overflow-y-auto">
        <ErrorBox erro={erro} />
        {operacaoBase && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950"><strong>Nova operação baseada na OP-{String(operacaoBase.id).padStart(4, "0")}</strong><p className="mt-1 text-xs">Revise todos os dados e efeitos antes de confirmar. A operação cancelada permanecerá preservada no histórico.</p></div>}
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Identificação</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-medium">Tipo de operação<select aria-label="Tipo de operação" disabled={atalhoAjuste} className={SELECT} value={tipo} onChange={(e) => alterarTipo(e.target.value)}>{Object.entries(TIPO_OPERACAO).filter(([chave]) => !["TRANSFERENCIA_FINANCEIRA", "TRANSFERENCIA_ESTOQUE", "APORTE", "RETIRADA"].includes(chave)).map(([chave, nome]) => <option key={chave} value={chave}>{nome}</option>)}</select>{atalhoAjuste && <span className="mt-1 block text-xs font-normal text-ink-3">Ajuste de estoque — para outro tipo de operação, abra Nova operação.</span>}</label>
            {!ehAjuste && <label className="text-sm font-medium">Data<input id="campo-data" aria-label="Data" aria-invalid={campoInvalido === "data" || undefined} required type="date" max={movimentaEstoque ? hoje() : undefined} className={CAMPO + classeCampoErro("data")} value={data} onChange={(e) => { setData(e.target.value); limparCampoInvalido("data"); }} />{movimentaEstoque && data > hoje() && <CampoErro id="erro-data">Operações que movimentam estoque não podem ter data futura.</CampoErro>}</label>}
            {exigeParceiro && <label className="text-sm font-medium">{parceiroLabel(tipo)} *<select id="campo-parceiroId" aria-label={parceiroLabel(tipo)} aria-invalid={campoInvalido === "parceiroId" || undefined} aria-describedby={campoInvalido === "parceiroId" ? "erro-parceiroId" : undefined} required className={SELECT + classeCampoErro("parceiroId")} value={parceiroId} onChange={(e) => { setParceiroId(e.target.value); limparCampoInvalido("parceiroId"); }}><option value="">Selecione</option>{parceiros.map((parceiro) => <option key={parceiro.id} value={parceiro.id}>{parceiro.nome}</option>)}</select>{campoInvalido === "parceiroId" && <CampoErro id="erro-parceiroId">Selecione um parceiro válido.</CampoErro>}</label>}
            {!ehAjuste && campoDescricao}
          </div>
        </section>
        {ehAjuste ? secaoAjuste : comItens ? <ItensOperacao itens={itens} setItens={setItens} config={config} ultimosPrecos={ultimosPrecos} custosMedios={custosMedios} movimentaEstoque={movimentaEstoque} atualizarItem={atualizarItem} alterarProduto={alterarProduto} itemInvalidoId={itemInvalidoId} porItem={porItem} centroCustoOperacao={centroCustoId} campoInvalido={campoInvalido} limparCampoInvalido={limparCampoInvalido} /> :<section><h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Valor do serviço</h3><label className="block max-w-xs text-sm font-medium">Valor total *<input id="campo-valorOperacao" aria-label="Valor total da operação" aria-invalid={campoInvalido === "valorOperacao" || undefined} aria-describedby={campoInvalido === "valorOperacao" ? "erro-valorOperacao" : undefined} required min="0.01" step="0.01" type="number" className={CAMPO + classeCampoErro("valorOperacao")} value={valorOperacao} onChange={(e) => { setValorOperacao(e.target.value); limparCampoInvalido("valorOperacao"); }} onBlur={(e) => setValorOperacao(normalizarMoeda(e.target.value))} />{campoInvalido === "valorOperacao" && <CampoErro id="erro-valorOperacao">Informe um valor total maior que zero.</CampoErro>}</label></section>}
        <section><h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Classificação</h3>
          {comItens && <div role="radiogroup" aria-label="Modo do centro de custo" className="mb-4 flex flex-wrap items-center gap-5 text-sm font-medium">
            <span className="text-ink-3">Centro de custo:</span>
            <label className="flex items-center gap-1.5"><input type="radio" name="modo-centro-custo" checked={!porItem} onChange={() => alterarModoCentro(false)} /> Único para a operação</label>
            <label className="flex items-center gap-1.5"><input type="radio" name="modo-centro-custo" checked={porItem} onChange={() => alterarModoCentro(true)} /> Por item</label>
          </div>}
          <div className="grid gap-4 md:grid-cols-2">{!comItens && !ehAjuste && <label className="text-sm font-medium">Categoria<select aria-label="Categoria" aria-invalid={campoInvalido === "categoriaId" || undefined} aria-describedby={campoInvalido === "categoriaId" ? "erro-categoriaId" : undefined} className={SELECT + classeCampoErro("categoriaId")} value={categoriaId} onChange={(e) => { setCategoriaId(e.target.value); setClassificacao(categorias.find((c) => c.id === Number(e.target.value))?.classificacao ?? ""); limparCampoInvalido("categoriaId"); }}><option value="">Sem categoria</option>{categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}</select>{campoInvalido === "categoriaId" && <CampoErro id="erro-categoriaId">Selecione uma categoria ativa.</CampoErro>}</label>}{!comItens && !ehAjuste && <label className="text-sm font-medium">Classificação<select aria-label="Classificação" className={SELECT} value={classificacao} onChange={(e) => setClassificacao(e.target.value)}><option value="">Não classificada</option><option value="CUSTEIO">Custeio</option><option value="INVESTIMENTO">Investimento</option></select></label>}<label className="text-sm font-medium">{comItens && porItem ? "Centro padrão (itens sem centro)" : "Centro de custo"}<select id="campo-centroCustoId" aria-label="Centro de custo" aria-invalid={campoInvalido === "centroCustoId" || undefined} aria-describedby={campoInvalido === "centroCustoId" ? "erro-centroCustoId" : undefined} className={SELECT + classeCampoErro("centroCustoId")} value={centroCustoId} onChange={(e) => { setCentroEscolhidoManualmente(true); setCentroCustoId(e.target.value); limparCampoInvalido("centroCustoId"); }}><option value="">Sem centro de custo</option>{config.centrosCusto.filter((centro) => centro.ativo).map((centro) => <option key={centro.id} value={centro.id}>{centro.nome}</option>)}</select>{campoInvalido === "centroCustoId" && <CampoErro id="erro-centroCustoId">Selecione um centro de custo ativo.</CampoErro>}</label></div>
        </section>
        {comItens && !porItem && produtosDivergentes && <p className="flex flex-wrap items-center gap-3 text-sm text-amber-800">Os produtos pertencem a centros de custo diferentes.<Button type="button" secondary onClick={() => alterarModoCentro(true)}>Separar por item</Button></p>}
        {parceiroInvalido && <p role="alert" className="text-sm text-red-700">O parceiro deste rascunho está inativo ou não tem um papel compatível. Selecione outro parceiro antes de confirmar.</p>}
        {permiteFinanceiro && parceiroSelecionado && (parceiroSelecionado.formaPagamentoPreferida || parceiroSelecionado.condicaoPagamentoPreferida) && <div className="rounded-lg border border-border p-4 text-sm">
          <p>Preferência de {parceiroSelecionado.nome}: {[parceiroSelecionado.formaPagamentoPreferida && FORMAS_PAGAMENTO[parceiroSelecionado.formaPagamentoPreferida], parceiroSelecionado.condicaoPagamentoPreferida === "A_VISTA" ? "à vista" : parceiroSelecionado.condicaoPagamentoPreferida === "A_PRAZO" ? `a prazo (${parceiroSelecionado.prazosPagamento?.join(" / ")} dias)` : null].filter(Boolean).join(" · ")}.</p>
          <p className="my-2 text-xs text-ink-3">É apenas uma sugestão. Você pode escolher outras condições livremente.{parceiroSelecionado.condicaoPagamentoPreferida === "A_PRAZO" && !sugestaoParcelas.length && " Informe o valor e a data para calcular as parcelas."}</p>
          <Button type="button" secondary disabled={salvando || (parceiroSelecionado.condicaoPagamentoPreferida === "A_PRAZO" && !sugestaoParcelas.length)} onClick={() => setConfirmarSugestao(true)}>Usar sugestão</Button>
        </div>}
        <EfeitoFinanceiro permite={permiteFinanceiro} condicao={condicao} alterarCondicao={alterarCondicao} contaId={contaId} setContaId={setContaId} formaPagamento={formaPagamento} setFormaPagamento={setFormaPagamento} config={config} valorAgora={valorAgora} setValorAgora={setValorAgora} total={totalFinanceiro} parcelas={parcelas} setParcelas={setParcelas} somaParcelasConfere={somaParcelasConfere} saldoFuturo={saldoFuturoFinanceiro} entradaSimulacao={entradaSimulacao} assinaturaSimulacao={assinaturaSimulacao} onSimulacao={(resultado) => setSimulacao({ assinatura: assinaturaSimulacao, resultado })} geradorParcelas={geradorParcelas} setGeradorParcelas={setGeradorParcelas} campoInvalido={campoInvalido} limparCampoInvalido={limparCampoInvalido} />
        {!ehAjuste && !atalhoAjuste && <Documentos anexos={anexos} setAnexos={setAnexos} anexosEnviando={anexosEnviando} documentosSalvos={documentosSalvos}atualizarDocumentoSalvo={atualizarDocumentoSalvo} removerDocumentoSalvo={removerDocumentoSalvo} selecionarAnexos={selecionarAnexos} />}
      </div>
      <aside className="flex h-full flex-col border-t border-border bg-[#1f2b21] p-6 text-white xl:border-l xl:border-t-0"><div><div className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">Revisão dos efeitos</div><div className="mt-3 font-serif text-3xl">{ehAjuste ? (diferencaMilesimos === null ? "—" : `${fmtDiferenca(diferencaMilesimos / 1000)} ${unidadeAjuste}`) : brl(total)}</div>{ehAjuste && <div className="mt-1 text-xs text-[#aeb9aa]">Diferença de estoque</div>}{comItens && <div className="mt-5 border-y border-white/10 py-4"><div className="mb-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">Itens da operação</div><div className="space-y-2">{itens.map((item) => { const produto = config.produtos.find((produtoAtual) => produtoAtual.id === Number(item.produtoId)); return <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-xs leading-4"><div className="min-w-0"><div className="truncate font-medium text-white">{produto?.nome || item.descricao || "Produto não selecionado"}</div><div className="text-[#aeb9aa]">{Number(item.quantidade || 0).toLocaleString("pt-BR")} {produto ? rotuloUnidade(produto.unidade) : (item.unidade || "un")}</div></div><strong className="self-center whitespace-nowrap text-white">{brl(totalItem(item))}</strong></div>; })}</div></div>}<div className={ehAjuste ? "hidden" : "mt-4 flex flex-wrap gap-6 text-xs"}><div className="space-y-2"><p className="font-semibold text-[#aeb9aa]">Valores por categoria</p>{resumoCategorias.map(([nome, centavos]) => <div key={nome} className="flex justify-between gap-3"><span>{nome}</span><strong>{brl(centavos / 100)}</strong></div>)}</div>{porItem && resumoCentros.length > 0 && <div className="space-y-2"><p className="font-semibold text-[#aeb9aa]">Valores por centro de custo</p>{resumoCentros.map(([nome, centavos]) => <div key={nome} className="flex justify-between gap-3"><span>{nome}</span><strong>{brl(centavos / 100)}</strong></div>)}</div>}</div><div className="mt-5 space-y-3 text-sm leading-5"><ReviewLine>Registrar {TIPO_OPERACAO[tipo]?.toLowerCase()}.</ReviewLine>{ehAjuste && <ReviewLine tone="brown">{saldoProduto && diferencaMilesimos !== null && !ajusteSemDiferenca ? <>Gerar 1 movimento físico de ajuste em {saldoProduto.nome}: saldo de {fmtQuantidade(saldoProduto.saldo)} para {fmtQuantidade(contadaMilesimos / 1000)} {unidadeAjuste}.</> : "Nenhum movimento físico de estoque será gerado."}</ReviewLine>}{movimentaEstoque && <ReviewLine tone="brown">{tipo === "VENDA" || tipo === "DEVOLUCAO" ? "Movimenta o estoque dos produtos que já tiveram entrada nesta fazenda." : movimentosEstoque > 0 ? <>Gerar {movimentosEstoque} movimento{movimentosEstoque === 1 ? "" : "s"} físico{movimentosEstoque === 1 ? "" : "s"} de estoque.</> : "Nenhum movimento físico de estoque será gerado."}</ReviewLine>}{condicao === "A_VISTA" && <ReviewLine>Registrar {entradaFinanceira ? "recebimento" : "pagamento"} integral de {brl(total)}.</ReviewLine>}{condicao === "A_PRAZO" && <ReviewLine tone="amber">Criar {parcelas.length} compromisso{parcelas.length === 1 ? "" : "s"} {entradaFinanceira ? "a receber" : "a pagar"}, totalizando {brl(totalParcelas)}. O saldo não muda agora.</ReviewLine>}{condicao === "PARCIAL" && <><ReviewLine>Registrar {entradaFinanceira ? "recebimento" : "pagamento"} de {brl(realizadoAgora)} agora.</ReviewLine><ReviewLine tone="amber">Criar {parcelas.length} compromisso{parcelas.length === 1 ? "" : "s"} para o saldo de {brl(totalParcelas)}.</ReviewLine></>}{condicao === "SEM_EFEITO_FINANCEIRO" && <ReviewLine tone="neutral">Nenhuma conta financeira ou compromisso será movimentado.</ReviewLine>}{!ehAjuste && (anexos.length + documentosSalvos.length) > 0 && <ReviewLine tone="neutral">Anexar {anexos.length + documentosSalvos.length} documento{anexos.length + documentosSalvos.length === 1 ? "" : "s"} à operação.</ReviewLine>}</div></div><div className="mt-auto border-t border-white/10 pt-5">{erroConfirmacao && <div id="erro-confirmacao" ref={erroConfirmacaoRef} role="alert" tabIndex={-1} className="mb-3 rounded-lg border border-red-300/50 bg-red-950/50 p-3 text-sm text-red-100">{erroConfirmacao}</div>}<p className="mb-3 text-center text-[11px] leading-4 text-[#aeb9aa]">A confirmação cria somente os efeitos descritos acima.</p><Button type="submit" disabled={salvando || anexosEnviando.length > 0 || (ehAjuste && (ajusteSemDiferenca || ajusteConsolidado))} ariaDescribedby={[erroConfirmacao ? "erro-confirmacao" : null, !podeConfirmar ? "motivo-pendencia" : null].filter(Boolean).join(" ") || undefined} className="w-full !bg-[#e9e3d2] !text-[#1f2b21]">{salvando ? "Confirmando…" : anexosEnviando.length ? "Anexando documento…" : ehAjuste ? "Confirmar ajuste" : "Confirmar operação"}</Button>{!podeConfirmar && <p id="motivo-pendencia" role="status" className="mt-3 flex items-start justify-center gap-1.5 text-center text-xs leading-5 text-[#e3c66f]"><CircleAlert size={14} className="mt-px shrink-0" aria-hidden /><span>{ehAjuste && ajusteSemDiferenca ? "Nenhum ajuste necessário: a quantidade contada é igual ao saldo atual." : "Ainda há campos pendentes ou incompletos nesta operação. Revise os itens destacados para confirmar."}</span></p>}</div></aside>
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

function ItensOperacao({ itens, setItens, config, ultimosPrecos, custosMedios, movimentaEstoque, atualizarItem, alterarProduto, itemInvalidoId, porItem, centroCustoOperacao, campoInvalido, limparCampoInvalido }: { itens: ItemForm[]; setItens: React.Dispatch<React.SetStateAction<ItemForm[]>>; config: ConfiguracoesFinanceiras; ultimosPrecos: Record<number, UltimoPrecoDTO & { produtoId: string }>; custosMedios: Record<number, number | null>; movimentaEstoque: boolean; atualizarItem: (id: number, patch: Partial<ItemForm>) => void; alterarProduto: (id: number, produtoId: string) => void; itemInvalidoId: number | null; porItem: boolean; centroCustoOperacao: string; campoInvalido: string | null; limparCampoInvalido: (campo: string) => void }) {
  return <section>
    <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Itens da operação</h3><p className="mt-1 text-xs text-ink-3">Informe o valor unitário ou alterne para o valor total de cada item.</p></div><Button type="button" secondary onClick={() => setItens((atuais) => [...atuais, novoItem()])}><Plus size={15} /> Adicionar item</Button></div>
    <div className="space-y-3">{itens.map((item, indice) => {
      const produto = config.produtos.find((produtoAtual) => produtoAtual.id === Number(item.produtoId));
      const unidade = produto ? rotuloUnidade(produto.unidade) : item.unidade;
      const invalido = item.id === itemInvalidoId;
      const ultimo = ultimosPrecos[item.id]?.produtoId === item.produtoId ? ultimosPrecos[item.id] : null;
      const custoMedio = !ultimo && item.produtoId ? custosMedios[item.id] : undefined;
      const campoCentro = `itens.${indice}.centroCustoId`;
      const centroInvalido = campoInvalido === campoCentro;
      return <div key={item.id} id={`item-${item.id}`} tabIndex={-1} className={`rounded-xl border p-4 outline-none ${invalido ? "border-red-400 bg-red-50/40 ring-2 ring-red-200" : "border-border bg-[#faf9f4]"}`}>
        <div className="mb-3 flex items-center justify-between"><strong className="text-sm">Item {indice + 1}</strong>{itens.length > 1 && <button type="button" aria-label={`Remover item ${indice + 1}`} onClick={() => setItens((atuais) => atuais.filter((atual) => atual.id !== item.id))} className="rounded-lg p-1.5 text-red-700 hover:bg-red-50"><Trash2 size={16} /></button>}</div>
        {invalido && <CampoErro className="mb-3">Preencha a descrição, a quantidade{movimentaEstoque ? " e o produto" : ""} deste item.</CampoErro>}
        <div className="grid gap-4 md:grid-cols-[minmax(200px,0.8fr)_minmax(0,2fr)]">
          <label className="text-sm font-medium">Produto{movimentaEstoque && " *"}<select aria-label={`Produto do item ${indice + 1}`} required={movimentaEstoque} className={SELECT} value={item.produtoId} onChange={(e) => alterarProduto(item.id, e.target.value)}><option value="">{movimentaEstoque ? "Selecione" : "Sem produto cadastrado"}</option>{config.produtos.map((produtoAtual) => <option key={produtoAtual.id} value={produtoAtual.id}>{produtoAtual.nome}</option>)}</select></label>
          <label className="text-sm font-medium">Descrição do item *<input aria-label={`Descrição do item ${indice + 1}`} required className={CAMPO} value={item.descricao} onChange={(e) => atualizarItem(item.id, { descricao: e.target.value })} /></label>
        </div>
        <div className={`mt-4 grid gap-4 ${porItem ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <label className="text-sm font-medium">Categoria<select aria-label={`Categoria do item ${indice + 1}`} className={SELECT} value={item.categoriaId ?? ""} onChange={(e) => { const categoria = config.categorias.find((c) => c.id === Number(e.target.value)); atualizarItem(item.id, { categoriaId: e.target.value, classificacao: categoria?.classificacao ?? "" }); }}><option value="">Sem categoria</option>{config.categorias.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label className="text-sm font-medium">Classificação<select aria-label={`Classificação do item ${indice + 1}`} className={SELECT} value={item.classificacao ?? ""} onChange={(e) => atualizarItem(item.id, { classificacao: e.target.value })}><option value="">Não classificada</option><option value="CUSTEIO">Custeio</option><option value="INVESTIMENTO">Investimento</option></select></label>
          {porItem && <label className="text-sm font-medium">Centro de custo<select id={`campo-itens-${indice}-centroCustoId`} aria-label={`Centro de custo do item ${indice + 1}`} aria-invalid={centroInvalido || undefined} aria-describedby={centroInvalido ? `erro-${campoCentro}` : undefined} className={SELECT + (centroInvalido ? " border-red-400 ring-2 ring-red-200" : "")} value={item.centroCustoId} onChange={(e) => { atualizarItem(item.id, { centroCustoId: e.target.value }); limparCampoInvalido(campoCentro); }}><option value="">Padrão da operação{centroCustoOperacao ? ` (${config.centrosCusto.find((c) => String(c.id) === centroCustoOperacao)?.nome ?? ""})` : ""}</option>{config.centrosCusto.filter((centro) => centro.ativo).map((centro) => <option key={centro.id} value={centro.id}>{centro.nome}</option>)}</select>{centroInvalido && <CampoErro id={`erro-${campoCentro}`}>Informe o centro de custo deste item ou um centro padrão para a operação.</CampoErro>}</label>}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.1fr]">
          <label className="text-sm font-medium">Quantidade *<div className="mt-1.5 flex"><input aria-label={`Quantidade do item ${indice + 1}`} required min="0.001" step="0.001" type="number" className="min-w-0 flex-1 rounded-l-lg border border-[#d8cfbb] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#6f7d68] focus:ring-2 focus:ring-[#6f7d68]/15" value={item.quantidade} onChange={(e) => atualizarItem(item.id, { quantidade: e.target.value })} /><span aria-label={`Unidade do item ${indice + 1}`} className="inline-flex min-w-14 items-center justify-center rounded-r-lg border border-l-0 border-[#d8cfbb] bg-[#f0ede4] px-3 text-sm text-ink-3">{unidade || "un"}</span></div></label>
          <label className="text-sm font-medium">Base do valor<select aria-label={`Base do valor do item ${indice + 1}`} className={SELECT} value={item.modoValor} onChange={(e) => atualizarItem(item.id, { modoValor: e.target.value as ModoValor })}><option value="UNITARIO">Valor unitário</option><option value="TOTAL">Valor total do item</option></select></label>
          {item.modoValor === "UNITARIO" ? <label className="text-sm font-medium">Valor unitário *<input aria-label={`Valor unitário do item ${indice + 1}`} required min="0" step="0.0001" type="number" className={CAMPO} value={item.valorUnitario} onChange={(e) => atualizarItem(item.id, { valorUnitario: e.target.value })} onBlur={(e) => atualizarItem(item.id, { valorUnitario: normalizarPreco(e.target.value) })} />{ultimo && <span className="mt-1 block text-xs font-normal text-ink-3">Última compra: {brlPreciso(ultimo.valorUnitario)} em {dataCurta(ultimo.data)}{ultimo.parceiro ? ` (${ultimo.parceiro.nome})` : ""}</span>}{!ultimo && custoMedio != null && <span className="mt-1 block text-xs font-normal text-ink-3">Custo médio atual: {brlPreciso(custoMedio)}</span>}</label> : <label className="text-sm font-medium">Valor total do item *<input aria-label={`Valor total do item ${indice + 1}`} required min="0" step="0.01" type="number" className={CAMPO} value={item.valorTotal} onChange={(e) => atualizarItem(item.id, { valorTotal: e.target.value })} onBlur={(e) => atualizarItem(item.id, { valorTotal: normalizarMoeda(e.target.value) })} /></label>}
          <div className="self-end rounded-lg border border-[#e5dfd0] bg-white px-3 py-2.5 text-sm"><span className="text-ink-3">Total do item</span><strong className="float-right">{brl(totalItem(item))}</strong></div>
        </div>
      </div>;
    })}</div>
  </section>;
}

type GeradorParcelas = NonNullable<EstadoFormulario["geradorParcelas"]>;
type PropsEfeitoFinanceiro = {
  permite: boolean; condicao: Condicao; alterarCondicao: (condicao: Condicao) => void;
  contaId: string; setContaId: (id: string) => void; formaPagamento: string; setFormaPagamento: (forma: string) => void;
  config: ConfiguracoesFinanceiras; valorAgora: string; setValorAgora: (valor: string) => void;
  total: number; parcelas: ParcelaForm[]; setParcelas: React.Dispatch<React.SetStateAction<ParcelaForm[]>>;
  somaParcelasConfere: boolean; saldoFuturo: number;
  entradaSimulacao: { itens: ({ quantidade: string; valorTotal: string } | { quantidade: string; valorUnitario: string })[]; valorTotal?: string; valorPagoAgora?: string };
  assinaturaSimulacao: string; onSimulacao: (resultado: SimulacaoParcelas) => void;
  geradorParcelas: GeradorParcelas; setGeradorParcelas: React.Dispatch<React.SetStateAction<GeradorParcelas>>;
  campoInvalido: string | null; limparCampoInvalido: (campo: string) => void;
};

function EfeitoFinanceiro({ permite, condicao, alterarCondicao, contaId, setContaId, formaPagamento, setFormaPagamento, config, valorAgora, setValorAgora, total, parcelas, setParcelas, somaParcelasConfere, saldoFuturo, entradaSimulacao, onSimulacao, geradorParcelas, setGeradorParcelas, campoInvalido, limparCampoInvalido }: PropsEfeitoFinanceiro) {
  const [gerando, setGerando] = useState(false);
  const [erroGeracao, setErroGeracao] = useState<string | null>(null);
  const [campoInvalidoGeracao, setCampoInvalidoGeracao] = useState<string | null>(null);
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [confirmarSubstituicao, setConfirmarSubstituicao] = useState(false);
  const totalAnotado = somarParcelas(parcelas);
  const esperado = Math.round((condicao === "PARCIAL" ? saldoFuturo : total) * 100);
  const diferenca = esperado - totalAnotado;
  const gerar = async () => {
    setGerando(true);
    setErroGeracao(null);
    setCampoInvalidoGeracao(null);
    try {
      const resultado = await simularParcelasOperacao({
        ...entradaSimulacao,
        quantidadeParcelas: Number(geradorParcelas.quantidade),
        frequencia: geradorParcelas.frequencia,
        primeiroVencimento: geradorParcelas.primeiroVencimento,
      });
      onSimulacao(resultado);
      setParcelas(resultado.parcelas.map((parcela) => ({ id: proximoId++, valor: parcela.valor, vencimento: parcela.dataVencimento })));
      setConfirmarSubstituicao(false);
      setPopoverAberto(false);
      limparCampoInvalido("parcelas");
    } catch (falha) {
      setErroGeracao(falha instanceof Error ? falha.message : "Não foi possível gerar as parcelas.");
      if (falha instanceof ApiError && falha.campo) setCampoInvalidoGeracao(falha.campo);
    } finally {
      setGerando(false);
    }
  };
  // Gerar sempre substitui a lista inteira — se já houver alguma parcela
  // preenchida à mão, confirma antes de descartar. Só o valor conta aqui: o
  // vencimento vem preenchido por padrão em toda parcela nova (novaParcela),
  // então usá-lo pediria confirmação mesmo num formulário ainda em branco.
  const solicitarGeracao = () => {
    if (parcelas.some((parcela) => parcela.valor)) {
      setConfirmarSubstituicao(true);
      return;
    }
    void gerar();
  };
  const aPrazo = condicao === "A_PRAZO" || condicao === "PARCIAL";

  return <section>
    <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Efeito financeiro</h3>
    {!permite ? <div className="rounded-lg bg-[#eef1e9] p-4 text-sm text-green-900"><strong>Sem movimentação financeira</strong><p className="mt-1 text-xs leading-5">Este tipo registra somente o efeito físico ou de valorização. Nenhuma conta ou compromisso será criado.</p></div> : <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium">Condição<select aria-label="Condição financeira" className={SELECT} value={condicao} onChange={(e) => alterarCondicao(e.target.value as Condicao)}><option value="A_VISTA">Liquidação integral na operação</option><option value="A_PRAZO">Liquidação integral a prazo</option><option value="PARCIAL">Liquidação parcial com saldo a prazo</option><option value="SEM_EFEITO_FINANCEIRO">Sem movimentação financeira</option></select></label>
        {(condicao === "A_VISTA" || condicao === "PARCIAL") && <><label className="text-sm font-medium">Conta financeira *<select id="campo-contaId" aria-label="Conta financeira" aria-invalid={campoInvalido === "contaId" || undefined} aria-describedby={campoInvalido === "contaId" ? "erro-contaId" : undefined} required className={SELECT + (campoInvalido === "contaId" ? " border-red-400 ring-2 ring-red-200" : "")} value={contaId} onChange={(e) => { setContaId(e.target.value); limparCampoInvalido("contaId"); }}><option value="">Selecione</option>{config.contas.filter((conta) => conta.ativo).map((conta) => <option key={conta.id} value={conta.id}>{conta.nome}</option>)}</select>{campoInvalido === "contaId" && <CampoErro id="erro-contaId">Selecione a conta financeira.</CampoErro>}</label><label className="text-sm font-medium">Forma de liquidação<select aria-label="Forma de liquidação" className={SELECT} value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>{Object.entries(FORMAS_PAGAMENTO).map(([chave, nome]) => <option key={chave} value={chave}>{nome}</option>)}</select></label></>}
      </div>
      {condicao === "PARCIAL" && <label className="block max-w-xs text-sm font-medium">Valor liquidado na operação *<input id="campo-valorAgora" aria-label="Valor liquidado na operação" aria-invalid={campoInvalido === "valorAgora" || undefined} aria-describedby={campoInvalido === "valorAgora" ? "erro-valorAgora" : undefined} required min="0.01" max={Math.max(total - 0.01, 0)} step="0.01" type="number" className={CAMPO + (campoInvalido === "valorAgora" ? " border-red-400 ring-2 ring-red-200" : "")} value={valorAgora} onChange={(e) => { setValorAgora(e.target.value); limparCampoInvalido("valorAgora"); }} />{campoInvalido === "valorAgora" && <CampoErro id="erro-valorAgora">Informe o valor liquidado agora.</CampoErro>}</label>}
      {aPrazo && <div id="secao-parcelas" tabIndex={-1} className={`rounded-xl border border-amber-200 bg-amber-50/50 p-4 outline-none${campoInvalido === "parcelas" ? " ring-2 ring-red-300" : ""}`}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div><strong className="text-sm">Parcelas do compromisso</strong><p className="mt-1 text-xs text-ink-3">Cada parcela será criada como um compromisso vinculado a esta operação. Adicione uma a uma ou gere uma grade automática.</p></div>
          <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
            <PopoverTrigger asChild><Button type="button" secondary><Wand2 size={15} /> Gerar parcelas</Button></PopoverTrigger>
            <PopoverContent align="end" sideOffset={6} className="w-[min(300px,calc(100vw-24px))] rounded-xl border border-border bg-white p-4 shadow-xl">
              <div className="space-y-3">
                <label className="block text-sm font-medium">Quantidade<input aria-label="Quantidade de parcelas" aria-invalid={campoInvalidoGeracao === "quantidadeParcelas" || undefined} min="1" max="360" step="1" type="number" className={CAMPO + (campoInvalidoGeracao === "quantidadeParcelas" ? " border-red-400 ring-2 ring-red-200" : "")} value={geradorParcelas.quantidade} onChange={(e) => { setGeradorParcelas((atual) => ({ ...atual, quantidade: e.target.value })); setCampoInvalidoGeracao(null); }} /></label>
                <label className="block text-sm font-medium">Intervalo<select aria-label="Intervalo das parcelas" className={SELECT} value={geradorParcelas.frequencia} onChange={(e) => setGeradorParcelas((atual) => ({ ...atual, frequencia: e.target.value as FrequenciaParcelas }))}><option value="MENSAL">Mensal</option><option value="SEMANAL">Semanal</option></select></label>
                <label className="block text-sm font-medium">Primeiro vencimento<input aria-label="Primeiro vencimento" aria-invalid={campoInvalidoGeracao === "primeiroVencimento" || undefined} type="date" className={CAMPO + (campoInvalidoGeracao === "primeiroVencimento" ? " border-red-400 ring-2 ring-red-200" : "")} value={geradorParcelas.primeiroVencimento} onChange={(e) => { setGeradorParcelas((atual) => ({ ...atual, primeiroVencimento: e.target.value })); setCampoInvalidoGeracao(null); }} /></label>
                {erroGeracao && <CampoErro className="mt-0">{erroGeracao}</CampoErro>}
                <Button type="button" className="w-full" disabled={gerando} onClick={solicitarGeracao}>{gerando ? "Gerando…" : "Gerar"}</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-3">{parcelas.map((parcela, indice) => {
          const idValor = `parcela-valor-${parcela.id}`;
          const idVencimento = `parcela-vencimento-${parcela.id}`;
          const erroValor = campoInvalido === idValor;
          const erroVencimento = campoInvalido === idVencimento;
          return <div key={parcela.id}>
            <div className="grid items-end gap-3 sm:grid-cols-[80px_1fr_1fr_40px]"><strong className="pb-2.5 text-sm">{indice + 1}/{parcelas.length}</strong><label className="text-sm font-medium">Valor<input id={idValor} aria-label={`Valor da parcela ${indice + 1}`} aria-invalid={erroValor || undefined} aria-describedby={erroValor ? `erro-${idValor}` : undefined} required min="0.01" step="0.01" type="number" className={CAMPO + (erroValor ? " border-red-400 ring-2 ring-red-200" : "")} value={parcela.valor} onChange={(e) => { setParcelas((atuais) => atuais.map((atual) => atual.id === parcela.id ? { ...atual, valor: e.target.value } : atual)); limparCampoInvalido(idValor); limparCampoInvalido("parcelas"); }} /></label><label className="text-sm font-medium">Vencimento<input id={idVencimento} aria-label={`Vencimento da parcela ${indice + 1}`} aria-invalid={erroVencimento || undefined} aria-describedby={erroVencimento ? `erro-${idVencimento}` : undefined} required type="date" className={CAMPO + (erroVencimento ? " border-red-400 ring-2 ring-red-200" : "")} value={parcela.vencimento} onChange={(e) => { setParcelas((atuais) => atuais.map((atual) => atual.id === parcela.id ? { ...atual, vencimento: e.target.value } : atual)); limparCampoInvalido(idVencimento); limparCampoInvalido("parcelas"); }} /></label><button type="button" disabled={parcelas.length === 1} aria-label={`Remover parcela ${indice + 1}`} onClick={() => setParcelas((atuais) => atuais.filter((atual) => atual.id !== parcela.id))} className="mb-1 rounded-lg p-2 text-red-700 hover:bg-red-50 disabled:opacity-30"><Trash2 size={16} /></button></div>
            {erroValor && <CampoErro id={`erro-${idValor}`} className="mt-1.5 sm:pl-[92px]">{parcela.valor === "" ? `A parcela ${indice + 1} está sem valor. Informe um valor maior que zero ou remova a parcela.` : `Informe um valor válido para a parcela ${indice + 1}: maior que zero, com até duas casas decimais.`}</CampoErro>}
            {erroVencimento && <CampoErro id={`erro-${idVencimento}`} className="mt-1.5 sm:pl-[92px]">{`A parcela ${indice + 1} está sem data de vencimento. Informe a data para continuar.`}</CampoErro>}
          </div>;
        })}</div>
        {/* Sempre ao fim da lista: cada clique acrescenta uma linha nova. */}
        <Button type="button" secondary className="mt-3 w-full" onClick={() => setParcelas((atuais) => [...atuais, novaParcela(atuais.length)])}><Plus size={15} /> Parcela</Button>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs"><span>Total das parcelas anotadas: <strong>{brl(deCentavos(totalAnotado))}</strong></span><span className={diferenca < 0 ? "text-red-700" : "text-ink-3"}>{diferenca < 0 ? "Excedente" : "Restante para distribuir"}: <strong>{brl(deCentavos(Math.abs(diferenca)))}</strong></span></div>
        {!somaParcelasConfere && <CampoErro className="mt-3">A soma das parcelas deve corresponder a {brl(condicao === "PARCIAL" ? saldoFuturo : total)}.</CampoErro>}
      </div>}
    </div>}
    <ConfirmDialog open={confirmarSubstituicao} title="Substituir as parcelas atuais?" message="A nova grade substituirá todas as parcelas já preenchidas nesta lista." confirmLabel="Substituir parcelas" processando={gerando} onCancel={() => setConfirmarSubstituicao(false)} onConfirm={() => void gerar()} />
  </section>;
}

function Documentos({ anexos, setAnexos, anexosEnviando, documentosSalvos, atualizarDocumentoSalvo, removerDocumentoSalvo, selecionarAnexos }: { anexos: AnexoForm[]; setAnexos: React.Dispatch<React.SetStateAction<AnexoForm[]>>; anexosEnviando: AnexoEnviando[]; documentosSalvos: DocumentoFinanceiro[]; atualizarDocumentoSalvo: (id: number, patch: { tipo?: string; numero?: string | null }) => void; removerDocumentoSalvo: (id: number) => void; selecionarAnexos: (evento: ChangeEvent<HTMLInputElement>) => void }) {
  const vazio = !anexos.length && !documentosSalvos.length && !anexosEnviando.length;
  const enviando = anexosEnviando.length > 0;
  return <section><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Documentos</h3><p className="mt-1 text-xs text-ink-3">PDF, XML, JPG, PNG ou WEBP, com até 10 MB por arquivo.</p></div><label aria-disabled={enviando} className={`inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold ${enviando ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-[#faf9f4]"}`}>{enviando ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Paperclip size={15} />} {enviando ? "Anexando…" : "Anexar"}<input aria-label="Anexar documentos" type="file" multiple disabled={enviando} accept=".pdf,.xml,.jpg,.jpeg,.png,.webp,application/pdf,application/xml,text/xml,image/jpeg,image/png,image/webp" className="sr-only" onChange={selecionarAnexos} /></label></div>{!vazio ? <div className="space-y-2">{documentosSalvos.map((documento) => <div key={`salvo-${documento.id}`} className="grid items-center gap-3 rounded-lg border border-border p-3 md:grid-cols-[minmax(0,1fr)_180px_160px_36px]"><div className="flex min-w-0 items-center gap-3"><FileText size={18} className="shrink-0 text-ink-3" /><div className="min-w-0"><div className="truncate text-sm font-medium">{documento.nome}</div><div className="text-xs text-ink-3">Salvo no rascunho</div></div></div><select aria-label={`Tipo do documento ${documento.nome}`} className={`${SELECT} mt-0 p-2 text-sm`} value={documento.tipo} onChange={(e) => atualizarDocumentoSalvo(documento.id, { tipo: e.target.value })}>{Object.entries(TIPOS_DOCUMENTO).map(([chave, nome]) => <option key={chave} value={chave}>{nome}</option>)}</select><input aria-label={`Número do documento ${documento.nome}`} placeholder="Número (opcional)" className="rounded-lg border border-[#d8cfbb] bg-white p-2 text-sm" value={documento.numero ?? ""} onChange={(e) => atualizarDocumentoSalvo(documento.id, { numero: e.target.value })} /><button type="button" aria-label={`Remover documento ${documento.nome}`} onClick={() => removerDocumentoSalvo(documento.id)} className="rounded-lg p-2 text-red-700 hover:bg-red-50"><Trash2 size={16} /></button></div>)}{anexos.map((anexo) => <div key={anexo.id} className="grid items-center gap-3 rounded-lg border border-border p-3 md:grid-cols-[minmax(0,1fr)_180px_160px_36px]"><div className="flex min-w-0 items-center gap-3"><FileText size={18} className="shrink-0 text-ink-3" /><div className="min-w-0"><div className="truncate text-sm font-medium">{anexo.arquivo.name}</div><div className="text-xs text-ink-3">{(anexo.arquivo.size / 1024 / 1024).toFixed(2)} MB</div></div></div><select aria-label={`Tipo do documento ${anexo.arquivo.name}`} className={`${SELECT} mt-0 p-2 text-sm`} value={anexo.tipo} onChange={(e) => setAnexos((atuais) => atuais.map((atual) => atual.id === anexo.id ? { ...atual, tipo: e.target.value } : atual))}>{Object.entries(TIPOS_DOCUMENTO).map(([chave, nome]) => <option key={chave} value={chave}>{nome}</option>)}</select><input aria-label={`Número do documento ${anexo.arquivo.name}`} placeholder="Número (opcional)" className="rounded-lg border border-[#d8cfbb] bg-white p-2 text-sm outline-none focus:border-[#6f7d68] focus:ring-2 focus:ring-[#6f7d68]/15" value={anexo.numero} onChange={(e) => setAnexos((atuais) => atuais.map((atual) => atual.id === anexo.id ? { ...atual, numero: e.target.value } : atual))} /><button type="button" aria-label={`Remover documento ${anexo.arquivo.name}`} onClick={() => setAnexos((atuais) => atuais.filter((atual) => atual.id !== anexo.id))} className="rounded-lg p-2 text-red-700 hover:bg-red-50"><Trash2 size={16} /></button></div>)}{anexosEnviando.map((pendente) => <div key={`enviando-${pendente.id}`} role="status" aria-busy="true" aria-label={`Anexando documento ${pendente.nome}`} className="flex items-center gap-3 rounded-lg border border-dashed border-[#6f7d68]/50 bg-[#faf9f4] p-3"><Loader2 size={18} className="shrink-0 animate-spin text-[#6f7d68]" aria-hidden /><div className="min-w-0"><div className="truncate text-sm font-medium">{pendente.nome}</div><div className="text-xs text-ink-3">Anexando… {(pendente.tamanho / 1024 / 1024).toFixed(2)} MB</div></div></div>)}</div> : <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-ink-3">Nenhum documento anexado.</div>}</section>;
}

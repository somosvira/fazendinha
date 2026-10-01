import { createHash } from "node:crypto";
import { z } from "zod";

const dinheiroSchema = z.string().regex(/^\d+\.\d{2}$/);
const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const linhaRioNovoSchema = z.object({
  indiceCache: z.number().int().positive(),
  hashLinha: z.string().regex(/^[a-f0-9]{64}$/),
  competencia: dataSchema.nullable(),
  vencimento: dataSchema.nullable(),
  liquidacao: dataSchema.nullable(),
  tipoLancamento: z.string().nullable(),
  natureza: z.enum(["CREDITO", "DEBITO"]).nullable(),
  situacao: z.enum(["ABERTO", "LIQUIDADO", "LIQUIDADO_PARCIAL", "DESCONHECIDA"]),
  valorOriginal: dinheiroSchema.nullable(),
  valorRealizado: dinheiroSchema.nullable(),
  valorRelatorio: dinheiroSchema.nullable(),
  estorno: z.boolean(),
  fonte: z.string().nullable(),
  fonteLinha: z.string().nullable(),
  descricao: z.string().nullable(),
  detalhes: z.string().nullable(),
  parceiro: z.string().nullable(),
  conta: z.string().nullable(),
  numeroDocumento: z.string().nullable(),
  numeroParcela: z.number().int().positive().nullable(),
  meioPagamento: z.string().nullable(),
  grupoCategoriaBruto: z.string().nullable(),
  categoriaBruta: z.string().nullable(),
  centroCusto: z.string().nullable(),
  grupoCategoria: z.string().nullable(),
  categoria: z.string().nullable(),
  origem: z.record(z.string(), z.string().nullable()),
});

export const artefatoRioNovoSchema = z.object({
  versaoFormato: z.literal(1),
  arquivo: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  fonte: z.string().min(1),
  extraidoEm: z.string().datetime(),
  cache: z.object({
    definicao: z.string(),
    registros: z.string(),
    quantidadeTotal: z.number().int().nonnegative(),
    quantidadeFonte: z.number().int().nonnegative(),
    quantidadeCampos: z.number().int().positive(),
    campos: z.array(z.string()),
    atualizadoPor: z.string().nullable(),
    atualizadoEm: z.string().datetime().nullable(),
    dataMinima: dataSchema.nullable(),
    dataMaxima: dataSchema.nullable(),
  }),
  linhas: z.array(linhaRioNovoSchema),
});

export type ArtefatoRioNovo = z.infer<typeof artefatoRioNovoSchema>;
export type LinhaRioNovo = z.infer<typeof linhaRioNovoSchema>;
export type RotaImportacao = "OPERACAO" | "TRANSFERENCIA" | "TRANSACAO_AVULSA";
export type StatusDecisao = "PRONTA" | "AGRUPADA" | "IGNORADA" | "REVISAO" | "REJEITADA";
export type TipoOperacaoImportada = "COMPRA_CONSUMO_DIRETO" | "SERVICO" | "VENDA" | "APORTE" | "RETIRADA";

export const VERSAO_MATRIZ_RIO_NOVO = 1;

const CATEGORIAS_SERVICO = new Set([
  "Admin - BPO Financeiro", "Admin - Prest de Serviços", "Contabilidade", "Empreitada", "Frete",
  "Internet", "Jardinagem", "Mão de Obra Investimento", "Pessoal - Exames Ocupacionais", "Veterinário",
]);
const CATEGORIAS_VENDA = new Set(["Venda de Café", "Venda de Leite", "Vendas Fazenda"]);
const CATEGORIAS_APORTE = new Set(["Aporte Denise (+)", "Aporte MAGC (+)", "Transf AFAC (+)", "Transf APORTE (+)", "Transf entre Empresas (+)"]);
const CATEGORIAS_RETIRADA = new Set(["Transf AFAC (-)", "Transf CONTR COMP E VENDA (-)", "Transf entre Empresas (-)"]);
const CATEGORIAS_AVULSA = new Set(["Aplicação Automática (+)", "Tarifas", "Transf EMPRÉSTIMO (+)", "Transf EMPRÉSTIMO (-)"]);
const CATEGORIAS_REVISAO = new Set([
  "Ajuste (-)", "Diversos (-)", "Estorno (+)", "Estorno (-)", "Identificar (+)", "Identificar (-)",
  "Pessoal Rescisão", "Recebimentos", "Saldo Inicial (+)", "Transferência", "Transf PAGAMENTO LUCROS (+)",
]);
const CATEGORIAS_CONSUMO = new Set([
  "Animal Aquisição", "Arrendamento", "Combustível", "Curral", "DARF", "Energia Eletrica", "Galpão",
  "Guias e Legalizações", "Invest Atividade Leiteira", "Investimento Plantio", "Manutenção",
  "Maq e Equip Investimento", "Material de Construção", "Medicamento Animal", "Medicamento Plantio",
  "Pessoal - EPI", "Pessoal - FGTS", "Pessoal - Férias", "Pessoal - Plano de Saúde", "Pessoal - Rescisão",
  "Pessoal - Salário", "Ração", "Reembolso (-)", "Reprodução", "Silagem",
]);

export const categoriasConhecidasRioNovo = Object.freeze([
  ...CATEGORIAS_SERVICO, ...CATEGORIAS_VENDA, ...CATEGORIAS_APORTE, ...CATEGORIAS_RETIRADA,
  ...CATEGORIAS_AVULSA, ...CATEGORIAS_REVISAO, ...CATEGORIAS_CONSUMO,
].sort((a, b) => a.localeCompare(b, "pt-BR")));

export interface DecisaoLinha {
  indiceCache: number;
  hashLinha: string;
  status: StatusDecisao;
  rota: RotaImportacao | "PROJECAO" | null;
  chaveEvento: string | null;
  motivo: string | null;
}

interface EventoBase {
  chave: string;
  linhas: number[];
  estornado: boolean;
  descricao: string;
  valor: string;
  data: string;
}

export interface EventoOperacao extends EventoBase {
  rota: "OPERACAO";
  tipo: TipoOperacaoImportada;
  natureza: "CREDITO" | "DEBITO";
  competencia: string;
  vencimento: string;
  liquidacao: string | null;
  situacao: "ABERTO" | "LIQUIDADO";
  valorOriginalFonte: string;
  parceiro: string | null;
  conta: string | null;
  categoria: string;
  categoriaBruta: string;
  grupoCategoria: string | null;
  grupoCategoriaBruto: string | null;
  centroCusto: string | null;
  classificacao: "CUSTEIO" | "INVESTIMENTO";
  numeroDocumento: string | null;
  numeroParcela: number | null;
  formaPagamento: FormaPagamentoImportada | null;
}

export interface EventoTransacaoAvulsa extends EventoBase {
  rota: "TRANSACAO_AVULSA";
  natureza: "CREDITO" | "DEBITO";
  conta: string;
  parceiro: string | null;
  formaPagamento: FormaPagamentoImportada | null;
  categoriaOrigem: string;
}

export interface EventoTransferencia extends EventoBase {
  rota: "TRANSFERENCIA";
  contaOrigem: string;
  contaDestino: string;
  formaPagamento: FormaPagamentoImportada | null;
}

export type EventoImportacao = EventoOperacao | EventoTransacaoAvulsa | EventoTransferencia;
export type FormaPagamentoImportada = "DINHEIRO" | "BOLETO" | "CARTAO" | "CHEQUE" | "OUTRO";

export interface PlanoImportacaoRioNovo {
  versaoPlano: 1;
  versaoMatriz: number;
  arquivo: string;
  sha256: string;
  fonte: string;
  incluirAbertos: boolean;
  fonteMaisRecenteConfirmada: boolean;
  eventos: EventoImportacao[];
  decisoes: DecisaoLinha[];
  resumo: {
    linhas: number;
    eventos: number;
    porStatus: Record<StatusDecisao, number>;
    porRota: Record<string, number>;
    valorEntradas: string;
    valorSaidas: string;
  };
}

export interface OpcoesPlanoRioNovo {
  incluirAbertos?: boolean;
  fonteMaisRecenteConfirmada?: boolean;
}

const semAcentos = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normalizar = (valor: string | null) => semAcentos(valor ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
const ehDescricaoEstorno = (linha: LinhaRioNovo) => /^estorno:\s*/i.test(linha.descricao ?? "");
const descricaoBase = (linha: LinhaRioNovo) => normalizar((linha.descricao ?? "").replace(/^estorno:\s*/i, ""));

function chave(prefixo: string, indices: number[]) {
  return `${prefixo}-${createHash("sha256").update(indices.slice().sort((a, b) => a - b).join(":"), "utf8").digest("hex").slice(0, 24)}`;
}

function centavos(valor: string) {
  const [inteiros, decimais] = valor.split(".");
  return BigInt(inteiros) * 100n + BigInt(decimais);
}

function formatarCentavos(valor: bigint) {
  const sinal = valor < 0n ? "-" : "";
  const absoluto = valor < 0n ? -valor : valor;
  return `${sinal}${absoluto / 100n}.${String(absoluto % 100n).padStart(2, "0")}`;
}

export function mapearFormaPagamento(valor: string | null): FormaPagamentoImportada | null {
  const meio = normalizar(valor);
  if (!meio || meio === "indefinido") return null;
  if (meio === "dinheiro") return "DINHEIRO";
  if (meio === "boleto") return "BOLETO";
  if (meio === "cartao debito" || meio === "cartao credito") return "CARTAO";
  if (meio === "cheque") return "CHEQUE";
  return "OUTRO";
}

function categoriaEfetiva(linha: LinhaRioNovo) {
  return linha.categoria ?? linha.categoriaBruta ?? "(Sem categoria)";
}

function classificacao(linha: LinhaRioNovo): "CUSTEIO" | "INVESTIMENTO" {
  const texto = normalizar([linha.centroCusto, linha.grupoCategoria, linha.categoria, linha.categoriaBruta].filter(Boolean).join(" "));
  return texto.includes("invest") ? "INVESTIMENTO" : "CUSTEIO";
}

function tipoOperacao(linha: LinhaRioNovo): TipoOperacaoImportada | "AVULSA" | "REVISAO" {
  const categoria = linha.categoriaBruta ?? "";
  if (CATEGORIAS_REVISAO.has(categoria) || !categoria) return "REVISAO";
  if (CATEGORIAS_AVULSA.has(categoria)) return "AVULSA";
  if (CATEGORIAS_APORTE.has(categoria)) return linha.natureza === "CREDITO" ? "APORTE" : "REVISAO";
  if (CATEGORIAS_RETIRADA.has(categoria)) return linha.natureza === "DEBITO" ? "RETIRADA" : "REVISAO";
  if (CATEGORIAS_VENDA.has(categoria)) return linha.natureza === "CREDITO" ? "VENDA" : "REVISAO";
  if (CATEGORIAS_SERVICO.has(categoria)) return linha.natureza === "DEBITO" ? "SERVICO" : "REVISAO";
  if (CATEGORIAS_CONSUMO.has(categoria)) return linha.natureza === "DEBITO" ? "COMPRA_CONSUMO_DIRETO" : "REVISAO";
  return "REVISAO";
}

function descricaoHistorica(linha: LinhaRioNovo) {
  const partes = [linha.descricao ?? linha.detalhes ?? categoriaEfetiva(linha)];
  if (linha.numeroDocumento) partes.push(`Documento: ${linha.numeroDocumento}`);
  if (linha.numeroParcela) partes.push(`Parcela: ${linha.numeroParcela}`);
  return partes.join(" | ");
}

function validarLinhaBasica(linha: LinhaRioNovo, exigeConta: boolean): string | null {
  if (!linha.natureza) return "Natureza de crédito/débito ausente ou inválida";
  if (!linha.competencia) return "Data de competência ausente ou inválida";
  if (!linha.vencimento) return "Data de vencimento ausente ou inválida";
  if (!linha.valorOriginal || linha.valorOriginal === "0.00") return "Valor original ausente ou zerado";
  if (linha.situacao === "LIQUIDADO" && (!linha.liquidacao || !linha.valorRealizado || linha.valorRealizado === "0.00")) return "Liquidação sem data ou valor realizado válido";
  if (exigeConta && linha.situacao === "LIQUIDADO" && !linha.conta) return "Liquidação sem conta financeira";
  if (!["ABERTO", "LIQUIDADO"].includes(linha.situacao)) return `Situação não suportada: ${linha.situacao}`;
  return null;
}

function criarEventoLinha(linha: LinhaRioNovo, estornado: boolean): EventoOperacao | EventoTransacaoAvulsa | string {
  const erro = validarLinhaBasica(linha, true);
  if (erro) return erro;
  const tipo = tipoOperacao(linha);
  if (tipo === "REVISAO") return `Categoria sem roteamento seguro: ${linha.categoriaBruta ?? "(vazia)"}`;
  const indices = [linha.indiceCache];
  const valor = linha.situacao === "LIQUIDADO" ? linha.valorRealizado! : linha.valorOriginal!;
  const data = linha.liquidacao ?? linha.vencimento!;
  if (tipo === "AVULSA" || ["Receita", "Despesa"].includes(linha.tipoLancamento ?? "")) {
    if (linha.situacao !== "LIQUIDADO" || !linha.conta) return "Transação avulsa precisa estar liquidada e possuir conta";
    return {
      chave: chave("avulsa", indices), rota: "TRANSACAO_AVULSA", linhas: indices, estornado,
      descricao: descricaoHistorica(linha), valor, data, natureza: linha.natureza!, conta: linha.conta,
      parceiro: linha.parceiro, formaPagamento: mapearFormaPagamento(linha.meioPagamento), categoriaOrigem: categoriaEfetiva(linha),
    };
  }
  if (!["FaturaPagar", "FaturaReceber"].includes(linha.tipoLancamento ?? "")) return `Tipo de lançamento não suportado: ${linha.tipoLancamento ?? "(vazio)"}`;
  const esperado = linha.tipoLancamento === "FaturaPagar" ? "DEBITO" : "CREDITO";
  if (linha.natureza !== esperado) return `Natureza ${linha.natureza} incompatível com ${linha.tipoLancamento}`;
  return {
    chave: chave("operacao", indices), rota: "OPERACAO", linhas: indices, estornado,
    descricao: descricaoHistorica(linha), valor, data, tipo, natureza: linha.natureza!, competencia: linha.competencia!,
    vencimento: linha.vencimento!, liquidacao: linha.liquidacao, situacao: linha.situacao as "ABERTO" | "LIQUIDADO",
    valorOriginalFonte: linha.valorOriginal!, parceiro: linha.parceiro, conta: linha.conta,
    categoria: categoriaEfetiva(linha), categoriaBruta: linha.categoriaBruta!, grupoCategoria: linha.grupoCategoria,
    grupoCategoriaBruto: linha.grupoCategoriaBruto, centroCusto: linha.centroCusto, classificacao: classificacao(linha),
    numeroDocumento: linha.numeroDocumento, numeroParcela: linha.numeroParcela,
    formaPagamento: mapearFormaPagamento(linha.meioPagamento),
  };
}

function assinaturaTransferencia(linha: LinhaRioNovo) {
  return [linha.liquidacao, linha.valorRealizado, descricaoBase(linha)].join("|");
}

function parearPontasTransferencia(linhas: LinhaRioNovo[]) {
  const debitos = linhas.filter((linha) => linha.natureza === "DEBITO").sort((a, b) => a.indiceCache - b.indiceCache);
  const creditos = linhas.filter((linha) => linha.natureza === "CREDITO").sort((a, b) => a.indiceCache - b.indiceCache);
  const pares: [LinhaRioNovo, LinhaRioNovo][] = [];
  while (debitos.length && creditos.length) {
    const debito = debitos.shift()!;
    const posicao = creditos.findIndex((credito) => credito.conta !== debito.conta);
    if (posicao < 0) break;
    pares.push([debito, creditos.splice(posicao, 1)[0]!]);
  }
  return { pares, sobras: [...debitos, ...creditos] };
}

function eventoTransferencia(debito: LinhaRioNovo, credito: LinhaRioNovo, estornado: boolean, linhas?: number[]): EventoTransferencia | string {
  const erroDebito = validarLinhaBasica(debito, true);
  const erroCredito = validarLinhaBasica(credito, true);
  if (erroDebito || erroCredito) return erroDebito ?? erroCredito!;
  if (debito.situacao !== "LIQUIDADO" || credito.situacao !== "LIQUIDADO") return "Transferência não liquidada";
  if (!debito.conta || !credito.conta || debito.conta === credito.conta) return "Transferência sem duas contas distintas";
  if (debito.valorRealizado !== credito.valorRealizado || debito.liquidacao !== credito.liquidacao) return "Pontas da transferência não conferem";
  const indices = linhas ?? [debito.indiceCache, credito.indiceCache];
  return {
    chave: chave("transferencia", indices), rota: "TRANSFERENCIA", linhas: indices, estornado,
    descricao: debito.descricao ?? credito.descricao ?? "Transferência histórica", valor: debito.valorRealizado!,
    data: debito.liquidacao!, contaOrigem: debito.conta, contaDestino: credito.conta,
    formaPagamento: mapearFormaPagamento(debito.meioPagamento ?? credito.meioPagamento),
  };
}

function assinaturaEstorno(linha: LinhaRioNovo) {
  const familia = ["Receita", "Despesa"].includes(linha.tipoLancamento ?? "") ? "AVULSA" : linha.tipoLancamento;
  return [familia, linha.competencia, linha.vencimento, linha.liquidacao, linha.valorRealizado, normalizar(linha.conta),
    normalizar(linha.parceiro), normalizar(linha.categoriaBruta), normalizar(linha.numeroDocumento), linha.numeroParcela].join("|");
}

function agruparPor<T>(itens: T[], seletor: (item: T) => string) {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const chaveGrupo = seletor(item);
    grupos.set(chaveGrupo, [...(grupos.get(chaveGrupo) ?? []), item]);
  }
  return grupos;
}

function resumoPlano(eventos: EventoImportacao[], decisoes: DecisaoLinha[], totalLinhas: number) {
  const porStatus: Record<StatusDecisao, number> = { PRONTA: 0, AGRUPADA: 0, IGNORADA: 0, REVISAO: 0, REJEITADA: 0 };
  const porRota: Record<string, number> = {};
  for (const decisao of decisoes) {
    porStatus[decisao.status] += 1;
    const rota = decisao.rota ?? "SEM_ROTA";
    porRota[rota] = (porRota[rota] ?? 0) + 1;
  }
  let entradas = 0n;
  let saidas = 0n;
  for (const evento of eventos) {
    if (evento.rota === "TRANSFERENCIA" || evento.estornado) continue;
    if (evento.natureza === "CREDITO") entradas += centavos(evento.valor);
    else saidas += centavos(evento.valor);
  }
  return { linhas: totalLinhas, eventos: eventos.length, porStatus, porRota, valorEntradas: formatarCentavos(entradas), valorSaidas: formatarCentavos(saidas) };
}

export function planejarImportacaoRioNovo(entrada: unknown, opcoes: OpcoesPlanoRioNovo = {}): PlanoImportacaoRioNovo {
  const artefato = artefatoRioNovoSchema.parse(entrada);
  const incluirAbertos = opcoes.incluirAbertos ?? false;
  const fonteMaisRecenteConfirmada = opcoes.fonteMaisRecenteConfirmada ?? false;
  if (incluirAbertos && !fonteMaisRecenteConfirmada) throw new Error("Títulos abertos só podem ser incluídos após confirmar que a planilha é a fonte mais recente");

  const eventos: EventoImportacao[] = [];
  const decisoes = new Map<number, DecisaoLinha>();
  const decidir = (linha: LinhaRioNovo, status: StatusDecisao, rota: DecisaoLinha["rota"], chaveEvento: string | null, motivo: string | null) => {
    decisoes.set(linha.indiceCache, { indiceCache: linha.indiceCache, hashLinha: linha.hashLinha, status, rota, chaveEvento, motivo });
  };
  const registrarEvento = (evento: EventoImportacao, linhas: LinhaRioNovo[]) => {
    eventos.push(evento);
    linhas.forEach((linha, indice) => decidir(linha, indice === 0 ? "PRONTA" : "AGRUPADA", evento.rota, evento.chave, null));
  };

  const transferencias = artefato.linhas.filter((linha) => linha.tipoLancamento === "Transferencia");
  const transferenciasAtivas = transferencias.filter((linha) => !linha.estorno);
  const gruposTransferencia = agruparPor(transferenciasAtivas, assinaturaTransferencia);
  for (const linhas of gruposTransferencia.values()) {
    const { pares, sobras } = parearPontasTransferencia(linhas);
    for (const [debito, credito] of pares) {
      const evento = eventoTransferencia(debito, credito, false);
      if (typeof evento === "string") [debito, credito].forEach((linha) => decidir(linha, "REVISAO", "TRANSFERENCIA", null, evento));
      else registrarEvento(evento, [debito, credito]);
    }
    sobras.forEach((linha) => decidir(linha, "REVISAO", "TRANSFERENCIA", null, "Ponta de transferência sem par"));
  }

  const transferenciasEstornadas = transferencias.filter((linha) => linha.estorno);
  const gruposTransferenciaEstornada = agruparPor(transferenciasEstornadas, assinaturaTransferencia);
  for (const linhas of gruposTransferenciaEstornada.values()) {
    const originais = parearPontasTransferencia(linhas.filter((linha) => !ehDescricaoEstorno(linha)));
    const reversoes = parearPontasTransferencia(linhas.filter(ehDescricaoEstorno));
    const quantidade = Math.min(originais.pares.length, reversoes.pares.length);
    for (let indice = 0; indice < quantidade; indice += 1) {
      const [debito, credito] = originais.pares[indice]!;
      const [debitoReversao, creditoReversao] = reversoes.pares[indice]!;
      const grupo = [debito, credito, debitoReversao, creditoReversao];
      if (debito.conta !== creditoReversao.conta || credito.conta !== debitoReversao.conta) {
        grupo.forEach((linha) => decidir(linha, "REVISAO", "TRANSFERENCIA", null, "Contas da reversão não espelham a transferência original"));
        continue;
      }
      const indices = grupo.map((linha) => linha.indiceCache);
      const evento = eventoTransferencia(debito, credito, true, indices);
      if (typeof evento === "string") grupo.forEach((linha) => decidir(linha, "REVISAO", "TRANSFERENCIA", null, evento));
      else registrarEvento(evento, grupo);
    }
    [...originais.pares.slice(quantidade).flat(), ...reversoes.pares.slice(quantidade).flat(), ...originais.sobras, ...reversoes.sobras]
      .forEach((linha) => decidir(linha, "REVISAO", "TRANSFERENCIA", null, "Conjunto de transferência estornada incompleto"));
  }

  const estornos = artefato.linhas.filter((linha) => linha.estorno && linha.tipoLancamento !== "Transferencia");
  const gruposEstorno = agruparPor(estornos, assinaturaEstorno);
  for (const linhas of gruposEstorno.values()) {
    const originais = linhas.filter((linha) => !ehDescricaoEstorno(linha)).sort((a, b) => a.indiceCache - b.indiceCache);
    const reversoes = linhas.filter(ehDescricaoEstorno).sort((a, b) => a.indiceCache - b.indiceCache);
    const quantidade = Math.min(originais.length, reversoes.length);
    for (let indice = 0; indice < quantidade; indice += 1) {
      const original = originais[indice]!;
      const reversao = reversoes[indice]!;
      if (original.natureza === reversao.natureza) {
        [original, reversao].forEach((linha) => decidir(linha, "REVISAO", null, null, "Estorno não inverte crédito/débito"));
        continue;
      }
      const criado = criarEventoLinha(original, true);
      if (typeof criado === "string") [original, reversao].forEach((linha) => decidir(linha, "REVISAO", null, null, criado));
      else {
        criado.linhas = [original.indiceCache, reversao.indiceCache];
        criado.chave = chave(criado.rota === "OPERACAO" ? "operacao-estornada" : "avulsa-estornada", criado.linhas);
        registrarEvento(criado, [original, reversao]);
      }
    }
    [...originais.slice(quantidade), ...reversoes.slice(quantidade)]
      .forEach((linha) => decidir(linha, "REVISAO", null, null, "Linha de estorno sem contraparte"));
  }

  for (const linha of artefato.linhas) {
    if (decisoes.has(linha.indiceCache) || linha.estorno || linha.tipoLancamento === "Transferencia") continue;
    if ((linha.numeroDocumento ?? "").trim().toLocaleUpperCase("pt-BR") === "PROJ") {
      decidir(linha, "IGNORADA", "PROJECAO", null, "Projeção excluída do domínio financeiro");
      continue;
    }
    if (linha.situacao === "ABERTO" && !incluirAbertos) {
      decidir(linha, "IGNORADA", null, null, "Título aberto não incluído neste ensaio");
      continue;
    }
    const criado = criarEventoLinha(linha, false);
    if (typeof criado === "string") decidir(linha, criado.includes("ausente") || criado.includes("inválid") ? "REJEITADA" : "REVISAO", null, null, criado);
    else registrarEvento(criado, [linha]);
  }

  for (const linha of artefato.linhas) {
    if (!decisoes.has(linha.indiceCache)) decidir(linha, "REJEITADA", null, null, "Linha não classificada pelo planejador");
  }
  const decisoesOrdenadas = [...decisoes.values()].sort((a, b) => a.indiceCache - b.indiceCache);
  eventos.sort((a, b) => Math.min(...a.linhas) - Math.min(...b.linhas));
  return {
    versaoPlano: 1,
    versaoMatriz: VERSAO_MATRIZ_RIO_NOVO,
    arquivo: artefato.arquivo,
    sha256: artefato.sha256,
    fonte: artefato.fonte,
    incluirAbertos,
    fonteMaisRecenteConfirmada,
    eventos,
    decisoes: decisoesOrdenadas,
    resumo: resumoPlano(eventos, decisoesOrdenadas, artefato.linhas.length),
  };
}

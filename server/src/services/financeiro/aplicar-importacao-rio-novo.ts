import { createHash } from "node:crypto";
import { Prisma, type PapelParceiro, type PrismaClient, type TipoParceiro, type TipoTransacaoFinanceira } from "@prisma/client";
import type {
  ArtefatoRioNovo,
  EventoImportacao,
  EventoOperacao,
  EventoTransacaoAvulsa,
  EventoTransferencia,
  PlanoImportacaoRioNovo,
} from "./importacao-rio-novo.js";

type Db = Prisma.TransactionClient;

export interface OpcoesAplicacaoRioNovo {
  propriedadeId: number;
  retomar?: boolean;
}

export interface ResultadoAplicacaoRioNovo {
  importacaoId: string;
  jaImportada: boolean;
  eventosAplicados: number;
  eventosIgnoradosPorRetomada: number;
  reconciliacao?: ResumoReconciliacao;
}

interface MovimentoEsperado {
  conta: string;
  direcao: "ENTRADA" | "SAIDA";
  valor: string;
  data: string;
}

interface ResumoReconciliacao {
  operacoes: number;
  compromissos: number;
  transacoes: number;
  movimentosConta: number;
  movimentosEstoque: number;
}

function data(valor: string) {
  return new Date(`${valor}T00:00:00.000Z`);
}

function json(valor: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}

function uuidDeterministico(semente: string) {
  const hexadecimal = createHash("sha256").update(semente, "utf8").digest("hex").slice(0, 32).split("");
  hexadecimal[12] = "5";
  hexadecimal[16] = ((Number.parseInt(hexadecimal[16]!, 16) & 0x3) | 0x8).toString(16);
  const texto = hexadecimal.join("");
  return `${texto.slice(0, 8)}-${texto.slice(8, 12)}-${texto.slice(12, 16)}-${texto.slice(16, 20)}-${texto.slice(20)}`;
}

function idEntidade(plano: PlanoImportacaoRioNovo, evento: EventoImportacao, sufixo: string) {
  return uuidDeterministico(`${plano.sha256}:${evento.chave}:${sufixo}`);
}

function tipoConta(nome: string): "BANCO" | "CAIXA" | "APLICACAO" {
  const normalizado = nome.toLocaleLowerCase("pt-BR");
  if (normalizado.includes("cdb") || normalizado.includes("aplica")) return "APLICACAO";
  if (normalizado.includes("caix") || normalizado.includes("moeda")) return "CAIXA";
  return "BANCO";
}

function instituicaoConta(nome: string) {
  const normalizado = nome.toLocaleLowerCase("pt-BR");
  if (normalizado.includes("sicoob")) return "Sicoob";
  if (normalizado.includes("bb ") || normalizado.startsWith("bb")) return "Banco do Brasil";
  return null;
}

async function garantirConta(db: Db, nome: string, propriedadeId: number, dataAbertura: Date) {
  const existente = await db.contaFinanceira.findUnique({ where: { propriedadeId_nome: { propriedadeId, nome } } });
  if (existente) return existente;
  const tipo = tipoConta(nome);
  return db.contaFinanceira.create({
    data: {
      nome,
      tipo,
      instituicao: tipo === "CAIXA" ? null : instituicaoConta(nome) ?? "A confirmar",
      local: tipo === "CAIXA" ? "Rio Novo" : null,
      saldoAbertura: new Prisma.Decimal(0),
      dataSaldoAbertura: dataAbertura,
      incluirNoSaldoGeral: false,
      propriedadeId,
      observacoes: "Cadastro provisório criado pela importação histórica; saldo e identificação aguardam conciliação.",
    },
  });
}

function papelDoEvento(evento: EventoOperacao | EventoTransacaoAvulsa): PapelParceiro {
  if (evento.rota === "OPERACAO" && evento.tipo === "SERVICO") return "PRESTADOR_SERVICO";
  if (evento.rota === "OPERACAO" && ["APORTE", "RETIRADA"].includes(evento.tipo)) return "OUTRO";
  return evento.natureza === "CREDITO" ? "CLIENTE" : "FORNECEDOR";
}

function tipoParceiro(papel: PapelParceiro): TipoParceiro {
  if (papel === "CLIENTE") return "CLIENTE";
  if (papel === "PROPRIETARIO") return "PROPRIETARIO";
  if (papel === "FUNCIONARIO") return "FUNCIONARIO";
  if (papel === "OUTRO") return "OUTRO";
  return "FORNECEDOR";
}

async function garantirParceiro(db: Db, nome: string | null, evento: EventoOperacao | EventoTransacaoAvulsa) {
  if (!nome?.trim()) return null;
  const nomeExato = nome.trim();
  const papel = papelDoEvento(evento);
  let parceiro = await db.parceiro.findFirst({ where: { nome: nomeExato }, orderBy: { createdAt: "asc" } });
  if (!parceiro) parceiro = await db.parceiro.create({ data: { nome: nomeExato, tipo: tipoParceiro(papel) } });
  await db.parceiroPapel.upsert({
    where: { parceiroId_papel: { parceiroId: parceiro.id, papel } },
    create: { parceiroId: parceiro.id, papel },
    update: {},
  });
  return parceiro;
}

async function garantirCategoria(db: Db, evento: EventoOperacao) {
  const existente = await db.categoria.findUnique({ where: { nome: evento.categoria } });
  if (existente) return existente;
  return db.categoria.create({ data: { nome: evento.categoria, classificacao: evento.classificacao } });
}

async function garantirCentroCusto(db: Db, nome: string | null) {
  if (!nome) return null;
  return db.centroCusto.upsert({ where: { nome }, create: { nome }, update: {} });
}

function tipoTransacaoOperacao(evento: EventoOperacao): TipoTransacaoFinanceira {
  if (evento.tipo === "APORTE") return "APORTE";
  if (evento.tipo === "RETIRADA") return "RETIRADA";
  return evento.natureza === "CREDITO" ? "RECEBIMENTO" : "PAGAMENTO";
}

function destinoMovimento(natureza: "CREDITO" | "DEBITO") {
  return natureza === "CREDITO" ? "ENTRADA" as const : "SAIDA" as const;
}

async function criarReversao(
  db: Db,
  plano: PlanoImportacaoRioNovo,
  evento: EventoImportacao,
  original: { id: string; operacaoId: string | null; parceiroId: string | null; movimentos: { id: string; contaId: string; direcao: "ENTRADA" | "SAIDA"; valor: Prisma.Decimal }[] },
  propriedadeId: number,
) {
  const reversaoId = idEntidade(plano, evento, "transacao-reversao");
  const ordemMovimentos = new Map([
    [idEntidade(plano, evento, "movimento-0"), 0],
    [idEntidade(plano, evento, "movimento-1"), 1],
  ]);
  const movimentosOriginais = original.movimentos.slice().sort((a, b) => (ordemMovimentos.get(a.id) ?? 99) - (ordemMovimentos.get(b.id) ?? 99));
  const reversao = await db.transacaoFinanceira.create({
    data: {
      id: reversaoId,
      tipo: "REVERSAO",
      data: data(evento.data),
      valorTotal: new Prisma.Decimal(evento.valor),
      descricao: `Estorno histórico: ${evento.descricao}`,
      operacaoId: original.operacaoId,
      parceiroId: original.parceiroId,
      propriedadeId,
      reversaoDeId: original.id,
      movimentos: {
        create: movimentosOriginais.map((movimento, indice) => ({
          id: idEntidade(plano, evento, `movimento-reversao-${indice}`),
          contaId: movimento.contaId,
          direcao: movimento.direcao === "ENTRADA" ? "SAIDA" : "ENTRADA",
          valor: movimento.valor,
        })),
      },
    },
    include: { movimentos: true },
  });
  await db.transacaoFinanceira.update({ where: { id: original.id }, data: { status: "REVERTIDA" } });
  return reversao;
}

async function aplicarOperacao(db: Db, plano: PlanoImportacaoRioNovo, evento: EventoOperacao, propriedadeId: number, dataAbertura: Date) {
  const parceiro = await garantirParceiro(db, evento.parceiro, evento);
  const categoria = await garantirCategoria(db, evento);
  const centro = await garantirCentroCusto(db, evento.centroCusto);
  const conta = evento.situacao === "LIQUIDADO" && evento.conta
    ? await garantirConta(db, evento.conta, propriedadeId, dataAbertura)
    : null;
  const operacaoId = idEntidade(plano, evento, "operacao");
  const compromissoId = idEntidade(plano, evento, "compromisso");
  const valor = new Prisma.Decimal(evento.valor);
  await db.operacao.create({
    data: {
      id: operacaoId,
      tipo: evento.tipo,
      status: "CONFIRMADA",
      data: data(evento.competencia),
      descricao: evento.descricao,
      valorTotal: valor,
      propriedadeId,
      parceiroId: parceiro?.id,
      categoriaId: categoria.id,
      categoriaNome: evento.categoria,
      classificacao: evento.classificacao,
      centroCustoId: centro?.id,
    },
  });
  await db.compromissoFinanceiro.create({
    data: {
      id: compromissoId,
      operacaoId,
      tipo: evento.natureza === "CREDITO" ? "RECEBER" : "PAGAR",
      status: evento.situacao === "LIQUIDADO" && !evento.estornado ? "LIQUIDADO" : "PENDENTE",
      // Decisão aprovada: o fato histórico usa o efetivamente realizado. O
      // valor original divergente permanece na LinhaImportacaoFinanceira.
      valorOriginal: valor,
      dataVencimento: data(evento.vencimento),
      numeroParcela: evento.numeroParcela,
      parceiroId: parceiro?.id,
    },
  });

  let transacaoId: string | null = null;
  let reversaoId: string | null = null;
  let movimentoIds: string[] = [];
  let liquidacaoId: string | null = null;
  if (evento.situacao === "LIQUIDADO" && conta && evento.liquidacao) {
    transacaoId = idEntidade(plano, evento, "transacao");
    const movimentoId = idEntidade(plano, evento, "movimento-0");
    const transacao = await db.transacaoFinanceira.create({
      data: {
        id: transacaoId,
        tipo: tipoTransacaoOperacao(evento),
        status: evento.estornado ? "REVERTIDA" : "CONFIRMADA",
        data: data(evento.liquidacao),
        valorTotal: valor,
        formaPagamento: evento.formaPagamento,
        descricao: evento.descricao,
        operacaoId,
        parceiroId: parceiro?.id,
        propriedadeId,
        movimentos: { create: { id: movimentoId, contaId: conta.id, direcao: destinoMovimento(evento.natureza), valor } },
      },
      include: { movimentos: true },
    });
    movimentoIds = transacao.movimentos.map((movimento) => movimento.id);
    liquidacaoId = idEntidade(plano, evento, "liquidacao");
    await db.liquidacao.create({ data: { id: liquidacaoId, compromissoId, transacaoId, valor } });
    if (evento.estornado) {
      const reversao = await criarReversao(db, plano, evento, transacao, propriedadeId);
      reversaoId = reversao.id;
      movimentoIds.push(...reversao.movimentos.map((movimento) => movimento.id));
    }
  }
  return { operacaoId, compromissoId, transacaoId, reversaoId, movimentoIds, liquidacaoId, parceiroId: parceiro?.id ?? null, categoriaId: categoria.id, centroCustoId: centro?.id ?? null };
}

async function aplicarAvulsa(db: Db, plano: PlanoImportacaoRioNovo, evento: EventoTransacaoAvulsa, propriedadeId: number, dataAbertura: Date) {
  const conta = await garantirConta(db, evento.conta, propriedadeId, dataAbertura);
  const parceiro = await garantirParceiro(db, evento.parceiro, evento);
  const transacaoId = idEntidade(plano, evento, "transacao");
  const valor = new Prisma.Decimal(evento.valor);
  const movimentoId = idEntidade(plano, evento, "movimento-0");
  const transacao = await db.transacaoFinanceira.create({
    data: {
      id: transacaoId,
      tipo: evento.natureza === "CREDITO" ? "RECEBIMENTO" : "PAGAMENTO",
      status: evento.estornado ? "REVERTIDA" : "CONFIRMADA",
      data: data(evento.data),
      valorTotal: valor,
      formaPagamento: evento.formaPagamento,
      descricao: `${evento.descricao} | Categoria de origem: ${evento.categoriaOrigem}`,
      parceiroId: parceiro?.id,
      propriedadeId,
      movimentos: { create: { id: movimentoId, contaId: conta.id, direcao: destinoMovimento(evento.natureza), valor } },
    },
    include: { movimentos: true },
  });
  let reversaoId: string | null = null;
  const movimentoIds = transacao.movimentos.map((movimento) => movimento.id);
  if (evento.estornado) {
    const reversao = await criarReversao(db, plano, evento, transacao, propriedadeId);
    reversaoId = reversao.id;
    movimentoIds.push(...reversao.movimentos.map((movimento) => movimento.id));
  }
  return { transacaoId, reversaoId, movimentoIds, parceiroId: parceiro?.id ?? null };
}

async function aplicarTransferencia(db: Db, plano: PlanoImportacaoRioNovo, evento: EventoTransferencia, propriedadeId: number, dataAbertura: Date) {
  const origem = await garantirConta(db, evento.contaOrigem, propriedadeId, dataAbertura);
  const destino = await garantirConta(db, evento.contaDestino, propriedadeId, dataAbertura);
  const valor = new Prisma.Decimal(evento.valor);
  const operacaoId = idEntidade(plano, evento, "operacao");
  const transacaoId = idEntidade(plano, evento, "transacao");
  await db.operacao.create({
    data: { id: operacaoId, tipo: "TRANSFERENCIA_FINANCEIRA", status: "CONFIRMADA", data: data(evento.data), descricao: evento.descricao, valorTotal: valor, propriedadeId },
  });
  const transacao = await db.transacaoFinanceira.create({
    data: {
      id: transacaoId,
      tipo: "TRANSFERENCIA",
      status: evento.estornado ? "REVERTIDA" : "CONFIRMADA",
      data: data(evento.data),
      valorTotal: valor,
      formaPagamento: evento.formaPagamento,
      descricao: evento.descricao,
      operacaoId,
      propriedadeId,
      movimentos: {
        create: [
          { id: idEntidade(plano, evento, "movimento-0"), contaId: origem.id, direcao: "SAIDA", valor },
          { id: idEntidade(plano, evento, "movimento-1"), contaId: destino.id, direcao: "ENTRADA", valor },
        ],
      },
    },
    include: { movimentos: true },
  });
  let reversaoId: string | null = null;
  const movimentoIds = transacao.movimentos.map((movimento) => movimento.id);
  if (evento.estornado) {
    const reversao = await criarReversao(db, plano, evento, transacao, propriedadeId);
    reversaoId = reversao.id;
    movimentoIds.push(...reversao.movimentos.map((movimento) => movimento.id));
  }
  return { operacaoId, transacaoId, reversaoId, movimentoIds, contaOrigemId: origem.id, contaDestinoId: destino.id };
}

async function aplicarEvento(db: Db, plano: PlanoImportacaoRioNovo, evento: EventoImportacao, propriedadeId: number, dataAbertura: Date) {
  const destino = evento.rota === "OPERACAO"
    ? await aplicarOperacao(db, plano, evento, propriedadeId, dataAbertura)
    : evento.rota === "TRANSFERENCIA"
      ? await aplicarTransferencia(db, plano, evento, propriedadeId, dataAbertura)
      : await aplicarAvulsa(db, plano, evento, propriedadeId, dataAbertura);

  await db.auditoriaFinanceira.create({
    data: {
      id: idEntidade(plano, evento, "auditoria"),
      entidade: evento.rota === "TRANSACAO_AVULSA" ? "TransacaoFinanceira" : "Operacao",
      entidadeId: "operacaoId" in destino ? destino.operacaoId : destino.transacaoId,
      acao: "IMPORTADA_HISTORICO",
      motivo: `Lote ${plano.sha256}; linhas ${evento.linhas.join(", ")}`,
      estadoPosterior: json(destino),
    },
  });
  return destino;
}

function lotesDe<T>(itens: T[], tamanho = 1_000) {
  const lotes: T[][] = [];
  for (let inicio = 0; inicio < itens.length; inicio += tamanho) lotes.push(itens.slice(inicio, inicio + tamanho));
  return lotes;
}

async function contarEmLotes(ids: string[], contar: (lote: string[]) => Promise<number>) {
  let total = 0;
  for (const lote of lotesDe(ids)) total += await contar(lote);
  return total;
}

async function reconciliarImportacao(prisma: PrismaClient, plano: PlanoImportacaoRioNovo): Promise<ResumoReconciliacao> {
  const operacoes: string[] = [];
  const compromissos: string[] = [];
  const transacoes: string[] = [];
  const movimentos = new Map<string, MovimentoEsperado>();
  const movimento = (evento: EventoImportacao, sufixo: string, esperado: MovimentoEsperado) => movimentos.set(idEntidade(plano, evento, sufixo), esperado);
  const inversa = (direcao: "ENTRADA" | "SAIDA") => direcao === "ENTRADA" ? "SAIDA" as const : "ENTRADA" as const;

  for (const evento of plano.eventos) {
    if (evento.rota !== "TRANSACAO_AVULSA") operacoes.push(idEntidade(plano, evento, "operacao"));
    if (evento.rota === "OPERACAO") compromissos.push(idEntidade(plano, evento, "compromisso"));
    if (evento.rota === "OPERACAO" && evento.situacao !== "LIQUIDADO") continue;
    transacoes.push(idEntidade(plano, evento, "transacao"));

    if (evento.rota === "TRANSFERENCIA") {
      movimento(evento, "movimento-0", { conta: evento.contaOrigem, direcao: "SAIDA", valor: evento.valor, data: evento.data });
      movimento(evento, "movimento-1", { conta: evento.contaDestino, direcao: "ENTRADA", valor: evento.valor, data: evento.data });
      if (evento.estornado) {
        movimento(evento, "movimento-reversao-0", { conta: evento.contaOrigem, direcao: "ENTRADA", valor: evento.valor, data: evento.data });
        movimento(evento, "movimento-reversao-1", { conta: evento.contaDestino, direcao: "SAIDA", valor: evento.valor, data: evento.data });
      }
    } else {
      if (!evento.conta) throw new Error(`Evento liquidado ${evento.chave} sem conta durante a reconciliação`);
      const direcao = destinoMovimento(evento.natureza);
      movimento(evento, "movimento-0", { conta: evento.conta, direcao, valor: evento.valor, data: evento.data });
      if (evento.estornado) movimento(evento, "movimento-reversao-0", { conta: evento.conta, direcao: inversa(direcao), valor: evento.valor, data: evento.data });
    }
    if (evento.estornado) transacoes.push(idEntidade(plano, evento, "transacao-reversao"));
  }

  const quantidadeOperacoes = await contarEmLotes(operacoes, (ids) => prisma.operacao.count({ where: { id: { in: ids } } }));
  const quantidadeCompromissos = await contarEmLotes(compromissos, (ids) => prisma.compromissoFinanceiro.count({ where: { id: { in: ids } } }));
  const quantidadeTransacoes = await contarEmLotes(transacoes, (ids) => prisma.transacaoFinanceira.count({ where: { id: { in: ids } } }));
  if (quantidadeOperacoes !== operacoes.length) throw new Error(`Reconciliação falhou: esperadas ${operacoes.length} operações, encontradas ${quantidadeOperacoes}`);
  if (quantidadeCompromissos !== compromissos.length) throw new Error(`Reconciliação falhou: esperados ${compromissos.length} compromissos, encontrados ${quantidadeCompromissos}`);
  if (quantidadeTransacoes !== transacoes.length) throw new Error(`Reconciliação falhou: esperadas ${transacoes.length} transações, encontradas ${quantidadeTransacoes}`);

  let quantidadeMovimentos = 0;
  for (const ids of lotesDe([...movimentos.keys()])) {
    const encontrados = await prisma.movimentoConta.findMany({
      where: { id: { in: ids } },
      select: { id: true, direcao: true, valor: true, conta: { select: { nome: true } }, transacao: { select: { data: true } } },
    });
    quantidadeMovimentos += encontrados.length;
    for (const encontrado of encontrados) {
      const esperado = movimentos.get(encontrado.id)!;
      const confere = encontrado.conta.nome === esperado.conta
        && encontrado.direcao === esperado.direcao
        && encontrado.valor.equals(esperado.valor)
        && encontrado.transacao.data.toISOString().slice(0, 10) === esperado.data;
      if (!confere) throw new Error(`Reconciliação falhou no movimento ${encontrado.id}`);
    }
  }
  if (quantidadeMovimentos !== movimentos.size) throw new Error(`Reconciliação falhou: esperados ${movimentos.size} movimentos de conta, encontrados ${quantidadeMovimentos}`);

  const movimentosEstoque = await contarEmLotes(operacoes, (ids) => prisma.movimentoEstoque.count({ where: { operacaoId: { in: ids } } }));
  if (movimentosEstoque !== 0) throw new Error(`Reconciliação falhou: a carga histórica gerou ${movimentosEstoque} movimentos de estoque`);
  return { operacoes: quantidadeOperacoes, compromissos: quantidadeCompromissos, transacoes: quantidadeTransacoes, movimentosConta: quantidadeMovimentos, movimentosEstoque };
}

export async function aplicarImportacaoRioNovo(
  prisma: PrismaClient,
  artefato: ArtefatoRioNovo,
  plano: PlanoImportacaoRioNovo,
  opcoes: OpcoesAplicacaoRioNovo,
): Promise<ResultadoAplicacaoRioNovo> {
  const propriedade = await prisma.propriedade.findUnique({ where: { id: opcoes.propriedadeId } });
  if (!propriedade || !propriedade.ativo) throw new Error("Propriedade da importação não encontrada ou inativa");

  let lote = await prisma.importacaoFinanceira.findUnique({ where: { sha256: plano.sha256 }, include: { linhas: { select: { indiceCache: true, destino: true } } } });
  if (lote?.status === "CONCLUIDA") return { importacaoId: lote.id, jaImportada: true, eventosAplicados: 0, eventosIgnoradosPorRetomada: plano.eventos.length };
  if (lote && !opcoes.retomar) throw new Error(`O lote ${lote.id} já existe com status ${lote.status}; use --retomar após investigar a falha`);

  if (!lote) {
    const linhaPorIndice = new Map(artefato.linhas.map((linha) => [linha.indiceCache, linha]));
    lote = await prisma.importacaoFinanceira.create({
      data: {
        arquivo: plano.arquivo,
        sha256: plano.sha256,
        fonte: plano.fonte,
        versaoFormato: artefato.versaoFormato,
        versaoMatriz: plano.versaoMatriz,
        propriedadeId: opcoes.propriedadeId,
        opcoes: json({ incluirAbertos: plano.incluirAbertos, fonteMaisRecenteConfirmada: plano.fonteMaisRecenteConfirmada }),
        resumo: json(plano.resumo),
        linhas: {
          create: plano.decisoes.map((decisao) => ({
            indiceCache: decisao.indiceCache,
            hashLinha: decisao.hashLinha,
            status: decisao.status,
            rota: decisao.rota,
            chaveEvento: decisao.chaveEvento,
            motivo: decisao.motivo,
            origem: json(linhaPorIndice.get(decisao.indiceCache)),
          })),
        },
      },
      include: { linhas: { select: { indiceCache: true, destino: true } } },
    });
  } else {
    await prisma.importacaoFinanceira.update({ where: { id: lote.id }, data: { status: "PROCESSANDO", erro: null } });
  }

  const linhasConcluidas = new Set(lote.linhas.filter((linha) => linha.destino != null).map((linha) => linha.indiceCache));
  const primeiraData = plano.eventos.map((evento) => evento.data).sort()[0] ?? artefato.cache.dataMinima ?? new Date().toISOString().slice(0, 10);
  let eventosAplicados = 0;
  let eventosIgnoradosPorRetomada = 0;
  try {
    for (const evento of plano.eventos) {
      if (evento.linhas.every((indice) => linhasConcluidas.has(indice))) {
        eventosIgnoradosPorRetomada += 1;
        continue;
      }
      await prisma.$transaction(async (db) => {
        const destino = await aplicarEvento(db, plano, evento, opcoes.propriedadeId, data(primeiraData));
        for (let posicao = 0; posicao < evento.linhas.length; posicao += 1) {
          await db.linhaImportacaoFinanceira.update({
            where: { importacaoId_indiceCache: { importacaoId: lote!.id, indiceCache: evento.linhas[posicao]! } },
            data: { status: posicao === 0 ? "IMPORTADA" : "AGRUPADA", destino: json({ chaveEvento: evento.chave, ...destino }) },
          });
        }
      }, { timeout: 30_000 });
      eventosAplicados += 1;
    }
    const reconciliacao = await reconciliarImportacao(prisma, plano);
    await prisma.importacaoFinanceira.update({ where: { id: lote.id }, data: { status: "CONCLUIDA", resumo: json({ ...plano.resumo, eventosAplicados, eventosIgnoradosPorRetomada, reconciliacao }), concluidoEm: new Date(), erro: null } });
    return { importacaoId: lote.id, jaImportada: false, eventosAplicados, eventosIgnoradosPorRetomada, reconciliacao };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await prisma.importacaoFinanceira.update({ where: { id: lote.id }, data: { status: "FALHOU", erro: mensagem.slice(0, 5000) } });
    throw erro;
  }
}

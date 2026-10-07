import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { transacaoPecuaria } from "../transacao.js";
import { RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { converterQuantidade } from "../../estoque/unidades.js";
import { prepararAplicacaoTx, criarAplicacaoTx, obterSaldo, travarOrigensAplicacoesTx } from "./aplicacoes.js";
import { prepararExameTx, registrarExameTx, travarTiposExame } from "./exames.js";
import { confirmarColetivo } from "./coletivos.js";
import type { ExecucaoEtapasInput } from "./execucao-etapas.schemas.js";

function validarConjunto(input: ExecucaoEtapasInput) {
  if (!input.itens.length || input.itens.length > 100 || new Set(input.itens.map((i) => i.animalId)).size !== input.itens.length ||
    new Set(input.itens.map((i) => i.tarefaId)).size !== input.itens.length || input.itens.some((i) => i.propriedadeId !== input.propriedadeId)) {
    throw new RebanhoError("VALIDACAO", "Selecione de 1 a 100 tarefas de animais distintos do mesmo sítio", "itens");
  }
}

async function conferirConsumos(tx: Prisma.TransactionClient, input: ExecucaoEtapasInput, quantidadesDiretas: Map<string, Prisma.Decimal>) {
  const grupos = new Map<string, { produtoId: string; partidaId: string | null; itemCompraDiretaId: string | null; unidade: string; quantidade: Prisma.Decimal }>();
  const produtos = await tx.produto.findMany({ where: { id: { in: input.itens.flatMap((i) => i.tipo === "APLICACAO" && i.produtoId ? [i.produtoId] : []) } } });
  const compras = await tx.itemOperacao.findMany({ where: { id: { in: input.itens.flatMap((i) => i.tipo === "APLICACAO" && i.itemCompraDiretaId ? [i.itemCompraDiretaId] : []) } } });
  const partidaIds = input.itens.flatMap((i) => i.tipo === "APLICACAO" && i.partidaId ? [i.partidaId] : []);
  const partidas = partidaIds.length ? await tx.partidaProduto.findMany({ where: { id: { in: partidaIds } }, select: { id: true, lotePrincipalId: true, nome: true, codigo: true, validade: true, lotePrincipal: { select: { id: true, nome: true, codigo: true, validade: true } } } }) : [];
  for (const item of input.itens) {
    if (item.tipo !== "APLICACAO" || !item.produtoId || !["BAIXA_ESTOQUE", "COMPRA_CONSUMO_DIRETO"].includes(item.origemInsumo)) continue;
    const produto = produtos.find((p) => p.id === item.produtoId);
    if (!produto) throw new RebanhoError("VALIDACAO", "Produto não encontrado", "produtoId");
    const compra = compras.find((c) => c.id === item.itemCompraDiretaId);
    const quantidade = item.origemInsumo === "COMPRA_CONSUMO_DIRETO" ? quantidadesDiretas.get(item.tarefaId) ?? new Prisma.Decimal(0) : converterQuantidade(new Prisma.Decimal(item.dose), item.unidadeDose, produto.unidade);
    const partida = partidas.find((p) => p.id === item.partidaId);
    const partidaId = item.origemInsumo === "BAIXA_ESTOQUE" ? partida?.lotePrincipalId ?? item.partidaId ?? null : null;
    const itemCompraDiretaId = item.origemInsumo === "COMPRA_CONSUMO_DIRETO" ? item.itemCompraDiretaId ?? null : null;
    const chave = `${produto.id}:${partidaId ?? ""}:${itemCompraDiretaId ?? ""}`;
    const anterior = grupos.get(chave);
    grupos.set(chave, { produtoId: produto.id, partidaId, itemCompraDiretaId, unidade: compra?.unidade ?? produto.unidade, quantidade: (anterior?.quantidade ?? new Prisma.Decimal(0)).plus(quantidade) });
  }
  const totaisProduto = new Map<string, Prisma.Decimal>();
  for (const grupo of grupos.values()) {
    if (grupo.itemCompraDiretaId) {
      const compra = compras.find((c) => c.id === grupo.itemCompraDiretaId)!;
      const usadas = await tx.aplicacaoProduto.aggregate({ where: { itemCompraDiretaId: compra.id, status: "VALIDO" }, _sum: { quantidadeCompraDireta: true } });
      if (grupo.quantidade.plus(usadas._sum.quantidadeCompraDireta ?? 0).gt(compra.quantidade)) throw new RebanhoError("VALIDACAO", "A compra direta não cobre todas as doses selecionadas", "itemCompraDiretaId");
    } else {
      totaisProduto.set(grupo.produtoId, (totaisProduto.get(grupo.produtoId) ?? new Prisma.Decimal(0)).plus(grupo.quantidade));
      if (grupo.partidaId && (await obterSaldo(tx, grupo.produtoId, input.propriedadeId, grupo.partidaId)).lt(grupo.quantidade)) throw new RebanhoError("VALIDACAO", "Saldo do lote insuficiente para o conjunto", "partidaId");
    }
  }
  for (const [produtoId, quantidade] of totaisProduto) if ((await obterSaldo(tx, produtoId, input.propriedadeId)).lt(quantidade)) throw new RebanhoError("VALIDACAO", "Saldo de estoque insuficiente para o conjunto", "dose");
  return [...grupos.values()].map((g) => {
    const alias = partidas.find(p => p.id === g.partidaId || p.lotePrincipalId === g.partidaId);
    const lote = alias?.lotePrincipal ?? alias;
    return { ...g, quantidade: g.quantidade.toString(), produtoNome: produtos.find(p => p.id === g.produtoId)?.nome ?? null, partidaNome: lote?.nome ?? lote?.codigo ?? null, partidaValidade: lote?.validade?.toISOString().slice(0,10) ?? null };
  });
}

async function prepararPreviaTx(tx: Prisma.TransactionClient, input: ExecucaoEtapasInput) {
  validarConjunto(input);
  await travarAnimais(tx, input.itens.map((i) => i.animalId));
  const tarefas = await tx.tarefaSanitaria.findMany({ where: { id: { in: input.itens.map((i) => i.tarefaId) } }, include: { execucao: true } });
  if (tarefas.length !== input.itens.length || new Set(tarefas.map((t) => `${t.etapaId}:${t.execucao.protocoloId}:${t.execucao.rodadaId ?? "legado"}`)).size !== 1) throw new RebanhoError("VALIDACAO", "Selecione tarefas da mesma etapa e rodada", "itens");
  // Desvios individuais podem usar origens ou tipos diferentes; todas as travas entram antes do laço.
  await travarOrigensAplicacoesTx(tx, input.itens.filter((i) => i.tipo === "APLICACAO"));
  await travarTiposExame(tx, input.itens.flatMap((i) => i.tipo === "EXAME" ? [i.tipoExameId] : []));
  const itens = [];
  const quantidadesDiretas = new Map<string, Prisma.Decimal>();
  for (const [linha, item] of input.itens.entries()) {
    try {
      const preparada = item.tipo === "APLICACAO" ? await prepararAplicacaoTx(tx, item, null, true) : await prepararExameTx(tx, item, null, true);
      const dados = preparada.dadosCriacao;
      if ("quantidadeCompraDireta" in dados && dados.quantidadeCompraDireta != null) quantidadesDiretas.set(item.tarefaId, new Prisma.Decimal(dados.quantidadeCompraDireta.toString()));
      itens.push({ tarefaId: item.tarefaId, animalId: item.animalId, tipo: item.tipo, ...preparada.desvioProtocoloSnapshot,
        carencia: item.tipo === "APLICACAO" ? { estadoLeite: "estadoCarenciaLeite" in dados ? dados.estadoCarenciaLeite : null,
          estadoCarne: "estadoCarenciaCarne" in dados ? dados.estadoCarenciaCarne : null, leiteHoras: item.carenciaLeiteHoras ?? null, carneHoras: item.carenciaCarneHoras ?? null } : null });
    } catch (e) { if (e instanceof RebanhoError) throw new RebanhoError(e.code, `Animal ${linha + 1}: ${e.message}`, `itens.${linha}.${e.campo ?? "tarefaId"}`); throw e; }
  }
  const consumos = await conferirConsumos(tx, input, quantidadesDiretas);
  const dados = { itens, consumos, temDesvios: itens.some((i) => i.motivoObrigatorio) };
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ ...dados, itens: [...itens].sort((a, b) => a.tarefaId.localeCompare(b.tarefaId)) })).digest("hex");
  return { ...dados, fingerprint };
}

export async function preverExecucaoEtapas(input: ExecucaoEtapasInput) { return transacaoPecuaria((tx) => prepararPreviaTx(tx, input)); }

export async function confirmarExecucaoEtapas(input: ExecucaoEtapasInput & { chave: string; fingerprint: string }, usuarioId: number | null) {
  validarConjunto(input);
  return confirmarColetivo(input, usuarioId, "ETAPA_PROTOCOLO_COLETIVA", async (tx, item, autor) => {
    if (item === input.itens[0]) {
      const previa = await prepararPreviaTx(tx, input);
      if (previa.fingerprint !== input.fingerprint) throw new RebanhoError("CONFLITO", "O planejamento ou os dados mudaram. Confira uma nova prévia", "fingerprint");
    }
    return item.tipo === "APLICACAO" ? criarAplicacaoTx(tx, item, autor) : registrarExameTx(tx, item, autor);
  });
}

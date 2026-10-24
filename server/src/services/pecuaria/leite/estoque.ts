import { confirmarMedicaoGeralSchema } from "./tanques.schemas.js";
import { conferirAnimaisOrigemGeralTx } from "./producao.js";
import { evidenciaFinalidadeLeite, exigirFinalidadeLeite } from "./finalidade.calc.js";
import { travarAnimais } from "../rebanho/regras.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { auditar, exigirPeriodoAberto } from "../../financeiro/regras.js";
import { hashConfirmacao, conferirReenvioOperacaoTx } from "../../financeiro/idempotencia.js";
import { corrigirVendaLeiteTx, criarVendaLeiteTx } from "../../financeiro/operacoes.js";
import { operacaoSchema } from "../../financeiro/schemas.js";
import { transacaoEstoque } from "../../estoque/transacao.js";
import { travarValorizacaoTx, previaRetroatividadeTx } from "../../estoque/valorizacao.js";
import { classificarEntradaLeiteTx, METODO_LEITE, planejarBaixaLeiteTx, saldosOrigensLeiteTx } from "../../estoque/leite.js";
import { repartirCustoProducaoLeite } from "../../estoque/leite.calc.js";
import { hojeFazendaDate, RebanhoError } from "../rebanho/regras.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { dataLeiteSchema } from "./schemas.js";
import { conferirCarenciaProducaoTx, conferirCarenciaOrigensVendaTx } from "./carencia-producao.js";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
type Contexto = { propriedadeId: number; usuarioId: number | null };
const autor = (id: number | null) => id != null && id > 0 ? id : null;
const uuid = z.string().uuid();
const grupoProducaoLeiteSchema = z.object({
  sessaoId: uuid, versaoEsperada: z.number().int().positive(), produtoId: uuid, chave: uuid,
  medicaoIds: z.array(uuid).min(1).max(2000),
  natureza: z.enum(["COMERCIAL", "COLOSTRO", "NAO_COMERCIAL"]),
  motivoNatureza: z.string().trim().min(5).max(500),
  motivoParcial: z.string().trim().min(5).max(500).optional(),
}).strict();
export const confirmarProducaoLeiteSchema = grupoProducaoLeiteSchema.superRefine((v, c) => { if (new Set(v.medicaoIds).size !== v.medicaoIds.length)
  c.addIssue({ code: "custom", path: ["medicaoIds"], message: "Cada medição deve aparecer uma única vez no grupo" });
}).transform(v => ({ ...v, medicaoIds: [...v.medicaoIds].sort() }));
export const confirmarSessaoProducaoLeiteSchema = z.object({
  sessaoId: uuid, versaoEsperada: z.number().int().positive(), chave: uuid,
  motivoParcial: z.string().trim().min(5).max(500).optional(),
  grupos: z.array(grupoProducaoLeiteSchema.omit({ sessaoId: true, versaoEsperada: true, motivoParcial: true })).min(1).max(2000),
}).strict().superRefine((v, c) => {
  const medicoes = v.grupos.flatMap(g => g.medicaoIds);
  if (medicoes.length > 2000 || new Set(medicoes).size !== medicoes.length)
    c.addIssue({ code: "custom", path: ["grupos"], message: "Cada medição deve pertencer a um único grupo da sessão (até 2000 medições)" });
  if (new Set([v.chave, ...v.grupos.map(g => g.chave)]).size !== v.grupos.length + 1)
    c.addIssue({ code: "custom", path: ["grupos"], message: "Use uma chave própria para cada grupo e para a confirmação" });
});
export const vendaLeiteSchema = z.object({
  chave: uuid, produtoId: uuid, quantidadeLitros: z.number().finite().positive().max(999999999.999).multipleOf(0.001),
  data: dataLeiteSchema, descricao: z.string().trim().min(2).max(240),
  parceiroId: uuid, valorTotal: z.number().finite().positive().max(999999999999.99).multipleOf(0.01),
  categoriaId: uuid.optional(), centroCustoId: uuid.optional(), financeiro: operacaoSchema.innerType().shape.financeiro,
}).strict();
export const apuracaoValorLeiteSchema = z.object({
  entradaId: uuid, chave: uuid, versaoEsperada: z.number().int().nonnegative(),
  valorTotal: z.number().finite().nonnegative().max(999999999999.99).multipleOf(0.01),
  referencia: z.string().trim().min(2).max(200), evidencia: z.string().trim().min(5).max(2000), motivo: z.string().trim().min(5).max(500),
}).strict();
export const anularEntradaLeiteSchema = z.object({ entradaId: uuid, motivo: z.string().trim().min(5).max(500) }).strict();
export const classificarEntradaLeiteSchema = z.object({ entradaId: uuid, chave: uuid, versaoEsperada: z.number().int().positive(),
  natureza: z.enum(["COMERCIAL", "COLOSTRO", "NAO_COMERCIAL"]), motivo: z.string().trim().min(5).max(500) }).strict();
export const correcaoVendaLeiteSchema = z.object({
  operacaoId: uuid, versaoEsperada: z.number().int().positive(), chave: uuid, motivo: z.string().trim().min(5).max(500),
  parceiroId: uuid, valorTotal: z.number().finite().positive().max(999999999999.99).multipleOf(0.01),
  categoriaId: uuid.nullable().optional(), centroCustoId: uuid.optional(), financeiro: operacaoSchema.innerType().shape.financeiro,
}).strict();
export const consultaVendasLeiteSchema = z.object({ produtoId: uuid.optional(), de: dataLeiteSchema.optional(), ate: dataLeiteSchema.optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1), porPagina: z.coerce.number().int().min(1).max(100).default(20) }).strict()
  .refine(v => !v.de || !v.ate || v.de <= v.ate, { message: "O início não pode superar o fim", path: ["de"] });

export function corrigirVendaLeite(input: z.infer<typeof correcaoVendaLeiteSchema>, contexto: Contexto) {
  return transacaoEstoque(tx => corrigirVendaLeiteTx(tx, input, contexto));
}

/** DTO comercial completo: a rota exige Financeiro/verValores e o sítio. */
export async function consultarVendasLeite(input: z.infer<typeof consultaVendasLeiteSchema>, contexto: Contexto) {
  return prisma.$transaction(async tx => {
    const where: Prisma.VersaoComercialVendaLeiteWhereInput = { operacao: { propriedadeId: contexto.propriedadeId,
      ...(input.de || input.ate ? { data: { ...(input.de ? { gte: new Date(`${input.de}T00:00:00Z`) } : {}), ...(input.ate ? { lte: new Date(`${input.ate}T00:00:00Z`) } : {}) } } : {}) },
      ...(input.produtoId ? { retirada: { produtoId: input.produtoId } } : {}) };
    const [total, linhas] = await Promise.all([tx.versaoComercialVendaLeite.count({ where }), tx.versaoComercialVendaLeite.findMany({ where,
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }], skip: (input.pagina - 1) * input.porPagina, take: input.porPagina,
      include: { alocacoesDemonstrativo: { where: { ativo: true }, select: { id: true } }, retirada: { include: { versoesComerciaisLeite: { select: { versao: true } } } }, operacao: { include: { itens: true, parceiro: true, transacoes: true,
        compromissos: { include: { liquidacoes: { include: { transacao: true } } } } } } } })]);
    const periodos = await tx.periodoFinanceiro.findMany({ where: { propriedadeId: contexto.propriedadeId, status: "FECHADO" }, select: { ano: true, mes: true } });
    const fechado = (data: Date) => periodos.some(p => p.ano === data.getUTCFullYear() && p.mes === data.getUTCMonth() + 1);
    return { total, pagina: input.pagina, porPagina: input.porPagina, itens: linhas.map(l => {
      const o = l.operacao;
      const recebidas = o.transacoes.filter(t => t.status === "CONFIRMADA" && t.tipo !== "REVERSAO");
      const liquidacaoAtiva = o.compromissos.some(c => c.liquidacoes.some(li => li.transacao.status === "CONFIRMADA"));
      const recebido = recebidas.reduce((s, t) => s.plus(t.valorTotal), D(0));
      const vigente = o.status === "CONFIRMADA" && l.versao === Math.max(...l.retirada.versoesComerciaisLeite.map(v => v.versao));
      const motivoBloqueio = !vigente ? "Esta versão já foi substituída; abra a venda vigente" : l.alocacoesDemonstrativo.length ? "Anule os demonstrativos ativos antes de corrigir a venda" : recebidas.length || liquidacaoAtiva ? "Faça o estorno financeiro explícito dos recebimentos antes de corrigir"
        : fechado(o.data) || fechado(l.retirada.data) || fechado(new Date()) ? "Há período financeiro fechado; regularize antes de corrigir" : null;
      return { operacaoId: o.id, numero: o.numero, retiradaId: l.retiradaId, versaoComercial: l.versao, status: o.status,
        parceiroId: o.parceiroId, parceiroNome: o.parceiro?.nome ?? null, data: o.data.toISOString().slice(0, 10), produtoId: l.retirada.produtoId,
        quantidadeLitros: l.retirada.quantidade.toString(), valorTotal: o.valorTotal.toFixed(2), valorRecebidoConfirmado: recebido.toFixed(2),
        estadoFinanceiro: o.status === "CANCELADA" ? "SUBSTITUIDA" : recebido.gt(0) ? recebido.gte(o.valorTotal) ? "RECEBIDA" : "PARCIAL" : o.compromissos.some(c => c.status !== "CANCELADO") ? "A_RECEBER" : "SEM_MOVIMENTACAO",
        podeCorrigir: motivoBloqueio == null, motivoBloqueio, categoriaId: o.itens[0]?.categoriaId ?? null,
        centroCustoId: o.itens[0]?.centroCustoId ?? o.centroCustoId, motivoCorrecao: l.motivo, corrigeOperacaoId: o.corrigeOperacaoId };
    }) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function classificarEntradaLeite(input: z.infer<typeof classificarEntradaLeiteSchema>, contexto: Contexto) {
  return transacaoEstoque(tx => operacaoIdempotenteTx(tx, { ...input, propriedadeId: contexto.propriedadeId }, contexto.usuarioId,
    "CLASSIFICAR_ENTRADA_LEITE", async () => {
      const declaracao = await classificarEntradaLeiteTx(tx, input, contexto);
      if (input.natureza === "COMERCIAL") await conferirCarenciaOrigensVendaTx(tx, [input.entradaId]);
      return declaracao;
    }));
}

export async function exigirSessaoLeiteEditavelTx(tx: Prisma.TransactionClient, sessaoId: string) {
  await tx.$queryRaw`SELECT id FROM pecuaria."SessaoOrdenha" WHERE id=${sessaoId} FOR NO KEY UPDATE`;
  if (await tx.entradaProducaoLeite.findFirst({ where: { sessaoId, status: "CONFIRMADA", medicaoGeralId: null }, select: { id: true } }))
    throw new RebanhoError("CONFLITO", "A ordenha já foi confirmada no estoque. Regularize a entrada e seus consumidores antes de alterar as medições.");
}

async function exigirProdutoLeiteTx(tx: Prisma.TransactionClient, produtoId: string) {
  const produto = await tx.produto.findFirst({ where: { id: produtoId, ativo: true } });
  if (!produto || produto.unidade !== "L" || produto.rastrearPartidas)
    throw new RebanhoError("VALIDACAO", "Selecione um produto ativo em litros sem rastreio por partida. As ordenhas preservam as origens do leite.", "produtoId");
  return produto;
}
async function conferirCronologiaTx(tx: Prisma.TransactionClient, produtoId: string, propriedadeId: number, data: Date) {
  const previa = await previaRetroatividadeTx(tx, produtoId, propriedadeId, data);
  if (!previa.permitido) throw new RebanhoError("CONFLITO", previa.motivo!);
}
function conferirReenvio(anterior: { hash: string; criadoPorId: number | null }, hash: string, contexto: Contexto) {
  if (anterior.hash !== hash || anterior.criadoPorId !== autor(contexto.usuarioId))
    throw new RebanhoError("CONFLITO", "Chave de reenvio usada com outros dados ou autor");
}

export async function confirmarProducaoLeite(input: z.infer<typeof confirmarProducaoLeiteSchema>, contexto: Contexto) {
  input = confirmarProducaoLeiteSchema.parse(input);
  return transacaoEstoque(tx => confirmarProducaoLeiteTx(tx, input, contexto));
}

async function travarChavesConfirmacaoTx(tx: Prisma.TransactionClient, chaves: string[]) {
  const unicas = [...new Set(chaves.map(chave => `leite-confirmacao:${chave}`))];
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(h) FROM (SELECT DISTINCT hashtext(k) AS h FROM unnest(${unicas}::text[]) AS k) AS chaves ORDER BY h`;
}
async function confirmarProducaoLeiteTx(tx: Prisma.TransactionClient, input: z.infer<typeof confirmarProducaoLeiteSchema>, contexto: Contexto) {
    await travarChavesConfirmacaoTx(tx, [input.chave]);
    const hash = hashConfirmacao({ ...input, propriedadeId: contexto.propriedadeId });
    const anterior = await tx.entradaProducaoLeite.findUnique({ where: { chave: input.chave }, include: { movimento: true } });
    if (anterior) { conferirReenvio(anterior, hash, contexto); return anterior; }
    const referencia = await tx.participanteProducaoLeite.findMany({ where: { dia: { propriedadeId: contexto.propriedadeId, sessoes: { some: { id: input.sessaoId } } } }, select: { animalId: true } });
    await travarAnimais(tx, referencia.map(p => p.animalId));
    const travadas = await tx.$queryRaw<{ id: string }[]>`SELECT s.id FROM pecuaria."SessaoOrdenha" s JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" WHERE s.id=${input.sessaoId} AND d."propriedadeId"=${contexto.propriedadeId} FOR NO KEY UPDATE OF s`;
    if (!travadas.length) throw new RebanhoError("NAO_ENCONTRADO", "Ordenha não encontrada neste sítio");
    const sessao = await tx.sessaoOrdenha.findUniqueOrThrow({ where: { id: input.sessaoId }, include: { dia: { include: { configuracao: true, participantes: { where: { excluidoEm: null } } } }, medicoes: { include: { participante: true } } } });
    if (sessao.versao !== input.versaoEsperada) throw new RebanhoError("CONFLITO", "A ordenha mudou desde a conferência; atualize antes de confirmar");
    if (sessao.dia.configuracao?.fonteProducao === "GERAL") throw new RebanhoError("CONFLITO", "Nesta data a produção vem dos tanques. O controle individual não gera outra entrada de estoque.");
    // A sessão permanece congelada para edição, mas admite confirmar grupos ainda livres.
    const usadas = await tx.vinculoMedicaoEntradaLeite.findMany({ where: { medicaoId: { in: input.medicaoIds }, ativo: true }, select: { medicaoId: true } });
    if (usadas.length) throw new RebanhoError("CONFLITO", "Uma medição selecionada já foi confirmada em outra origem ou produto; recarregue a folha", "medicaoIds");
    await exigirProdutoLeiteTx(tx, input.produtoId);
    await travarValorizacaoTx(tx, [input.produtoId]);
    const data = sessao.dia.dataOperacional;
    if (data > hojeFazendaDate()) throw new RebanhoError("VALIDACAO", "Não confirme produção futura");
    await exigirPeriodoAberto(tx, contexto.propriedadeId, data);
    await conferirCronologiaTx(tx, input.produtoId, contexto.propriedadeId, data);
    const legado = await tx.movimentoEstoque.count({ where: { produtoId: input.produtoId, metodoValorizacao: { not: METODO_LEITE } } });
    if (legado) throw new RebanhoError("CONFLITO", "Este produto possui movimentos de outra origem; concilie o histórico antes de confirmar produção leiteira");
    const ativas = sessao.medicoes.filter(m => m.participante.excluidoEm == null);
    const medidas = input.medicaoIds.map(id => ativas.find(m => m.id === id));
    if (medidas.some(m => !m || m.estado !== "MEDIDO" || !m.litros?.gt(0)))
      throw new RebanhoError("VALIDACAO", "Selecione somente medições inteiras positivas desta ordenha e de animais ativos na folha", "medicaoIds");
    const selecionadas = medidas.filter((m): m is NonNullable<typeof m> => m != null);
    const finalidades = await tx.finalidadeAnimal.findMany({ where: { animalId: { in: selecionadas.map(m => m.participante.animalId) } } });
    const baixas = await tx.baixaAnimal.findMany({ where: { animalId: { in: selecionadas.map(m => m.participante.animalId) }, data, estornadaEm: null } });
    for (const m of selecionadas) {
      const comprovada = exigirFinalidadeLeite(finalidades.filter(f => f.animalId === m.participante.animalId), data, baixas.filter(b => b.animalId === m.participante.animalId));
      if (evidenciaFinalidadeLeite(m.participante, data.toISOString().slice(0, 10)).estado !== "COMPROVADA" || m.participante.finalidadeId !== comprovada.finalidadeId)
        throw new RebanhoError("CONFLITO", "Finalidade histórica não comprovada na medição; concilie a folha antes de confirmar o estoque", "finalidade");
    }
    const resolvidas = ativas.filter(m => m.estado === "MEDIDO" || m.estado === "NAO_ORDENHADO").length;
    const pendentes = sessao.dia.participantes.length - resolvidas;
    if (pendentes > 0 && !input.motivoParcial) throw new RebanhoError("VALIDACAO", "Explique a confirmação parcial: as medições pendentes não entrarão no estoque", "motivoParcial");
    const litros = selecionadas.reduce((s, m) => s.plus(m.litros!), D(0));
    if (!litros.gt(0) || litros.gt("999999999.999")) throw new RebanhoError("VALIDACAO", "A ordenha precisa ter litros medidos positivos dentro da capacidade do estoque");
    const carencia = await conferirCarenciaProducaoTx(tx, { data, horario: sessao.horario, animalIds: selecionadas.map(m => m.participante.animalId) });
    if (input.natureza === "COMERCIAL" && carencia.animais.some(a => a.estado !== "SEM_RESTRICAO_REGISTRADA"))
      throw new RebanhoError("CONFLITO", "Há carência de venda ativa ou não aferível neste grupo. Separe o leite não comercial antes de confirmar.", "natureza");
    const movimento = await tx.movimentoEstoque.create({ data: { produtoId: input.produtoId, propriedadeId: contexto.propriedadeId,
      tipo: "ENTRADA", origem: "PRODUCAO", data, quantidade: litros, custoUnitario: null, valorTotal: null,
      metodoValorizacao: METODO_LEITE, criadoPorId: autor(contexto.usuarioId), observacao: `Ordenha ${sessao.nome}` } });
    const entrada = await tx.entradaProducaoLeite.create({ data: { sessaoId: sessao.id, versaoSessao: sessao.versao, movimentoId: movimento.id,
      chave: input.chave, hash, criadoPorId: autor(contexto.usuarioId), snapshot: { versao: 4, carencia, natureza: input.natureza, motivoNatureza: input.motivoNatureza,
        cobertura: { esperadas: sessao.dia.participantes.length, medidas: selecionadas.length, pendentes }, motivoParcial: input.motivoParcial ?? null,
        medicoes: selecionadas.map(m => ({ id: m.id, animalId: m.participante.animalId, finalidadeId: m.participante.finalidadeId, finalidadeSnapshot: m.participante.finalidadeSnapshot, versao: m.versao, estado: m.estado, litros: m.litros!.toString() })) },
      vinculosMedicoes: { create: selecionadas.map(m => ({ medicaoId: m.id, quantidade: m.litros!, versaoMedicao: m.versao })) },
      classificacoes: { create: { versao: 1, natureza: "NAO_INFORMADA", motivo: "Produção aguardando declaração explícita da natureza da entrada inteira", criadoPorId: autor(contexto.usuarioId) } } }, include: { movimento: true } });
    await classificarEntradaLeiteTx(tx, { entradaId: entrada.id, natureza: input.natureza, motivo: input.motivoNatureza, versaoEsperada: 1 }, contexto);
    await auditar(tx, { entidade: "EntradaProducaoLeite", entidadeId: entrada.id, acao: "CONFIRMADA", usuarioId: contexto.usuarioId, depois: entrada });
    return entrada;
}


export async function confirmarSessaoProducaoLeite(input: z.infer<typeof confirmarSessaoProducaoLeiteSchema>, contexto: Contexto) {
  input = confirmarSessaoProducaoLeiteSchema.parse(input);
  return transacaoEstoque(tx => operacaoIdempotenteTx(tx, { ...input, propriedadeId: contexto.propriedadeId }, contexto.usuarioId,
    "CONFIRMAR_SESSAO_PRODUCAO_LEITE", async () => {
      // Todos os grupos antes dos animais: o caminho individual usa esta mesma ordem.
      await travarChavesConfirmacaoTx(tx, input.grupos.map(g => g.chave));
      const referencia = await tx.participanteProducaoLeite.findMany({ where: { dia: { propriedadeId: contexto.propriedadeId, sessoes: { some: { id: input.sessaoId } } } }, select: { animalId: true } });
      await travarAnimais(tx, referencia.map(p => p.animalId));
      const travadas = await tx.$queryRaw<{ id: string }[]>`SELECT s.id FROM pecuaria."SessaoOrdenha" s JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" WHERE s.id=${input.sessaoId} AND d."propriedadeId"=${contexto.propriedadeId} FOR NO KEY UPDATE OF s`;
      if (!travadas.length) throw new RebanhoError("NAO_ENCONTRADO", "Ordenha não encontrada neste sítio");
      const sessao = await tx.sessaoOrdenha.findUniqueOrThrow({ where: { id: input.sessaoId }, include: { medicoes: { include: { participante: true, origensEstoque: { where: { ativo: true } } } } } });
      if (sessao.versao !== input.versaoEsperada) throw new RebanhoError("CONFLITO", "A ordenha mudou; atualize antes de confirmar");
      const livres = sessao.medicoes.filter(m => !m.participante.excluidoEm && m.estado === "MEDIDO" && m.litros?.gt(0) && !m.origensEstoque.length);
      const ids = input.grupos.flatMap(g => g.medicaoIds);
      if (livres.length !== ids.length || livres.some(m => !ids.includes(m.id)))
        throw new RebanhoError("VALIDACAO", "Distribua todas as medições positivas ainda livres em grupos antes de confirmar a sessão", "grupos");
      // Um único tx e locks de produto ordenados: falha em qualquer grupo desfaz todos.
      await travarValorizacaoTx(tx, [...new Set(input.grupos.map(g => g.produtoId))].sort());
      const grupos = [];
      for (const grupo of input.grupos) {
        const entrada = await confirmarProducaoLeiteTx(tx, { ...grupo, sessaoId: input.sessaoId, versaoEsperada: input.versaoEsperada, motivoParcial: input.motivoParcial }, contexto);
        grupos.push({ id: entrada.id, sessaoId: entrada.sessaoId, versaoSessao: entrada.versaoSessao, status: entrada.status, natureza: grupo.natureza, quantidadeLitros: entrada.movimento.quantidade.toString() });
      }
      return { sessaoId: input.sessaoId, grupos };
    }));
}

export async function venderLeite(input: z.infer<typeof vendaLeiteSchema>, contexto: Contexto) {
  return transacaoEstoque(tx => venderLeiteTx(tx, input, contexto));
}
export async function venderLeiteTx(tx: Prisma.TransactionClient, input: z.infer<typeof vendaLeiteSchema>, contexto: Contexto) {
    const dados = { ...operacaoSchema.parse({ chave: input.chave, tipo: "VENDA", data: input.data, descricao: input.descricao,
      parceiroId: input.parceiroId, centroCustoId: input.centroCustoId, financeiro: input.financeiro,
      itens: [{ descricao: "Leite produzido", produtoId: input.produtoId, quantidade: input.quantidadeLitros, unidade: "L", valorTotal: input.valorTotal, categoriaId: input.categoriaId }] }),
      propriedadeId: contexto.propriedadeId, usuarioId: contexto.usuarioId };
    const reenvio = await conferirReenvioOperacaoTx(tx, dados);
    if (reenvio) return reenvio;
    await exigirProdutoLeiteTx(tx, input.produtoId);
    await travarValorizacaoTx(tx, [input.produtoId]);
    if (dados.data > hojeFazendaDate()) throw new RebanhoError("VALIDACAO", "Não confirme retirada futura de leite");
    await exigirPeriodoAberto(tx, contexto.propriedadeId, dados.data);
    await conferirCronologiaTx(tx, input.produtoId, contexto.propriedadeId, dados.data);
    const plano = await planejarBaixaLeiteTx(tx, { produtoId: input.produtoId, propriedadeId: contexto.propriedadeId, data: dados.data, quantidade: input.quantidadeLitros, finalidade: "VENDA" });
    return criarVendaLeiteTx(tx, dados, plano);
}

export async function apurarValorProducaoLeite(input: z.infer<typeof apuracaoValorLeiteSchema>, contexto: Contexto) {
  return transacaoEstoque(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`leite-apuracao:${input.chave}`}))`;
    const hash = hashConfirmacao({ ...input, propriedadeId: contexto.propriedadeId });
    const anterior = await tx.apuracaoValorLeite.findUnique({ where: { chave: input.chave }, include: { apropriacoes: true } });
    if (anterior) { conferirReenvio(anterior, hash, contexto); return anterior; }
    const referencia = await tx.entradaProducaoLeite.findFirst({ where: { id: input.entradaId, status: "CONFIRMADA", movimento: { propriedadeId: contexto.propriedadeId } }, select: { movimento: { select: { produtoId: true } } } });
    if (!referencia) throw new RebanhoError("NAO_ENCONTRADO", "Produção confirmada não encontrada neste sítio");
    await travarValorizacaoTx(tx, [referencia.movimento.produtoId]);
    const bases = await saldosOrigensLeiteTx(tx, referencia.movimento.produtoId, contexto.propriedadeId);
    const origem = bases.find(b => b.entradaId === input.entradaId);
    if (!origem) throw new RebanhoError("CONFLITO", "A produção mudou desde a conferência");
    const versao = origem.entrada.apuracoes[0]?.versao ?? 0;
    if (versao !== input.versaoEsperada) throw new RebanhoError("CONFLITO", "O valor já foi apurado ou corrigido; atualize a conferência");
    await exigirPeriodoAberto(tx, contexto.propriedadeId, origem.entrada.movimento.data);
    await exigirPeriodoAberto(tx, contexto.propriedadeId, new Date());
    const consumos = origem.entrada.alocacoes.filter(a => a.movimento.status === "CONFIRMADO" && !a.movimento.reversaoDeId).sort((a, b) => a.movimento.seq - b.movimento.seq);
    for (const consumo of consumos) await exigirPeriodoAberto(tx, contexto.propriedadeId, consumo.movimento.data);
    const calculo = repartirCustoProducaoLeite({ quantidadeProduzida: origem.entrada.movimento.quantidade, valorTotal: input.valorTotal,
      consumos: consumos.map(c => ({ id: c.id, quantidade: c.quantidade })) });
    const apuracao = await tx.apuracaoValorLeite.create({ data: { entradaId: input.entradaId, versao: versao + 1, valorTotal: D(input.valorTotal),
      referencia: input.referencia, evidencia: input.evidencia, motivo: input.motivo, chave: input.chave, hash, criadoPorId: autor(contexto.usuarioId),
      apropriacoes: { create: calculo.parcelas.map(p => ({ alocacaoId: p.id, valorTotal: p.valorTotal })) } }, include: { apropriacoes: true } });
    await auditar(tx, { entidade: "ApuracaoValorLeite", entidadeId: apuracao.id, acao: versao ? "CORRIGIDA" : "APURADA", usuarioId: contexto.usuarioId, motivo: input.motivo, depois: apuracao });
    return apuracao;
  });
}

export async function anularEntradaProducaoLeite(input: z.infer<typeof anularEntradaLeiteSchema>, contexto: Contexto) {
  return transacaoEstoque(async tx => {
    const entrada = await tx.entradaProducaoLeite.findFirst({ where: { id: input.entradaId, movimento: { propriedadeId: contexto.propriedadeId } }, include: { movimento: true } });
    if (!entrada) throw new RebanhoError("NAO_ENCONTRADO", "Produção não encontrada neste sítio");
    // A anulação também atualiza EntradaProducaoLeite: seu gatilho SQL trava as
    // origens gerais. Adquire a mesma trava antes de sessão/produto para evitar inversão.
    const origem = entrada.medicaoGeralId ? await tx.medicaoGeralLeite.findUniqueOrThrow({
      where: { id: entrada.medicaoGeralId }, select: { animaisOrigem: true },
    }) : null;
    if (origem) await travarAnimais(tx, z.array(z.string().uuid()).parse(origem.animaisOrigem));
    await tx.$queryRaw`SELECT id FROM pecuaria."SessaoOrdenha" WHERE id=${entrada.sessaoId} FOR NO KEY UPDATE`;
    await travarValorizacaoTx(tx, [entrada.movimento.produtoId]);
    const atual = await tx.entradaProducaoLeite.findUniqueOrThrow({ where: { id: entrada.id }, include: { medicaoGeral: { select: { animaisOrigem: true } }, movimento: { include: { revertidoPor: true } }, alocacoes: { include: { movimento: true } } } });
    if (atual.status === "ANULADA") {
      const inverso = atual.movimento.revertidoPor;
      if (inverso?.observacao !== input.motivo || inverso.criadoPorId !== autor(contexto.usuarioId))
        throw new RebanhoError("CONFLITO", "A entrada já foi anulada com outros dados ou autor");
      return inverso;
    }
    if (origem && JSON.stringify(origem.animaisOrigem) !== JSON.stringify(atual.medicaoGeral?.animaisOrigem))
      throw new RebanhoError("CONFLITO", "Os animais de origem mudaram; recarregue antes de anular a entrada");
    if (atual.alocacoes.some(a => a.movimento.status === "CONFIRMADO" && !a.movimento.reversaoDeId))
      throw new RebanhoError("CONFLITO", "A produção tem litros consumidos ou vendidos. Regularize os consumidores antes de corrigir a ordenha");
    await exigirPeriodoAberto(tx, contexto.propriedadeId, atual.movimento.data);
    await exigirPeriodoAberto(tx, contexto.propriedadeId, new Date());
    const inverso = await tx.movimentoEstoque.create({ data: { produtoId: atual.movimento.produtoId, propriedadeId: contexto.propriedadeId,
      tipo: "SAIDA", origem: "PRODUCAO", data: atual.movimento.data, quantidade: atual.movimento.quantidade, custoUnitario: null, valorTotal: null,
      metodoValorizacao: METODO_LEITE, reversaoDeId: atual.movimentoId, observacao: input.motivo, criadoPorId: autor(contexto.usuarioId) } });
    await tx.movimentoEstoque.update({ where: { id: atual.movimentoId }, data: { status: "REVERTIDO" } });
    await tx.entradaProducaoLeite.update({ where: { id: atual.id }, data: { status: "ANULADA" } });
    await tx.vinculoMedicaoEntradaLeite.updateMany({ where: { entradaId: atual.id, ativo: true }, data: { ativo: false } });
    await auditar(tx, { entidade: "EntradaProducaoLeite", entidadeId: atual.id, acao: "ANULADA", motivo: input.motivo, usuarioId: contexto.usuarioId, antes: atual, depois: inverso });
    return inverso;
  });
}

export async function consultarEstoqueLeite(produtoId: string, contexto: Contexto, verValores: boolean) {
  await exigirProdutoLeiteTx(prisma, produtoId);
  const bases = await saldosOrigensLeiteTx(prisma, produtoId, contexto.propriedadeId);
  const quantidade = bases.reduce((q, b) => q.plus(b.quantidade), D(0));
  const movimentos = await prisma.movimentoEstoque.findMany({ where: { produtoId, propriedadeId: contexto.propriedadeId, status: { in: ["CONFIRMADO", "REVERTIDO"] } }, select: { tipo: true, quantidade: true, metodoValorizacao: true } });
  const fisico = movimentos.reduce((q, m) => q.plus(m.tipo === "SAIDA" ? m.quantidade.negated() : m.quantidade), D(0));
  const confiavel = bases.length > 0 && !fisico.lt(0) && fisico.eq(quantidade) && movimentos.every(m => m.metodoValorizacao === METODO_LEITE);
  const conhecido = bases.every(b => b.quantidade.isZero() || b.valor != null);
  const semDeclaracao = bases.some(b => b.quantidade.gt(0) && b.natureza === "NAO_INFORMADA");
  const comercialConfiavel = confiavel && !semDeclaracao;
  const litrosComerciais = bases.filter(b => b.natureza === "COMERCIAL").reduce((q, b) => q.plus(b.quantidade), D(0));
  return { produtoId, propriedadeId: contexto.propriedadeId, quantidadeLitros: confiavel ? quantidade.toString() : null,
    confiavel, motivoNaoAferivel: confiavel ? null : bases.length === 0 ? "Não há produção confirmada que comprove o saldo deste produto e sítio" : "O razão físico diverge das origens confirmadas; regularize o estoque",
    estadoValor: !verValores ? "OCULTO" : confiavel && conhecido ? "APURADO" : "PENDENTE",
    valorTotal: verValores && confiavel && conhecido ? bases.reduce((v, b) => v.plus(b.valor ?? 0), D(0)).toFixed(2) : null,
    comercial: { confiavel: comercialConfiavel, quantidadeLitros: comercialConfiavel ? litrosComerciais.toString() : null,
      motivoNaoAferivel: !confiavel ? "Saldo físico sem lastro confiável" : semDeclaracao ? "Há leite sem declaração de natureza; confirme a classificação das entradas" : null },
    origens: bases.map(b => ({ entradaId: b.entradaId, sessaoId: b.entrada.sessaoId, nomeOrdenha: b.entrada.sessao.nome, data: b.data, quantidadeLitros: b.quantidade.toString(),
      medicaoIds: (b.entrada.vinculosMedicoes ?? []).map(v => v.medicaoId),
      animaisGrupo: (b.entrada.vinculosMedicoes ?? []).map(v => ({ ...v.medicao.participante, litros: v.quantidade.toString() })),
      natureza: b.natureza, classificacaoId: b.classificacaoId, versaoClassificacao: b.entrada.classificacoes[0]?.versao ?? 0,
      estadoValor: !verValores ? "OCULTO" : b.valor == null ? "PENDENTE" : "APURADO", valorTotal: verValores ? b.valor?.toFixed(2) ?? null : null,
      versaoApuracao: b.entrada.apuracoes[0]?.versao ?? 0 })) };
}

/** Confirma a aferição inteira de um tanque; os controles individuais permanecem independentes. */
export async function confirmarProducaoGeral(input: z.infer<typeof confirmarMedicaoGeralSchema>, contexto: Contexto) {
 const dados = confirmarMedicaoGeralSchema.parse(input);
 return transacaoEstoque(tx => operacaoIdempotenteTx(tx, { ...dados, propriedadeId: contexto.propriedadeId }, contexto.usuarioId, "CONFIRMAR_PRODUCAO_GERAL", async () => {
  const where = { id: dados.medicaoId, sessao: { dia: { propriedadeId: contexto.propriedadeId } } };
  const ref = await tx.medicaoGeralLeite.findFirst({ where });
  if (!ref) throw new RebanhoError("NAO_ENCONTRADO", "Aferição não encontrada neste sítio");
  const animais = z.array(z.string().uuid()).parse(ref.animaisOrigem);
  await travarAnimais(tx, animais);
  await tx.$queryRaw`SELECT id FROM pecuaria."SessaoOrdenha" WHERE id=${ref.sessaoId} FOR NO KEY UPDATE`;
  const m = await tx.medicaoGeralLeite.findFirstOrThrow({ where, include: { tanque: true, sessao: { include: { dia: { include: { configuracao: true } } } }, entradasEstoque: { where: { status: "CONFIRMADA" } } } });
  if (m.versao !== dados.versaoEsperada || JSON.stringify(ref.animaisOrigem) !== JSON.stringify(m.animaisOrigem)) throw new RebanhoError("CONFLITO", "A aferição mudou; recarregue antes de confirmar");
  if (m.entradasEstoque.length) throw new RebanhoError("CONFLITO", "Esta aferição já gerou entrada de estoque");
  if (m.sessao.dia.configuracao.fonteProducao !== "GERAL") throw new RebanhoError("CONFLITO", "A data não está configurada para produção geral");
  if (!m.litros.gt(0)) throw new RebanhoError("VALIDACAO", "Uma aferição zero é preservada, mas não gera entrada de estoque");
  const data = m.sessao.dia.dataOperacional;
  if (data > hojeFazendaDate()) throw new RebanhoError("VALIDACAO", "Não confirme produção futura");
  const origens = await conferirAnimaisOrigemGeralTx(tx, contexto.propriedadeId, data, animais);
  const carencia = await conferirCarenciaProducaoTx(tx, { data, horario: m.sessao.horario, animalIds: animais });
  if (m.natureza === "COMERCIAL" && (!animais.length || carencia.animais.some(a => a.estado !== "SEM_RESTRICAO_REGISTRADA"))) throw new RebanhoError("CONFLITO", "Identifique os animais que compõem o tanque e confira suas carências antes da confirmação comercial. Não é necessário informar litros por animal.");
  await exigirProdutoLeiteTx(tx, dados.produtoId);
  await travarValorizacaoTx(tx, [dados.produtoId]);
  await exigirPeriodoAberto(tx, contexto.propriedadeId, data);
  await conferirCronologiaTx(tx, dados.produtoId, contexto.propriedadeId, data);
  if (await tx.movimentoEstoque.count({ where: { produtoId: dados.produtoId, metodoValorizacao: { not: METODO_LEITE } } })) throw new RebanhoError("CONFLITO", "Produto possui movimentos de outra valorização; regularize as origens antes de confirmar");
  const movimento = await tx.movimentoEstoque.create({ data: { produtoId: dados.produtoId, propriedadeId: contexto.propriedadeId, tipo: "ENTRADA", origem: "PRODUCAO", data, quantidade: m.litros, custoUnitario: null, valorTotal: null, metodoValorizacao: METODO_LEITE, criadoPorId: autor(contexto.usuarioId), observacao: `Ordenha ${m.sessao.nome} · ${m.tanque.nome}` } });
  const entrada = await tx.entradaProducaoLeite.create({ data: { sessaoId: m.sessaoId, medicaoGeralId: m.id, versaoSessao: m.sessao.versao, movimentoId: movimento.id, chave: dados.chave, hash: hashConfirmacao({ ...dados, propriedadeId: contexto.propriedadeId }), criadoPorId: autor(contexto.usuarioId), snapshot: { versao: 5, fonte: "GERAL", medicaoGeralId: m.id, versaoMedicaoGeral: m.versao, litros: m.litros.toString(), tanqueId: m.tanqueId, reguaMm: m.reguaMm?.toString() ?? null, origemLitros: m.origemLitros, animaisOrigem: origens, carencia, natureza: m.natureza, motivoNatureza: dados.motivoNatureza }, classificacoes: { create: { versao: 1, natureza: "NAO_INFORMADA", motivo: "Aferição geral aguardando declaração da natureza", criadoPorId: autor(contexto.usuarioId) } } } });
  await classificarEntradaLeiteTx(tx, { entradaId: entrada.id, natureza: z.enum(["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO"]).parse(m.natureza), motivo: dados.motivoNatureza, versaoEsperada: 1 }, contexto);
  await auditar(tx, { entidade: "EntradaProducaoLeite", entidadeId: entrada.id, acao: "CONFIRMADA", usuarioId: contexto.usuarioId, depois: entrada });
  return { id: entrada.id, quantidadeLitros: m.litros.toString() };
 }));
}

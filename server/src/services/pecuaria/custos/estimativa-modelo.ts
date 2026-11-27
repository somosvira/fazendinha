import { Prisma, type UnidadeMedida } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { coberturaSaldoTx } from "../../estoque/valorizacao.js";
import { converterQuantidade, UNIDADES } from "../../estoque/unidades.js";
import { RebanhoError } from "../rebanho/regras.js";
import { referenciasCustoSchema } from "./referencias-planejadas.js";
import { estimarPlanosProtocolos } from "./estimativa-protocolo.js";

const decimal = z.union([z.string().regex(/^\d+(?:\.\d+)?$/), z.number().finite().nonnegative()]).nullable().optional();
const referenciasPreviasSchema = z.object({ material: referenciasCustoSchema.shape.material, servico: z.object({ valorUnitario: z.union([z.string().max(32), z.number().finite().nonnegative()]).nullable().optional(), unidade: z.literal("POR_ATENDIMENTO").optional(), origem: z.string().trim().max(200).optional(), data: z.string().max(10).optional() }).strict().optional() }).strict();
export const estimativaModeloSchema = z.object({
  // Aceito apenas por compatibilidade; o escopo vem do cabeçalho da consulta.
  propriedadeId: z.number().int().positive().optional(),
  referenciasPagina: z.number().int().min(1).default(1),
  etapas: z.array(z.object({
    nome: z.string().max(120), tipo: z.enum(["APLICACAO", "TENTATIVA", "AVALIACAO", "EXAME", "RETIRADA", "MANEJO"]),
    produtoId: z.string().uuid().nullable().optional(), produtoCatalogoId: z.string().uuid().nullable().optional(),
    quantidade: decimal, unidade: z.string().max(40).nullable().optional(), referenciasCusto: referenciasPreviasSchema.optional(),
  }).strict()).max(100),
}).strict();
export type EstimativaModelo = z.infer<typeof estimativaModeloSchema>;

/** Prévia de rascunho; escopo resolvido pela requisição, sem gravação ou adoção. */
export async function estimarModeloTx(tx: Prisma.TransactionClient, input: EstimativaModelo, escopo: number | null) {
  const sitios = await tx.propriedade.findMany({ where: { ativo: true, ...(escopo == null ? {} : { id: escopo }) }, select: { id: true }, orderBy: { id: "asc" } });
  if (escopo != null && !sitios.length) throw new RebanhoError("VALIDACAO", "Sítio selecionado não está ativo ou não existe", "propriedadeId");
  const consultadaEm = new Date();
  const saldos = new Map<string, { unidade: UnidadeMedida; custo: Prisma.Decimal | null; situacao: string }>();
  const planos: Array<{ quantidade: Prisma.Decimal.Value | null; custoUnitario: Prisma.Decimal.Value | null }> = [];
  const referencias: Array<{ descricao: string; natureza: string; origem: string; data: string | null; unidade: string | null; quantidade: string | null; valorUnitario: string | null; valor: string | null; situacao: string }> = [];
  for (const etapa of input.etapas) {
    if (["APLICACAO", "TENTATIVA"].includes(etapa.tipo)) {
      let saldo = etapa.produtoId ? saldos.get(etapa.produtoId) : undefined;
      if (etapa.produtoId && !saldo) {
        const produto = await tx.produto.findUnique({ where: { id: etapa.produtoId }, select: { unidade: true } });
        if (produto) {
          let quantidade = new Prisma.Decimal(0), valor = new Prisma.Decimal(0), completa = true;
          for (const sitio of sitios) {
            const base = await coberturaSaldoTx(tx, etapa.produtoId, sitio.id, consultadaEm);
            if (!base.completa || base.fisico.lt(0)) completa = false;
            quantidade = quantidade.plus(base.quantidade); valor = valor.plus(base.valor);
          }
          saldo = { unidade: produto.unidade, custo: completa && quantidade.gt(0) ? valor.div(quantidade) : null, situacao: !sitios.length ? "ESCOPO_VAZIO" : !completa ? "COBERTURA_INSUFICIENTE" : quantidade.gt(0) ? "CONHECIDO" : "SALDO_ZERO" };
          saldos.set(etapa.produtoId, saldo);
        }
      }
      let quantidade: Prisma.Decimal | null = null;
      if (etapa.quantidade != null && new Prisma.Decimal(etapa.quantidade).gt(0) && etapa.unidade && saldo && etapa.unidade in UNIDADES) {
        try { quantidade = converterQuantidade(new Prisma.Decimal(etapa.quantidade), etapa.unidade as UnidadeMedida, saldo.unidade); } catch { /* unidade incompatível */ }
      }
      const custo = saldo?.custo ?? null;
      const situacao = !etapa.produtoId ? (etapa.produtoCatalogoId ? "CATALOGO_NAO_ADOTADO" : "PRODUTO_NAO_INFORMADO") : !saldo ? "PRODUTO_NAO_ENCONTRADO" : quantidade == null && etapa.quantidade != null && etapa.unidade ? "UNIDADE_INCOMPATIVEL" : quantidade == null ? "QUANTIDADE_PENDENTE" : saldo.situacao;
      planos.push({ quantidade, custoUnitario: custo });
      referencias.push({ descricao: etapa.nome, natureza: "MATERIAL", origem: "Saldo valorizado documentado", data: consultadaEm.toISOString(), unidade: saldo?.unidade ?? etapa.unidade ?? null, quantidade: quantidade?.toString() ?? null, valorUnitario: custo?.toString() ?? null, valor: quantidade != null && custo != null ? quantidade.mul(custo).toFixed(2) : null, situacao });
    }
    const servico = etapa.referenciasCusto?.servico;
    if (servico) {
      const completa = servico.valorUnitario != null && /^\d{1,12}(?:\.\d{1,2})?$/.test(String(servico.valorUnitario)) && !!servico.unidade && (servico.origem?.length ?? 0) >= 2 && z.string().date().safeParse(servico.data).success;
      const custo = completa ? new Prisma.Decimal(servico.valorUnitario!) : null;
      planos.push({ quantidade: 1, custoUnitario: custo });
      referencias.push({ descricao: etapa.nome, natureza: "SERVICO", origem: servico.origem || "Referência de serviço incompleta", data: servico.data || null, unidade: servico.unidade ?? null, quantidade: "1", valorUnitario: custo?.toString() ?? null, valor: custo?.toFixed(2) ?? null, situacao: completa ? "CONHECIDO" : "REFERENCIA_INCOMPLETA" });
    }
  }
  const pagina = Math.min(input.referenciasPagina, Math.max(1, Math.ceil(referencias.length / 10)));
  return { ...estimarPlanosProtocolos(planos), referencia: "Saldo valorizado documentado e serviços declarados; sem reserva ou baixa de estoque", limitacoes: ["Estimativa por animal; despesas gerais não incluídas"], escopo: { tipo: escopo == null ? "CONSOLIDADO" : "SITIO", propriedadeIds: sitios.map(s => s.id), consultadaEm: consultadaEm.toISOString() }, acoes: input.etapas.length, referencias: { itens: referencias.slice((pagina - 1) * 10, pagina * 10), total: referencias.length, pagina, porPagina: 10 } };
}
export const estimarModelo = (input: EstimativaModelo, escopo: number | null) => prisma.$transaction(tx => estimarModeloTx(tx, input, escopo), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

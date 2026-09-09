// Ferramentas do assistente alinhadas ao novo financeiro. Consultas livres usam
// o registro declarativo; saldo e estoque ficam curados por terem regras próprias.
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import type { ContextoConsulta } from "../consulta/tipos.js";
import { toolsConsulta } from "./tools-consulta.js";

export type Json = Record<string, unknown>;
type Handler = (args: Json, ctx: ContextoConsulta) => Promise<unknown>;
export interface Tool {
  spec: { type: "function"; function: { name: string; description: string; parameters: Json } };
  handler: Handler;
}

export function formatarAnimalAlerta(animal: { numero: string; nome: string | null }) {
  return animal.nome ? `#${animal.numero} ${animal.nome}` : `#${animal.numero}`;
}

const saldoContas: Tool = {
  spec: { type: "function", function: { name: "saldo_contas", description: "Saldo atual por conta e saldo geral, calculados exclusivamente pelo razão financeiro.", parameters: { type: "object", properties: {} } } },
  handler: async (_args, ctx) => {
    const contas = await prisma.contaFinanceira.findMany({
      where: { ativo: true, ...(ctx.propriedadeId ? { propriedadeId: ctx.propriedadeId } : {}) },
      include: { movimentos: { select: { direcao: true, valor: true } } },
      orderBy: { nome: "asc" },
    });
    const itens = contas.map((conta) => ({
      conta: conta.nome,
      tipo: conta.tipo,
      incluirNoSaldoGeral: conta.incluirNoSaldoGeral,
      saldo: conta.movimentos.reduce((s, m) => s.plus(m.direcao === "ENTRADA" ? m.valor : m.valor.negated()), new Prisma.Decimal(conta.saldoAbertura)).toNumber(),
    }));
    return { saldoGeral: itens.filter((i) => i.incluirNoSaldoGeral).reduce((s, i) => s + i.saldo, 0), contas: itens };
  },
};

const estoque: Tool = {
  spec: { type: "function", function: { name: "estoque", description: "Saldo físico por produto, considerando apenas movimentos confirmados.", parameters: { type: "object", properties: { produto: { type: "string" } } } } },
  handler: async (args, ctx) => {
    const termo = typeof args.produto === "string" ? args.produto.trim() : "";
    const produtos = await prisma.produto.findMany({ where: { ativo: true, ...(termo ? { nome: { contains: termo, mode: "insensitive" } } : {}) }, take: 50 });
    const itens = [];
    for (const produto of produtos) {
      const movimentos = await prisma.movimentoEstoque.findMany({ where: { produtoId: produto.id, status: "CONFIRMADO", ...(ctx.propriedadeId ? { propriedadeId: ctx.propriedadeId } : {}) }, select: { tipo: true, quantidade: true } });
      const saldo = movimentos.reduce((s, m) => m.tipo === "SAIDA" ? s.minus(m.quantidade) : s.plus(m.quantidade), new Prisma.Decimal(0));
      itens.push({ produto: produto.nome, unidade: produto.unidade, saldo: saldo.toNumber() });
    }
    return itens;
  },
};

export async function taxonomiaResumo() {
  const [grupos, centros] = await Promise.all([
    prisma.grupoCategoria.findMany({ select: { nome: true }, orderBy: { nome: "asc" } }),
    prisma.centroCusto.findMany({ select: { nome: true }, orderBy: { nome: "asc" } }),
  ]);
  return `Grupos: ${grupos.map((g) => g.nome).join("; ")}. Centros de custo: ${centros.map((c) => c.nome).join("; ")}.`;
}

const TOOLS = [...toolsConsulta, saldoContas, estoque];
const porNome = new Map(TOOLS.map((tool) => [tool.spec.function.name, tool]));
export const toolSpecs = TOOLS.map((tool) => tool.spec);

export async function dispatchTool(name: string, args: Json, ctx: ContextoConsulta = { propriedadeId: null }) {
  const tool = porNome.get(name);
  if (!tool) return { erro: `Ferramenta desconhecida: ${name}` };
  try { return await tool.handler(args ?? {}, ctx); }
  catch (erro) { return { erro: erro instanceof Error ? erro.message : String(erro) }; }
}

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { RebanhoError } from "../rebanho/regras.js";
import { linhasProducaoGeralTx } from "./producao-geral-consulta.js";
import { folhaLeiteDTO } from "./producao.js";
import { dataLeiteSchema } from "./schemas.js";

export const consultaOrdenhasPeriodoSchema = z.object({
  inicio: dataLeiteSchema, fim: dataLeiteSchema,
  propriedadeId: z.coerce.number().int().positive().max(2147483647).optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
  busca: z.string().trim().max(100).default(""),
  natureza: z.enum(["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO", "A_CLASSIFICAR"]).optional(),
  situacao: z.enum(["SEM_AFERICAO", "PENDENTE_ESTOQUE", "PARCIAL_ESTOQUE", "CONFIRMADA"]).optional(),
  posicaoId: z.string().uuid().optional(),
}).strict().refine(v => v.inicio <= v.fim && Date.parse(v.fim) - Date.parse(v.inicio) < 366 * 86400000,
  "Consulte até 366 dias, com início anterior ao fim");
export type ConsultaOrdenhasPeriodo = z.input<typeof consultaOrdenhasPeriodoSchema>;
const somar = (valores: (number | null)[]) => {
  const conhecidos = valores.filter((v): v is number => v !== null);
  return conhecidos.length ? conhecidos.reduce((s, v) => s.plus(v), new Prisma.Decimal(0)).toNumber() : null;
};
type Parcela = { medicaoGeralId: string | null; tanqueId: string | null; recipiente: string | null; natureza: string; litros: number | null; confirmada: boolean };
const porNatureza = (parcelas: Parcela[]) => [...new Set(parcelas.map(p => p.natureza))].map(natureza => ({
  natureza, litros: somar(parcelas.filter(p => p.natureza === natureza).map(p => p.litros)),
}));

/** Lista sessões existentes, sem criar folhas ao consultar ou inferir zeros para dias ausentes. */
export async function consultarOrdenhasPeriodoTx(tx: Prisma.TransactionClient, propriedadeId: number, input: ConsultaOrdenhasPeriodo) {
  const filtro = consultaOrdenhasPeriodoSchema.parse(input);
  const where = { propriedadeId, dataOperacional: { gte: new Date(filtro.inicio), lte: new Date(filtro.fim) } };
  const quantidade = await tx.medicaoLeite.count({ where: { sessao: { dia: where } } });
  if (quantidade > 50000) throw new RebanhoError("VALIDACAO", "Reduza o período: limite de 50 mil medições");
  const incluirEntrada = { movimento: { select: { produtoId: true, quantidade: true } }, classificacoes: { orderBy: { versao: "desc" as const }, take: 1 } };
  const dias = await tx.diaProducaoLeite.findMany({ where, include: {
    configuracao: { include: { ordenhas: { orderBy: { ordem: "asc" } } } },
    sessoes: { include: { entradasEstoque: { include: incluirEntrada } }, orderBy: { ordem: "asc" } },
    participantes: { include: { medicoes: { include: { origensEstoque: { where: { ativo: true }, include: { entrada: { include: incluirEntrada } } } } } } },
  }, orderBy: [{ dataOperacional: "desc" }, { id: "asc" }], take: 5001 });
  if (dias.length > 5000) throw new RebanhoError("VALIDACAO", "Reduza o período da consulta de ordenhas");
  const gerais = await linhasProducaoGeralTx(tx, dias);
  const porSessao = new Map<string, typeof gerais>();
  for (const linha of gerais) { const grupo = porSessao.get(linha.sessaoId) ?? []; grupo.push(linha); porSessao.set(linha.sessaoId, grupo); }
  const busca = filtro.busca.toLocaleLowerCase("pt-BR");
  const itens = dias.flatMap(dia => {
    const folha = folhaLeiteDTO(dia);
    return folha.sessoes.flatMap(sessao => {
      if (!sessao.id || (filtro.posicaoId && sessao.posicaoId !== filtro.posicaoId)) return [];
      const fonteProducao = dia.configuracao.fonteProducao === "GERAL" ? "GERAL" as const : "INDIVIDUAL" as const;
      let parcelas: Parcela[] = fonteProducao === "GERAL" ? (porSessao.get(sessao.id) ?? []).map(l => ({
        medicaoGeralId: l.medicaoGeralId, tanqueId: l.tanqueId, recipiente: l.recipiente,
        natureza: l.natureza, litros: l.litros, confirmada: l.confirmada,
      })) : folha.animais.flatMap(a => a.medicoes.filter(m => m.posicaoId === sessao.posicaoId).map(m => ({
        medicaoGeralId: null, tanqueId: null, recipiente: null,
        natureza: m.confirmacaoEstoque?.natureza && m.confirmacaoEstoque.natureza !== "NAO_INFORMADA" ? m.confirmacaoEstoque.natureza : "A_CLASSIFICAR",
        litros: m.litros, confirmada: m.confirmacaoEstoque !== null,
      })));
      if (filtro.natureza) parcelas = parcelas.filter(p => p.natureza === filtro.natureza);
      if (filtro.natureza && !parcelas.length) return [];
      const medidas = parcelas.filter(p => p.litros !== null), confirmadas = medidas.filter(p => p.confirmada);
      const situacao = !medidas.length ? "SEM_AFERICAO" as const : confirmadas.length === medidas.length ? "CONFIRMADA" as const
        : confirmadas.length ? "PARCIAL_ESTOQUE" as const : "PENDENTE_ESTOQUE" as const;
      if (filtro.situacao && filtro.situacao !== situacao) return [];
      if (busca && ![sessao.nome, folha.dataOperacional, ...parcelas.map(p => p.recipiente ?? "")].join(" ").toLocaleLowerCase("pt-BR").includes(busca)) return [];
      return [{ id: sessao.id, diaId: dia.id, dataOperacional: folha.dataOperacional, posicaoId: sessao.posicaoId,
        nome: sessao.nome, ordem: sessao.ordem, fonteProducao, litros: somar(parcelas.map(p => p.litros)),
        situacao, porNatureza: porNatureza(parcelas), parcelas }];
    });
  });
  const resumo = { totalLitros: somar(itens.map(i => i.litros)), sessoes: itens.length,
    semAfericao: itens.filter(i => i.situacao === "SEM_AFERICAO").length,
    pendentesEstoque: itens.filter(i => i.situacao === "PENDENTE_ESTOQUE" || i.situacao === "PARCIAL_ESTOQUE").length,
    porNatureza: porNatureza(itens.flatMap(i => i.parcelas)),
  };
  return { propriedadeId, periodo: { inicio: filtro.inicio, fim: filtro.fim },
    itens: itens.slice((filtro.pagina - 1) * filtro.porPagina, filtro.pagina * filtro.porPagina),
    total: itens.length, pagina: filtro.pagina, porPagina: filtro.porPagina, resumo };
}
export function consultarOrdenhasPeriodo(propriedadeId: number, input: ConsultaOrdenhasPeriodo) {
  return prisma.$transaction(tx => consultarOrdenhasPeriodoTx(tx, propriedadeId, input), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

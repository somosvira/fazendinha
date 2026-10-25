import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { RebanhoError } from "../rebanho/regras.js";
import { dataLeiteSchema } from "./schemas.js";

export const consultaVendasUnificadasLeiteSchema = z.object({
  propriedadeId: z.coerce.number().int().positive().max(2147483647).optional(),
  de: dataLeiteSchema.optional(), ate: dataLeiteSchema.optional(),
  parceiroId: z.string().uuid().optional(), busca: z.string().trim().max(100).optional(),
  modalidade: z.enum(["PERIODO", "AVULSA"]).optional(),
  situacao: z.enum(["ABERTA", "FECHADA", "CONFIRMADA", "CANCELADA"]).optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(v => !v.de || !v.ate || v.de <= v.ate, { message: "Fim anterior ao início", path: ["ate"] });
export type ConsultaVendasUnificadasLeite = z.input<typeof consultaVendasUnificadasLeiteSchema>;
export interface VendaUnificadaLeiteDTO {
  id: string; modalidade: "PERIODO" | "AVULSA"; comercialId: string | null; operacaoId: string | null;
  referencia: string; inicio: string; fim: string; data: string;
  parceiroId: string | null; parceiroNome: string | null; quantidadeLitros: string;
  valorTotal: string | null; situacao: string; versaoComercial: number | null;
}
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const data = (v: string) => new Date(`${v}T00:00:00Z`);
const texto = (v: Date) => v.toISOString().slice(0, 10);
const limite = 5000;
function exigirLimite(quantidade: number) {
  if (quantidade > limite) throw new RebanhoError("VALIDACAO", "Refine a consulta de vendas: limite de cinco mil registros; nenhum total foi truncado");
}
/** Lista operacional: consulta de valores é independente do acesso aos metadados. */
export async function consultarVendasUnificadasLeiteTx(tx: Prisma.TransactionClient, propriedadeId: number, input: ConsultaVendasUnificadasLeite, verValores: boolean) {
  const f = consultaVendasUnificadasLeiteSchema.parse(input);
  const numeroBuscado = f.busca && /^(?:Venda\s*#?|#)?(\d+)$/i.exec(f.busca)?.[1];
  const [periodos, versoes] = await Promise.all([
    f.modalidade === "AVULSA" ? [] : tx.operacaoComercialLeite.findMany({ where: {
      propriedadeId, ...(f.parceiroId ? { parceiroId: f.parceiroId } : {}),
      ...(f.busca ? { OR: [{ referencia: { contains: f.busca, mode: "insensitive" as const } }, { parceiro: { nome: { contains: f.busca, mode: "insensitive" as const } } }] } : {}),
      ...(f.de ? { fim: { gte: data(f.de) } } : {}), ...(f.ate ? { inicio: { lte: data(f.ate) } } : {}),
    }, select: {
      id: true, status: true, referencia: true, inicio: true, fim: true, parceiroId: true,
      parceiro: { select: { nome: true } },
      fechamentos: { orderBy: { versao: "desc" }, take: 1, select: {
        operacaoId: true, versao: true, volumeReconhecido: true,
        operacao: { select: { data: true, status: true, valorTotal: true } },
      } },
    }, orderBy: [{ inicio: "desc" }, { id: "desc" }], take: limite + 1 }),
    f.modalidade === "PERIODO" ? [] : tx.versaoComercialVendaLeite.findMany({ where: {
      operacao: { propriedadeId, fechamentoComercialLeite: null,
        ...(f.parceiroId ? { parceiroId: f.parceiroId } : {}),
        ...(f.busca ? { OR: [{ parceiro: { nome: { contains: f.busca, mode: "insensitive" as const } } }, ...(numeroBuscado && Number.isSafeInteger(Number(numeroBuscado)) ? [{ numero: Number(numeroBuscado) }] : [])] } : {}),
        ...(f.de || f.ate ? { data: { ...(f.de ? { gte: data(f.de) } : {}), ...(f.ate ? { lte: data(f.ate) } : {}) } } : {}),
      }, retirada: { retiradaOperacaoLeite: null },
    }, select: {
      id: true, operacaoId: true, versao: true,
      operacao: { select: { numero: true, data: true, status: true, parceiroId: true, parceiro: { select: { nome: true } }, valorTotal: true } },
      retirada: { select: { quantidade: true, versoesComerciaisLeite: { orderBy: { versao: "desc" }, take: 1, select: { id: true } } } },
    }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: limite + 1 }),
  ]);
  exigirLimite(periodos.length + versoes.length);
  const abertas = periodos.filter(o => o.status === "ABERTA" && !o.fechamentos.length).map(o => o.id);
  const retiradas = abertas.length ? await tx.retiradaOperacaoLeite.findMany({ where: {
    comercialId: { in: abertas }, movimento: { propriedadeId, status: "CONFIRMADO", reversaoDeId: null },
  }, select: { comercialId: true, movimento: { select: { quantidade: true } } }, take: 50001 }) : [];
  if (retiradas.length > 50000) throw new RebanhoError("VALIDACAO", "Refine a consulta: limite de 50 mil coletas; nenhum total foi truncado");
  const volumes = new Map<string, Prisma.Decimal>();
  for (const r of retiradas) volumes.set(r.comercialId, (volumes.get(r.comercialId) ?? D(0)).plus(r.movimento.quantidade));
  const porPeriodo: VendaUnificadaLeiteDTO[] = periodos.map(o => {
    const fechamento = o.fechamentos[0];
    return { id: o.id, modalidade: "PERIODO", comercialId: o.id, operacaoId: fechamento?.operacaoId ?? null,
      referencia: o.referencia, inicio: texto(o.inicio), fim: texto(o.fim), data: texto(fechamento?.operacao.data ?? o.inicio),
      parceiroId: o.parceiroId, parceiroNome: o.parceiro.nome,
      quantidadeLitros: fechamento ? fechamento.volumeReconhecido.toString() : (volumes.get(o.id) ?? D(0)).toString(),
      valorTotal: verValores && fechamento ? fechamento.operacao.valorTotal.toFixed(2) : null,
      situacao: fechamento?.operacao.status === "CANCELADA" ? "CANCELADA" : o.status,
      versaoComercial: fechamento?.versao ?? null,
    };
  });
  // O comprador pode mudar numa correção. Selecionar comprador antes da última
  // versão poderia ressuscitar a venda substituída de outro comprador.
  const avulsas: VendaUnificadaLeiteDTO[] = versoes.filter(v => v.retirada.versoesComerciaisLeite[0]?.id === v.id).map(v => ({
    id: v.id, modalidade: "AVULSA", comercialId: null, operacaoId: v.operacaoId,
    referencia: `Venda #${v.operacao.numero}`, inicio: texto(v.operacao.data), fim: texto(v.operacao.data), data: texto(v.operacao.data),
    parceiroId: v.operacao.parceiroId, parceiroNome: v.operacao.parceiro?.nome ?? null,
    quantidadeLitros: v.retirada.quantidade.toString(), valorTotal: verValores ? v.operacao.valorTotal.toFixed(2) : null,
    situacao: v.operacao.status, versaoComercial: v.versao,
  }));
  const busca = f.busca?.toLocaleLowerCase("pt-BR");
  const linhas = [...porPeriodo, ...avulsas].filter(l =>
    (!f.parceiroId || l.parceiroId === f.parceiroId) && (!f.situacao || l.situacao === f.situacao) &&
    (!busca || [l.referencia, l.parceiroNome ?? ""].join(" ").toLocaleLowerCase("pt-BR").includes(busca) || (l.modalidade === "AVULSA" && numeroBuscado && l.referencia === `Venda #${numeroBuscado}`)),
  ).sort((a, b) => b.inicio.localeCompare(a.inicio) || b.id.localeCompare(a.id));
  const vigentes = linhas.filter(l => l.situacao !== "CANCELADA");
  const resumo = { vendas: linhas.length, canceladas: linhas.length - vigentes.length,
    totalLitros: vigentes.reduce((s, l) => s.plus(l.quantidadeLitros), D(0)).toString(),
    valorTotal: verValores && vigentes.every(l => l.valorTotal !== null) ? vigentes.reduce((s, l) => s.plus(l.valorTotal!), D(0)).toFixed(2) : null,
    precoPendente: vigentes.filter(l => l.modalidade === "PERIODO" && l.operacaoId === null).length,
  };
  return { propriedadeId, itens: linhas.slice((f.pagina - 1) * f.porPagina, f.pagina * f.porPagina), total: linhas.length, pagina: f.pagina, porPagina: f.porPagina, resumo };
}
export function consultarVendasUnificadasLeite(propriedadeId: number, input: ConsultaVendasUnificadasLeite, verValores: boolean) {
  return prisma.$transaction(tx => consultarVendasUnificadasLeiteTx(tx, propriedadeId, input, verValores), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

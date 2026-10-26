import type { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";
/** Tanques são opções. Cada ordenha sem qualquer aferição conserva uma pendência. */
export async function linhasProducaoGeralTx(
  tx: Prisma.TransactionClient,
  dias: {
    id: string;
    dataOperacional: Date;
    configuracao: { fonteProducao?: string };
    sessoes: { id: string; posicaoId: string; nome: string }[];
  }[],
) {
  const gerais = dias.filter(d => d.configuracao?.fonteProducao === "GERAL");
  if (!gerais.length) return [];
  const tanques = await tx.tanqueLeite.findMany({
    where: { medicoes: { some: { sessao: { diaId: { in: gerais.map(d => d.id) } } } } },
  });
  const medicoes = await tx.medicaoGeralLeite.findMany({
    where: { sessao: { diaId: { in: gerais.map(d => d.id) } } },
    include: {
      entradasEstoque: {
        where: { status: "CONFIRMADA" },
        select: {
          id: true,
          classificacoes: { orderBy: { versao: "desc" }, take: 1, select: { natureza: true } },
        },
      },
    },
    take: 50001,
  });
  if (medicoes.length > 50000)
    throw new RebanhoError("VALIDACAO", "Reduza o período: limite de 50 mil aferições");
  const porSessao = new Map<string, typeof medicoes>();
  for (const medicao of medicoes) {
    const linhas = porSessao.get(medicao.sessaoId) ?? [];
    linhas.push(medicao);
    porSessao.set(medicao.sessaoId, linhas);
  }
  const porTanque = new Map(tanques.map(t => [t.id, t]));
  const linhas = gerais.flatMap(d => d.sessoes.flatMap(s => {
    const itens = porSessao.get(s.id) ?? [];
    // O catálogo não prova quais tanques foram usados. Sem aferição, o volume
    // da ordenha permanece desconhecido, em vez de criar zeros para cada tanque.
    const afericoes = itens.length ? itens : [null];
    return afericoes.map(m => ({
      animaisOrigem: Array.isArray(m?.animaisOrigem) ? m.animaisOrigem.filter((id): id is string => typeof id === "string") : [],
      fonte: "GERAL" as const,
      tanqueId: m?.tanqueId ?? null,
      medicaoGeralId: m?.id ?? null,
      recipiente: m?.recipiente ?? null,
      sessaoId: s.id,
      data: d.dataOperacional.toISOString().slice(0, 10),
      animalId: null,
      brinco: m ? (m.tanqueId ? porTanque.get(m.tanqueId)?.nome : null) ?? m.recipiente ?? "Recipiente da aferição" : "Ordenha sem aferição",
      nome: m ? (m.tanqueId ? porTanque.get(m.tanqueId)?.nome : null) ?? m.recipiente ?? "Recipiente da aferição" : "Ordenha sem aferição",
      finalidade: null,
      posicaoId: s.posicaoId,
      ordenha: s.nome,
      natureza: (() => {
        const naturezas = new Set(m?.entradasEstoque.map(e => e.classificacoes[0]?.natureza ?? "NAO_INFORMADA") ?? []);
        const natureza = naturezas.size === 1 ? [...naturezas][0] : naturezas.size > 1 ? "NAO_INFORMADA" : m?.natureza;
        return !natureza || natureza === "NAO_INFORMADA" ? "A_CLASSIFICAR" : natureza;
      })(),
      estado: m ? "MEDIDO" : "PENDENTE",
      litros: m?.litros.toNumber() ?? null,
      confirmada: !!m?.entradasEstoque.length,
    }));
  }));
  if (linhas.length > 50000)
    throw new RebanhoError("VALIDACAO", "Reduza o período: limite de 50 mil aferições e ordenhas");
  return linhas;
}

// Leitura das movimentações a partir dos itens (MovimentacaoAnimal), que guardam de onde cada
// animal saiu e nunca são apagados — uma movimentação desfeita continua listando seus animais e
// aparece tanto no lote de destino quanto no de origem. Escrita (movimentar/desfazer) vive em animais.ts.

import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { hojeFazendaDate, RebanhoError } from "./regras.js";
import { avaliarCategoria, type CategoriaRef } from "./categoria.calc.js";
import { carregarRegras, manualDe, SELECT_MANUAL_ABERTA } from "./categorias.js";
import { direcaoNoLote, linhasUsadasEmBaixaAtiva, resumirOrigens } from "./movimentacao.calc.js";
import type { ListarMovimentacoesInput } from "./schemas.js";

export interface MovimentacaoResumoDTO {
  id: string;
  data: string;
  /** só na vista de um lote: entrou nele ou saiu dele */
  direcao: "ENTRADA" | "SAIDA" | null;
  /** animais da movimentação (na vista de lote: os que entraram no / saíram do lote) */
  quantidade: number;
  quantidadeTotal: number;
  origens: string[];
  destino: { propriedade: { id: number; nome: string }; lote: { id: string; nome: string } | null };
  motivo: string | null;
  criadoPor: string | null;
  criadoEm: string;
  desfeitaEm: string | null;
  desfeitaMotivo: string | null;
  podeDesfazer: boolean;
}

/** Compatibilidade com o nome usado pela página do lote. */
export type MovimentacaoDoLoteDTO = MovimentacaoResumoDTO;

export interface AnimalDaMovimentacaoDTO {
  animalId: string;
  brinco: string;
  nome: string | null;
  categoria: CategoriaRef | null;
  origem: string | null;
  /** NO_DESTINO: a linha aberta pela movimentação ainda é a atual · SAIU_DO_DESTINO: moveu de novo ou saiu do rebanho · DESFEITO */
  situacao: "NO_DESTINO" | "SAIU_DO_DESTINO" | "DESFEITO";
  desfeitoEm: string | null;
}

export interface MovimentacaoDetalheDTO extends MovimentacaoResumoDTO {
  animais: AnimalDaMovimentacaoDTO[];
}

const chaveDia = (d: Date) => d.toISOString().slice(0, 10);
const rotuloLocal = (propriedade: { nome: string } | null, lote: { nome: string } | null) =>
  propriedade ? (lote ? `${lote.nome} (${propriedade.nome})` : `${propriedade.nome}, sem lote`) : null;

const INCLUDE_MOV = {
  propriedadeDestino: { select: { id: true, nome: true } },
  loteDestino: { select: { id: true, nome: true } },
  criadoPor: { select: { nome: true } },
  animais: {
    orderBy: { criadoEm: "asc" as const },
    select: {
      animalId: true, origemLoteId: true, desfeitoEm: true, localizacaoId: true,
      origemPropriedade: { select: { nome: true } },
      origemLote: { select: { nome: true } },
      localizacao: { select: { ate: true } },
    },
  },
} satisfies Prisma.MovimentacaoInclude;

type MovComItens = Prisma.MovimentacaoGetPayload<{ include: typeof INCLUDE_MOV }>;

/** Envolve o sítio: destino nele ou algum animal saindo dele. */
const noSitio = (propriedadeId: number): Prisma.MovimentacaoWhereInput => ({
  OR: [{ propriedadeDestinoId: propriedadeId }, { animais: { some: { origemPropriedadeId: propriedadeId } } }],
});

/**
 * Dá para desfazer se nada aconteceu depois: todo animal ainda não desfeito continua na linha
 * aberta pela movimentação, está ativo e essa linha não foi usada numa baixa ativa (baixa
 * estornada não bloqueia — mesma regra de `desfazerMovimentacao`).
 */
async function calcularPodeDesfazer(movs: MovComItens[]): Promise<Set<string>> {
  const ativos = movs.flatMap((m) => (m.desfeitaEm ? [] : m.animais.filter((a) => !a.desfeitoEm)));
  const animalIds = [...new Set(ativos.map((a) => a.animalId))];
  const linhas = ativos.map((a) => a.localizacaoId).filter((v): v is string => v != null);
  const [inativos, usadas] = await Promise.all([
    animalIds.length ? prisma.baixaAnimal.findMany({ where: { animalId: { in: animalIds }, estornadaEm: null }, select: { animalId: true } }) : [],
    linhas.length ? prisma.baixaAnimal.findMany({ where: { localizacaoFechadaId: { in: linhas } }, select: { localizacaoFechadaId: true, estornadaEm: true } }) : [],
  ]);
  const inativosSet = new Set(inativos.map((s) => s.animalId));
  const usadasSet = linhasUsadasEmBaixaAtiva(usadas);
  const pode = new Set<string>();
  for (const m of movs) {
    if (m.desfeitaEm) continue;
    const vivos = m.animais.filter((a) => !a.desfeitoEm);
    if (vivos.length && vivos.every((a) => a.localizacaoId && a.localizacao?.ate == null && !inativosSet.has(a.animalId) && !usadasSet.has(a.localizacaoId))) pode.add(m.id);
  }
  return pode;
}

function mapearResumo(m: MovComItens, podeDesfazer: boolean, loteId: string | null): MovimentacaoResumoDTO {
  const itens = m.animais.map((a) => ({ origemLoteId: a.origemLoteId, origemRotulo: rotuloLocal(a.origemPropriedade, a.origemLote) }));
  const vista = loteId ? direcaoNoLote(m.loteDestinoId, itens, loteId) : null;
  return {
    id: m.id,
    data: chaveDia(m.data),
    direcao: vista?.direcao ?? null,
    quantidade: vista?.quantidade ?? (itens.length || m.quantidade),
    quantidadeTotal: m.quantidade,
    origens: resumirOrigens(itens),
    destino: { propriedade: m.propriedadeDestino, lote: m.loteDestino },
    motivo: m.motivo,
    criadoPor: m.criadoPor?.nome ?? null,
    criadoEm: m.criadoEm.toISOString(),
    desfeitaEm: m.desfeitaEm ? m.desfeitaEm.toISOString() : null,
    desfeitaMotivo: m.desfeitaMotivo,
    podeDesfazer,
  };
}

/** Histórico geral (aba Lotes) — com `loteId`, vira o histórico daquele lote. */
export async function listarMovimentacoes(filtros: ListarMovimentacoesInput, escopo: number | null): Promise<{ itens: MovimentacaoResumoDTO[]; total: number }> {
  const where: Prisma.MovimentacaoWhereInput = {
    AND: [
      escopo != null ? noSitio(escopo) : {},
      filtros.propriedadeId != null ? noSitio(filtros.propriedadeId) : {},
      filtros.loteId ? { OR: [{ loteDestinoId: filtros.loteId }, { animais: { some: { origemLoteId: filtros.loteId } } }] } : {},
      // itens (MovimentacaoAnimal) nunca são apagados — inclui a movimentação mesmo desfeita
      // quando `incluirDesfeitas` (a flag abaixo cuida de excluir as desfeitas se for o caso)
      filtros.animalId ? { animais: { some: { animalId: filtros.animalId } } } : {},
      filtros.dataDe || filtros.dataAte ? { data: { ...(filtros.dataDe ? { gte: new Date(filtros.dataDe) } : {}), ...(filtros.dataAte ? { lte: new Date(filtros.dataAte) } : {}) } } : {},
      filtros.incluirDesfeitas ? {} : { desfeitaEm: null },
    ],
  };
  const [total, movs] = await Promise.all([
    prisma.movimentacao.count({ where }),
    prisma.movimentacao.findMany({
      where,
      include: INCLUDE_MOV,
      orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
    }),
  ]);
  const pode = await calcularPodeDesfazer(movs);
  return { itens: movs.map((m) => mapearResumo(m, pode.has(m.id), filtros.loteId ?? null)), total };
}

export async function listarMovimentacoesDoLote(loteId: string, escopo: number | null, pagina = 1, porPagina = 20): Promise<{ itens: MovimentacaoResumoDTO[]; total: number }> {
  const lote = await prisma.lote.findUnique({ where: { id: loteId } });
  if (!lote || (escopo != null && lote.propriedadeId !== escopo)) throw new RebanhoError("NAO_ENCONTRADO", "Lote não encontrado");
  return listarMovimentacoes({ loteId, page: pagina, pageSize: porPagina, incluirDesfeitas: true }, escopo);
}

/** Uma movimentação com os animais movidos — inclusive as já desfeitas. */
export async function buscarMovimentacao(id: string, escopo: number | null): Promise<MovimentacaoDetalheDTO> {
  const mov = await prisma.movimentacao.findFirst({
    where: { id, ...(escopo != null ? noSitio(escopo) : {}) },
    include: INCLUDE_MOV,
  });
  if (!mov) throw new RebanhoError("NAO_ENCONTRADO", "Movimentação não encontrada");

  const animais = await prisma.animal.findMany({
    where: { id: { in: mov.animais.map((a) => a.animalId) } },
    select: { id: true, brinco: true, nome: true, sexo: true, dataNascimento: true, partosAntesDaEntrada: true, categoriasManuais: SELECT_MANUAL_ABERTA },
  });
  const porId = new Map(animais.map((a) => [a.id, a]));
  const [pode, regras] = await Promise.all([calcularPodeDesfazer([mov]), carregarRegras()]);
  const hoje = hojeFazendaDate();

  return {
    ...mapearResumo(mov, pode.has(mov.id), null),
    animais: mov.animais.map((item): AnimalDaMovimentacaoDTO => {
      const a = porId.get(item.animalId)!;
      return {
        animalId: a.id,
        brinco: a.brinco,
        nome: a.nome,
        categoria: avaliarCategoria({ sexo: a.sexo, dataNascimento: a.dataNascimento, partos: a.partosAntesDaEntrada }, regras, manualDe(a.categoriasManuais), hoje).categoria,
        origem: rotuloLocal(item.origemPropriedade, item.origemLote),
        situacao: item.desfeitoEm ? "DESFEITO" : item.localizacao && item.localizacao.ate == null ? "NO_DESTINO" : "SAIU_DO_DESTINO",
        desfeitoEm: item.desfeitoEm ? item.desfeitoEm.toISOString() : null,
      };
    }).sort((x, y) => x.brinco.localeCompare(y.brinco, "pt-BR", { numeric: true })),
  };
}

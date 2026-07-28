import { Prisma, type PrismaClient } from "@prisma/client";
import {
  projetarColunasLegadas,
  type ColunaLegada,
  type IndicadorEspelho,
} from "./genetica-espelho.calc.js";

// Delegates realmente usados pelo import — mesmo espírito de `DbIatf` em import-iatf.ts:
// um Pick restrito torna o mock trivial e mantém `import-rebanho.ts` passando `prisma` direto.
export type DbGenetica = Pick<
  PrismaClient,
  | "$transaction"
  | "propriedade"
  | "reprodutor"
  | "raca"
  | "centralSemen"
  | "indicadorGenetico"
  | "valorIndicadorReprodutor"
  | "marcadorGenetico"
  | "valorMarcadorReprodutor"
  | "caseina"
  | "valorCaseinaReprodutor"
  | "tipoSemen"
  | "estoqueSemen"
  | "pedigreeReprodutor"
>;

export interface DadosGeneticaLegado {
  reprodutoresGeneticos?: { ideagriId: number; nome: string; codigo: string | null; racaSigla: string | null; centralSigla: string | null }[];
  indicadores?: { ideagriId: number; sigla: string; nome: string; unidade: string | null; direcao: string; colunaLegada: string | null; ranking: boolean }[];
  valoresIndicador?: { reprodutorIdeagriId: number; indicadorSigla: string; valor: number }[];
  marcadores?: { ideagriId: number; sigla: string; nome: string }[];
  valoresMarcador?: { reprodutorIdeagriId: number; marcadorSigla: string; resultado: string }[];
  caseinas?: { ideagriId: number; sigla: string; nome: string }[];
  valoresCaseina?: { reprodutorIdeagriId: number; caseinaSigla: string; genotipo: string }[];
  tiposSemen?: { ideagriId: number; sigla: string; nome: string }[];
  estoquesSemen?: { ideagriId: number; reprodutorIdeagriId: number; tipoSemenSigla: string | null; lote: string | null; localizacao: string | null; doses: number }[];
  pedigrees?: { reprodutorIdeagriId: number; paiNome: string | null; paiCodigo: string | null; maeNome: string | null; maeCodigo: string | null; avoMaternoNome: string | null; avoMaternoCodigo: string | null; avoPaternoNome: string | null; avoPaternoCodigo: string | null }[];
}

export interface ResultadoImportGenetica {
  reprodutores: number;
  indicadores: number;
  valores: number;
  marcadores: number;
  caseinas: number;
  tiposSemen: number;
  estoques: number;
  pedigrees: number;
}

const VAZIO: ResultadoImportGenetica = {
  reprodutores: 0,
  indicadores: 0,
  valores: 0,
  marcadores: 0,
  caseinas: 0,
  tiposSemen: 0,
  estoques: 0,
  pedigrees: 0,
};

type Tx = Parameters<Parameters<DbGenetica["$transaction"]>[0]>[0];

// Delegate de dicionário compartilhado (indicador/marcador/caséina/tipo-sêmen): as três
// funções que o upsert-por-sigla precisa. Restringe o tipo ao contrato mínimo mockável.
interface DicionarioDelegate {
  findUnique(args: {
    where: { sigla: string } | { ideagriId: number };
    select: { id: true; ideagriId: true; sigla: true };
  }): Promise<{ id: number; ideagriId: number | null; sigla: string } | null>;
  upsert(args: unknown): Promise<{ id: number }>;
}

/**
 * Upsert idempotente de um dicionário compartilhado por `ideagriId`, reconciliando com uma
 * linha de catálogo já criada pelo usuário via `sigla` (unique) — sem duplicar. Um conflito
 * entre `ideagriId` e a `sigla` de outra origem é ESTRUTURAL e aborta (nunca reatribui em
 * silêncio). Retorna o id resolvido e o `ideagriId` de origem para os mapas `sigla→id`.
 */
async function upsertDicionario(
  delegate: DicionarioDelegate,
  entidade: string,
  origemId: number,
  sigla: string,
  create: Record<string, unknown>,
  update: Record<string, unknown>,
): Promise<number> {
  const selectIdentidade = { id: true, ideagriId: true, sigla: true } as const;
  const [porSigla, porOrigem] = await Promise.all([
    delegate.findUnique({ where: { sigla }, select: selectIdentidade }),
    delegate.findUnique({ where: { ideagriId: origemId }, select: selectIdentidade }),
  ]);
  if (porSigla && porSigla.ideagriId != null && porSigla.ideagriId !== origemId) {
    throw new Error(`conflito de identidade em ${entidade}: sigla ${sigla} já pertence a IDEAGRI ${porSigla.ideagriId}`);
  }
  if (porOrigem && porOrigem.sigla !== sigla) {
    throw new Error(`conflito de identidade em ${entidade}: IDEAGRI ${origemId} já pertence à sigla ${porOrigem.sigla}, não ${sigla}`);
  }
  if (porSigla && porOrigem && porSigla.id !== porOrigem.id) {
    throw new Error(`conflito de identidade em ${entidade}: sigla ${sigla} e IDEAGRI ${origemId} apontam para registros distintos`);
  }
  // Linha do usuário sem origem ainda: carimba `ideagriId` pela PK, não cria segunda linha.
  if (porSigla && porSigla.ideagriId == null) {
    const row = await delegate.upsert({
      where: { id: porSigla.id },
      create: { ...create, ideagriId: origemId },
      update: { ...update, ideagriId: origemId },
    });
    return row.id;
  }
  const row = await delegate.upsert({
    where: { ideagriId: origemId },
    create: { ...create, ideagriId: origemId },
    update,
  });
  return row.id;
}

function reprodutorIdOuAborta(mapa: ReadonlyMap<number, number>, ideagriId: number): number {
  const id = mapa.get(ideagriId);
  if (id == null) throw new Error(`reprodutor IDEAGRI ${ideagriId} não encontrado`);
  return id;
}

function idPorSiglaOuAborta(mapa: ReadonlyMap<string, number>, entidade: string, sigla: string): number {
  const id = mapa.get(sigla);
  if (id == null) throw new Error(`${entidade} ${sigla} não encontrado`);
  return id;
}

/**
 * Importa o contrato genético/sêmen usando as identidades de origem (`ideagriId`/sigla) como
 * chaves idempotentes: rodar 2× converge. Tudo dentro de uma única `$transaction` — qualquer
 * referência quebrada (raça/central/reprodutor/sigla ausente) aborta a transação inteira.
 * Sem nenhum array = no-op retrocompatível (não abre transação).
 */
export async function importarGeneticaLegado(
  db: DbGenetica,
  dados: DadosGeneticaLegado,
): Promise<ResultadoImportGenetica> {
  const reprodutores = dados.reprodutoresGeneticos ?? [];
  const indicadores = dados.indicadores ?? [];
  const valoresIndicador = dados.valoresIndicador ?? [];
  const marcadores = dados.marcadores ?? [];
  const valoresMarcador = dados.valoresMarcador ?? [];
  const caseinas = dados.caseinas ?? [];
  const valoresCaseina = dados.valoresCaseina ?? [];
  const tiposSemen = dados.tiposSemen ?? [];
  const estoques = dados.estoquesSemen ?? [];
  const pedigrees = dados.pedigrees ?? [];

  const temBlocoGenetico =
    dados.reprodutoresGeneticos != null || dados.indicadores != null || dados.valoresIndicador != null ||
    dados.marcadores != null || dados.valoresMarcador != null || dados.caseinas != null ||
    dados.valoresCaseina != null || dados.tiposSemen != null || dados.estoquesSemen != null ||
    dados.pedigrees != null;
  if (!temBlocoGenetico) return { ...VAZIO };

  return db.$transaction(async (tx: Tx) => {
    const propriedade =
      (await tx.propriedade.findFirst({ where: { principal: true }, orderBy: { id: "asc" }, select: { id: true } }))
      ?? (await tx.propriedade.findFirst({ orderBy: { id: "asc" }, select: { id: true } }));
    if (!propriedade) throw new Error("nenhuma propriedade cadastrada");
    const propriedadeId = propriedade.id;

    // --- Reprodutores: resolve raça (por código) e central (por nome) sem inventar entidades ---
    const reprodutorIdPorIdeagri = new Map<number, number>();
    const racaIdPorSigla = new Map<string, number>();
    const centralIdPorSigla = new Map<string, number>();
    for (const rep of reprodutores) {
      let racaId: number | null = null;
      if (rep.racaSigla != null) {
        if (!racaIdPorSigla.has(rep.racaSigla)) {
          const raca = await tx.raca.findUnique({ where: { codigo: rep.racaSigla }, select: { id: true } });
          if (!raca) throw new Error(`raça ${rep.racaSigla} não encontrada`);
          racaIdPorSigla.set(rep.racaSigla, raca.id);
        }
        racaId = racaIdPorSigla.get(rep.racaSigla)!;
      }
      let centralSemenId: number | null = null;
      if (rep.centralSigla != null) {
        if (!centralIdPorSigla.has(rep.centralSigla)) {
          const centrais = await tx.centralSemen.findMany({
            where: { nome: rep.centralSigla, OR: [{ propriedadeId }, { propriedadeId: null }] },
            select: { id: true },
            orderBy: { id: "asc" },
            take: 2,
          });
          if (centrais.length === 0) throw new Error(`central de sêmen ${rep.centralSigla} não encontrada`);
          if (centrais.length > 1) throw new Error(`central de sêmen ${rep.centralSigla} ambígua`);
          centralIdPorSigla.set(rep.centralSigla, centrais[0].id);
        }
        centralSemenId = centralIdPorSigla.get(rep.centralSigla)!;
      }
      const dadosReprodutor = { nome: rep.nome, codigo: rep.codigo, racaId, centralSemenId, propriedadeId };
      const row = await tx.reprodutor.upsert({
        where: { ideagriId: rep.ideagriId },
        create: { ideagriId: rep.ideagriId, ...dadosReprodutor },
        update: dadosReprodutor,
      });
      reprodutorIdPorIdeagri.set(rep.ideagriId, row.id);
    }

    // --- Dicionários compartilhados: upsert por ideagriId reconciliando por sigla ---
    const indicadorIdPorSigla = new Map<string, number>();
    for (const ind of indicadores) {
      const colunaLegada = ind.colunaLegada;
      const dadosInd = {
        sigla: ind.sigla, nome: ind.nome, unidade: ind.unidade,
        direcao: ind.direcao, colunaLegada, ranking: ind.ranking,
      };
      const id = await upsertDicionario(
        tx.indicadorGenetico as unknown as DicionarioDelegate,
        "indicador", ind.ideagriId, ind.sigla, dadosInd, dadosInd,
      );
      indicadorIdPorSigla.set(ind.sigla, id);
    }

    const marcadorIdPorSigla = new Map<string, number>();
    for (const marc of marcadores) {
      const dadosMarc = { sigla: marc.sigla, nome: marc.nome };
      const id = await upsertDicionario(
        tx.marcadorGenetico as unknown as DicionarioDelegate,
        "marcador", marc.ideagriId, marc.sigla, dadosMarc, dadosMarc,
      );
      marcadorIdPorSigla.set(marc.sigla, id);
    }

    const caseinaIdPorSigla = new Map<string, number>();
    for (const cas of caseinas) {
      const dadosCas = { sigla: cas.sigla, nome: cas.nome };
      const id = await upsertDicionario(
        tx.caseina as unknown as DicionarioDelegate,
        "caseína", cas.ideagriId, cas.sigla, dadosCas, dadosCas,
      );
      caseinaIdPorSigla.set(cas.sigla, id);
    }

    const tipoSemenIdPorSigla = new Map<string, number>();
    for (const tipo of tiposSemen) {
      const dadosTipo = { sigla: tipo.sigla, nome: tipo.nome };
      const id = await upsertDicionario(
        tx.tipoSemen as unknown as DicionarioDelegate,
        "tipo de sêmen", tipo.ideagriId, tipo.sigla, dadosTipo, dadosTipo,
      );
      tipoSemenIdPorSigla.set(tipo.sigla, id);
    }

    // --- Valores N:N por chave composta [reprodutor, dicionário] (upsert, não createMany cego) ---
    // Agrupa os valores de indicador por reprodutor para projetar as colunas legadas de uma vez.
    const valoresIndPorReprodutor = new Map<number, { indicadorId: number; valor: number }[]>();
    for (const v of valoresIndicador) {
      const reprodutorId = reprodutorIdOuAborta(reprodutorIdPorIdeagri, v.reprodutorIdeagriId);
      const indicadorId = idPorSiglaOuAborta(indicadorIdPorSigla, "indicador", v.indicadorSigla);
      await tx.valorIndicadorReprodutor.upsert({
        where: { reprodutorId_indicadorId: { reprodutorId, indicadorId } },
        create: { reprodutorId, indicadorId, valor: new Prisma.Decimal(v.valor) },
        update: { valor: new Prisma.Decimal(v.valor) },
      });
      const arr = valoresIndPorReprodutor.get(reprodutorId);
      if (arr) arr.push({ indicadorId, valor: v.valor });
      else valoresIndPorReprodutor.set(reprodutorId, [{ indicadorId, valor: v.valor }]);
    }

    // Um bloco explicitamente presente (inclusive `[]`) é a fotografia autoritativa da fonte:
    // inclui no espelho todos os reprodutores importados para limpar valores legados obsoletos.
    // Bloco ausente mantém no-op retrocompatível e não toca nas colunas.
    if (dados.valoresIndicador != null) {
      for (const reprodutorId of reprodutorIdPorIdeagri.values()) {
        if (!valoresIndPorReprodutor.has(reprodutorId)) valoresIndPorReprodutor.set(reprodutorId, []);
      }
    }

    // Espelho legado: consulta o catálogo inteiro (inclusive indicadores criados pelo usuário ou
    // importados antes), limpa TODAS as colunas gerenciadas e reprojeta as presentes. Colunas sem
    // `colunaLegada` ficam intocadas.
    const catalogoEspelho = await tx.indicadorGenetico.findMany({
      select: { id: true, colunaLegada: true },
    });
    const catalogoEspelhoPorId = new Map(
      catalogoEspelho.map((ind) => [ind.id, ind as IndicadorEspelho]),
    );
    const colunasGerenciadas = Object.fromEntries(
      catalogoEspelho
        .map((ind) => ind.colunaLegada)
        .filter((c): c is ColunaLegada => c != null)
        .map((c) => [c, null]),
    ) as Partial<Record<ColunaLegada, null>>;
    for (const [reprodutorId, valores] of valoresIndPorReprodutor) {
      const colunas = { ...colunasGerenciadas, ...projetarColunasLegadas(valores, catalogoEspelhoPorId) };
      if (Object.keys(colunas).length > 0) {
        await tx.reprodutor.update({ where: { id: reprodutorId }, data: colunas });
      }
    }

    for (const v of valoresMarcador) {
      const reprodutorId = reprodutorIdOuAborta(reprodutorIdPorIdeagri, v.reprodutorIdeagriId);
      const marcadorId = idPorSiglaOuAborta(marcadorIdPorSigla, "marcador", v.marcadorSigla);
      await tx.valorMarcadorReprodutor.upsert({
        where: { reprodutorId_marcadorId: { reprodutorId, marcadorId } },
        create: { reprodutorId, marcadorId, resultado: v.resultado },
        update: { resultado: v.resultado },
      });
    }

    for (const v of valoresCaseina) {
      const reprodutorId = reprodutorIdOuAborta(reprodutorIdPorIdeagri, v.reprodutorIdeagriId);
      const caseinaId = idPorSiglaOuAborta(caseinaIdPorSigla, "caseína", v.caseinaSigla);
      await tx.valorCaseinaReprodutor.upsert({
        where: { reprodutorId_caseinaId: { reprodutorId, caseinaId } },
        create: { reprodutorId, caseinaId, genotipo: v.genotipo },
        update: { genotipo: v.genotipo },
      });
    }

    // --- Estoque de sêmen: upsert por ideagriId, resolvendo reprodutor + tipo por sigla ---
    for (const est of estoques) {
      const reprodutorId = reprodutorIdOuAborta(reprodutorIdPorIdeagri, est.reprodutorIdeagriId);
      const tipoSemenId = est.tipoSemenSigla == null
        ? null
        : idPorSiglaOuAborta(tipoSemenIdPorSigla, "tipo de sêmen", est.tipoSemenSigla);
      const dadosEstoque = {
        reprodutorId, tipoSemenId, lote: est.lote,
        localizacao: est.localizacao, dosesDisponiveis: est.doses, propriedadeId,
      };
      await tx.estoqueSemen.upsert({
        where: { ideagriId: est.ideagriId },
        create: { ideagriId: est.ideagriId, ...dadosEstoque },
        update: dadosEstoque,
      });
    }

    // --- Pedigree: 1:1 por reprodutor (chave de origem) ---
    for (const ped of pedigrees) {
      const reprodutorId = reprodutorIdOuAborta(reprodutorIdPorIdeagri, ped.reprodutorIdeagriId);
      const dadosPed = {
        paiNome: ped.paiNome, paiCodigo: ped.paiCodigo,
        maeNome: ped.maeNome, maeCodigo: ped.maeCodigo,
        avoMaternoNome: ped.avoMaternoNome, avoMaternoCodigo: ped.avoMaternoCodigo,
        avoPaternoNome: ped.avoPaternoNome, avoPaternoCodigo: ped.avoPaternoCodigo,
      };
      await tx.pedigreeReprodutor.upsert({
        where: { reprodutorId },
        create: { reprodutorId, ...dadosPed },
        update: dadosPed,
      });
    }

    return {
      reprodutores: reprodutores.length,
      indicadores: indicadores.length,
      valores: valoresIndicador.length,
      marcadores: marcadores.length,
      caseinas: caseinas.length,
      tiposSemen: tiposSemen.length,
      estoques: estoques.length,
      pedigrees: pedigrees.length,
    };
  }, { maxWait: 20_000, timeout: 120_000 });
}

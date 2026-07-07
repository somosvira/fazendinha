// Parâmetros de manejo do rebanho — leitura centralizada.
//
// O modelo ParametroManejo é key/value. Este serviço:
//   1. lê tudo em cache com TTL curto (invalidado em write);
//   2. expõe helpers tipados para os consumidores (indicadores, insights);
//   3. expõe API de upsert/reset que preserva referência Embrapa.
//
// Fallback: se a linha não existir no banco (dev com DB novo, testes), o
// serviço devolve o default Embrapa do PARAMETRO_DEFAULTS abaixo — mantendo
// o comportamento idêntico ao hardcoded anterior.

import { prisma } from "../../db.js";
import type { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Chaves tipadas (fonte da verdade)
// ─────────────────────────────────────────────────────────────────────────────

export type ChaveParametro =
  // Reprodução — constantes de manejo
  | "PEV_DIAS"
  | "GESTACAO_DIAS"
  | "SECAGEM_ANTEC"
  // Manejo específico da fazenda
  | "DESMAME_MODO"
  | "DESMAME_DIAS"
  | "DESMAME_PESO_KG"
  | "PESO_UA_REF_KG"
  // Pesos de referência por categoria (UA)
  | "PESO_REF_VACA" | "PESO_REF_TOURO" | "PESO_REF_NOVILHA"
  | "PESO_REF_BEZERRA" | "PESO_REF_BEZERRO"
  | "PESO_REF_CABRA" | "PESO_REF_BODE" | "PESO_REF_CABRITA" | "PESO_REF_CABRITO"
  // Produção mínima por categoria + janelas prime
  | "PROD_META_VACA" | "PROD_META_CABRA"
  | "PRIME_BOVINO_MIN" | "PRIME_BOVINO_MAX"
  | "PRIME_CAPRINO_MIN" | "PRIME_CAPRINO_MAX"
  // 24 metas Embrapa
  | "META_VL" | "META_DL" | "META_PERS" | "META_PVO" | "META_PL" | "META_PS_DRY"
  | "META_IP" | "META_PS" | "META_PRENH" | "META_PR1S" | "META_TG" | "META_IPP"
  | "META_NAT" | "META_AB" | "META_PDIP" | "META_PLVA"
  | "META_LOT" | "META_PT" | "META_PMO" | "META_LC" | "META_DESC"
  | "META_MORT_AD" | "META_MORT_BEZ" | "META_CCS";

export type CategoriaParametro = "MANEJO" | "PRODUCAO" | "REPRODUCAO" | "GESTAO" | "SANITARIO";
export type DirecaoMeta = "maior_melhor" | "menor_melhor";

// DTO de saída — snapshot serializável (Decimal virou number).
export interface ParametroDTO {
  chave: ChaveParametro;
  categoria: CategoriaParametro;
  descricao: string;
  unidade: string | null;
  valorNumero: number | null;
  valorNumeroAceitavel: number | null;
  valorTexto: string | null;
  modo: string | null;
  direcao: DirecaoMeta | null;
  referenciaNumero: number | null;
  referenciaNumeroAceitavel: number | null;
  ordem: number;
  // true quando o valor efetivo veio do banco; false quando caiu no default.
  temOverride: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults Embrapa (espelham o seed da migration). Ficam aqui pra:
//   1. fallback quando o banco ainda não tem a linha;
//   2. serem exportados pros consumidores em testes.
// ─────────────────────────────────────────────────────────────────────────────

interface Default {
  categoria: CategoriaParametro;
  descricao: string;
  unidade: string | null;
  valor: number | null;
  aceitavel: number | null;
  modo: string | null;
  direcao: DirecaoMeta | null;
  ordem: number;
}

const D = (
  categoria: CategoriaParametro,
  descricao: string,
  unidade: string | null,
  valor: number | null,
  ordem: number,
  extra: Partial<Pick<Default, "aceitavel" | "modo" | "direcao">> = {}
): Default => ({
  categoria, descricao, unidade, valor, ordem,
  aceitavel: extra.aceitavel ?? null,
  modo: extra.modo ?? null,
  direcao: extra.direcao ?? null,
});

export const PARAMETRO_DEFAULTS: Record<ChaveParametro, Default> = {
  PEV_DIAS:          D("REPRODUCAO", "Período de espera voluntária (PEV) pós-parto", "dias",  60, 40),
  GESTACAO_DIAS:     D("REPRODUCAO", "Duração da gestação",                          "dias", 283, 41),
  SECAGEM_ANTEC:     D("REPRODUCAO", "Antecedência da secagem antes do parto",       "dias",  60, 42),

  DESMAME_MODO:      D("MANEJO",    "Como decidir a hora do desmame",       null,    null, 1, { modo: "DIAS" }),
  DESMAME_DIAS:      D("MANEJO",    "Idade de desmame (por dias)",          "dias",   120, 2),
  DESMAME_PESO_KG:   D("MANEJO",    "Peso de desmame (por peso)",           "kg",     180, 3),
  PESO_UA_REF_KG:    D("MANEJO",    "Peso vivo de 1 UA",                    "kg",     450, 4),

  PESO_REF_VACA:     D("MANEJO",    "Peso referência VACA",                 "kg",     500, 10),
  PESO_REF_TOURO:    D("MANEJO",    "Peso referência TOURO",                "kg",     800, 11),
  PESO_REF_NOVILHA:  D("MANEJO",    "Peso referência NOVILHA",              "kg",     280, 12),
  PESO_REF_BEZERRA:  D("MANEJO",    "Peso referência BEZERRA",              "kg",     120, 13),
  PESO_REF_BEZERRO:  D("MANEJO",    "Peso referência BEZERRO",              "kg",     120, 14),
  PESO_REF_CABRA:    D("MANEJO",    "Peso referência CABRA",                "kg",      55, 15),
  PESO_REF_BODE:     D("MANEJO",    "Peso referência BODE",                 "kg",      75, 16),
  PESO_REF_CABRITA:  D("MANEJO",    "Peso referência CABRITA",              "kg",      25, 17),
  PESO_REF_CABRITO:  D("MANEJO",    "Peso referência CABRITO",              "kg",      25, 18),

  PROD_META_VACA:    D("PRODUCAO",  "Meta de produção — VACA",              "L/vaca/dia",  28, 20),
  PROD_META_CABRA:   D("PRODUCAO",  "Meta de produção — CABRA",             "L/cabra/dia",  4, 21),

  PRIME_BOVINO_MIN:  D("PRODUCAO",  "Idade mín. do PRIME (bovino)",         "anos",    3, 30),
  PRIME_BOVINO_MAX:  D("PRODUCAO",  "Idade máx. do PRIME (bovino)",         "anos",    7, 31),
  PRIME_CAPRINO_MIN: D("PRODUCAO",  "Idade mín. do PRIME (caprino)",        "anos",    2, 32),
  PRIME_CAPRINO_MAX: D("PRODUCAO",  "Idade máx. do PRIME (caprino)",        "anos",    5, 33),

  META_VL:      D("PRODUCAO",  "% Vacas em Lactação",                    "%",              83, 50, { aceitavel:   75, direcao: "maior_melhor" }),
  META_DL:      D("PRODUCAO",  "Duração da Lactação",                    "dias",          305, 51, { aceitavel:  270, direcao: "maior_melhor" }),
  META_PERS:    D("PRODUCAO",  "Persistência da Lactação",               "%",              90, 52, { aceitavel:   80, direcao: "maior_melhor" }),
  META_PVO:     D("PRODUCAO",  "Produção por Vaca Ordenhada",            "L/vaca/dia",     18, 53, { aceitavel:   10, direcao: "maior_melhor" }),
  META_PL:      D("PRODUCAO",  "Produção por Lactação",                  "kg/lactação", 5500, 54, { aceitavel: 3000, direcao: "maior_melhor" }),
  META_PS_DRY:  D("PRODUCAO",  "Período Seco",                           "dias",           60, 55, { aceitavel:   70, direcao: "menor_melhor" }),
  META_IP:      D("REPRODUCAO","Intervalo de Partos",                    "dias",          395, 60, { aceitavel:  425, direcao: "menor_melhor" }),
  META_PS:      D("REPRODUCAO","Período de Serviço",                     "dias",          120, 61, { aceitavel:  150, direcao: "menor_melhor" }),
  META_PRENH:   D("REPRODUCAO","% Prenhez do Rebanho",                   "%",              60, 62, { aceitavel:   45, direcao: "maior_melhor" }),
  META_PR1S:    D("REPRODUCAO","% Prenhez ao 1º Serviço",                "%",              50, 63, { aceitavel:   40, direcao: "maior_melhor" }),
  META_TG:      D("REPRODUCAO","Taxa de Gestação",                       "%",              40, 64, { aceitavel:   30, direcao: "maior_melhor" }),
  META_IPP:     D("REPRODUCAO","Idade ao 1º Parto",                      "meses",          26, 65, { aceitavel:   30, direcao: "menor_melhor" }),
  META_NAT:     D("REPRODUCAO","Taxa de Natalidade",                     "%",              80, 66, { aceitavel:   70, direcao: "maior_melhor" }),
  META_AB:      D("REPRODUCAO","Taxa de Abortos e Natimortos",           "%",               5, 67, { aceitavel:    8, direcao: "menor_melhor" }),
  META_PDIP:    D("PRODUCAO",  "PDIP — Produção por dia de IEP",         "kg/dia",         14, 70, { aceitavel:   10, direcao: "maior_melhor" }),
  META_PLVA:    D("PRODUCAO",  "PLVA — Produção por Vaca/Ano",           "kg/vaca/ano",  5000, 71, { aceitavel: 2500, direcao: "maior_melhor" }),
  META_LOT:     D("GESTAO",    "Taxa de Lotação",                        "UA/ha",         3.0, 80, { aceitavel:  1.5, direcao: "maior_melhor" }),
  META_PT:      D("GESTAO",    "Produtividade da Terra",                 "L/ha/ano",     5000, 81, { aceitavel: 1500, direcao: "maior_melhor" }),
  META_PMO:     D("GESTAO",    "Produtividade da Mão de Obra",           "L/func/dia",    250, 82, { aceitavel:  150, direcao: "maior_melhor" }),
  META_LC:      D("GESTAO",    "Relação Leite / Concentrado",            "L/kg",          2.0, 83, { aceitavel:  1.5, direcao: "maior_melhor" }),
  META_DESC:    D("GESTAO",    "Taxa de Descarte",                       "%/ano",          22, 84, { aceitavel:   30, direcao: "menor_melhor" }),
  META_MORT_AD: D("SANITARIO", "Mortalidade de Adultos",                 "%/ano",           2, 90, { aceitavel:    4, direcao: "menor_melhor" }),
  META_MORT_BEZ:D("SANITARIO", "Mortalidade de Bezerros (até 1 ano)",    "%/ano",           8, 91, { aceitavel:   12, direcao: "menor_melhor" }),
  META_CCS:     D("SANITARIO", "CCS — Contagem de Células Somáticas",    "mil/mL",        200, 92, { aceitavel:  400, direcao: "menor_melhor" }),
};

export const CHAVES_PARAMETRO = Object.keys(PARAMETRO_DEFAULTS) as ChaveParametro[];

// ─────────────────────────────────────────────────────────────────────────────
// Cache in-memory (TTL curto; invalidado nos writes)
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000;
let cache: { data: Map<ChaveParametro, ParametroDTO>; expiraEm: number } | null = null;

const toNum = (v: Prisma.Decimal | null | undefined): number | null =>
  v == null ? null : Number(v);

function fromDefault(chave: ChaveParametro): ParametroDTO {
  const d = PARAMETRO_DEFAULTS[chave];
  return {
    chave,
    categoria: d.categoria,
    descricao: d.descricao,
    unidade: d.unidade,
    valorNumero: d.valor,
    valorNumeroAceitavel: d.aceitavel,
    valorTexto: null,
    modo: d.modo,
    direcao: d.direcao,
    referenciaNumero: d.valor,
    referenciaNumeroAceitavel: d.aceitavel,
    ordem: d.ordem,
    temOverride: false,
  };
}

async function carregar(): Promise<Map<ChaveParametro, ParametroDTO>> {
  const linhas = await prisma.parametroManejo.findMany();
  const map = new Map<ChaveParametro, ParametroDTO>();
  // Começa com todos os defaults, depois sobrescreve com o que veio do banco.
  for (const chave of CHAVES_PARAMETRO) map.set(chave, fromDefault(chave));
  for (const l of linhas) {
    const chave = l.chave as ChaveParametro;
    if (!(chave in PARAMETRO_DEFAULTS)) continue; // ignora chaves desconhecidas
    map.set(chave, {
      chave,
      categoria: l.categoria as CategoriaParametro,
      descricao: l.descricao,
      unidade: l.unidade,
      valorNumero: toNum(l.valorNumero),
      valorNumeroAceitavel: toNum(l.valorNumeroAceitavel),
      valorTexto: l.valorTexto,
      modo: l.modo,
      direcao: (l.direcao as DirecaoMeta | null) ?? null,
      referenciaNumero: toNum(l.referenciaNumero),
      referenciaNumeroAceitavel: toNum(l.referenciaNumeroAceitavel),
      ordem: l.ordem,
      temOverride: true,
    });
  }
  return map;
}

async function obterCache(): Promise<Map<ChaveParametro, ParametroDTO>> {
  const agora = Date.now();
  if (cache && cache.expiraEm > agora) return cache.data;
  const data = await carregar();
  cache = { data, expiraEm: agora + CACHE_TTL_MS };
  return data;
}

function invalidar() {
  cache = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

export async function getParametros(): Promise<ParametroDTO[]> {
  const map = await obterCache();
  return [...map.values()].sort((a, b) => a.ordem - b.ordem);
}

export async function getParametro(chave: ChaveParametro): Promise<ParametroDTO> {
  const map = await obterCache();
  return map.get(chave) ?? fromDefault(chave);
}

// Helpers convenientes pros consumidores. Usam o cache internamente; se o
// consumidor chamar N vezes em sequência, só faz 1 hit no banco por TTL.

export async function getNumero(chave: ChaveParametro): Promise<number | null> {
  return (await getParametro(chave)).valorNumero;
}

export async function getMeta(chave: ChaveParametro): Promise<{
  ideal: number; aceitavel: number; direcao: DirecaoMeta;
} | null> {
  const p = await getParametro(chave);
  if (p.valorNumero == null || p.valorNumeroAceitavel == null || !p.direcao) return null;
  return { ideal: p.valorNumero, aceitavel: p.valorNumeroAceitavel, direcao: p.direcao };
}

// Update em batch. Cada item pode trazer só os campos que quer mudar. A
// referência Embrapa NUNCA muda por essa API — é preservada.
export interface ParametroPatch {
  chave: ChaveParametro;
  valorNumero?: number | null;
  valorNumeroAceitavel?: number | null;
  valorTexto?: string | null;
  modo?: string | null;
}

export async function salvarParametros(patches: ParametroPatch[]): Promise<ParametroDTO[]> {
  await prisma.$transaction(
    patches.map((p) => {
      const d = PARAMETRO_DEFAULTS[p.chave];
      if (!d) throw new Error(`Chave desconhecida: ${p.chave}`);
      const update: Prisma.ParametroManejoUpdateInput = {};
      if (p.valorNumero !== undefined) update.valorNumero = p.valorNumero as Prisma.Decimal | null;
      if (p.valorNumeroAceitavel !== undefined) update.valorNumeroAceitavel = p.valorNumeroAceitavel as Prisma.Decimal | null;
      if (p.valorTexto !== undefined) update.valorTexto = p.valorTexto;
      if (p.modo !== undefined) update.modo = p.modo;
      return prisma.parametroManejo.upsert({
        where: { chave: p.chave },
        update,
        create: {
          chave: p.chave,
          categoria: d.categoria,
          descricao: d.descricao,
          unidade: d.unidade,
          valorNumero: (p.valorNumero ?? d.valor) as Prisma.Decimal | null,
          valorNumeroAceitavel: (p.valorNumeroAceitavel ?? d.aceitavel) as Prisma.Decimal | null,
          valorTexto: p.valorTexto ?? null,
          modo: p.modo ?? d.modo,
          direcao: d.direcao,
          referenciaNumero: d.valor as Prisma.Decimal | null,
          referenciaNumeroAceitavel: d.aceitavel as Prisma.Decimal | null,
          ordem: d.ordem,
        },
      });
    })
  );
  invalidar();
  return getParametros();
}

// Volta a chave pro default Embrapa (deleta o override).
export async function resetParametro(chave: ChaveParametro): Promise<ParametroDTO> {
  await prisma.parametroManejo.delete({ where: { chave } }).catch(() => {});
  invalidar();
  return getParametro(chave);
}

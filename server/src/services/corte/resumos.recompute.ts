/* Engine de recomputo do ResumoLote — espelha rebanho/*.recompute.ts.
 *
 * Núcleo PURO (calcularResumo) sem DB, testável; wrapper (recomputarResumo)
 * carrega do Prisma, chama o núcleo e faz upsert do read-model.
 *
 * A unidade é o LOTE: peso médio é o KPI central, GMD é a inclinação dele.
 * "Hoje" é ancorado em 2026-05-28 (mesmo pin do app) — diasSemPesar e janelas
 * de vacina/vermífugo são calculados contra essa âncora.
 *
 * Referencial técnico — Embrapa Gado de Corte (Indicadores de desempenho na
 * pecuária de corte): 1 UA = 450 kg PV; rendimento de carcaça 52%; @ = 15 kg.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";

/** Âncora "hoje" do app (mesmo pin do DateRangePicker / mock). */
export const HOJE_ANCORA = "2026-05-28";

const MS = 86_400_000;
const D = Prisma.Decimal;

/** Diferença em dias (b − a), ambos ISO YYYY-MM-DD. */
const diffDias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / MS);

/** 1 UA = 450 kg de peso vivo. */
export const KG_POR_UA = 450;
/** Rendimento de carcaça típico Nelore engorda pasto. */
export const RENDIMENTO_CARCACA = 0.52;
/** Conversão kg carcaça → arroba. */
export const KG_POR_ARROBA = 15;

/** Peso de abate alvo padrão por fase, quando não há alvo explícito (kg vivo). */
export function pesoAlvoPadrao(fase: string): number | null {
  // Só faz sentido falar em alvo de venda em terminação (boi/novilho/descarte).
  return fase === "TERMINACAO" ? 540 : null;
}

const iso = (d: Date | string | null | undefined): string | null => {
  if (d == null) return null;
  return typeof d === "string" ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);
};

export interface PesagemInput {
  data: string; // YYYY-MM-DD
  pesoMedio: number; // kg/cabeça
  numCabecas: number;
}

export interface ManejoInput {
  tipo: string;
  data: string; // YYYY-MM-DD
  proximaDose?: string | null; // YYYY-MM-DD
}

export interface LoteInput {
  fase: string;
  numCabecas: number;
  numCabecasEntrada: number;
  dataFormacao: string; // YYYY-MM-DD
}

export interface ResumoCalculado {
  pesoMedio: number | null;
  pesoMedioEntrada: number | null;
  gmd: number | null;
  gmdAcumulado: number | null;
  ultimaPesagem: string | null;
  diasSemPesar: number | null;
  ua: number | null;
  mortalidadeAcumulada: number | null;
  arrobasEstimadas: number | null;
  pesoAlvoVenda: number | null;
  diasParaAlvo: number | null;
  proximaVacina: string | null;
  proximoVermifugo: string | null;
  ultimoManejo: string | null;
}

/** Rótulo curto por tipo de manejo (para o texto de ultimoManejo). */
const ROTULO_MANEJO: Record<string, string> = {
  VACINA_AFTOSA: "vacinação aftosa",
  VACINA_BRUCELOSE_B19: "vacinação brucelose B19",
  VACINA_CLOSTRIDIOSE: "vacinação clostridiose",
  VACINA_RAIVA: "vacinação raiva",
  VACINA_CARBUNCULO: "vacinação carbúnculo",
  VACINA_LEPTOSPIROSE: "vacinação leptospirose",
  VACINA_IBR_BVD: "vacinação IBR-BVD",
  VERMIFUGACAO_5811: "vermifugação 5-8-11",
  VERMIFUGACAO_ESTRATEGICA: "vermifugação estratégica",
  CONTROLE_CARRAPATO: "controle de carrapato",
  CONTROLE_MOSCA: "controle de mosca",
  CONTROLE_BERNE: "controle de berne",
  MARCACAO: "marcação",
  DESCORNA: "descorna",
  CASTRACAO: "castração",
  BRINCO_ELETRONICO: "identificação eletrônica",
};

const num = (d: Prisma.Decimal) => Number(d.toFixed(3));

/**
 * Núcleo PURO — recebe pesagens (qualquer ordem), o lote e os manejos, devolve
 * os campos computados do ResumoLote. Sem nenhum acesso a DB; usa Prisma.Decimal
 * para a matemática de precisão financeira mas devolve Number no DTO.
 */
export function calcularResumo(args: {
  pesagens: PesagemInput[];
  lote: LoteInput;
  manejos?: ManejoInput[];
  hoje?: string;
}): ResumoCalculado {
  const hoje = args.hoje ?? HOJE_ANCORA;
  const manejos = args.manejos ?? [];
  const { lote } = args;
  const pesagens = args.pesagens.slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));

  const base: ResumoCalculado = {
    pesoMedio: null,
    pesoMedioEntrada: null,
    gmd: null,
    gmdAcumulado: null,
    ultimaPesagem: null,
    diasSemPesar: null,
    ua: null,
    mortalidadeAcumulada: null,
    arrobasEstimadas: null,
    pesoAlvoVenda: pesoAlvoPadrao(lote.fase),
    diasParaAlvo: null,
    proximaVacina: null,
    proximoVermifugo: null,
    ultimoManejo: null,
  };

  // Último manejo (mais recente <= hoje) — texto curto "YYYY-MM-DD · rótulo".
  const passados = manejos
    .filter((m) => Date.parse(m.data) <= Date.parse(hoje))
    .sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
  if (passados[0]) {
    const m = passados[0];
    base.ultimoManejo = `${m.data} · ${ROTULO_MANEJO[m.tipo] ?? m.tipo.toLowerCase()}`;
  }

  // Mortalidade acumulada não depende de pesagens.
  if (lote.numCabecasEntrada > 0) {
    const mort = new D(lote.numCabecasEntrada - lote.numCabecas)
      .div(lote.numCabecasEntrada)
      .mul(100);
    base.mortalidadeAcumulada = Number(mort.toFixed(2));
  }

  // Janelas de sanidade — próxima dose futura mais próxima por família.
  base.proximaVacina = proximaJanela(manejos, hoje, (t) => t.startsWith("VACINA"));
  base.proximoVermifugo = proximaJanela(manejos, hoje, (t) => t.startsWith("VERMIFUGACAO"));

  if (pesagens.length === 0) return base;

  const ultima = pesagens[pesagens.length - 1];
  const pesoMedio = new D(ultima.pesoMedio);
  base.pesoMedio = num(pesoMedio);
  base.ultimaPesagem = ultima.data;
  base.diasSemPesar = Math.max(0, diffDias(ultima.data, hoje));
  base.pesoMedioEntrada = num(new D(pesagens[0].pesoMedio));

  // UA = pesoMedio × numCabecas ÷ 450.
  base.ua = Number(pesoMedio.mul(lote.numCabecas).div(KG_POR_UA).toFixed(2));

  // Arrobas estimadas/cabeça = pesoMedio × 0,52 ÷ 15.
  base.arrobasEstimadas = Number(
    pesoMedio.mul(RENDIMENTO_CARCACA).div(KG_POR_ARROBA).toFixed(2)
  );

  // GMD (últimas duas pesagens): Δpeso/Δdias, guard div0.
  if (pesagens.length >= 2) {
    const penult = pesagens[pesagens.length - 2];
    const dDias = diffDias(penult.data, ultima.data);
    if (dDias > 0) {
      const gmd = new D(ultima.pesoMedio).minus(penult.pesoMedio).div(dDias);
      base.gmd = num(gmd);
    }
  }

  // GMD acumulado: última pesagem vs peso de entrada ÷ dias desde dataFormacao.
  const dDiasAcum = diffDias(lote.dataFormacao, ultima.data);
  if (dDiasAcum > 0) {
    const gmdAc = new D(ultima.pesoMedio).minus(pesagens[0].pesoMedio).div(dDiasAcum);
    base.gmdAcumulado = num(gmdAc);
  }

  // Dias para o alvo de venda — só quando há alvo e GMD positivo.
  if (base.pesoAlvoVenda != null && base.gmd != null && base.gmd > 0) {
    const falta = new D(base.pesoAlvoVenda).minus(pesoMedio);
    base.diasParaAlvo = Math.max(0, Math.round(Number(falta.div(base.gmd))));
  }

  return base;
}

/** Próxima dose futura mais próxima (>= hoje) entre os manejos que casam `filtro`. */
function proximaJanela(
  manejos: ManejoInput[],
  hoje: string,
  filtro: (tipo: string) => boolean
): string | null {
  const futuras = manejos
    .filter((m) => filtro(m.tipo) && m.proximaDose && Date.parse(m.proximaDose) >= Date.parse(hoje))
    .map((m) => m.proximaDose!)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return futuras[0] ?? null;
}

/**
 * Wrapper com DB — carrega pesagens/lote/manejos do Prisma, chama o núcleo puro
 * e faz upsert do ResumoLote. Idempotente.
 */
export async function recomputarResumo(loteId: number): Promise<void> {
  const lote = await prisma.loteCorte.findUnique({ where: { id: loteId } });
  if (!lote) return;

  const [pesagens, manejos] = await Promise.all([
    prisma.pesagemLote.findMany({ where: { loteId }, orderBy: { data: "asc" } }),
    prisma.manejoSanitario.findMany({ where: { loteId } }),
  ]);

  const calc = calcularResumo({
    pesagens: pesagens.map((p) => ({
      data: iso(p.data)!,
      pesoMedio: Number(p.pesoMedio),
      numCabecas: p.numCabecas,
    })),
    lote: {
      fase: lote.fase,
      numCabecas: lote.numCabecas,
      numCabecasEntrada: lote.numCabecasEntrada,
      dataFormacao: iso(lote.dataFormacao)!,
    },
    manejos: manejos.map((m) => ({
      tipo: m.tipo,
      data: iso(m.data)!,
      proximaDose: iso(m.proximaDose),
    })),
  });

  const data = {
    pesoMedio: calc.pesoMedio,
    pesoMedioEntrada: calc.pesoMedioEntrada,
    gmd: calc.gmd,
    gmdAcumulado: calc.gmdAcumulado,
    ultimaPesagem: calc.ultimaPesagem ? new Date(calc.ultimaPesagem) : null,
    diasSemPesar: calc.diasSemPesar,
    ua: calc.ua,
    mortalidadeAcumulada: calc.mortalidadeAcumulada,
    arrobasEstimadas: calc.arrobasEstimadas,
    pesoAlvoVenda: calc.pesoAlvoVenda,
    diasParaAlvo: calc.diasParaAlvo,
    proximaVacina: calc.proximaVacina,
    proximoVermifugo: calc.proximoVermifugo,
    ultimoManejo: calc.ultimoManejo,
  };

  await prisma.resumoLote.upsert({
    where: { loteId },
    update: data,
    create: { loteId, ...data },
  });
}

/* Dashboard do Corte — agora lê do Prisma (lotes ATIVO + resumos + piquetes).
 *
 * Mantém EXATAMENTE a forma DashboardCorte que o client espera (k / dominios /
 * alertas); só troca a fonte (mock → DB). KPIs derivam do read-model ResumoLote
 * computado por resumos.recompute.ts.
 */
import { prisma } from "../../db.js";

// Preços-referência da arroba (Cepea/B3). Constantes sensatas — Onda 1 não
// pluga cotação ao vivo ainda.
const PRECO_ARROBA_SPOT = 245;
const PRECO_ARROBA_SET = 252;

// Limiares de alerta.
const PESO_PRONTO_KG = 480;
const GMD_BAIXO = 0.35;
const DIAS_SEM_PESAR_MAX = 60;
const MORTALIDADE_ALTA = 8;

export async function buildCorteDashboard(propriedadeId?: number | null) {
  const escopo = propriedadeId != null ? { propriedadeId } : {}; // escopo do sítio
  const [ativos, piquetes] = await Promise.all([
    prisma.loteCorte.findMany({ where: { estado: "ATIVO", ...escopo }, include: { resumo: true } }),
    prisma.piquete.findMany({ where: escopo, select: { estado: true } }),
  ]);

  const pesoMedioDe = (l: any) => (l.resumo?.pesoMedio != null ? Number(l.resumo.pesoMedio) : 0);
  const gmdDe = (l: any) => (l.resumo?.gmd != null ? Number(l.resumo.gmd) : 0);
  const diasSemPesarDe = (l: any) => l.resumo?.diasSemPesar ?? 0;

  const totalCabecas = ativos.reduce((a, l) => a + l.numCabecas, 0);

  const uaTotal = ativos.reduce((a, l) => a + (pesoMedioDe(l) * l.numCabecas) / 450, 0);
  const arrobasEstoque = ativos.reduce((a, l) => a + (pesoMedioDe(l) * 0.52 * l.numCabecas) / 15, 0);

  const prontos = ativos.filter((l) => pesoMedioDe(l) >= PESO_PRONTO_KG);
  const arrobasProntas = prontos.reduce((a, l) => a + (pesoMedioDe(l) * 0.52 * l.numCabecas) / 15, 0);
  const prontosN = prontos.length;

  const lotesComGmd = ativos.filter((l) => gmdDe(l) > 0);
  const gmdMedio = lotesComGmd.length
    ? lotesComGmd.reduce((a, l) => a + gmdDe(l), 0) / lotesComGmd.length
    : 0;

  const gmdBaixoN = ativos.filter((l) => gmdDe(l) > 0 && gmdDe(l) < GMD_BAIXO).length;
  const pesagemVencidaN = ativos.filter((l) => diasSemPesarDe(l) > DIAS_SEM_PESAR_MAX).length;
  const mortAltaN = ativos.filter(
    (l) => l.numCabecasEntrada > 0 && ((l.numCabecasEntrada - l.numCabecas) / l.numCabecasEntrada) * 100 >= MORTALIDADE_ALTA
  ).length;

  // Próxima aftosa — menor proximaVacina futura entre os resumos (texto curto).
  const proximaVacina = ativos
    .map((l) => l.resumo?.proximaVacina)
    .filter((v): v is string => !!v)
    .sort()[0];

  const ocupados = piquetes.filter((p) => p.estado === "OCUPADO").length;
  const descanso = piquetes.filter((p) => p.estado === "DESCANSO").length;

  return {
    k: {
      totalCabecas,
      totalAtivos: ativos.length,
      uaTotal: round1(uaTotal),
      arrobasEstoque: round1(arrobasEstoque),
      arrobasProntas: round1(arrobasProntas),
      precoArrobaSpot: PRECO_ARROBA_SPOT,
      precoArrobaSet: PRECO_ARROBA_SET,
      valorEstoque: Math.round(arrobasEstoque * PRECO_ARROBA_SPOT),
      gmdMedio: round2(gmdMedio),
    },
    dominios: [
      {
        tab: "cor-pesagem",
        titulo: "Pesagem & ganho",
        linhas: [
          `${ativos.length} lotes ativos · ${totalCabecas} cabeças`,
          `GMD médio ${round2(gmdMedio)} kg/dia`,
          `${gmdBaixoN} lotes com GMD < 0,35 kg/dia`,
        ],
      },
      {
        tab: "cor-sanidade",
        titulo: "Sanidade",
        linhas: [proximaVacina ? `Próxima vacina: ${proximaVacina}` : "Sem vacina agendada"],
      },
      {
        tab: "cor-comercial",
        titulo: "Comercial",
        linhas: [
          `${prontosN} lotes prontos pra abate (${round1(arrobasProntas)} @)`,
          `@ spot R$ ${PRECO_ARROBA_SPOT} · B3 set R$ ${PRECO_ARROBA_SET}`,
        ],
      },
      {
        tab: "cor-pasto",
        titulo: "Pasto & piquetes",
        linhas: [`${ocupados} piquetes ocupados`, `${descanso} em descanso`],
      },
    ],
    alertas: [
      { label: "Lotes prontos pra abate", n: prontosN, tab: "cor-comercial" },
      { label: "GMD abaixo do esperado", n: gmdBaixoN, tom: "up", tab: "cor-pesagem" },
      { label: "Pesagem vencida (> 60d)", n: pesagemVencidaN, tom: "bad", tab: "cor-pesagem" },
      { label: "Mortalidade ≥ 8%", n: mortAltaN, tom: "up", tab: "cor-sanidade" },
    ],
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

import { lotes, resumos, piquetes } from "./mock.js";

const PRECO_ARROBA_SPOT = 317;
const PRECO_ARROBA_SET = 347;

export function buildCorteDashboard() {
  const ativos = lotes.filter((l) => l.estado === "ATIVO");
  const totalCabecas = ativos.reduce((a, l) => a + l.numCabecas, 0);
  const uaTotal = ativos.reduce((a, l) => {
    const r = resumos.find((x) => x.loteId === l.id);
    return a + ((r?.pesoMedio ?? 0) * l.numCabecas) / 450;
  }, 0);
  const arrobasEstoque = ativos.reduce((a, l) => {
    const r = resumos.find((x) => x.loteId === l.id);
    return a + ((r?.pesoMedio ?? 0) * 0.52 * l.numCabecas) / 15;
  }, 0);
  const arrobasProntas = ativos.filter((l) => {
    const r = resumos.find((x) => x.loteId === l.id);
    return (r?.pesoMedio ?? 0) >= 480;
  }).reduce((a, l) => {
    const r = resumos.find((x) => x.loteId === l.id);
    return a + ((r?.pesoMedio ?? 0) * 0.52 * l.numCabecas) / 15;
  }, 0);
  const lotesComGmd = resumos.filter((r) => (r.gmd ?? 0) > 0);
  const gmdMedio = lotesComGmd.length
    ? lotesComGmd.reduce((a, r) => a + (r.gmd ?? 0), 0) / lotesComGmd.length
    : 0;
  const prontosN = ativos.filter((l) => {
    const r = resumos.find((x) => x.loteId === l.id);
    return (r?.pesoMedio ?? 0) >= 480;
  }).length;
  const gmdBaixoN = resumos.filter((r) => (r.gmd ?? 0) > 0 && (r.gmd ?? 0) < 0.35).length;
  const pesagemVencidaN = resumos.filter((r) => (r.diasSemPesar ?? 0) > 60).length;
  const mortAltaN = ativos.filter((l) => ((l.numCabecasEntrada - l.numCabecas) / l.numCabecasEntrada) * 100 >= 8).length;

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
      { tab: "cor-pesagem", titulo: "Pesagem & ganho", linhas: [
        `${ativos.length} lotes ativos · ${totalCabecas} cabeças`,
        `GMD médio ${round2(gmdMedio)} kg/dia`,
        `${gmdBaixoN} lotes com GMD < 0,35 kg/dia`,
      ]},
      { tab: "cor-sanidade", titulo: "Sanidade", linhas: [
        `Próxima aftosa: nov/2026 (etapa 2)`,
      ]},
      { tab: "cor-comercial", titulo: "Comercial", linhas: [
        `${prontosN} lotes prontos pra abate (${round1(arrobasProntas)} @)`,
        `@ spot R$ ${PRECO_ARROBA_SPOT} · B3 set R$ ${PRECO_ARROBA_SET}`,
      ]},
      { tab: "cor-pasto", titulo: "Pasto & piquetes", linhas: [
        `${piquetes.filter((p) => p.estado === "OCUPADO").length} piquetes ocupados`,
        `${piquetes.filter((p) => p.estado === "DESCANSO").length} em descanso`,
      ]},
    ],
    alertas: [
      { label: "Lotes prontos pra abate", n: prontosN, tab: "cor-comercial" },
      { label: "GMD abaixo do esperado", n: gmdBaixoN, tom: "up", tab: "cor-pesagem" },
      { label: "Pesagem vencida (> 60d)", n: pesagemVencidaN, tom: "bad", tab: "cor-pesagem" },
      { label: "Mortalidade ≥ 8%", n: mortAltaN, tom: "up", tab: "cor-sanidade" },
    ],
  };
}

function round1(n: number) { return Math.round(n * 10) / 10; }
function round2(n: number) { return Math.round(n * 100) / 100; }

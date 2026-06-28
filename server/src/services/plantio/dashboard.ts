import { talhoes, resumos, eventos } from "./mock.js";

const HOJE = new Date("2026-05-28");

export function buildPlantioDashboard() {
  const ativos = talhoes.filter((t) => t.estado === "ATIVO");
  const areaTotal = talhoes.reduce((a, t) => a + t.areaHa, 0);
  const sacasEsperadas = talhoes.reduce((a, t) => {
    const r = resumos.find((x) => x.talhaoId === t.id);
    return a + (r?.produtividadeEsperada ?? 0) * t.areaHa;
  }, 0);
  const jaColhidas = eventos
    .filter((e) => e.dominio === "colheita" && e.data >= "2026-05-01")
    .reduce((a, e) => {
      const m = e.impacto?.match(/(\d+(?:[\.,]\d+)?)\s*sc/);
      return a + (m ? Number(m[1].replace(",", ".")) : 0);
    }, 0);
  const emProducao = ativos.filter((t) => (resumos.find((x) => x.talhaoId === t.id)?.produtividadeEsperada ?? 0) > 0);
  const prodMedia = emProducao.length
    ? emProducao.reduce((a, t) => a + (resumos.find((x) => x.talhaoId === t.id)?.produtividadeEsperada ?? 0), 0) / emProducao.length
    : 0;
  const variedades = new Set(talhoes.map((t) => t.variedade)).size;
  const alertaFito = resumos.filter((r) => (r.ferrugem ?? 0) >= 5 || (r.broca ?? 0) >= 3).length;
  const fases = resumos.map((r) => r.fase);
  const fasePred = fases.sort((a, b) =>
    fases.filter((x) => x === b).length - fases.filter((x) => x === a).length,
  )[0];

  const fitAlerta = resumos.filter((r) => (r.ferrugem ?? 0) >= 5).length;
  const colherJa = resumos.filter((r) => (r.maturacaoCereja ?? 0) >= 60 && r.fase !== "COLHEITA").length;
  const semFoliar = resumos.filter((r) => {
    if (!r.ultimaAnaliseFoliar) return true;
    const dias = (HOJE.getTime() - new Date(r.ultimaAnaliseFoliar).getTime()) / 86_400_000;
    return dias > 120;
  }).length;
  const semSolo = resumos.filter((r) => {
    if (!r.ultimaAnaliseSolo) return true;
    const dias = (HOJE.getTime() - new Date(r.ultimaAnaliseSolo).getTime()) / 86_400_000;
    return dias > 365;
  }).length;

  return {
    k: {
      areaTotal: Math.round(areaTotal * 10) / 10,
      talhoesAtivos: ativos.length,
      sacasEsperadas: Math.round(sacasEsperadas),
      sacasJaColhidas: Math.round(jaColhidas),
      produtividadeMedia: Math.round(prodMedia * 10) / 10,
      variedades,
      alertaFito,
      fase: fasePred,
    },
    dominios: [
      { tab: "pla-fenologia", titulo: "Fenologia da safra", linhas: [
        `${resumos.filter((r) => r.fase === "MATURACAO_CEREJA").length} talhões em maturação cereja`,
        `${resumos.filter((r) => r.fase === "COLHEITA").length} talhões em colheita ativa`,
        `${resumos.filter((r) => r.fase === "REPOUSO").length} talhões em repouso / formação`,
      ]},
      { tab: "pla-fitossanidade", titulo: "Fitossanidade", linhas: [
        `${fitAlerta} talhões com ferrugem ≥ 5%`,
        `${resumos.filter((r) => (r.broca ?? 0) >= 3).length} talhões com broca ≥ 3%`,
      ]},
      { tab: "pla-nutricao", titulo: "Nutrição / solo", linhas: [
        `${semFoliar} talhões com foliar vencida`,
        `${semSolo} talhões com solo vencido (> 1 ano)`,
      ]},
      { tab: "pla-colheita", titulo: "Colheita 2026", linhas: [
        `${colherJa} talhões prontos pra entrar (cereja ≥ 60%)`,
        `${Math.round(jaColhidas)} sc beneficiadas até hoje`,
      ]},
    ],
    alertas: [
      { label: "Ferrugem ≥ 5%", n: fitAlerta, tom: fitAlerta > 0 ? "up" : undefined, tab: "pla-fitossanidade" },
      { label: "Broca ≥ 3%", n: resumos.filter((r) => (r.broca ?? 0) >= 3).length, tom: "up", tab: "pla-fitossanidade" },
      { label: "Foliar vencida", n: semFoliar, tom: "bad", tab: "pla-nutricao" },
      { label: "Solo vencido", n: semSolo, tom: "bad", tab: "pla-nutricao" },
    ],
  };
}

export interface ResumoAgg { statusReprodutivo: string; del: number | null; producaoMediaDia: number | null; ccs: number | null; ccsTendencia: string | null; iepProjetado: number | null; diasGestacao: number | null; previsaoSecagem: string | null; }
export interface AnimalAgg { categoria: string; resumo: ResumoAgg | null; }
export interface DashboardDTO {
  kpis: { rebanhoAtivo: number; emLactacao: number; secas: number; producaoMedia: number | null; gestantes: number; prenhez: number };
  dominios: { tab: "reproducao" | "sanidade" | "nutricao" | "animal"; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tab: "reproducao" | "sanidade" | "nutricao" | "animal"; tom: "bad" | "ok" }[];
}
const VAZIA_ATRASADA_DEL = 90;

export function agregarDashboard(animais: AnimalAgg[], hoje: string): DashboardDTO {
  const rs = animais.map((a) => a.resumo).filter((r): r is ResumoAgg => r != null);
  const n = animais.length;
  const emLactacao = rs.filter((r) => r.del != null).length;
  const vacas = animais.filter((a) => a.categoria === "VACA").length;
  const secas = animais.filter((a) => a.categoria === "VACA" && (a.resumo?.del == null)).length;
  const gestantes = rs.filter((r) => r.statusReprodutivo === "PRENHE").length;
  const vazias = rs.filter((r) => r.statusReprodutivo === "VAZIA").length;
  const servidas = rs.filter((r) => r.statusReprodutivo === "INSEMINADA").length;
  const prods = rs.map((r) => r.producaoMediaDia).filter((x): x is number => x != null);
  const producaoMedia = prods.length ? Math.round(prods.reduce((a, b) => a + b, 0) / prods.length) : null;
  const ieps = rs.map((r) => r.iepProjetado).filter((x): x is number => x != null);
  const iepMedio = ieps.length ? Math.round(ieps.reduce((a, b) => a + b, 0) / ieps.length) : null;
  const ccss = rs.map((r) => r.ccs).filter((x): x is number => x != null);
  const ccsMedio = ccss.length ? Math.round(ccss.reduce((a, b) => a + b, 0) / ccss.length) : null;
  const ccsAlto = rs.filter((r) => (r.ccs ?? 0) >= 400).length;
  const prenhez = n ? Math.round((gestantes / n) * 100) : 0;

  const secagensAtrasadas = rs.filter((r) => r.statusReprodutivo === "PRENHE" && r.previsaoSecagem && Date.parse(r.previsaoSecagem) < Date.parse(hoje)).length;
  const vaziasAtrasadas = rs.filter((r) => r.statusReprodutivo === "VAZIA" && (r.del ?? 0) > VAZIA_ATRASADA_DEL).length;
  const partosPrevistos = rs.filter((r) => r.statusReprodutivo === "PRENHE" && (r.diasGestacao ?? 0) >= 253).length;

  return {
    kpis: { rebanhoAtivo: n, emLactacao, secas, producaoMedia, gestantes, prenhez },
    dominios: [
      { tab: "reproducao", titulo: "Reprodução", linhas: [`${gestantes} gestantes · ${servidas} servidas`, `${vazias} vazias`, iepMedio ? `IEP médio ${iepMedio}d` : "IEP —"] },
      { tab: "sanidade", titulo: "Sanidade", linhas: [ccsMedio ? `CCS médio ${ccsMedio} mil` : "CCS —", `${ccsAlto} com CCS ≥ 400 mil`] },
      { tab: "nutricao", titulo: "Nutrição", linhas: [producaoMedia ? `Produção média ${producaoMedia} L/d` : "—"] },
      { tab: "animal", titulo: "Animal", linhas: [`${n} ativos · ${emLactacao} em lactação`, `${secas} secas · ${vacas} vacas`] },
    ],
    alertas: [
      { label: "Secagens atrasadas", n: secagensAtrasadas, tab: "reproducao", tom: secagensAtrasadas ? "bad" : "ok" },
      { label: "Vazias atrasadas (PEV)", n: vaziasAtrasadas, tab: "reproducao", tom: vaziasAtrasadas ? "bad" : "ok" },
      { label: "CCS alto", n: ccsAlto, tab: "sanidade", tom: ccsAlto ? "bad" : "ok" },
      { label: "Partos previstos ≤30d", n: partosPrevistos, tab: "reproducao", tom: "ok" },
    ],
  };
}

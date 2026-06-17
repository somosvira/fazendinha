import { describe, it, expect } from "vitest";
import { agregarDashboard } from "./dashboard.agg.js";
const a = (categoria: string, resumo: any) => ({ categoria, resumo });
const HOJE = "2026-06-16";
const herd = [
  a("VACA", { statusReprodutivo: "PRENHE", del: 145, producaoMediaDia: 28, ccs: 512, ccsTendencia: "subindo", iepProjetado: 396, diasGestacao: 49, previsaoSecagem: "2026-04-01" }), // secagem vencida
  a("VACA", { statusReprodutivo: "VAZIA", del: 110, producaoMediaDia: 22, ccs: 300, ccsTendencia: "subindo", iepProjetado: null, diasGestacao: null, previsaoSecagem: null }),
  a("VACA", { statusReprodutivo: "PEV", del: 40, producaoMediaDia: 31, ccs: 180, ccsTendencia: "estavel", iepProjetado: null, diasGestacao: null, previsaoSecagem: null }),
  a("BEZERRA", null),
];
describe("agregarDashboard", () => {
  it("KPIs", () => {
    const d = agregarDashboard(herd, HOJE);
    expect(d.kpis.rebanhoAtivo).toBe(4);
    expect(d.kpis.emLactacao).toBe(3);
    expect(d.kpis.gestantes).toBe(1);
    expect(d.kpis.prenhez).toBe(25);          // 1/4
    expect(d.kpis.producaoMedia).toBe(27);     // (28+22+31)/3 = 27
  });
  it("alertas: secagem vencida + CCS alto + vazia atrasada", () => {
    const d = agregarDashboard(herd, HOJE);
    const get = (label: string) => d.alertas.find((x) => x.label.startsWith(label))?.n;
    expect(get("Secagens")).toBe(1);            // PRENHE com previsaoSecagem < hoje
    expect(get("CCS")).toBe(1);                 // ccs >= 400 → só a primeira (512)
    expect(get("Vazias")).toBe(1);              // VAZIA com del > 90
  });
});

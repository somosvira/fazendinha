import { describe, it, expect } from "vitest";
import { montarContexto, contextoParaTexto, type AnimalCtx, type LoteCtx } from "./ia.context.js";

const HOJE = "2026-06-17";

// Conjunto fixo cobrindo cada lista do contexto:
const animais: AnimalCtx[] = [
  // PRENHE perto de secar (previsão -2 dias = já atrasada) + parto próximo (diasGestacao 260)
  { numero: "1234", nome: "Jurema", categoria: "VACA", statusReprodutivo: "PRENHE", del: 80, producaoMediaDia: 18, ccs: 220, ccsTendencia: "estavel", diasGestacao: 260, previsaoSecagem: "2026-06-15", iepProjetado: 390 },
  // VAZIA atrasada (del 120 > 90)
  { numero: "1300", nome: "Cravina", categoria: "VACA", statusReprodutivo: "VAZIA", del: 120, producaoMediaDia: 22, ccs: 180, ccsTendencia: "estavel", diasGestacao: null, previsaoSecagem: null, iepProjetado: null },
  // Em lactação com CCS alto subindo (512)
  { numero: "1450", nome: "Tulipa", categoria: "VACA", statusReprodutivo: "INSEMINADA", del: 150, producaoMediaDia: 30, ccs: 512, ccsTendencia: "subindo", diasGestacao: null, previsaoSecagem: null, iepProjetado: null },
  // PEV em lactação (del 20) — não vazia atrasada
  { numero: "1500", nome: "Acácia", categoria: "VACA", statusReprodutivo: "PEV", del: 20, producaoMediaDia: 26, ccs: 150, ccsTendencia: "estavel", diasGestacao: null, previsaoSecagem: null, iepProjetado: null },
  // Novilha sem resumo reprodutivo / sem produção
  { numero: "2001", nome: null, categoria: "NOVILHA", statusReprodutivo: null, del: null, producaoMediaDia: null, ccs: null, ccsTendencia: null, diasGestacao: null, previsaoSecagem: null, iepProjetado: null },
];

const lotes: LoteCtx[] = [
  { nome: "Lote Alta Produção", dietaNome: "Dieta TMR Lactação", numAnimais: 12, producaoMedia: 28 },
  { nome: "Lote Seca", dietaNome: null, numAnimais: 5, producaoMedia: null },
];

describe("montarContexto", () => {
  const ctx = montarContexto(animais, lotes, HOJE);

  it("totais", () => {
    expect(ctx.totais.ativos).toBe(5);
    // emLactacao = del != null → Jurema, Cravina, Tulipa, Acácia = 4
    expect(ctx.totais.emLactacao).toBe(4);
    expect(ctx.totais.gestantes).toBe(1); // Jurema PRENHE
    expect(ctx.totais.vazias).toBe(1);    // Cravina VAZIA
    // secas: del==null && statusReprodutivo não vazio → novilha tem status null → 0
    expect(ctx.totais.secas).toBe(0);
  });

  it("producaoMediaRebanho — média dos em lactação com produção", () => {
    // (18 + 22 + 30 + 26) / 4 = 24
    expect(ctx.producaoMediaRebanho).toBe(24);
  });

  it("prenhezPct — gestantes / elegíveis", () => {
    // elegíveis = PRENHE, VAZIA, INSEMINADA, PEV → Jurema, Cravina, Tulipa, Acácia = 4
    // 100 * 1 / 4 = 25
    expect(ctx.prenhezPct).toBe(25);
  });

  it("ccsAlto — ccs >= 400 ordenado desc", () => {
    expect(ctx.ccsAlto).toHaveLength(1);
    expect(ctx.ccsAlto[0].numero).toBe("1450");
    expect(ctx.ccsAlto[0].ccs).toBe(512);
    expect(ctx.ccsAlto[0].tendencia).toBe("subindo");
  });

  it("vaziasAtrasadas — VAZIA & del > 90", () => {
    expect(ctx.vaziasAtrasadas).toHaveLength(1);
    expect(ctx.vaziasAtrasadas[0].numero).toBe("1300");
    expect(ctx.vaziasAtrasadas[0].del).toBe(120);
  });

  it("aSecar — PRENHE & previsão <= hoje+30 (inclui já atrasada)", () => {
    expect(ctx.aSecar).toHaveLength(1);
    expect(ctx.aSecar[0].numero).toBe("1234");
    expect(ctx.aSecar[0].previsaoSecagem).toBe("2026-06-15");
  });

  it("partosPrevistos — PRENHE & diasGestacao >= 253", () => {
    expect(ctx.partosPrevistos).toHaveLength(1);
    expect(ctx.partosPrevistos[0].numero).toBe("1234");
    expect(ctx.partosPrevistos[0].diasGestacao).toBe(260);
  });

  it("lotes passam direto", () => {
    expect(ctx.lotes).toHaveLength(2);
    expect(ctx.lotes[0].nome).toBe("Lote Alta Produção");
  });

  it("contextoParaTexto inclui números-chave e rótulos", () => {
    const txt = contextoParaTexto(ctx);
    expect(txt).toContain("512");
    expect(txt).toContain("Prenhez");
  });
});

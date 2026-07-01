import { describe, it, expect } from "vitest";
import {
  montarContextoPlantio,
  contextoPlantioParaTexto,
  type TalhaoCtx,
  type CustoCtx,
  type ColheitaCtx,
  type EstoqueBaixoCtx,
} from "./ia.context.js";

const HOJE = "2026-05-28";

// Talhões cobrindo cada lista do contexto:
const talhoes: TalhaoCtx[] = [
  // Ferrugem alta subindo + cereja pronta + foliar vencida (>120d) + solo vencido (>365d)
  { codigo: "CAF-02", nome: "Cafundó alto · setor 2", variedade: "Catuaí", areaHa: 3.6, fase: "MATURACAO_CEREJA", maturacaoCereja: 68, produtividadeEsperada: 36, ferrugem: 11, broca: 4.1, tendFerrugem: "subindo", pH: 5.3, v: 56, potassio: 88, ultimaInspecao: "2026-05-22", ultimaAnaliseFoliar: "2025-12-01", ultimaAnaliseSolo: "2024-08-10" },
  // Ferrugem no limite (5) estável + broca abaixo (2) + em COLHEITA (não entra prontosColher)
  { codigo: "TIJ-02", nome: "Tijuco oeste", variedade: "Topázio", areaHa: 4.7, fase: "COLHEITA", maturacaoCereja: 79, produtividadeEsperada: 48, ferrugem: 5, broca: 2.4, tendFerrugem: "estavel", pH: null, v: null, potassio: null, ultimaInspecao: "2026-05-22", ultimaAnaliseFoliar: "2026-04-01", ultimaAnaliseSolo: "2026-02-01" },
  // Resistente, tudo baixo, foliar nunca feita (null → vencida)
  { codigo: "SEC-01", nome: "Mata Seca · Acauã", variedade: "Acauã", areaHa: 6.0, fase: "MATURACAO_CEREJA", maturacaoCereja: 76, produtividadeEsperada: 36, ferrugem: 1, broca: 2.5, tendFerrugem: "estavel", pH: 5.6, v: 62, potassio: 72, ultimaInspecao: "2026-05-20", ultimaAnaliseFoliar: null, ultimaAnaliseSolo: "2026-01-01" },
];

const custo: CustoCtx = {
  custoSaca: 780, custoHa: 12000, custeioTotal: 250000, investimentoTotal: 90000,
  sacasPeriodo: 320, periodoMeses: 12,
  breakdown: [{ categoria: "Mão de obra", valor: 90000, pct: 36 }, { categoria: "Fertilizantes", valor: 62500, pct: 25 }],
};
const colheita: ColheitaCtx = { passadas: 4, sacasBeneficiadas: 320 };
const estoqueBaixo: EstoqueBaixoCtx[] = [{ nome: "Cuprovinil", saldo: 12, unidade: "L", minimoEstoque: 40 }];

describe("montarContextoPlantio", () => {
  const ctx = montarContextoPlantio(talhoes, custo, colheita, estoqueBaixo, HOJE);

  it("totais e produtividade média", () => {
    expect(ctx.totais.ativos).toBe(3);
    expect(ctx.totais.areaHa).toBe(14.3);
    // média de produtividadeEsperada > 0 → (36+48+36)/3 = 40
    expect(ctx.totais.produtividadeMediaEsperada).toBe(40);
  });

  it("porFase + faseDominante (empate desempata por contagem)", () => {
    // MATURACAO_CEREJA 2, COLHEITA 1
    expect(ctx.faseDominante).toBe("MATURACAO_CEREJA");
    expect(ctx.porFase.find((f) => f.fase === "MATURACAO_CEREJA")?.n).toBe(2);
  });

  it("alertaFerrugem — ferrugem >= 5 ordenado desc", () => {
    expect(ctx.alertaFerrugem).toHaveLength(2);
    expect(ctx.alertaFerrugem[0].codigo).toBe("CAF-02");
    expect(ctx.alertaFerrugem[0].ferrugem).toBe(11);
    expect(ctx.alertaFerrugem[0].tendencia).toBe("subindo");
  });

  it("alertaBroca — broca >= 3", () => {
    expect(ctx.alertaBroca).toHaveLength(1);
    expect(ctx.alertaBroca[0].codigo).toBe("CAF-02");
  });

  it("prontosColher — cereja >= 60 e fora de COLHEITA", () => {
    // CAF-02 (68) e SEC-01 (76); TIJ-02 está em COLHEITA → excluído
    expect(ctx.prontosColher.map((t) => t.codigo).sort()).toEqual(["CAF-02", "SEC-01"]);
  });

  it("foliarVencida — >120 dias ou nunca", () => {
    // CAF-02 (2025-12-01 → ~178d) e SEC-01 (null); TIJ-02 (2026-04-01 ~57d) fora
    expect(ctx.foliarVencida.map((t) => t.codigo).sort()).toEqual(["CAF-02", "SEC-01"]);
  });

  it("soloVencido — >365 dias ou nunca", () => {
    // CAF-02 (2024-08-10) vencido; os outros recentes
    expect(ctx.soloVencido.map((t) => t.codigo)).toEqual(["CAF-02"]);
  });

  it("custo/colheita/estoque passam direto", () => {
    expect(ctx.custo.custoSaca).toBe(780);
    expect(ctx.colheita.sacasBeneficiadas).toBe(320);
    expect(ctx.estoqueBaixo[0].nome).toBe("Cuprovinil");
  });

  it("contextoPlantioParaTexto inclui números-chave e rótulos", () => {
    const txt = contextoPlantioParaTexto(ctx);
    expect(txt).toContain("11%");
    expect(txt).toContain("Ferrugem");
    expect(txt).toContain("Custo/saca");
  });
});

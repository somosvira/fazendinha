import { describe, it, expect } from "vitest";
import { recomputarQuartos, type ExameQuartoIn } from "./quarto.recompute.js";

// Data de referência fixa nos testes → cálculo determinístico (janela 12m relativa a `hoje`).
const HOJE = "2026-07-19";

function ex(p: Partial<ExameQuartoIn> & { quarto: ExameQuartoIn["quarto"]; data: string }): ExameQuartoIn {
  return { scoreCmt: null, ccs: null, clinica: false, perdido: false, ...p };
}

describe("recomputarQuartos", () => {
  it("animal sem exames → tudo zerado, todos os quartos SADIO", () => {
    const r = recomputarQuartos([], HOJE);
    expect(r.quartosCronicos).toBe(0);
    expect(r.quartosPerdidos).toBe(0);
    expect(r.porQuarto.AE.estado).toBe("SADIO");
    expect(r.porQuarto.PD.estado).toBe("SADIO");
  });

  it("crônico por 3 positivos subclínicos (2 cruzes) no mesmo quarto em 12m", () => {
    const r = recomputarQuartos([
      ex({ quarto: "PE", data: "2026-01-10", scoreCmt: "DUAS_CRUZES" }),
      ex({ quarto: "PE", data: "2026-03-10", scoreCmt: "TRES_CRUZES" }),
      ex({ quarto: "PE", data: "2026-06-10", scoreCmt: "DUAS_CRUZES" }),
    ], HOJE);
    expect(r.porQuarto.PE.estado).toBe("CRONICO");
    expect(r.porQuarto.PE.positivos12m).toBe(3);
    expect(r.quartosCronicos).toBe(1);
  });

  it("CCS >= 400 conta como positivo firme; UMA_CRUZ/TRACOS não", () => {
    const r = recomputarQuartos([
      ex({ quarto: "AD", data: "2026-02-10", ccs: 500 }),
      ex({ quarto: "AD", data: "2026-04-10", ccs: 420 }),
      ex({ quarto: "AD", data: "2026-06-10", scoreCmt: "UMA_CRUZ", ccs: 200 }),
      ex({ quarto: "AD", data: "2026-06-20", scoreCmt: "TRACOS" }),
    ], HOJE);
    // só 2 positivos firmes (os CCS>=400); UMA_CRUZ/TRACOS/CCS<400 não contam → não crônico
    expect(r.porQuarto.AD.positivos12m).toBe(2);
    // último positivo firme foi em abril (>60d de HOJE) → SADIO, não ATIVO
    expect(r.porQuarto.AD.estado).toBe("SADIO");
    expect(r.porQuarto.AD.ultimoPositivo).toBe("2026-04-10");
    expect(r.quartosCronicos).toBe(0);
  });

  it("crônico por 2 episódios clínicos em 12m", () => {
    const r = recomputarQuartos([
      ex({ quarto: "AE", data: "2026-02-01", clinica: true }),
      ex({ quarto: "AE", data: "2026-05-01", clinica: true }),
    ], HOJE);
    expect(r.porQuarto.AE.clinicas12m).toBe(2);
    expect(r.porQuarto.AE.estado).toBe("CRONICO");
    expect(r.quartosCronicos).toBe(1);
  });

  it("quarto perdido tem precedência sobre crônico", () => {
    const r = recomputarQuartos([
      ex({ quarto: "PD", data: "2026-01-01", scoreCmt: "TRES_CRUZES" }),
      ex({ quarto: "PD", data: "2026-03-01", scoreCmt: "TRES_CRUZES" }),
      ex({ quarto: "PD", data: "2026-05-01", scoreCmt: "TRES_CRUZES" }),
      ex({ quarto: "PD", data: "2026-06-01", perdido: true }),
    ], HOJE);
    expect(r.porQuarto.PD.estado).toBe("PERDIDO");
    expect(r.quartosPerdidos).toBe(1);
    // perdido sai do denominador tratável: não conta como crônico
    expect(r.quartosCronicos).toBe(0);
  });

  it("positivos fora da janela de 12m não contam", () => {
    const r = recomputarQuartos([
      ex({ quarto: "PE", data: "2025-01-10", scoreCmt: "DUAS_CRUZES" }), // > 12m
      ex({ quarto: "PE", data: "2025-03-10", scoreCmt: "DUAS_CRUZES" }), // > 12m
      ex({ quarto: "PE", data: "2026-06-10", scoreCmt: "DUAS_CRUZES" }), // dentro
    ], HOJE);
    expect(r.porQuarto.PE.positivos12m).toBe(1);
    expect(r.porQuarto.PE.estado).toBe("ATIVO");
    expect(r.quartosCronicos).toBe(0);
  });

  it("ATIVO só se último positivo < 60d; senão SADIO", () => {
    const rAtivo = recomputarQuartos([ex({ quarto: "AE", data: "2026-06-25", scoreCmt: "DUAS_CRUZES" })], HOJE);
    expect(rAtivo.porQuarto.AE.estado).toBe("ATIVO");
    const rSadio = recomputarQuartos([ex({ quarto: "AE", data: "2026-02-01", scoreCmt: "DUAS_CRUZES" })], HOJE);
    expect(rSadio.porQuarto.AE.estado).toBe("SADIO");
    expect(rSadio.porQuarto.AE.ultimoPositivo).toBe("2026-02-01");
  });

  it("dois quartos crônicos → quartosCronicos = 2", () => {
    const trio = (q: ExameQuartoIn["quarto"]) => [
      ex({ quarto: q, data: "2026-01-10", scoreCmt: "DUAS_CRUZES" }),
      ex({ quarto: q, data: "2026-03-10", scoreCmt: "DUAS_CRUZES" }),
      ex({ quarto: q, data: "2026-06-10", scoreCmt: "DUAS_CRUZES" }),
    ];
    const r = recomputarQuartos([...trio("PE"), ...trio("AD")], HOJE);
    expect(r.quartosCronicos).toBe(2);
  });
});

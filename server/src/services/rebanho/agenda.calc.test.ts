import { describe, expect, it } from "vitest";
import { montarAgenda, type ItemAgendaIn } from "./agenda.calc.js";

const HOJE = "2026-07-20";
const item = (tipo: "VACINA" | "IATF", data: string, titulo: string, alvo: string): ItemAgendaIn => ({ tipo, data, titulo, alvo });

describe("montarAgenda", () => {
  it("vazio → []", () => {
    expect(montarAgenda([], HOJE)).toEqual([]);
  });

  it("ordena por data asc", () => {
    const r = montarAgenda([
      item("VACINA", "2026-08-01", "Aftosa", "#12"),
      item("IATF", "2026-07-25", "D7 — PGF", "Lote Alta"),
      item("VACINA", "2026-07-10", "Brucelose", "#5"),
    ], HOJE);
    expect(r.map((x) => x.data)).toEqual(["2026-07-10", "2026-07-25", "2026-08-01"]);
  });

  it("marca atrasado (data < hoje) e futuro (data >= hoje)", () => {
    const r = montarAgenda([item("VACINA", "2026-07-10", "Aftosa", "#1"), item("VACINA", "2026-07-20", "Brucelose", "#2"), item("IATF", "2026-08-01", "D0", "Lote")], HOJE);
    expect(r.find((x) => x.data === "2026-07-10")!.status).toBe("atrasado");
    expect(r.find((x) => x.data === "2026-07-20")!.status).toBe("futuro"); // hoje = futuro (inclusive)
    expect(r.find((x) => x.data === "2026-08-01")!.status).toBe("futuro");
  });

  it("calcula diasParaData (negativo = atraso)", () => {
    const r = montarAgenda([item("VACINA", "2026-07-25", "Aftosa", "#1"), item("VACINA", "2026-07-15", "Brucelose", "#2")], HOJE);
    expect(r.find((x) => x.data === "2026-07-25")!.diasParaData).toBe(5);
    expect(r.find((x) => x.data === "2026-07-15")!.diasParaData).toBe(-5);
  });

  it("preserva tipo/titulo/alvo", () => {
    const r = montarAgenda([item("IATF", "2026-07-25", "D7 — PGF", "Lote Alta")], HOJE);
    expect(r[0]).toMatchObject({ tipo: "IATF", titulo: "D7 — PGF", alvo: "Lote Alta" });
  });
});

import { describe, it, expect } from "vitest";
import { resumirCockpit, type CockpitInput } from "./cockpit.calc.js";

const base: CockpitInput = {
  alertas: [],
  estoqueAbaixoMinimo: 0,
  carenciaAtivaCount: 0,
  fluxoDia: 0,
  fluxoMes: 0,
};
const contador = (r: ReturnType<typeof resumirCockpit>, cat: string) => r.contadores.find((c) => c.categoria === cat)!;

describe("resumirCockpit", () => {
  it("rebanho zerado → 4 contadores com quantidade 0 e saldos 0", () => {
    const r = resumirCockpit(base);
    expect(r.contadores.map((c) => c.categoria)).toEqual(["repro", "sanidade", "carencia", "estoque"]);
    expect(r.contadores.every((c) => c.quantidade === 0)).toBe(true);
    expect(r.saldoDia).toBe(0);
    expect(r.saldoMes).toBe(0);
  });

  it("repro soma as 4 chaves reprodutivas e escolhe deep-link da maior severidade", () => {
    const r = resumirCockpit({
      ...base,
      alertas: [
        { chave: "dg-pendente", quantidade: 3, severidade: "media" },
        { chave: "secagem-atrasada", quantidade: 2, severidade: "alta" },
        { chave: "parto-proximo", quantidade: 1, severidade: "baixa" },
      ],
    });
    const repro = contador(r, "repro");
    expect(repro.quantidade).toBe(6);
    expect(repro.chave).toBe("secagem-atrasada"); // maior severidade
    expect(repro.tab).toBe("reproducao");
  });

  it("sanidade vem só de ccs-alta, com chave própria", () => {
    const r = resumirCockpit({ ...base, alertas: [{ chave: "ccs-alta", quantidade: 4, severidade: "alta" }] });
    const san = contador(r, "sanidade");
    expect(san.quantidade).toBe(4);
    expect(san.chave).toBe("ccs-alta");
    expect(san.tab).toBe("sanidade");
    // ccs-alta não entra em repro
    expect(contador(r, "repro").quantidade).toBe(0);
  });

  it("carência: contador sem chave (navega por tab produção)", () => {
    const r = resumirCockpit({ ...base, carenciaAtivaCount: 3 });
    const car = contador(r, "carencia");
    expect(car.quantidade).toBe(3);
    expect(car.chave).toBeNull();
    expect(car.tab).toBe("producao");
  });

  it("estoque: contador sem chave (navega por tab nutrição)", () => {
    const r = resumirCockpit({ ...base, estoqueAbaixoMinimo: 2 });
    const est = contador(r, "estoque");
    expect(est.quantidade).toBe(2);
    expect(est.chave).toBeNull();
    expect(est.tab).toBe("nutricao");
  });

  it("saldos preservam o sinal (negativo continua negativo)", () => {
    const r = resumirCockpit({ ...base, fluxoDia: -1234.5, fluxoMes: 8900 });
    expect(r.saldoDia).toBe(-1234.5);
    expect(r.saldoMes).toBe(8900);
  });

  it("empate de severidade em repro → determinístico pela ordem canônica das chaves", () => {
    const r = resumirCockpit({
      ...base,
      alertas: [
        { chave: "dg-pendente", quantidade: 1, severidade: "alta" },
        { chave: "secagem-atrasada", quantidade: 1, severidade: "alta" },
      ],
    });
    // ordem canônica: secagem-atrasada vem antes de dg-pendente
    expect(contador(r, "repro").chave).toBe("secagem-atrasada");
  });

  it("repro sem nenhuma worklist reprodutiva presente → chave null", () => {
    const r = resumirCockpit({ ...base, alertas: [{ chave: "ccs-alta", quantidade: 2, severidade: "alta" }] });
    expect(contador(r, "repro").quantidade).toBe(0);
    expect(contador(r, "repro").chave).toBeNull();
  });

  it("ignora quantidades zeradas ao escolher o deep-link de repro", () => {
    const r = resumirCockpit({
      ...base,
      alertas: [
        { chave: "secagem-atrasada", quantidade: 0, severidade: "alta" }, // zerada → não define o link
        { chave: "vazia-pos-pev", quantidade: 5, severidade: "media" },
      ],
    });
    expect(contador(r, "repro").quantidade).toBe(5);
    expect(contador(r, "repro").chave).toBe("vazia-pos-pev");
  });
});

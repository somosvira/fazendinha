import { describe, expect, it } from "vitest";
import { impactosInicioLegado } from "./inicio-legado.calc.js";
import type { EtapaIatf } from "../reproducao/schemas.js";

const etapas: EtapaIatf[] = [
  { nome: "Primeiro manejo", tipo: "MANEJO", intervalo: 0, unidade: "DIAS" },
  { nome: "Segundo manejo", tipo: "MANEJO", intervalo: 2, unidade: "DIAS" },
  { nome: "Manejo com hora", tipo: "MANEJO", intervalo: 12, unidade: "HORAS" },
];
const tarefas = () => etapas.map((e, etapa) => ({ id: `tarefa-${etapa}`, nome: e.nome, etapa,
  previstaEm: new Date(etapa === 1 ? "2026-10-12" : "2026-10-10"), precisaoTemporal: "DIA" as const,
  previsaoPendente: etapa === 2, realizadaEm: null as Date | null, dispensadaEm: null as Date | null }));

describe("prévia do calendário legado", () => {
  it("expõe datas anteriores/novas somente das pendências realmente alteradas sem modificar a entrada", () => {
    const entrada = tarefas(), original = structuredClone(entrada);
    entrada[1].dispensadaEm = new Date("2026-10-11");
    const itens = impactosInicioLegado("2026-10-11", etapas, entrada);
    expect(itens.map(i => i.id)).toEqual(["tarefa-0", "tarefa-2"]);
    expect(itens[0]).toMatchObject({ previstaAnterior: "2026-10-10", previstaNova: "2026-10-11", precisaoAnterior: "DIA", precisaoNova: "DIA" });
    expect(itens[1]).toMatchObject({ previsaoPendenteAnterior: true, previsaoPendente: true });
    expect(entrada[0]).toEqual(original[0]);
    expect(entrada[2]).toEqual(original[2]);
  });
  it("referência idêntica não exige ciência e realização anterior não é reprogramada", () => {
    expect(impactosInicioLegado("2026-10-10", etapas, tarefas())).toEqual([]);
    const entrada = tarefas(); entrada[0].realizadaEm = new Date("2026-10-10");
    expect(impactosInicioLegado("2026-10-11", etapas, entrada).map(i => i.id)).toEqual(["tarefa-1", "tarefa-2"]);
  });
  it("início com hora revela alteração de precisão e da previsão antes não aferível", () => {
    const item = impactosInicioLegado("2026-10-10T12:00:00Z", etapas, tarefas())[2];
    expect(item).toMatchObject({ previstaAnterior: "2026-10-10", previstaNova: "2026-10-11T00:00:00.000Z",
      precisaoAnterior: "DIA", precisaoNova: "HORA", previsaoPendenteAnterior: true, previsaoPendente: false });
  });
});

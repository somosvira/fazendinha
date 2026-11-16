import { expect, it } from "vitest";
import {
  dataOperacionalDemanda,
  projetarAgendaDemanda,
} from "./agenda-demanda.calc.js";
const original = new Date("2026-01-01"),
  agendada = new Date("2026-02-01");
it("data operacional não altera data nem referência da regra", () => {
  const d = {
    previstaPara: original,
    estado: "PENDENTE",
    decisaoOperacional: {
      id: "decisao",
      tipo: "REAGENDAR",
      data: agendada,
      destino: "Visita",
      motivo: "Conferência explícita",
    },
  };
  expect(dataOperacionalDemanda(d)).toBe(agendada);
  expect(projetarAgendaDemanda(d)).toMatchObject({
    previstaPara: agendada,
    previstaPelaRegra: original,
    estado: "PENDENTE",
  });
  expect(d.previstaPara).toBe(original);
});
it("dispensa encerra só a apresentação administrativa sem fabricar resolução clínica", () => {
  const d = {
    previstaPara: null,
    estado: "PENDENTE",
    decisaoOperacional: {
      id: "decisao",
      tipo: "DISPENSAR",
      data: null,
      destino: null,
      motivo: "Cuidado dispensado explicitamente",
    },
  };
  expect(projetarAgendaDemanda(d)).toMatchObject({
    estado: "ENCERRADA",
    motivoEncerramento: "DISPENSA_ADMINISTRATIVA",
  });
  expect(d.estado).toBe("PENDENTE");
  expect(projetarAgendaDemanda({ ...d, estado: "RESOLVIDA" }).estado).toBe(
    "RESOLVIDA",
  );
});

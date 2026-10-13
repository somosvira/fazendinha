import { describe, expect, it, vi } from "vitest";
vi.mock("./FormReproducao", () => ({ FormReproducao: () => null }));
vi.mock("../sanidade/FormAplicacaoServico", () => ({
  FormAplicacaoServico: () => null,
}));
import {
  dataHoraISO,
  inputHorarioIatf,
  horarioIatf,
  statusTarefaIatf,
  statusParticipanteIatf,
} from "./Iatf";
describe("horário e estados de IATF", () => {
  it("interpreta entrada de campo no fuso São Paulo mesmo com navegador em outro fuso", () => {
    expect(dataHoraISO("2026-10-01T23:30")).toBe("2026-10-02T02:30:00.000Z");
    expect(inputHorarioIatf("2026-10-02T02:30:00.000Z")).toBe(
      "2026-10-01T23:30",
    );
    expect(horarioIatf("2026-10-02T02:30:00.000Z")).toContain("23:30");
    expect(() => dataHoraISO("")).toThrow();
  });
  it("deriva tarefa de execução/dispensa e participação de início/encerramento documentados", () => {
    const t = {
      id: "t",
      tipo: "RETIRADA",
      previstaEm: "2026-10-01T12:00:00Z",
      status: "",
    };
    expect(statusTarefaIatf(t)).toBe("Pendente");
    expect(statusTarefaIatf({...t,realizadaEm:"2026-10-01T12:00:00Z",historicoRegularizacao:[{acao:"ENCERRAR_SEM_SUBSTITUICAO"}]})).toBe("Encerrada sem substituição");
    expect(
      statusTarefaIatf({ ...t, dispensadaEm: "2026-10-01T13:00:00Z" }),
    ).toBe("Dispensada");
    expect(
      statusTarefaIatf({ ...t, realizadaEm: "2026-10-01T12:00:00Z" }),
    ).toBe("Realizada");
    const p = {
      id: "p",
      animalId: "a",
      inicioPrevisto: "2026-10-01T12:00:00Z",
      inicioEfetivo: null,
      tarefas: [],
    };
    expect(statusParticipanteIatf(p)).toBe("Prevista");
    expect(
      statusParticipanteIatf({ ...p, inicioEfetivo: "2026-10-01T12:00:00Z" }),
    ).toBe("Iniciada");
    expect(
      statusParticipanteIatf({ ...p, encerradoEm: "2026-10-02T12:00:00Z" }),
    ).toBe("Encerrada");
  });
});

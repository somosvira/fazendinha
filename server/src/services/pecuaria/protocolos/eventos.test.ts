import { describe, expect, it } from "vitest";
import { eventoTarefaSchema } from "./eventos.js";

const base = { chave: "9192047d-ab87-4ff6-bbc7-f7c6702eb83a", propriedadeId: 1, ocorridaEm: "2026-10-18T12:00:00-03:00", motivo: "Animal não encontrado no manejo" };
describe("contrato dos eventos operacionais da tarefa", () => {
  it("não atendimento exige justificativa e não admite dados de adiamento/retificação", () => {
    expect(eventoTarefaSchema.parse({ ...base, tipo: "NAO_ATENDIDO" }).motivo).toBe(base.motivo);
    expect(eventoTarefaSchema.safeParse({ ...base, tipo: "NAO_ATENDIDO", motivo: " " }).success).toBe(false);
    expect(eventoTarefaSchema.safeParse({ ...base, tipo: "NAO_ATENDIDO", previstaPara: "2026-10-20" }).success).toBe(false);
    expect(eventoTarefaSchema.safeParse({ ...base, tipo: "NAO_ATENDIDO", eventoCorrigidoId: base.chave }).success).toBe(false);
  });
  it("adiamento aceita data sem inventar hora e exige nova previsão", () => {
    expect(eventoTarefaSchema.parse({ ...base, tipo: "ADIAMENTO", previstaPara: "2026-10-20" }).previstaPara).toBe("2026-10-20");
    expect(eventoTarefaSchema.safeParse({ ...base, tipo: "ADIAMENTO" }).success).toBe(false);
    expect(eventoTarefaSchema.safeParse({ ...base, tipo: "ADIAMENTO", previstaPara: "2026-02-30" }).success).toBe(false);
  });
  it("retificação exige identidade do original e recusa campos de previsão e autoria fornecida", () => {
    expect(eventoTarefaSchema.safeParse({ ...base, tipo: "RETIFICACAO_JUSTIFICATIVA", eventoCorrigidoId: base.chave }).success).toBe(true);
    expect(eventoTarefaSchema.safeParse({ ...base, tipo: "RETIFICACAO_JUSTIFICATIVA" }).success).toBe(false);
    expect(eventoTarefaSchema.safeParse({ ...base, tipo: "RETIFICACAO_JUSTIFICATIVA", eventoCorrigidoId: base.chave, previstaPara: "2026-10-20" }).success).toBe(false);
    expect(eventoTarefaSchema.safeParse({ ...base, tipo: "NAO_ATENDIDO", registradoPorId: 1 }).success).toBe(false);
  });
});

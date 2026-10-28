import { beforeEach, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({ publicar: vi.fn(), auditar: vi.fn() }));
vi.mock("./atendimento.js", () => ({ publicarEstadoProgramacaoTx: mocks.publicar }));
vi.mock("../../rebanho/regras.js", () => ({ auditar: mocks.auditar }));
import { reavaliarContinuidadeProgramaAnimalTx } from "./continuidade.js";
function fixture(situacao: string, motivo: string, baixado = false) {
  const fake = {
    necessidadeProgramacaoSanitaria: { findMany: vi.fn().mockResolvedValue([{ id: "n", alertaId: "a", situacao, sujeitoTipo: "ANIMAL", sujeitoId: "animal", propriedadeId: 1, programacao: { ativo: true, produtoId: null, tipoExameId: null, publico: {} } }]), update: vi.fn() },
    alerta: { findUniqueOrThrow: vi.fn().mockResolvedValue({ resumo: {}, motivo }) },
    animal: { findUnique: vi.fn().mockResolvedValue({ sexo: "F", dataNascimento: new Date("2025-01-01Z"), localizacoes: [{ propriedadeId: 1 }], baixas: baixado ? [{ id: "baixa" }] : [] }) },
    tipoExame: { findUnique: vi.fn().mockResolvedValue({ ativo: false }) },
  };
  // Fronteira do teste: somente os delegados utilizados por esta transação são simulados.
  return { fake, tx: fake as unknown as Prisma.TransactionClient };
}
beforeEach(() => vi.clearAllMocks());
it("identifica encerramento por baixa e reabre só esse cuidado para conferência após estorno", async () => {
  const { tx, fake } = fixture("ENCERRADO", "Baixa do animal: baixa; cuidado encerrado sem realização");
  await reavaliarContinuidadeProgramaAnimalTx(tx, "animal", 7, "ESTORNO_BAIXA");
  expect(fake.necessidadeProgramacaoSanitaria.update).toHaveBeenCalledWith({ where: { id: "n" }, data: { situacao: "NECESSITA_REVISAO", propriedadeId: 1, revisao: { increment: 1 } } });
  expect(mocks.publicar).toHaveBeenCalledWith(tx, "n", { usuarioId: 7 }, "REABRIR", expect.objectContaining({ motivo: expect.stringContaining("Baixa estornada") }));
});
it("preserva encerramentos manuais e atendimentos quando uma baixa é estornada", async () => {
  for (const [situacao, motivo] of [["ENCERRADO", "Encerramento decidido na revisão"], ["REALIZADO", "Baixa do animal: baixa"], ["DISPENSADO", "Baixa do animal: baixa"]]) {
    const { tx, fake } = fixture(situacao, motivo);
    await reavaliarContinuidadeProgramaAnimalTx(tx, "animal", 7, "ESTORNO_BAIXA");
    expect(fake.necessidadeProgramacaoSanitaria.update).not.toHaveBeenCalled();
  }
  expect(mocks.publicar).not.toHaveBeenCalled();
});
it("registra a origem da baixa ao encerrar sem realização", async () => {
  const { tx } = fixture("PENDENTE", "Programação mensal", true);
  await reavaliarContinuidadeProgramaAnimalTx(tx, "animal", 7, "BAIXA");
  expect(mocks.publicar).toHaveBeenCalledWith(tx, "n", { usuarioId: 7 }, "ENCERRAR", { motivo: "Baixa do animal: baixa; cuidado encerrado sem realização" });
});
it("preserva destino nulo da revisão original sem herdar um exame posterior inativo", async () => {
  const { tx, fake } = fixture("PENDENTE", "Programação mensal");
  fake.necessidadeProgramacaoSanitaria.findMany.mockResolvedValue([{ id: "n", alertaId: "a", situacao: "PENDENTE", sujeitoTipo: "ANIMAL", sujeitoId: "animal", propriedadeId: 1, programacao: { ativo: true, produtoId: null, tipoExameId: "exame-novo", publico: {} } }]);
  fake.alerta.findUniqueOrThrow.mockResolvedValue({ motivo: "Programação mensal", resumo: { programacaoSnapshot: { produtoId: null, tipoExameId: null, publico: {} } } });
  await reavaliarContinuidadeProgramaAnimalTx(tx, "animal", 7, "LOCALIZACAO");
  expect(fake.tipoExame.findUnique).not.toHaveBeenCalled();
  expect(fake.necessidadeProgramacaoSanitaria.update).not.toHaveBeenCalled();
});

import { beforeEach, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({ publicar: vi.fn(), auditar: vi.fn() }));
vi.mock("./atendimento.js", () => ({ publicarEstadoProgramacaoTx: mocks.publicar }));
vi.mock("../../rebanho/regras.js", async original => ({ ...await original<typeof import("../../rebanho/regras.js")>(), auditar: mocks.auditar }));
import { reconciliarProgramacaoTx, reavaliarContinuidadeProgramaAnimalTx } from "./continuidade.js";
function fixture(situacao: string, motivo: string, baixado = false) {
  const fake = {
    $queryRaw: vi.fn().mockResolvedValue([{ adquirido: true }]),
    necessidadeProgramacaoSanitaria: { findMany: vi.fn().mockResolvedValue([{ id: "n", alertaId: "a", situacao, sujeitoTipo: "ANIMAL", sujeitoId: "animal", propriedadeId: 1, programacao: { ativo: true, produtoId: null, tipoExameId: null, publico: {} } }]), update: vi.fn() },
    alerta: { findUniqueOrThrow: vi.fn().mockResolvedValue({ resumo: {}, motivo, ciclo: situacao === "INVALIDADO" ? "INVALIDADO" : ["REALIZADO", "DISPENSADO", "ENCERRADO"].includes(situacao) ? "ENCERRADO" : "ABERTO" }) },
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
it.each(["REALIZADO", "DISPENSADO", "ENCERRADO", "INVALIDADO"])("acompanha o sítio atual no histórico %s sem substituir fato ou reabrir o cuidado", async situacao => {
  const { tx, fake } = fixture(situacao, "Decisão histórica preservada");
  fake.animal.findUnique.mockResolvedValue({ sexo: "F", dataNascimento: new Date("2025-01-01Z"), localizacoes: [{ propriedadeId: 2 }], baixas: [] });
  await reavaliarContinuidadeProgramaAnimalTx(tx, "animal", 7, "LOCALIZACAO");
  expect(fake.necessidadeProgramacaoSanitaria.update).toHaveBeenCalledTimes(1);
  expect(fake.necessidadeProgramacaoSanitaria.update).toHaveBeenCalledWith({ where: { id: "n" }, data: { propriedadeId: 2, revisao: { increment: 1 } } });
  expect(mocks.publicar).toHaveBeenCalledWith(tx, "n", { usuarioId: 7 }, situacao === "INVALIDADO" ? "INVALIDAR" : "ENCERRAR");
  expect(mocks.auditar).toHaveBeenCalledWith(tx, expect.objectContaining({ entidadeId: "n", propriedadeId: 2, depois: expect.objectContaining({ situacao, propriedadeId: 2 }) }));
});
it("rele a necessidade após travar o animal e preserva decisão confirmada antes da trava", async () => {
  const { tx, fake } = fixture("REALIZADO", "Aplicação vinculada");
  const chamadas: string[] = [];
  const realizado = await fake.necessidadeProgramacaoSanitaria.findMany();
  fake.necessidadeProgramacaoSanitaria.findMany.mockReset()
    .mockImplementationOnce(async () => { chamadas.push("candidatas"); return [{ id: "n", sujeitoTipo: "ANIMAL", sujeitoId: "animal" }]; })
    .mockImplementationOnce(async () => { chamadas.push("releitura"); return realizado; });
  fake.$queryRaw.mockImplementation(async () => { chamadas.push("trava"); return [{ adquirido: true }]; });
  const r = await reconciliarProgramacaoTx(tx, "programa", new Date("2030-01-01Z"), { tecnico: "teste" });
  expect(chamadas).toEqual(["trava", "candidatas", "trava", "releitura"]);
  expect(fake.necessidadeProgramacaoSanitaria.findMany.mock.calls[0][0]).toMatchObject({ take: 50, select: { id: true, sujeitoId: true, sujeitoTipo: true } });
  expect(fake.necessidadeProgramacaoSanitaria.update).not.toHaveBeenCalled();
  expect(mocks.publicar).not.toHaveBeenCalled();
  expect(r).toEqual({ cursorNecessidadeId: "n", concluido: true });
});

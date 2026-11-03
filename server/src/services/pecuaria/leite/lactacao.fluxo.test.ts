import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  matriz: vi.fn(),
  tx: { $executeRaw: vi.fn(), lactacaoAnimal: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    controleHistoricoLeite: { findMany: vi.fn() },
    vinculoPesagemSecagem: { findFirst: vi.fn() },
    $queryRaw: vi.fn(), participanteProducaoLeite: { findMany: vi.fn() }, auditoriaPecuaria: { create: vi.fn() } },
}));
vi.mock("../../../db.js", () => ({ prisma: {} }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: (executar: (tx: typeof mocks.tx) => Promise<unknown>) => executar(mocks.tx) }));
vi.mock("../fatos.js", async original => ({ ...await original<typeof import("../fatos.js")>(), conferirAnimalNoFato: mocks.matriz }));
import { encerrarLactacao, corrigirLactacao } from "../reproducao/registros.js";
const dia = (data: string) => new Date(`${data}T00:00:00Z`);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.matriz.mockResolvedValue({ id: "animal", sexo: "F" });
  mocks.tx.lactacaoAnimal.findFirst.mockResolvedValue({ id: "lactacao", animalId: "animal", propriedadeId: 1, inicio: dia("2026-01-01"), encerradaEm: null, versao: 1 });
  mocks.tx.lactacaoAnimal.findMany.mockResolvedValue([]);
  mocks.tx.vinculoPesagemSecagem.findFirst.mockResolvedValue(null);
  mocks.tx.controleHistoricoLeite.findMany.mockResolvedValue([]);
  mocks.tx.$queryRaw.mockResolvedValue([]);
  mocks.tx.participanteProducaoLeite.findMany.mockResolvedValue([{ lactacaoId: "lactacao", dia: { dataOperacional: dia("2026-10-01") } }]);
});
describe("alteração da lactação conserva a origem da produção", () => {
  it("encerramento chama a guarda antes da escrita", async () => {
    await expect(encerrarLactacao("lactacao", 1, "2026-10-01", "Secagem informada", 7)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.tx.lactacaoAnimal.update).not.toHaveBeenCalled();
  });
  it("correção do início também não pode deixar litros fora da lactação", async () => {
    await expect(corrigirLactacao("lactacao", { propriedadeId: 1, inicio: "2026-10-02", versaoEsperada: 1, motivo: "Início corrigido" }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.tx.lactacaoAnimal.update).not.toHaveBeenCalled();
  });
});

it("secagem não escreve sobre produção geral identificada sem controle individual", async () => {
  mocks.tx.participanteProducaoLeite.findMany.mockResolvedValue([]);
  mocks.tx.$queryRaw.mockResolvedValue([{ animalId: "animal", propriedadeId: 1, data: dia("2026-10-20"), entradaId: null, evidencia: null }]);
  await expect(encerrarLactacao("lactacao", 1, "2026-10-19", "Secagem retroativa", 7)).rejects.toMatchObject({ code: "CONFLITO" });
  expect(mocks.tx.lactacaoAnimal.update).not.toHaveBeenCalled();
});


it("encerrar e corrigir lactação conservam controle documental sem litros operacionais", async () => {
  mocks.tx.participanteProducaoLeite.findMany.mockResolvedValue([]);
  mocks.tx.controleHistoricoLeite.findMany.mockResolvedValue([{ id: "documento", inicio: dia("2026-10-20"), fim: dia("2026-10-20") }]);
  await expect(encerrarLactacao("lactacao", 1, "2026-10-20", "Secagem informada", 7)).rejects.toMatchObject({ code: "CONFLITO" });
  await expect(corrigirLactacao("lactacao", { propriedadeId: 1, inicio: "2026-10-21", motivo: "Início retificado" }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
  expect(mocks.tx.lactacaoAnimal.update).not.toHaveBeenCalled();
  expect(mocks.tx.auditoriaPecuaria.create).not.toHaveBeenCalled();
});

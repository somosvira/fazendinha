import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { uid } from "../../../lib/uid.fixture.js";

const mocks = vi.hoisted(() => {
  const lista = () => ({ findMany: vi.fn().mockResolvedValue([]) });
  const tx = {
    $executeRaw: vi.fn(),
    visitaVeterinaria: { findFirst: vi.fn(), update: vi.fn() },
    atividadeVisita: { ...lista(), aggregate: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    participanteVisita: { ...lista(), createMany: vi.fn(), findUnique: vi.fn() },
    tarefaProtocolo: { ...lista(), findFirst: vi.fn() },
    animal: lista(), localizacaoAnimal: lista(), categoriaAnimal: lista(), categoriaManualAnimal: lista(), destinoAnimal: lista(),
    ocorrenciaSanitaria: lista(), regraSanitariaReprodutiva: lista(), periodoReprodutivoAnimal: lista(), tarefaIatf: lista(),
    programacaoIatf: lista(), protocolo: lista(), protocoloIatf: lista(), participanteIatf: lista(),
    avaliacaoReprodutiva: lista(), gestacaoAnimal: lista(), tentativaReprodutiva: lista(), auditoriaPecuaria: { create: vi.fn() },
  };
  return { tx, estados: vi.fn(), contextos: vi.fn(), retornos: vi.fn() };
});
vi.mock("../../../db.js", () => ({ prisma: { ...mocks.tx, $transaction: (f: (tx: typeof mocks.tx) => unknown) => f(mocks.tx) } }));
vi.mock("./registros.js", async original => ({ ...await original<typeof import("./registros.js")>(), obterEstadosReprodutivosTx: mocks.estados }));
vi.mock("./contexto-animal.js", async original => ({ ...await original<typeof import("./contexto-animal.js")>(), obterContextosAnimaisNaDataTx: mocks.contextos }));
vi.mock("./contexto-retorno.js", async original => ({ ...await original<typeof import("./contexto-retorno.js")>(), carregarRetornosNaDataTx: mocks.retornos }));
import { adicionarAtividadeTx, sugestoesVisita, tarefaParticipanteVisita } from "./visitas.js";
import { atividadeSchema } from "./schemas.js";

const animalId = uid(1), visitaId = uid(2), atividadeId = uid(3), participanteId = uid(4), tarefaId = uid(5);
const parametros = { produtoId: uid(6), dose: "2.500", unidade: "ML", via: "SC", tipoAplicacaoId: uid(7), tipoExameId: uid(8) };
const tarefa = () => ({ id: tarefaId, previstaPara: new Date("2026-02-01"), parametros: { ...parametros, id: "intruso", animalId: "intruso", custoUnitario: "900" },
  etapa: { tipo: "APLICACAO", ordem: 1, produtoId: "atual", dose: "9", unidade: "L", via: "IM", tipoExameId: "atual" },
  execucao: { animalId, propriedadeId: 2, protocolo: { tipo: "SANITARIO" }, rodada: null } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx.visitaVeterinaria.findFirst.mockResolvedValue({ id: visitaId, data: new Date("2026-01-01"), propriedadeId: 2, status: "ABERTA", encerradaEm: null });
  mocks.tx.atividadeVisita.aggregate.mockResolvedValue({ _max: { ordem: 0 } });
  mocks.tx.atividadeVisita.create.mockResolvedValue({ id: atividadeId });
  mocks.tx.atividadeVisita.findFirst.mockResolvedValue({ id: atividadeId, tipo: "APLICACAO_SANITARIA" });
  mocks.tx.participanteVisita.findUnique.mockResolvedValue({ id: participanteId, atividadeId, animalId, tarefaId });
  mocks.tx.tarefaProtocolo.findFirst.mockResolvedValue(tarefa());
  mocks.tx.tarefaProtocolo.findMany.mockResolvedValue([tarefa()]);
  mocks.tx.animal.findMany.mockResolvedValue([{ id: animalId, sexo: "F", dataNascimento: new Date("2020-01-01"), atualizadoEm: new Date("2026-01-01") }]);
  mocks.tx.localizacaoAnimal.findMany.mockResolvedValue([{ animalId, propriedadeId: 2, lote: null }]);
  mocks.estados.mockResolvedValue(new Map([[animalId, { situacao: "VAZIA", partos: 1, tentativasCiclo: 0, restricoes: [] }]]));
  mocks.contextos.mockResolvedValue(new Map()); mocks.retornos.mockResolvedValue(new Map());
});

describe("parâmetros sanitários nos três retornos de visita", () => {
  it("congela os parâmetros diretos no snapshot da atividade, incluindo tarefa futura", async () => {
    await adicionarAtividadeTx(mocks.tx as unknown as Prisma.TransactionClient, visitaId, atividadeSchema.parse({
      propriedadeId: 2, tipo: "APLICACAO_SANITARIA", nome: "Aplicação", participantes: [{ animalId, tarefaSanitariaId: tarefaId }],
    }), 7);
    const criado = mocks.tx.participanteVisita.createMany.mock.calls[0][0].data[0];
    expect(criado.snapshot.tarefaPlanejada).toMatchObject({ origem: "SANITARIA", tarefa: { ...parametros, id: tarefaId, animalId } });
    expect(criado.snapshot.tarefaPlanejada.tarefa.custoUnitario).toBeUndefined();
  });
  it("expõe os mesmos parâmetros congelados nas sugestões", async () => {
    const r = await sugestoesVisita(2, "2026-02-01");
    expect(r.tarefasSanitarias[0]).toMatchObject({ ...parametros, id: tarefaId, animalId });
    expect(r.tarefasSanitarias[0]).not.toHaveProperty("custoUnitario");
  });
  it("consulta tarefa futura específica com os parâmetros e o escopo preservados", async () => {
    const r = await tarefaParticipanteVisita(visitaId, participanteId, 2);
    expect(r).toMatchObject({ origem: "SANITARIA", tarefa: { ...parametros, id: tarefaId, animalId } });
    expect(r.tarefa).not.toHaveProperty("custoUnitario");
    expect(mocks.tx.tarefaProtocolo.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: tarefaId, execucao: { animalId, propriedadeId: 2, protocolo: { tipo: "SANITARIO" } } },
    }));
    mocks.tx.tarefaProtocolo.findFirst.mockResolvedValue(null);
    await expect(tarefaParticipanteVisita(visitaId, participanteId, 2)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
  });
});

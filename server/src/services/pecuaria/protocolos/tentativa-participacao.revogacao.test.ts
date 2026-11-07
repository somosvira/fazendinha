import type { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
import type { IdentidadeRequisicao } from "../requisicoes.js";

const m = vi.hoisted(() => ({
  alvo: vi.fn(),
  transacao: vi.fn(),
  trava: vi.fn(),
  lerVinculo: vi.fn(),
  revogar: vi.fn(),
  auditar: vi.fn(),
  alertas: vi.fn(),
  criarDemandas: vi.fn(),
  reconciliarDemandas: vi.fn(),
  lerRequisicao: vi.fn(),
  guardarRequisicao: vi.fn(),
  atualizarDemanda: vi.fn(),
  atualizarConclusao: vi.fn(),
  executarSql: vi.fn(),
}));
vi.mock("../../../db.js", () => ({
  prisma: { vinculoTentativaParticipacao: { findFirst: m.alvo } },
}));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: m.transacao }));
vi.mock("../rebanho/regras.js", async (original) => ({
  ...(await original<typeof import("../rebanho/regras.js")>()),
  travarAnimais: m.trava,
  auditar: m.auditar,
}));
vi.mock("../reproducao/acompanhamento.js", () => ({
  criarDemandasDoFatoTx: m.criarDemandas,
  reconciliarDemandasAnimalTx: m.reconciliarDemandas,
}));
vi.mock("../reproducao/alertas/produtor.js", () => ({
  reconciliarAlertasReprodutivosAnimalTx: m.alertas,
}));

import { revogarTentativaParticipacao } from "./tentativa-participacao.js";

const input = {
  chave: "07000000-0000-4000-8000-000000000001",
  propriedadeId: 7,
  motivo: "Associação documental revista pelo responsável",
};
const tx = {
  vinculoTentativaParticipacao: { findFirst: m.lerVinculo, update: m.revogar },
  requisicaoPecuaria: {
    findUnique: m.lerRequisicao,
    create: m.guardarRequisicao,
  },
  demandaAcompanhamentoReprodutivo: { update: m.atualizarDemanda },
  vinculoConclusaoAcompanhamento: { update: m.atualizarConclusao },
  $executeRaw: m.executarSql,
};
let vinculo: {
  id: string;
  revogadoEm: Date | null;
  participacao: { animalId: string };
};
type RegistroRequisicao = IdentidadeRequisicao & {
  resultadoIds: Prisma.InputJsonValue;
};
let requisicao: RegistroRequisicao | null;
let eventos: string[];

beforeEach(() => {
  vi.resetAllMocks();
  vinculo = {
    id: "vinculo",
    revogadoEm: null,
    participacao: { animalId: "animal" },
  };
  requisicao = null;
  eventos = [];
  m.alvo.mockResolvedValue({ participacao: { animalId: "animal" } });
  m.transacao.mockImplementation(
    (executar: (t: typeof tx) => Promise<unknown>) => executar(tx),
  );
  m.trava.mockImplementation(async () => {
    eventos.push("trava");
  });
  m.lerVinculo.mockImplementation(async () => {
    eventos.push("leitura");
    return vinculo;
  });
  m.revogar.mockImplementation(
    async ({ data }: { data: { revogadoEm: Date } }) => {
      eventos.push("revogar");
      vinculo = { ...vinculo, ...data };
      return vinculo;
    },
  );
  m.auditar.mockImplementation(async () => {
    eventos.push("auditar");
  });
  m.alertas.mockImplementation(async () => {
    eventos.push("alertas");
    // O produtor precisa enxergar a associação já revogada para reabrir PREPARO.
    expect(vinculo.revogadoEm).toBeInstanceOf(Date);
  });
  m.lerRequisicao.mockImplementation(async () => requisicao);
  m.guardarRequisicao.mockImplementation(
    async ({ data }: { data: RegistroRequisicao }) => {
      eventos.push("guardar");
      requisicao = data;
      return data;
    },
  );
});

it("reconcilia apenas alertas do mesmo animal na transação já travada, sem tocar DG ou sua conclusão", async () => {
  const resposta = await revogarTentativaParticipacao("vinculo", input, 27);
  expect(eventos).toEqual([
    "trava",
    "leitura",
    "revogar",
    "auditar",
    "alertas",
    "guardar",
  ]);
  expect(m.trava).toHaveBeenCalledWith(tx, ["animal"]);
  expect(m.alertas).toHaveBeenCalledTimes(1);
  expect(m.alertas).toHaveBeenCalledWith(tx, "animal", 27);
  expect(m.auditar).toHaveBeenCalledWith(
    tx,
    expect.objectContaining({
      acao: "REVOGACAO_VINCULO",
      animalId: "animal",
      usuarioId: 27,
    }),
  );
  expect(m.criarDemandas).not.toHaveBeenCalled();
  expect(m.reconciliarDemandas).not.toHaveBeenCalled();
  expect(m.atualizarDemanda).not.toHaveBeenCalled();
  expect(m.atualizarConclusao).not.toHaveBeenCalled();
  expect(resposta).toEqual({
    id: "vinculo",
    revogadoEm: vinculo.revogadoEm?.toISOString(),
  });
});

it("reenvio da mesma chave recupera o recibo sem repetir revogação, auditoria ou publicação de alertas", async () => {
  const primeira = await revogarTentativaParticipacao("vinculo", input, 27);
  const reenvio = await revogarTentativaParticipacao("vinculo", input, 27);
  expect(reenvio).toEqual(primeira);
  expect(m.revogar).toHaveBeenCalledTimes(1);
  expect(m.auditar).toHaveBeenCalledTimes(1);
  expect(m.alertas).toHaveBeenCalledTimes(1);
  expect(m.alertas).toHaveBeenCalledWith(tx, "animal", 27);
  expect(m.guardarRequisicao).toHaveBeenCalledTimes(1);
  expect(m.reconciliarDemandas).not.toHaveBeenCalled();
});

it("mesma chave com outros dados continua recusada sem reconciliar alertas novamente", async () => {
  await revogarTentativaParticipacao("vinculo", input, 27);
  await expect(
    revogarTentativaParticipacao(
      "vinculo",
      { ...input, motivo: "Outro motivo documental para a mesma chave" },
      27,
    ),
  ).rejects.toThrow("Chave de reenvio usada com outros dados");
  expect(m.revogar).toHaveBeenCalledTimes(1);
  expect(m.alertas).toHaveBeenCalledTimes(1);
});

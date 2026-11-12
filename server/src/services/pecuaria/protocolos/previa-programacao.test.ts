import { expect, it, vi } from "vitest";
import { AvisoAptidaoProgramacao } from "../reproducao/elegibilidade.js";
import { preverAutomacoesAdesao } from "./automacao.js";
import { RebanhoError } from "../rebanho/regras.js";
import { conferirDisponibilidadeTx } from "../reproducao/registros.js";
import { preverParticipacaoIndividual } from "./operacao.js";
import { preverProgramacaoColetiva } from "./previa-programacao.js";

const animais = vi.hoisted(() => [
  { id: "00000000-0000-4000-8000-000000000001", brinco: "DEV-001", nome: null },
  { id: "00000000-0000-4000-8000-000000000002", brinco: "DEV-002", nome: "Aurora" },
]);
vi.mock("../transacao.js", () => ({
  transacaoPecuaria: (executar: (tx: unknown) => unknown) => executar({
    animal: { findMany: async () => [...animais].reverse() },
  }),
}));
vi.mock("../reproducao/registros.js", () => ({ conferirDisponibilidadeTx: vi.fn() }));
vi.mock("./operacao.js", () => ({ preverParticipacaoIndividual: vi.fn() }));
vi.mock("./automacao.js", () => ({ preverAutomacoesAdesao: vi.fn() }));

it("bloqueia a prévia quando um participante posterior não tem aptidão", async () => {
  vi.mocked(conferirDisponibilidadeTx).mockResolvedValueOnce({} as Awaited<ReturnType<typeof conferirDisponibilidadeTx>>)
    .mockRejectedValueOnce(new RebanhoError("VALIDACAO", "Animal sem aptidão confirmada nesta data", "animalId"));
  await expect(preverProgramacaoColetiva({
    propriedadeId: 1,
    protocoloId: "00000000-0000-4000-8000-000000000003",
    inicioReferencia: "2026-01-10",
    animaisIds: animais.map(animal => animal.id),
    cienciaSanitaria: true,
  })).rejects.toMatchObject({ campo: "animalId", message: "DEV-002 · Aurora: Animal sem aptidão confirmada nesta data" });
  expect(conferirDisponibilidadeTx).toHaveBeenNthCalledWith(2, expect.anything(), animais[1].id, 1, expect.any(Date), "IATF", true);
  expect(preverParticipacaoIndividual).not.toHaveBeenCalled();
});

it("lista os animais com aviso de aptidão na prévia da nova programação", async () => {
  vi.mocked(conferirDisponibilidadeTx).mockRejectedValue(new AvisoAptidaoProgramacao("Aguarda exame"));
  vi.mocked(preverParticipacaoIndividual).mockResolvedValueOnce({
    tipo: "REPRODUTIVO", modo: "INDIVIDUAL", animal: animais[0], propriedadeId: 1,
    inicioReferencia: "2026-01-10", precisaoTemporal: "DIA", avisos: [],
    protocolo: { id: "protocolo", tipo: "REPRODUTIVO", nome: "Protocolo", versao: 1 },
    itens: [], total: 0, pagina: 1, porPagina: 10,
  });
  vi.mocked(preverAutomacoesAdesao).mockResolvedValueOnce({ itens: [], automacaoHabilitada: false, referencia: "2026-01-10" });
  await expect(preverProgramacaoColetiva({
    propriedadeId: 1,
    protocoloId: "00000000-0000-4000-8000-000000000003",
    inicioReferencia: "2026-01-10",
    animaisIds: animais.map(animal => animal.id),
    aptidaoComoAviso: true,
  })).resolves.toMatchObject({
    participantes: animais,
    avisosAptidao: [
      { animalId: animais[0].id, mensagem: "DEV-001: Aguarda exame" },
      { animalId: animais[1].id, mensagem: "DEV-002 · Aurora: Aguarda exame" },
    ],
  });
});

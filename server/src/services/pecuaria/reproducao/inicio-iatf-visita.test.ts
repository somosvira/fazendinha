import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmarInicioIatfVisitaTx, prepararContextoInicioIatfTx } from "./inicio-iatf-visita.js";
import { carregarVersaoTx } from "../protocolos/versoes.js";
import { criarParticipacaoPlanejadaTx, iniciarParticipanteTx } from "./iatf.js";
import { criarProgramacaoReprodutivaTx } from "../protocolos/reproducao.js";
vi.mock("../protocolos/versoes.js", () => ({ carregarVersaoTx: vi.fn() }));
vi.mock("../protocolos/reproducao.js", () => ({ resolverIdReprodutivoTx: vi.fn(async (_tx, _tipo, id) => id), criarProgramacaoReprodutivaTx: vi.fn() }));
vi.mock("./iatf.js", () => ({ criarParticipacaoPlanejadaTx: vi.fn(), iniciarParticipanteTx: vi.fn() }));
vi.mock("../rebanho/regras.js", async importar => ({ ...await importar<typeof import("../rebanho/regras.js")>(), auditar: vi.fn() }));
const protocoloId = randomUUID(), animalId = randomUUID(), programaId = randomUUID(), participanteId = randomUUID();
const protocolo = { id: protocoloId, nome: "Protocolo escolhido", versao: 2, ativo: true, publicado: true, publicadoEm: new Date() };
const vinculo = { versao: 1, protocoloId, nomeProtocolo: protocolo.nome, versaoProtocolo: 2 };
const atividade = { id: randomUUID(), nome: "Grupo início", contexto: { protocoloId, inicioIatf: vinculo } };
const participante = { id: participanteId, animalId, protocoloId, propriedadeId: 1, inicioEfetivo: null, canceladaEm: null,
  rodada: { id: programaId, status: "ABERTA", propriedadeId: 1 } };
function transacao(pendencias: unknown[] = [], contexto: unknown = atividade.contexto) {
  const mock = { atividadeVisita: { findUniqueOrThrow: vi.fn().mockResolvedValue({ ...atividade, contexto }), update: vi.fn() },
    participacaoProtocolo: { findMany: vi.fn().mockResolvedValue(pendencias) }, programacaoProtocolo: { findFirst: vi.fn() } };
  return { tx: mock as unknown as Prisma.TransactionClient, mock };
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(carregarVersaoTx).mockResolvedValue(protocolo as Awaited<ReturnType<typeof carregarVersaoTx>>);
  vi.mocked(criarProgramacaoReprodutivaTx).mockResolvedValue({ id: programaId } as Awaited<ReturnType<typeof criarProgramacaoReprodutivaTx>>);
  vi.mocked(criarParticipacaoPlanejadaTx).mockResolvedValue({ id: participanteId } as Awaited<ReturnType<typeof criarParticipacaoPlanejadaTx>>); });
const dados = { inicioEfetivo: "2026-10-14", cienciaSanitaria: true };
describe("contrato de início IATF na visita", () => {
  it("preparação conserva versão sem criar programação/participação", async () => {
    const { tx } = transacao();
    expect(await prepararContextoInicioIatfTx(tx, { protocoloId })).toEqual(atividade.contexto);
    expect(criarProgramacaoReprodutivaTx).not.toHaveBeenCalled(); expect(criarParticipacaoPlanejadaTx).not.toHaveBeenCalled();
    await expect(prepararContextoInicioIatfTx(tx, { protocoloId, inicioIatf: vinculo })).rejects.toThrow("vínculo");
  });
  it("sem pendência cria no núcleo comum e começa sem executar tarefas", async () => {
    const { tx, mock } = transacao();
    await confirmarInicioIatfVisitaTx(tx, atividade, animalId, 1, dados, null);
    expect(criarProgramacaoReprodutivaTx).toHaveBeenCalledWith(tx, { data: expect.objectContaining({ protocoloId, propriedadeId: 1, precisaoTemporal: "DIA" }) });
    expect(criarParticipacaoPlanejadaTx).toHaveBeenCalledWith(tx, programaId, animalId, dados.inicioEfetivo, null);
    expect(iniciarParticipanteTx).toHaveBeenCalledWith(tx, participanteId, 1, dados.inicioEfetivo, null, true);
    expect(mock.atividadeVisita.update).toHaveBeenCalledWith(expect.objectContaining({ data: { contexto: { protocoloId, inicioIatf: { ...vinculo, programacaoId: programaId, criadaPorId: null } } } }));
  });
  it("reutiliza única compatível; várias exigem decisão", async () => {
    const unica = transacao([participante]);
    await confirmarInicioIatfVisitaTx(unica.tx, atividade, animalId, 1, dados, null);
    expect(criarParticipacaoPlanejadaTx).not.toHaveBeenCalled();
    const varias = transacao([participante, { ...participante, id: randomUUID() }]);
    await expect(confirmarInicioIatfVisitaTx(varias.tx, atividade, animalId, 1, dados, null)).rejects.toThrow("várias participações");
  });
  it.each([
    { animalId: randomUUID() }, { propriedadeId: 2 }, { protocoloId: randomUUID() },
    { inicioEfetivo: new Date() }, { canceladaEm: new Date() }, { rodada: { status: "ENCERRADA", propriedadeId: 1 } },
    { rodada: { status: "ABERTA", propriedadeId: 2 } },
  ])("recusa participação explícita incompatível %j", async alteracao => {
    const { tx } = transacao([{ ...participante, ...alteracao }]);
    await expect(confirmarInicioIatfVisitaTx(tx, atividade, animalId, 1, { ...dados, participanteIatfId: participanteId }, null)).rejects.toThrow("incompatível");
    expect(iniciarParticipanteTx).not.toHaveBeenCalled(); expect(criarParticipacaoPlanejadaTx).not.toHaveBeenCalled();
  });
  it("reutiliza programação vinculada após validar destino/versão/sítio/autoria", async () => {
    const { tx, mock } = transacao([], { protocoloId, inicioIatf: { ...vinculo, programacaoId: programaId, criadaPorId: 9 } });
    mock.programacaoProtocolo.findFirst.mockResolvedValue({ id: programaId });
    await confirmarInicioIatfVisitaTx(tx, atividade, animalId, 1, dados, null);
    expect(mock.programacaoProtocolo.findFirst).toHaveBeenCalledWith({ where: { id: programaId, propriedadeId: 1, protocoloId, status: "ABERTA", criadoPorId: 9 } });
    expect(criarProgramacaoReprodutivaTx).not.toHaveBeenCalled();
    expect(criarParticipacaoPlanejadaTx).toHaveBeenCalledWith(tx, programaId, animalId, dados.inicioEfetivo, null);
  });
  it("recusa vínculo inválido e protocolo inativado; legado exige escolha explícita", async () => {
    const invalido = transacao([], { protocoloId, inicioIatf: { ...vinculo, programacaoId: programaId, criadaPorId: null } });
    await expect(confirmarInicioIatfVisitaTx(invalido.tx, atividade, animalId, 1, dados, null)).rejects.toThrow("não é compatível");
    const legado = transacao([], {});
    await expect(confirmarInicioIatfVisitaTx(legado.tx, atividade, animalId, 1, dados, null)).rejects.toThrow("explicitamente");
    vi.mocked(carregarVersaoTx).mockResolvedValue({ ...protocolo, ativo: false } as Awaited<ReturnType<typeof carregarVersaoTx>>);
    await expect(confirmarInicioIatfVisitaTx(transacao().tx, atividade, animalId, 1, dados, null)).rejects.toThrow("publicado e ativo");
  });
});

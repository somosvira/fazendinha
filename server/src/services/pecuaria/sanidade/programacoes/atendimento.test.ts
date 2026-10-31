import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({ publicar: vi.fn(), auditar: vi.fn() }));
vi.mock("../../../alertas/publicacao.js", () => ({ publicarAlertaTx: mocks.publicar }));
vi.mock("../../rebanho/regras.js", async original => ({ ...await original<typeof import("../../rebanho/regras.js")>(), auditar: mocks.auditar }));
import { vincularAplicacaoProgramacaoTx, vincularExameProgramacaoTx, revisarFatoProgramacaoTx, publicarEstadoProgramacaoTx } from "./atendimento.js";
const programa = { executor: "APLICACAO", produtoId: "produto", tipoExameId: "tipo" };
const n = { id: "n", sujeitoTipo: "ANIMAL", sujeitoId: "animal", propriedadeId: 1, revisao: 1, situacao: "PENDENTE", aplicacaoId: null, exameId: null, alertaId: "alerta", regraNecessidadeId: null, programacao: programa };
function fixture() {
  const fake = { necessidadeProgramacaoSanitaria: { findFirst: vi.fn().mockResolvedValue(n), findUniqueOrThrow: vi.fn().mockResolvedValue({ ...n, revisao: 2 }), findMany: vi.fn().mockResolvedValue([n]), update: vi.fn() },
    alerta: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "alerta", resumo: {}, proprietario: "fazendinha", produtor: "sanidade", tipo: "PROGRAMACAO", chaveOcorrencia: "chave", chaveAgrupamento: "grupo", titulo: "Fictícia", motivo: "Mês", prazo: null }) },
    aplicacaoProduto: { findUnique: vi.fn().mockResolvedValue({ status: "VALIDO" }) }, vinculoAtendimentoAlerta: { create: vi.fn() } };
  return { fake, tx: fake as unknown as Prisma.TransactionClient };
}
const input = { alertaId: "alerta", alertaRevisao: 1, confirmarCuidadoAlerta: true };
const fato = { id: "fato", animalId: "animal", propriedadeId: 1, produtoId: "produto", data: new Date("2030-01-01Z") };
beforeEach(() => vi.clearAllMocks());
describe("atendimento factual da programação", () => {
  it("vincula somente ocorrência escolhida e publica dentro da transação", async () => {
    const {tx,fake} = fixture(); await vincularAplicacaoProgramacaoTx(tx,input,fato,1);
    expect(fake.vinculoAtendimentoAlerta.create).toHaveBeenCalledWith({data:{aplicacaoId:"fato",necessidadeProgramaId:"n",criadoPorId:1}});
    expect(fake.necessidadeProgramacaoSanitaria.update).toHaveBeenCalledWith({where:{id:"n"},data:{aplicacaoId:"fato",situacao:"REALIZADO",revisao:{increment:1}}});
    expect(mocks.publicar).toHaveBeenCalledWith(tx,expect.objectContaining({comando:"ENCERRAR",origemId:"n"}),{usuarioId:1});
  });
  it("propaga falha da publicação para rollback do executor", async () => {
    mocks.publicar.mockRejectedValueOnce(new Error("Falha simulada")); const {tx} = fixture();
    await expect(vincularAplicacaoProgramacaoTx(tx,input,fato,1)).rejects.toThrow("Falha simulada");
  });
  it("recusa revisão vencida e outro animal antes do vínculo", async () => {
    const {tx,fake}=fixture(); await expect(vincularAplicacaoProgramacaoTx(tx,{...input,alertaRevisao:2},fato,1)).rejects.toMatchObject({code:"CONFLITO"});
    await expect(vincularAplicacaoProgramacaoTx(tx,input,{...fato,animalId:"outro"},1)).rejects.toMatchObject({code:"VALIDACAO"}); expect(fake.vinculoAtendimentoAlerta.create).not.toHaveBeenCalled();
  });
  it("exame sem resultado realizado não comprova atendimento", async () => {
    const {tx,fake}=fixture();fake.necessidadeProgramacaoSanitaria.findFirst.mockResolvedValue({...n,programacao:{...programa,executor:"EXAME_ANIMAL"}});
    await expect(vincularExameProgramacaoTx(tx,input,{id:"exame",animalId:"animal",propriedadeId:1,tipoExameId:"tipo",status:"VALIDO",realizacao:"NAO_REALIZADO"},1)).rejects.toMatchObject({code:"VALIDACAO"});expect(fake.vinculoAtendimentoAlerta.create).not.toHaveBeenCalled();
  });
  it("anulação preserva referência e reabre para revisão", async () => {
    const {tx,fake}=fixture();await revisarFatoProgramacaoTx(tx,{aplicacaoId:"fato"},"Anulação conferida",1);
    expect(fake.necessidadeProgramacaoSanitaria.update).toHaveBeenCalledWith({where:{id:"n"},data:{situacao:"NECESSITA_REVISAO",revisao:{increment:1}}});
    expect(mocks.publicar).toHaveBeenCalledWith(tx,expect.objectContaining({comando:"REABRIR"}),{usuarioId:1});
  });
});

it("transferência conserva alerta e separa agrupamento do sítio anterior",async()=>{const {tx,fake}=fixture();fake.necessidadeProgramacaoSanitaria.findUniqueOrThrow.mockResolvedValue({...n,revisao:2,propriedadeId:2,programacaoId:"prog",periodo:"CAMPANHA:2026-10"});await publicarEstadoProgramacaoTx(tx,"n",{usuarioId:1},"PUBLICAR");expect(mocks.publicar).toHaveBeenCalledWith(tx,expect.objectContaining({chaveOcorrencia:"chave",propriedadeId:2,chaveAgrupamento:JSON.stringify(["prog","CAMPANHA:2026-10",2])}),{usuarioId:1});});

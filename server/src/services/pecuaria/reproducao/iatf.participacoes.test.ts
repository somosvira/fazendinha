import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ participacoes:vi.fn(),programacoes:vi.fn(),participantes:vi.fn(),tarefas:vi.fn(),protocolos:vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma:{participacaoProtocolo:{findMany:mocks.participacoes},programacaoIatf:{findMany:mocks.programacoes},participanteIatf:{findMany:mocks.participantes},tarefaIatf:{findMany:mocks.tarefas},protocoloIatf:{findMany:mocks.protocolos}} }));
import { listarProgramacoes } from "./iatf.js";
beforeEach(() => { vi.clearAllMocks();mocks.participacoes.mockResolvedValue([{rodadaId:"programacao-a"}]);mocks.programacoes.mockResolvedValue([{id:"programacao-a",protocoloId:"versao-2"}]);mocks.participantes.mockResolvedValue([{id:"p",programacaoId:"programacao-a",animalId:"animal-a"}]);mocks.tarefas.mockResolvedValue([{id:"t",participanteId:"p"}]);mocks.protocolos.mockResolvedValue([{id:"versao-2",versao:2}]); });
it("filtra identidade comum por animal, finalidade e sítio antes de buscar tarefas", async () => {
 const resultado = await listarProgramacoes(4,undefined,"animal-a");
 expect(mocks.participacoes).toHaveBeenCalledWith({where:{animalId:"animal-a",protocolo:{tipo:"REPRODUTIVO"},propriedadeId:4},select:{rodadaId:true}});
 expect(mocks.programacoes).toHaveBeenCalledWith({where:{propriedadeId:4,id:{in:["programacao-a"]}},orderBy:{inicioPrevisto:"desc"}});
 expect(mocks.participantes).toHaveBeenCalledWith({where:{programacaoId:{in:["programacao-a"]},animalId:"animal-a"}});
 expect(mocks.tarefas).toHaveBeenCalledWith({where:{participanteId:{in:["p"]}},orderBy:{etapa:"asc"}});
 expect(resultado[0]).toMatchObject({protocolo:{versao:2},participantes:[{animalId:"animal-a",tarefas:[{id:"t"}]}]});
});
it("animal sem participação usa conjunto vazio, sem cair na consulta global limitada", async () => {
 mocks.participacoes.mockResolvedValue([]);mocks.programacoes.mockResolvedValue([]);mocks.participantes.mockResolvedValue([]);
 expect(await listarProgramacoes(7,undefined,"animal-b")).toEqual([]);
 expect(mocks.programacoes).toHaveBeenCalledWith(expect.objectContaining({where:{propriedadeId:7,id:{in:[]}}}));
});

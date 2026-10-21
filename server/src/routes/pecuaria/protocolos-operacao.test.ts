import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UsuarioContexto } from "../../services/auth/sessao.js";
import { uid } from "../../lib/uid.fixture.js";
const mocks = vi.hoisted(() => ({ cabecalho: vi.fn(), momentos: vi.fn(), previaComum: vi.fn(), confirmarComum: vi.fn(), reciboComum: vi.fn(), etapas: vi.fn(), tarefas: vi.fn(), procedimentos: vi.fn(), eventos: vi.fn(), previa: vi.fn(), participacoes: vi.fn(), programacoes: vi.fn(), versoes: vi.fn(), origensFato: vi.fn(), vinculosColetivos: vi.fn(), participantes: vi.fn(), previaExecucao: vi.fn(), registrar: vi.fn(), individual: vi.fn(), sanitario: vi.fn() }));
vi.mock("../../services/pecuaria/protocolos/operacao.js", () => ({ obterCabecalhoOperacao: mocks.cabecalho, listarMomentosOperacao: mocks.momentos, listarEtapasOperacao: mocks.etapas, listarTarefasOperacao: mocks.tarefas, listarProcedimentosOperacao: mocks.procedimentos, listarEventosTarefaOperacao: mocks.eventos, preverParticipacaoIndividual: mocks.previa, listarParticipacoesOperacao: mocks.participacoes, listarProgramacoesOperacao: mocks.programacoes, listarVersoesOperacao: mocks.versoes, listarOrigensFatoOperacao: mocks.origensFato, listarVinculosColetivosOperacao: mocks.vinculosColetivos, listarParticipantesOperacao: mocks.participantes }));
vi.mock("../../services/pecuaria/protocolos/eventos.js", async original => ({ ...await original<typeof import("../../services/pecuaria/protocolos/eventos.js")>(), registrarEventoTarefa: mocks.registrar }));
vi.mock("../../services/pecuaria/reproducao/iatf.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/iatf.js")>(), criarParticipacaoIndividualReprodutiva: mocks.individual, preverInicioExecucaoTarefa: mocks.previaExecucao }));
vi.mock("../../services/pecuaria/sanidade/protocolos.js", () => ({ iniciarExecucao: mocks.sanitario }));
vi.mock("../../services/pecuaria/protocolos/execucao.js",()=>({preverExecucaoProtocolo:mocks.previaComum,confirmarExecucaoProtocolo:mocks.confirmarComum,obterReciboExecucaoProtocolo:mocks.reciboComum}));
import { protocolosOperacaoRouter } from "./protocolos-operacao.js";
const id = uid(401), animalId = uid(402), protocoloId = uid(403);
function app(lancar = false, area = true, autenticado = true) {
  const usuario: UsuarioContexto = { id: 7, nome: "Teste", email: "teste@example.com", papel: "LEITOR", abas: [], areas: area ? ["pecuaria"] : [], flags: lancar ? ["lancar"] : [], dono: false, status: "ATIVO" };
  return new Hono<{ Variables: { usuario: UsuarioContexto } }>().use("*", async (c, next) => { if (autenticado) c.set("usuario", usuario); await next(); }).route("/", protocolosOperacaoRouter);
}
const post = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const evento = { chave: uid(404), propriedadeId: 114, tipo: "NAO_ATENDIDO", ocorridaEm: "2026-10-19T10:00:00-03:00", motivo: "Animal não localizado no manejo" };
const individual = { chave: uid(405), propriedadeId: 114, tipo: "REPRODUTIVO", protocoloId, animalId, inicioReferencia: "2026-10-19" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cabecalho.mockResolvedValue({ id, modo: "COLETIVO" });
  for (const mock of [mocks.momentos,mocks.etapas, mocks.tarefas, mocks.procedimentos, mocks.eventos, mocks.participantes, mocks.vinculosColetivos, mocks.origensFato]) mock.mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 });
  mocks.registrar.mockResolvedValue({ id: uid(406) }); mocks.individual.mockResolvedValue({ id }); mocks.sanitario.mockResolvedValue({ id }); mocks.previa.mockResolvedValue({ tarefas: [] });
});
describe("operação comum de protocolos", () => {
  it("exige sessão/área e protege a escrita por lançamento", async () => {
    expect((await app(false, true, false).request(`/programacoes/${id}`)).status).toBe(403);
    expect((await app(false, false).request(`/programacoes/${id}`)).status).toBe(403);
    expect((await app().request(`/tarefas/${id}/eventos`, post(evento))).status).toBe(403);
    expect((await app().request("/participacoes", post(individual))).status).toBe(403);
    expect(mocks.registrar).not.toHaveBeenCalled(); expect(mocks.individual).not.toHaveBeenCalled();
  });
  it("resolve o sítio do contexto e consulta os dois modos com paginação máxima de dez", async () => {
    const pagina = await app().request(`/programacoes/${id}/tarefas?propriedadeId=114&etapaId=${uid(407)}&pagina=2&porPagina=10&situacao=PENDENTES`);
    expect(pagina.status).toBe(200);
    expect(mocks.tarefas).toHaveBeenCalledWith({ programacaoId: id }, 114, expect.objectContaining({ pagina: 2, porPagina: 10, situacao: "PENDENTES", etapaId: uid(407) }), expect.objectContaining({ id: 7 }));
    expect((await app().request(`/participacoes/${id}/etapas?propriedadeId=114`)).status).toBe(200);
    expect(mocks.etapas).toHaveBeenCalledWith({ participacaoId: id }, 114, expect.objectContaining({ porPagina: 10 }));
    expect((await app().request(`/programacoes/${id}/tarefas?propriedadeId=114&porPagina=11`)).status).toBe(422);
    expect(mocks.tarefas).toHaveBeenCalledTimes(1);
    expect((await app().request(`/programacoes/${id}/participantes?propriedadeId=114&pagina=2`)).status).toBe(200);
    expect(mocks.participantes).toHaveBeenCalledWith({ programacaoId: id }, 114, expect.objectContaining({ pagina: 2, porPagina: 10 }));
    expect((await app().request(`/vinculos-coletivos?propriedadeId=114&tipo=REPRODUTIVO&animalId=${animalId}&pagina=2`)).status).toBe(200);
    expect(mocks.vinculosColetivos).toHaveBeenCalledWith(114, expect.objectContaining({ animalId, pagina: 2, porPagina: 10 }));
    expect((await app().request("/vinculos-coletivos?propriedadeId=114")).status).toBe(422);
    expect((await app().request(`/origens-fato?propriedadeId=114&animalId=${animalId}&fatoId=${id}`)).status).toBe(200);
    expect(mocks.origensFato).toHaveBeenCalledWith(114, expect.objectContaining({ animalId, fatoId: id, pagina: 1, porPagina: 10 }));
    expect((await app().request(`/origens-fato?propriedadeId=114&animalId=${animalId}&fatoId=${id}&porPagina=11`)).status).toBe(422);
    expect((await app().request(`/programacoes/${id}/participantes?propriedadeId=114&porPagina=11`)).status).toBe(422);
  });
  it("pagina versões publicadas e a prévia de execução, inclusive para leitura sem lançamento", async () => {
    mocks.versoes.mockResolvedValue({ itens: [], total: 0, pagina: 2, porPagina: 10 });
    mocks.previaExecucao.mockResolvedValue({ exigeCiencia: true, itens: [], total: 0, pagina: 1, porPagina: 10 });
    expect((await app().request("/versoes?propriedadeId=114&tipo=REPRODUTIVO&pagina=2")).status).toBe(200);
    expect(mocks.versoes).toHaveBeenCalledWith(expect.objectContaining({ tipo: "REPRODUTIVO", pagina: 2, porPagina: 10 }));
    expect((await app().request("/versoes?propriedadeId=114&tipo=REPRODUTIVO&porPagina=11")).status).toBe(422);
    const query = new URLSearchParams({ propriedadeId: "114", realizadaEm: "2026-10-19T10:00:00-03:00" });
    expect((await app().request(`/tarefas/${id}/previa-execucao?${query}`)).status).toBe(200);
    expect(mocks.previaExecucao).toHaveBeenCalledWith(id, expect.objectContaining({ propriedadeId: 114, realizadaEm: "2026-10-19T10:00:00-03:00", pagina: 1, porPagina: 10 }));
    query.set("porPagina", "11");
    expect((await app().request(`/tarefas/${id}/previa-execucao?${query}`)).status).toBe(422);
    expect(mocks.previaExecucao).toHaveBeenCalledTimes(1);
  });
  it("registra evento autorizado com autoria servidor e rejeita justificativa ausente", async () => {
    expect((await app(true).request(`/tarefas/${id}/eventos`, post(evento))).status).toBe(201);
    expect(mocks.registrar).toHaveBeenCalledWith(id, evento, 7);
    expect((await app(true).request(`/tarefas/${id}/eventos`, post({ ...evento, motivo: "" }))).status).toBe(422);
    expect((await app(true).request(`/tarefas/${id}/eventos`, post({ ...evento, registradoPorId: 99 }))).status).toBe(422);
    expect(mocks.registrar).toHaveBeenCalledTimes(1);
  });
  it("admite prévia sem lançamento e encaminha criação individual sem programação artificial", async () => {
    expect((await app().request("/participacoes/previa", post(individual))).status).toBe(200);
    const { chave: _chave, ...semChave } = individual;
    expect(mocks.previa).toHaveBeenCalledWith({ ...semChave, pagina: 1, porPagina: 10 });
    expect((await app(true).request("/participacoes", post(individual))).status).toBe(201);
    const { tipo: _tipo, ...entrada } = individual;
    expect(mocks.individual).toHaveBeenCalledWith(entrada, 7);
    expect((await app(true).request("/participacoes", post({ ...individual, tipo: "SANITARIO" }))).status).toBe(201);
    expect(mocks.sanitario).toHaveBeenCalledWith(expect.objectContaining({ animalId, protocoloId, inicio: individual.inicioReferencia, propriedadeId: 114 }), 7);
    expect(mocks.sanitario.mock.calls[0][0]).not.toHaveProperty("rodadaId");
  });
  it("valida IDs e propaga conflito sem repetir a operação", async () => {
    expect((await app().request("/programacoes/identificador-invalido?propriedadeId=114")).status).toBe(422);
    const { RebanhoError } = await import("../../services/pecuaria/rebanho/regras.js");
    mocks.registrar.mockRejectedValueOnce(new RebanhoError("CONFLITO", "Atendimento já registrado"));
    const resposta = await app(true).request(`/tarefas/${id}/eventos`, post(evento));
    expect(resposta.status).toBe(409); expect(await resposta.json()).toMatchObject({ code: "CONFLITO" });
    expect(mocks.registrar).toHaveBeenCalledTimes(1);
  });
  it("execução comum exige lançamento, valida os limites e usa autoria da sessão",async()=>{
    const execucao={versao:1,propriedadeId:114,itens:[{tipo:"APLICACAO",tarefaId:id,animalId,propriedadeId:114,data:"2026-10-19",nomeProdutoAplicado:"Produto",dose:"2",unidadeDose:"ML",origemInsumo:"BAIXA_ESTOQUE"}]};
    mocks.previaComum.mockResolvedValue({fingerprint:"a".repeat(64)});mocks.confirmarComum.mockResolvedValue({versao:1,total:1,itens:[]});
    expect((await app().request("/execucoes/previa",post(execucao))).status).toBe(403);
    expect((await app().request("/execucoes/confirmar",post({execucao,chave:uid(408),fingerprint:"a".repeat(64)}))).status).toBe(403);
    expect((await app(true).request("/execucoes/previa?pagina=2",post(execucao))).status).toBe(200);
    expect(mocks.previaComum).toHaveBeenCalledWith(execucao,{pagina:2,porPagina:10});
    expect((await app(true).request("/execucoes/previa?porPagina=11",post(execucao))).status).toBe(422);
    expect((await app(true).request("/execucoes/confirmar",post({execucao,chave:uid(408),fingerprint:"a".repeat(64)}))).status).toBe(201);
    expect(mocks.confirmarComum).toHaveBeenCalledWith({execucao,chave:uid(408),fingerprint:"a".repeat(64)},7);
    expect((await app(true).request("/execucoes/previa",post({...execucao,itens:Array.from({length:101},()=>execucao.itens[0])}))).status).toBe(422);
  });
  it("recibo e momentos usam paginação e escopo antes da leitura",async()=>{
    mocks.reciboComum.mockResolvedValue({versao:1,itens:[],total:0,pagina:2,porPagina:10});
    expect((await app().request(`/execucoes/${uid(408)}/itens?propriedadeId=114&pagina=2`)).status).toBe(200);
    expect(mocks.reciboComum).toHaveBeenCalledWith(uid(408),114,7,{pagina:2,porPagina:10});
    expect((await app().request(`/execucoes/${uid(408)}/itens?propriedadeId=114&porPagina=11`)).status).toBe(422);
    expect((await app().request(`/programacoes/${id}/momentos?propriedadeId=114&pagina=2`)).status).toBe(200);
    expect(mocks.momentos).toHaveBeenCalledWith({programacaoId:id},114,expect.objectContaining({pagina:2,porPagina:10}));
  });

});

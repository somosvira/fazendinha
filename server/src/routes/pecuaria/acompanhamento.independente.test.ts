import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exigeArea } from "../../middleware/permissao.js";
import { uid } from "../../lib/uid.fixture.js";
const mocks = vi.hoisted(() => ({ listar: vi.fn(), politicas: vi.fn(), criarPolitica: vi.fn(), previa: vi.fn(), adotar: vi.fn(), perda: vi.fn(), parto: vi.fn(), corrigirParto: vi.fn(), leitura: vi.fn(), escrita: vi.fn() }));
vi.mock("../../services/pecuaria/reproducao/acompanhamento.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/acompanhamento.js")>(), listarAcompanhamentosPaginados: mocks.listar, listarPoliticasAcompanhamento: mocks.politicas, criarPoliticaAcompanhamento: mocks.criarPolitica, previaAdocaoAcompanhamento: mocks.previa, adotarAcompanhamento: mocks.adotar }));
vi.mock("../../services/pecuaria/reproducao/registros.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/registros.js")>(), registrarPerda: mocks.perda, criarParto: mocks.parto, corrigirParto: mocks.corrigirParto }));
vi.mock("../../services/propriedade.js", async original => ({ ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita }));
import { rebanhoRouter } from "./rebanho.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
const perfil = (areas = ["pecuaria"], flags = ["lancar"]) => ({ id: 17, dono: false, areas, flags, abas: [], status: "ATIVO" });
function app(usuario: ReturnType<typeof perfil> | null = perfil()) {
  return new Hono().use("*", async (c, next) => { if (usuario) c.set("usuario" as never, usuario as never); await next(); }).use("*", exigeArea("pecuaria")).route("/", rebanhoRouter);
}
const body = (input: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
const base = () => ({ chave: uid(1), animalId: uid(2), propriedadeId: 1, data: "2026-01-20" });
const politica = () => ({ chave: uid(3), propriedadeId: 1, vigenteDesde: "2026-01-01", parametros: { versao: 1, efeito: "ALERTA", diagnostico: { diasAposTentativa: 0, tipoExameId: uid(4), tipoExameVersao: 2 }, reconfirmacoes: [{ ocorrencia: 1, diasAposPrimeiroPositivo: 30 }] } });
const raiz = "/reproducao/acompanhamento";
beforeEach(() => {
  vi.resetAllMocks(); mocks.leitura.mockResolvedValue(1); mocks.escrita.mockResolvedValue(1);
  mocks.listar.mockResolvedValue({ itens: [], pagina: 1, porPagina: 10, total: 0, totalPaginas: 1, resumo: { pendentes: 0 } }); mocks.politicas.mockResolvedValue([]); mocks.criarPolitica.mockResolvedValue({ id: uid(5) }); mocks.previa.mockResolvedValue({ propostas: [], revisao: "a".repeat(64) }); mocks.adotar.mockResolvedValue({ propostas: [] });
  mocks.perda.mockResolvedValue({ id: uid(6), tipoEncerramento: "PERDA" }); mocks.parto.mockResolvedValue({ id: uid(7), tipo: "ABORTO" }); mocks.corrigirParto.mockResolvedValue({ id: uid(7) });
});
describe("acompanhamento — autorização e contratos HTTP independentes", () => {
  it.each([{ nome: "sem sessão", usuario: null, status: 401 }, { nome: "sem área Pecuária", usuario: perfil(["financeiro"]), status: 403 }])("$nome não lê nem escreve política ou demanda", async ({ usuario, status }) => {
    const a = app(usuario);
    expect((await a.request(raiz)).status).toBe(status);
    expect((await a.request(`${raiz}/politicas`, body(politica()))).status).toBe(status);
    expect(mocks.listar).not.toHaveBeenCalled(); expect(mocks.criarPolitica).not.toHaveBeenCalled();
  });
  it("sem lançar mantém GET e não confirma política, adoção ou perda", async () => {
    const a = app(perfil(["pecuaria"], [])); expect((await a.request(`${raiz}?data=2026-01-20`)).status).toBe(200);
    for (const [url, input] of [[`${raiz}/politicas`, politica()], [`${raiz}/adocao`, { chave: uid(1), propriedadeId: 1, politicaId: uid(5), tentativaIds: [uid(6)], motivo: "Adoção explícita conferida", revisao: "a".repeat(64) }], ["/reproducao/perdas", { ...base(), gestacaoId: uid(6), motivo: "Observação clínica registrada" }]] as const) expect((await a.request(url, body(input))).status).toBe(403);
    expect(mocks.criarPolitica).not.toHaveBeenCalled(); expect(mocks.adotar).not.toHaveBeenCalled(); expect(mocks.perda).not.toHaveBeenCalled();
  });
  it("GET usa o sítio resolvido e não chama funções escritoras", async () => {
    mocks.leitura.mockResolvedValue(7); const a = app(perfil(["pecuaria"], []));
    expect((await a.request(`${raiz}?animalId=${uid(2)}&data=2026-01-20`)).status).toBe(200);
    expect(mocks.listar).toHaveBeenCalledWith(7, { animalId: uid(2), data: "2026-01-20", pagina: 1, porPagina: 10 });
    expect((await a.request(`${raiz}/politicas`)).status).toBe(200); expect(mocks.politicas).toHaveBeenCalledWith(7);
    for (const gravar of [mocks.criarPolitica, mocks.adotar, mocks.perda, mocks.parto]) expect(gravar).not.toHaveBeenCalled();
  });
  it.each(["animalId=invalido", "data=2026-02-31", "data=ontem", "porPagina=11"])("GET inválido %s recebe422 antes do serviço", async query => {
    expect((await app().request(`${raiz}?${query}`)).status).toBe(422); expect(mocks.listar).not.toHaveBeenCalled();
  });
  it("sítio indefinido não é convertido em consolidado silencioso", async () => {
    mocks.leitura.mockResolvedValue(null); expect((await app().request(raiz)).status).toBe(422); expect(mocks.listar).not.toHaveBeenCalled();
  });
  it("política clínica autorizada preserva tipo/versão configurados, prazo zero e autoria", async () => {
    mocks.escrita.mockResolvedValue(9); const input = politica();
    expect((await app().request(`${raiz}/politicas`, body(input))).status).toBe(201);
    expect(mocks.criarPolitica).toHaveBeenCalledWith({ ...input, propriedadeId: 9 }, 17);
  });
  it.each([{}, { versao: 1, efeito: "ALERTA", diagnostico: {}, reconfirmacoes: [] }, { versao: 1, efeito: "ALERTA", diagnostico: null, reconfirmacoes: [] }])("política sem configuração válida não chega ao serviço %#", async parametros => {
    expect((await app().request(`${raiz}/politicas`, body({ ...politica(), parametros }))).status).toBe(422); expect(mocks.criarPolitica).not.toHaveBeenCalled();
  });
  it("adoção exige fatos selecionados e fingerprint da prévia", async () => {
    expect((await app().request(`${raiz}/adocao/previa`, body({ propriedadeId: 1, politicaId: uid(5) }))).status).toBe(422);
    expect((await app().request(`${raiz}/adocao`, body({ chave: uid(1), propriedadeId: 1, politicaId: uid(5), tentativaIds: [uid(6)], motivo: "Adoção conferida", revisao: "invalida" }))).status).toBe(422);
    expect(mocks.previa).not.toHaveBeenCalled(); expect(mocks.adotar).not.toHaveBeenCalled();
  });
  it("conflito de política ou adoção é409 e mantém código do domínio", async () => {
    mocks.criarPolitica.mockRejectedValue(new RebanhoError("CONFLITO", "A versão foi alterada"));
    const r = await app().request(`${raiz}/politicas`, body(politica())); expect(r.status).toBe(409); expect(await r.json()).toMatchObject({ code: "CONFLITO", error: "A versão foi alterada" });
  });
  it.each([undefined, null, "", "  "])("causa desconhecida não dispensa explicação da perda %#", async motivo => {
    expect((await app().request("/reproducao/perdas", body({ ...base(), gestacaoId: uid(6), motivo, causaClinica: { estado: "DESCONHECIDA" } }))).status).toBe(422); expect(mocks.perda).not.toHaveBeenCalled();
  });
  it("perda com contexto e causa desconhecida é aceita sem laudo obrigatório", async () => {
    const input = { ...base(), gestacaoId: uid(6), motivo: "Observado retorno ao cio; causa desconhecida", causaClinica: { estado: "DESCONHECIDA" } };
    expect((await app().request("/reproducao/perdas", body(input))).status).toBe(201); expect(mocks.perda).toHaveBeenCalledWith(input, 17);
  });
  it.each([undefined, "", "  "])("novo aborto exige observação do contexto %#", async observacao => {
    expect((await app().request("/reproducao/partos", body({ ...base(), tipo: "ABORTO", observacao }))).status).toBe(422); expect(mocks.parto).not.toHaveBeenCalled();
  });
  it("novo aborto explicado usa o mesmo registro de parto, sem registrar PERDA paralela", async () => {
    expect((await app().request("/reproducao/partos", body({ ...base(), tipo: "ABORTO", observacao: "Observada expulsão fetal durante atendimento" }))).status).toBe(201);
    expect(mocks.parto).toHaveBeenCalledTimes(1); expect(mocks.perda).not.toHaveBeenCalled();
  });
  it("correção que muda desfecho para aborto exige explicação e UUID de fato é conservado", async () => {
    const input = { propriedadeId: 1, motivo: "Correção factual conferida", desfecho: "ABORTO" };
    mocks.corrigirParto.mockRejectedValueOnce(new RebanhoError("VALIDACAO", "Explique a observação e o contexto do aborto", "observacao"));
    expect((await app().request(`/reproducao/partos/${uid(7)}/correcao`, body(input))).status).toBe(422);
    expect(mocks.corrigirParto).toHaveBeenCalledWith(uid(7), input, 17);
    expect((await app().request(`/reproducao/partos/${uid(7)}/correcao`, body({ ...input, observacao: "Observação original do contexto fetal" }))).status).toBe(200);
    expect(mocks.corrigirParto).toHaveBeenCalledWith(uid(7), expect.objectContaining({ desfecho: "ABORTO", observacao: "Observação original do contexto fetal" }), 17);
  });
  it("correção independente com tipo histórico é delegada ao serviço sem exigir nova observação", async () => {
    const input = { propriedadeId: 1, motivo: "Responsável conferido na folha original", tipo: "ABORTO", responsavel: "José" };
    expect((await app().request(`/reproducao/partos/${uid(7)}/correcao`, body(input))).status).toBe(200);
    expect(mocks.corrigirParto).toHaveBeenCalledWith(uid(7), input, 17);
  });
});

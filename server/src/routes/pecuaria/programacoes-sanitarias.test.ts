import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
vi.mock("../../services/pecuaria/sanidade/programacoes/consulta.js", () => ({ cadastrarProgramacao: vi.fn(), consultarProgramacoes: vi.fn(), listarCadastrosProgramacoes: vi.fn().mockResolvedValue([{id:"p",ano:null,executor:null,vigenciaInicio:null,meses:[2]}]), obterCadastroProgramacao: vi.fn(), listarSitiosExportacao: vi.fn().mockResolvedValue([{id:1,nome:"Fictício"}]) }));
vi.mock("../../services/pecuaria/sanidade/programacoes/ativacao.js", () => ({ previaAtivacaoProgramacao: vi.fn(), ativarProgramacao: vi.fn() }));
vi.mock("../../services/propriedade.js", () => ({ resolverEscopoLeitura: vi.fn().mockResolvedValue(1), PropriedadeError: class extends Error {} }));
import { programacoesSanitariasRouter } from "./programacoes-sanitarias.js";
import { cadastrarProgramacao, consultarProgramacoes } from "../../services/pecuaria/sanidade/programacoes/consulta.js";
const usuario = { id: 1, status: "ATIVO", dono: true, areas: ["pecuaria"], abas: ["cadastros"], flags: [] };
function app(u: unknown = usuario) { return new Hono<{ Variables: { usuario: unknown } }>().use("*", async (c, next) => { c.set("usuario", u); return next(); }).route("/", programacoesSanitariasRouter); }
beforeEach(() => vi.clearAllMocks());
describe("programações sanitárias: autorização e consulta", () => {
  it("leitura de cadastro conserva ano original ausente sem escrita", async () => {
    const r=await app({...usuario,dono:false,abas:[]}).request("/cadastros");expect(r.status).toBe(200);expect(await r.json()).toEqual([{id:"p",ano:null,executor:null,vigenciaInicio:null,meses:[2]}]);expect(cadastrarProgramacao).not.toHaveBeenCalled();
  });
  it("exporta todos os meses autorizados sem truncar pela página e exige exportar", async () => {
    const eventos = Array.from({length:130},(_,i)=>({id:String(i)}));
    vi.mocked(consultarProgramacoes).mockResolvedValue({ ano:2030, mes:null, meses:[{mes:1,eventos,total:130}],itens:eventos.slice(0,100),total:130,pagina:1,tamanho:100 } as Awaited<ReturnType<typeof consultarProgramacoes>>);
    const response = await app().request("/exportacao?ano=2030&tamanho=100");
    expect(response.status).toBe(200); const body = await response.json(); expect(body.itens).toHaveLength(130); expect(body.meta).toMatchObject({completo:true,ano:2030,escopo:"SITIO"});
    expect((await app({...usuario,dono:false,flags:[]}).request("/exportacao?ano=2030")).status).toBe(403);
    expect((await app().request("/exportacao?ano=2030&mes=1")).status).toBe(422);
  });

  it("rejeita visitante, ponte sintética e outra área sem consultar origem", async () => {
    for (const u of [null, { ...usuario, id: 0 }, { ...usuario, areas: ["financeiro"], dono: false }]) expect((await app(u).request("/?ano=2030")).status).toBe(u && u.id > 0 ? 403 : 401);
    expect(consultarProgramacoes).not.toHaveBeenCalled();
  });
  it("GET somente consulta o recorte autorizado", async () => {
    vi.mocked(consultarProgramacoes).mockResolvedValue({ ano: 2030, mes: 2, meses: [], itens: [], total: 0, pagina: 1, tamanho: 30 });
    expect((await app().request("/?ano=2030&mes=2")).status).toBe(200);
    expect(consultarProgramacoes).toHaveBeenCalledWith(expect.objectContaining({ ano: 2030, mes: 2 }), 1);
    expect(cadastrarProgramacao).not.toHaveBeenCalled();
  });
  it("recusa ano ausente, parâmetro extra e mês inválido antes da consulta", async () => {
    for (const query of ["", "ano=2030&mes=13", "ano=2030&peso=200"]) expect((await app().request(`/?${query}`)).status).toBe(422);
    expect(consultarProgramacoes).not.toHaveBeenCalled();
  });
  it("leitor não cadastra e sítio divergente não grava", async () => {
    expect((await app({ ...usuario, dono: false, abas: [] }).request("/", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } })).status).toBe(403);
    const body = { propriedadeId: 2, nome: "Fictícia", tipo: "VERIFICACAO", meses: [2], precisao: "MES", recorrencia: "JANELA_ELEGIBILIDADE", publico: {}, sujeitoTipo: "SITIO" };
    expect((await app().request("/", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } })).status).toBe(403);
    expect(cadastrarProgramacao).not.toHaveBeenCalled();
  });
});

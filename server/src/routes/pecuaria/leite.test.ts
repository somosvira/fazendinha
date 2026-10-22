import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ consultar: vi.fn(), salvar: vi.fn(), candidatos: vi.fn(), configuracoes: vi.fn(), criarConfiguracao: vi.fn(), leitura: vi.fn(), escrita: vi.fn() }));
vi.mock("../../services/propriedade.js", async original => ({ ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita }));
vi.mock("../../services/pecuaria/leite/producao.js", () => ({ consultarFolha: mocks.consultar, salvarFolha: mocks.salvar, listarCandidatos: mocks.candidatos }));
vi.mock("../../services/pecuaria/leite/configuracoes.js", () => ({ listarConfiguracoes: mocks.configuracoes, criarConfiguracao: mocks.criarConfiguracao }));
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
import { leiteRouter } from "./leite.js";
const app = (opcoes: { autenticado?: boolean; lancar?: boolean; pecuaria?: boolean } = {}) => new Hono().use("*", async (c, next) => {
  if (opcoes.autenticado !== false) c.set("usuario" as never, { id: 7, dono: false, areas: opcoes.pecuaria === false ? ["financeiro"] : ["pecuaria"], flags: opcoes.lancar ? ["lancar"] : [], abas: [] } as never);
  await next();
}).route("/", leiteRouter);
const chave = "10000000-0000-4000-8000-000000000001";
const animalId = "20000000-0000-4000-8000-000000000001";
const posicaoId = "00000000-0000-4000-8000-000000000001";
const payload = { chave, propriedadeId: 2, dataOperacional: "2026-10-01", versaoEsperada: 0, medicoes: [{ animalId, posicaoId, estado: "MEDIDO", litros: 0 }] };
const post = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.leitura.mockResolvedValue(2); mocks.escrita.mockResolvedValue(2);
  mocks.consultar.mockResolvedValue({ id: null, versao: 0 }); mocks.salvar.mockResolvedValue({ id: chave, versao: 1 });
  mocks.configuracoes.mockResolvedValue({ vigente: null, historico: [] }); mocks.criarConfiguracao.mockResolvedValue({ id: chave });
  mocks.candidatos.mockResolvedValue({ itens: [], total: 0 });
});
describe("rotas de produção leiteira", () => {
  it("aplica sessão, área e lançamento no servidor", async () => {
    expect((await app({ autenticado: false }).request("/folha?dataOperacional=2026-10-01")).status).toBe(401);
    expect((await app({ pecuaria: false }).request("/folha?dataOperacional=2026-10-01")).status).toBe(403);
    expect((await app().request("/folha", post(payload))).status).toBe(403);
    expect((await app().request("/configuracoes", post({}))).status).toBe(403);
    expect(mocks.consultar).not.toHaveBeenCalled(); expect(mocks.salvar).not.toHaveBeenCalled();
    expect((await app().request("/folha?dataOperacional=2026-10-01")).status).toBe(200);
  });
  it("resolve sítio de leitura e recusa folha consolidada", async () => {
    await app().request("/folha?dataOperacional=2026-10-01");
    expect(mocks.consultar).toHaveBeenCalledWith(2, "2026-10-01");
    mocks.leitura.mockResolvedValue(null);
    expect((await app().request("/folha?dataOperacional=2026-10-01")).status).toBe(422);
    expect((await app().request("/configuracoes?data=2026-10-01")).status).toBe(422);
  });
  it("preserva zero explícito, versão, chave e autoria", async () => {
    expect((await app({ lancar: true }).request("/folha", post(payload))).status).toBe(200);
    expect(mocks.salvar).toHaveBeenCalledWith({ ...payload, animaisAdicionar: [], animaisExcluir: [] }, 7);
    expect(mocks.escrita).toHaveBeenCalledWith(expect.anything(), 2);
    expect((await app({ lancar: true }).request("/folha", post({ ...payload, medicoes: [{ animalId, posicaoId, estado: "MEDIDO" }] }))).status).toBe(422);
  });
  it("valida datas reais, limites de sítio e células duplicadas antes do serviço", async () => {
    expect((await app().request("/folha?dataOperacional=2026-02-30")).status).toBe(422);
    expect((await app().request("/folha?dataOperacional=2026-10-01&propriedadeId=2147483648")).status).toBe(422);
    expect((await app({ lancar: true }).request("/folha", post({ ...payload, medicoes: [payload.medicoes[0], payload.medicoes[0]] }))).status).toBe(422);
    expect(mocks.salvar).not.toHaveBeenCalled();
  });
  it("encaminha candidatos históricos e traduz conflito de versão", async () => {
    expect((await app().request("/candidatos?dataOperacional=2026-10-01&busca=Vaca&pagina=2")).status).toBe(200);
    expect(mocks.candidatos).toHaveBeenCalledWith(2, "2026-10-01", "Vaca", 2);
    mocks.salvar.mockRejectedValue(new RebanhoError("CONFLITO", "A folha mudou"));
    const resposta = await app({ lancar: true }).request("/folha", post(payload));
    expect(resposta.status).toBe(409); expect(await resposta.json()).toMatchObject({ code: "CONFLITO" });
  });
  it("configura posições de identidade estável sem exigir horário", async () => {
    const input = { chave, propriedadeId: 2, vigenteDesde: "2026-10-01", ordenhas: [{ posicaoId, nome: "Principal", ordem: 1 }] };
    expect((await app({ lancar: true }).request("/configuracoes", post(input))).status).toBe(201);
    expect(mocks.criarConfiguracao).toHaveBeenCalledWith(input, 7);
  });
});

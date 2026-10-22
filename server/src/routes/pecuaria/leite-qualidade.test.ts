import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ leitura: vi.fn(), escrita: vi.fn(), formatos: vi.fn(), criarFormato: vi.fn(), editarFormato: vi.fn(), registrar: vi.fn(), corrigir: vi.fn(), listar: vi.fn(), obter: vi.fn(), historico: vi.fn(), origens: vi.fn(), parametros: vi.fn(), upload: vi.fn(), confirmarUpload: vi.fn(), baixar: vi.fn() }));
vi.mock("../../db.js", () => ({ prisma: {} }));
vi.mock("../../services/propriedade.js", async original => ({ ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoLeitura: m.leitura, resolverEscopoEscrita: m.escrita }));
vi.mock("../../services/pecuaria/leite/qualidade.js", () => ({ listarFormatosQualidade: m.formatos, criarFormatoQualidade: m.criarFormato, editarFormatoQualidade: m.editarFormato, registrarQualidade: m.registrar, corrigirQualidade: m.corrigir, listarAmostrasQualidade: m.listar, obterAmostraQualidade: m.obter, historicoQualidade: m.historico, listarOrigensQualidade: m.origens, consultarParametrosQualidade: m.parametros }));
vi.mock("../../services/pecuaria/leite/qualidade.laudos.js", () => ({ solicitarLaudoQualidade: m.upload, confirmarLaudoQualidade: m.confirmarUpload, baixarLaudoQualidade: m.baixar }));
import { leiteQualidadeRouter } from "./leite-qualidade.js";
const uid = "10000000-0000-4000-8000-000000000001";
function app(opcoes: { autenticado?: boolean; area?: boolean; lancar?: boolean } = {}) {
  return new Hono().use("*", async (c, next) => {
    if (opcoes.autenticado !== false) c.set("usuario" as never, { id: 7, dono: false, areas: opcoes.area === false ? ["financeiro"] : ["pecuaria"], flags: opcoes.lancar ? ["lancar"] : [], abas: [] } as never);
    await next();
  }).route("/", leiteQualidadeRouter);
}
const post = (body: unknown, method = "POST") => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const coleta = { chave: uid, propriedadeId: 2, data: "2026-10-19", tipoExameId: uid, formatoExameHash: "a".repeat(64), sujeito: { tipo: "COLETIVO", origem: "Tanque conforme laudo" } };
beforeEach(() => { vi.resetAllMocks(); m.leitura.mockResolvedValue(2); m.escrita.mockResolvedValue(2); m.formatos.mockResolvedValue([]); m.listar.mockResolvedValue({ propriedadeId: 2, itens: [], total: 0, pagina: 1, tamanho: 30 }); m.registrar.mockResolvedValue({ id: uid }); m.criarFormato.mockResolvedValue({ id: uid }); m.historico.mockResolvedValue({ itens: [] }); m.obter.mockResolvedValue({ id: uid }); m.origens.mockResolvedValue({ itens: [] }); m.baixar.mockResolvedValue({ url: "https://signed.example/laudo" }); });
describe("autorização e escopo das rotas de qualidade do leite", () => {
  it("exige sessão, área e ação no servidor, inclusive formatos e laudos", async () => {
    expect((await app({ autenticado: false }).request("/formatos")).status).toBe(401);
    expect((await app({ area: false }).request("/formatos")).status).toBe(403);
    for (const path of ["/formatos", "/amostras", `/amostras/${uid}/correcoes`, `/amostras/${uid}/laudos/upload`, `/amostras/${uid}/laudos/confirmar`])
      expect((await app().request(path, post(coleta))).status).toBe(403);
    expect(m.registrar).not.toHaveBeenCalled(); expect(m.upload).not.toHaveBeenCalled();
  });
  it("leitor consulta dados clínicos sem permissão financeira, sempre no sítio resolvido", async () => {
    expect((await app().request("/amostras")).status).toBe(200);
    expect(m.listar).toHaveBeenCalledWith(2, { pagina: 1, tamanho: 30 });
    expect((await app().request(`/amostras/${uid}/historico?pagina=2&tamanho=5`)).status).toBe(200);
    expect(m.historico).toHaveBeenCalledWith(uid, 2, 2, 5);
    expect((await app().request(`/amostras/${uid}/laudos/${uid}/download`)).status).toBe(200);
    expect(m.baixar).toHaveBeenCalledWith(uid, uid, 2);
  });
  it("consolidado sem sítio é recusado antes de ler amostra, histórico ou documento", async () => {
    m.leitura.mockResolvedValue(null);
    for (const path of ["/amostras", `/amostras/${uid}`, `/amostras/${uid}/historico`, `/amostras/${uid}/laudos/${uid}/download`, "/origens?data=2026-10-19"])
      expect((await app().request(path)).status).toBe(422);
    expect(m.obter).not.toHaveBeenCalled(); expect(m.baixar).not.toHaveBeenCalled();
  });
  it("registra origem coletiva explícita com sítio autorizado e autor", async () => {
    expect((await app({ lancar: true }).request("/amostras", post(coleta))).status).toBe(201);
    expect(m.escrita).toHaveBeenCalledWith(expect.anything(), 2);
    expect(m.registrar).toHaveBeenCalledWith({ ...coleta, resultados: [] }, 7);
    expect((await app({ lancar: true }).request("/amostras", post({ ...coleta, sujeito: { ...coleta.sujeito, animalId: uid } }))).status).toBe(422);
  });
  it("nova versão usa tipoExameId anterior e campos definidos no laudo", async () => {
    const formato = { chave: uid, nome: "Laudo v2", campos: [{ codigo: "CAMPO", tipo: "NUMERO", unidade: "unidade informada" }] };
    expect((await app({ lancar: true }).request(`/formatos/${uid}/versoes`, post(formato))).status).toBe(201);
    expect(m.criarFormato).toHaveBeenCalledWith({ ...formato, campos: [{ ...formato.campos[0], obrigatorio: false }] }, 7, uid);
  });
  it("correção e upload não aceitam sítio nulo nem token ligado implicitamente a outro sítio", async () => {
    const correcao = { chave: uid, propriedadeId: null, versaoEsperada: 1, motivo: "Conferido", resultados: [{ campo: "CAMPO", valor: 0 }] };
    expect((await app({ lancar: true }).request(`/amostras/${uid}/correcoes`, post(correcao))).status).toBe(422);
    expect((await app({ lancar: true }).request(`/amostras/${uid}/laudos/confirmar`, post({ propriedadeId: 2, uploadToken: "token" }))).status).toBe(201);
    expect(m.confirmarUpload).toHaveBeenCalledWith(uid, 2, "token", 7);
  });
  it("origens históricas usam busca, data e paginação", async () => {
    expect((await app().request("/origens?data=2026-10-19&busca=leite&pagina=2")).status).toBe(200);
    expect(m.origens).toHaveBeenCalledWith(2, { data: "2026-10-19", busca: "leite", pagina: 2 });
  });
});

it("histórico por parâmetro valida período, exige sessão e resolve sítio sem valores financeiros", async () => {
  const path = "/parametros?campo=CPP&inicio=2026-10-01&fim=2026-10-21";
  m.parametros.mockResolvedValue({ itens: [], total: 0 });
  expect((await app({ autenticado: false }).request(path)).status).toBe(401);
  expect((await app({ area: false }).request(path)).status).toBe(403);
  expect((await app().request(path)).status).toBe(200);
  expect(m.parametros).toHaveBeenCalledWith(2, { campo: "CPP", inicio: "2026-10-01", fim: "2026-10-21", pagina: 1, tamanho: 20 });
  expect((await app().request(path.replace("fim=2026-10-21", "fim=2026-09-01"))).status).toBe(422);
  m.leitura.mockResolvedValue(null);
  expect((await app().request(path)).status).toBe(422);
});

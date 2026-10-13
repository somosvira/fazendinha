import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exigeArea } from "../../middleware/permissao.js";
import { uid } from "../../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({ leitura: vi.fn(), escrita: vi.fn(), painel: vi.fn(), tentativa: vi.fn(), avaliacao: vi.fn(), detalheVisita: vi.fn(), confirmar: vi.fn(), programacoes: vi.fn() }));
vi.mock("../../services/propriedade.js", async original => ({ ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita }));
vi.mock("../../services/pecuaria/reproducao/registros.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/registros.js")>(), painelReproducao: mocks.painel, criarTentativa: mocks.tentativa, criarAvaliacao: mocks.avaliacao }));
vi.mock("../../services/pecuaria/reproducao/visitas.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/visitas.js")>(), detalheVisita: mocks.detalheVisita, confirmarAtividade: mocks.confirmar }));
vi.mock("../../services/pecuaria/reproducao/iatf.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/iatf.js")>(), listarProgramacoes: mocks.programacoes }));
import { rebanhoRouter } from "./rebanho.js";
import { PropriedadeError } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";

const usuario = { id: 7, dono: false, areas: ["pecuaria"], flags: ["lancar"], abas: [] };
const app = (u: typeof usuario | null = usuario) => new Hono().use("*", async (c, next) => { if (u) c.set("usuario" as never, u as never); await next(); }).use("*", exigeArea("pecuaria")).route("/", rebanhoRouter);
const json = { "content-type": "application/json" };
const base = { chave: uid(1), animalId: uid(2), propriedadeId: 2, data: "2026-10-01" };
const payloadTentativa = { ...base, tipo: "IA", materialId: uid(3), origem: "DOCUMENTADA", justificativaSemOrigem: "Material documentado na ficha" };
const usuarioFinanceiro = { ...usuario, areas: ["pecuaria", "financeiro"], flags: ["lancar", "verValores"] };

beforeEach(() => {
  vi.resetAllMocks(); mocks.leitura.mockResolvedValue(2); mocks.escrita.mockResolvedValue(2);
  mocks.painel.mockResolvedValue({ animais: [], tentativas: [{ id: uid(1), quantidade: "1", valorProdutoAtribuido: "42.50", valorServicoAtribuido: "20" }] });
  mocks.tentativa.mockResolvedValue({ id: uid(1), quantidade: "1", valorProdutoAtribuido: "42.50", valorServicoAtribuido: "20" });
});

describe("V4: autorização e exposição de custos", () => {
  it("exige sessão e área, inclusive nas consultas", async () => {
    expect((await app(null).request("/reproducao")).status).toBe(401);
    expect((await app({ ...usuario, areas: ["estoque"] }).request("/reproducao")).status).toBe(403);
    expect(mocks.painel).not.toHaveBeenCalled();
  });
  it("bloqueia lançamento e confirmação coletiva sem a ação existente", async () => {
    const somenteLeitura = app({ ...usuario, flags: [] });
    for (const rota of ["/reproducao/tentativas", `/visitas/${uid(5)}/atividades/${uid(6)}/confirmacao`]) {
      expect((await somenteLeitura.request(rota, { method: "POST", headers: json, body: JSON.stringify(payloadTentativa) })).status).toBe(403);
    }
    expect(mocks.tentativa).not.toHaveBeenCalled(); expect(mocks.confirmar).not.toHaveBeenCalled();
  });
  it("mascara consulta e resposta de gravação; exige área Financeiro e verValores juntas", async () => {
    for (const u of [usuario, { ...usuario, flags: ["lancar", "verValores"] }, { ...usuario, areas: ["pecuaria", "financeiro"] }]) {
      const leitura = await app(u).request("/reproducao");
      expect(await leitura.json()).toMatchObject({ tentativas: [{ quantidade: "1", valorProdutoAtribuido: null, valorServicoAtribuido: null }] });
      const escrita = await app(u).request("/reproducao/tentativas", { method: "POST", headers: json, body: JSON.stringify(payloadTentativa) });
      expect(escrita.status).toBe(201);
      expect(await escrita.json()).toMatchObject({ quantidade: "1", valorProdutoAtribuido: null, valorServicoAtribuido: null });
    }
    expect(await (await app(usuarioFinanceiro).request("/reproducao")).json()).toMatchObject({ tentativas: [{ valorProdutoAtribuido: "42.50" }] });
  });
  it("impede atribuir ou limpar custo sem permissão, inclusive nos dados coletivos", async () => {
    for (const valorServicoAtribuido of [20, 0, null]) {
      expect((await app().request("/reproducao/tentativas", { method: "POST", headers: json, body: JSON.stringify({ ...payloadTentativa, valorServicoAtribuido }) })).status).toBe(403);
    }
    const item = { participanteId: uid(9), dados: { ...payloadTentativa, valorServicoAtribuido: 20 } };
    expect((await app().request(`/visitas/${uid(5)}/atividades/${uid(6)}/confirmacao`, { method: "POST", headers: json, body: JSON.stringify({ propriedadeId: 2, chave: uid(8), itens: [item] }) })).status).toBe(403);
    expect(mocks.tentativa).not.toHaveBeenCalled(); expect(mocks.confirmar).not.toHaveBeenCalled();
  });
  it("transmite escopo resolvido e autoria ao serviço", async () => {
    await app().request("/reproducao/tentativas", { method: "POST", headers: json, body: JSON.stringify(payloadTentativa) });
    expect(mocks.escrita).toHaveBeenCalledWith(expect.anything(), 2);
    expect(mocks.tentativa).toHaveBeenCalledWith(expect.objectContaining({ propriedadeId: 2, animalId: uid(2) }), 7);
    await app().request(`/reproducao/animais/${uid(2)}`);
    expect(mocks.painel).toHaveBeenCalledWith(2, uid(2));
  });
  it("recusa escopo inválido antes da escrita e não expõe fato de outro sítio", async () => {
    mocks.escrita.mockRejectedValue(new PropriedadeError("ESCOPO_INVALIDO", "Sítio inválido"));
    expect((await app().request("/reproducao/tentativas", { method: "POST", headers: json, body: JSON.stringify(payloadTentativa) })).status).toBe(400);
    expect(mocks.tentativa).not.toHaveBeenCalled();
    mocks.detalheVisita.mockRejectedValue(new RebanhoError("NAO_ENCONTRADO", "Visita não encontrada neste sítio"));
    expect((await app().request(`/visitas/${uid(5)}`)).status).toBe(404);
    expect(mocks.detalheVisita).toHaveBeenCalledWith(uid(5), 2);
  });
  it("mascara snapshots aninhados de visitas e conserva anotações e quantidades", async () => {
    mocks.detalheVisita.mockResolvedValue({ atividades: [{ contexto: { valorTotal: "500" }, participantes: [{ rascunho: { quantidade: 1, valorServicoAtribuido: "30", anotacaoOriginal: "P+" } }] }] });
    expect(await (await app().request(`/visitas/${uid(5)}`)).json()).toEqual({ atividades: [{ contexto: { valorTotal: null }, participantes: [{ rascunho: { quantidade: 1, valorServicoAtribuido: null, anotacaoOriginal: "P+" } }] }] });
  });
  it("protege custos nas programações e responde 404 para uma programação ausente no escopo", async () => {
    mocks.programacoes.mockResolvedValue([{ id: uid(4), participantes: [{ tarefas: [{ realizado: { quantidade: 1, valorServicoAtribuido: "30" } }] }] }]);
    const resposta = await app().request(`/reproducao/programacoes/${uid(4)}`);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ participantes: [{ tarefas: [{ realizado: { quantidade: 1, valorServicoAtribuido: null } }] }] });
    expect(mocks.programacoes).toHaveBeenCalledWith(2, uid(4));
    mocks.programacoes.mockResolvedValue([]);
    expect((await app().request(`/reproducao/programacoes/${uid(4)}`)).status).toBe(404);
  });
  it("recusa resultados desconhecidos e lotes acima de 100 sem gravar", async () => {
    expect((await app().request("/reproducao/avaliacoes", { method: "POST", headers: json, body: JSON.stringify({ ...base, resultado: "IATFCL" }) })).status).toBe(422);
    expect(mocks.avaliacao).not.toHaveBeenCalled();
    const itens = Array.from({ length: 101 }, (_, i) => ({ participanteId: uid(100 + i), status: "NAO_ATENDIDO", motivo: "Animal ausente" }));
    expect((await app().request(`/visitas/${uid(5)}/atividades/${uid(6)}/confirmacao`, { method: "POST", headers: json, body: JSON.stringify({ propriedadeId: 2, chave: uid(8), itens }) })).status).toBe(422);
    expect(mocks.confirmar).not.toHaveBeenCalled();
  });
});

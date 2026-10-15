import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({ criar: vi.fn(), corrigir: vi.fn(), painel: vi.fn(), salvarRascunho: vi.fn(), detalheVisita: vi.fn(), confirmarAtividade: vi.fn() }));
vi.mock("../../services/propriedade.js", async original => ({ ...await original<typeof import("../../services/propriedade.js")>(),
  resolverEscopoLeitura: vi.fn().mockResolvedValue(2), resolverEscopoEscrita: vi.fn().mockResolvedValue(2) }));
vi.mock("../../services/pecuaria/reproducao/registros.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/registros.js")>(),
  criarParto: mocks.criar, corrigirParto: mocks.corrigir, painelReproducao: mocks.painel }));
vi.mock("../../services/pecuaria/reproducao/visitas.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/visitas.js")>(),
  salvarRascunho: mocks.salvarRascunho, detalheVisita: mocks.detalheVisita, confirmarAtividade: mocks.confirmarAtividade }));
import { rebanhoRouter } from "./rebanho.js";

const usuario = { id: 7, dono: false, areas: ["pecuaria"], flags: ["lancar"], abas: [] };
const app = (u = usuario) => new Hono().use("*", async (c, next) => {
  c.set("usuario" as never, u as never); await next();
}).route("/", rebanhoRouter);
const parto = () => ({ id: uid(1), observacao: "Conferido", examesPosParto: [{ id: uid(3), valorServicoAtribuido: "125.50",
  resultados: [{ campo: "ESCORE", valor: "3.25" }, { campo: "ESCALA_MIN", valor: "0" }, { campo: "ESCALA_MAX", valor: "5" }] }] });
const rotas = [
  { rota: "/reproducao/partos", status: 201, corpo: { chave: uid(8), propriedadeId: 2, animalId: uid(2), data: "2026-01-01", desfecho: "NASCIMENTO" } },
  { rota: `/reproducao/partos/${uid(1)}/correcao`, status: 200, corpo: { propriedadeId: 2, motivo: "Conferência do registro", observacao: "Conferido" } },
];
beforeEach(() => {
  vi.clearAllMocks(); mocks.criar.mockResolvedValue(parto()); mocks.corrigir.mockResolvedValue(parto());
  mocks.painel.mockResolvedValue({ partos: [parto()] });
});

describe("rascunhos clínicos de visitas", () => {
  it.each(["AVALIACAO_REPRODUTIVA", "EXAME_SANITARIO"])("salva, relê e confirma %s sem apagar respostas nem expor custos", async tipo => {
    const resultados = [{ campo: "MEDIDA", valor: "0" }, { campo: "ACHADO", valor: false }, { campo: "NOTA", valor: 3.25 }];
    const rascunho = tipo === "AVALIACAO_REPRODUTIVA" ? { tipoExameId: uid(8), resultados } : { dados: { tipoExameId: uid(8), resultados } };
    const salvo = { id: uid(3), versaoRascunho: 1, rascunho: { ...rascunho, valorServicoAtribuido: 80, valor: 90 } };
    mocks.salvarRascunho.mockResolvedValue(salvo);
    mocks.detalheVisita.mockResolvedValue({ id: uid(1), atividades: [{ id: uid(2), tipo, participantes: [salvo] }] });
    mocks.confirmarAtividade.mockResolvedValue({ status: "CONCLUIDA", participantes: [salvo] });
    const esperado = { ...rascunho, valorServicoAtribuido: null, valor: null };
    const resposta = await app().request(`/visitas/${uid(1)}/participantes/${uid(3)}/rascunho`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ propriedadeId: 2, versaoRascunho: 0, rascunho }),
    });
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ rascunho: esperado });
    expect(mocks.salvarRascunho).toHaveBeenCalledWith(uid(1), uid(3), 2, rascunho, 7, 0);
    const consulta = await app({ ...usuario, flags: [] }).request(`/visitas/${uid(1)}`);
    expect(consulta.status).toBe(200);
    expect(await consulta.json()).toMatchObject({ atividades: [{ participantes: [{ rascunho: esperado }] }] });
    const confirmacao = await app().request(`/visitas/${uid(1)}/atividades/${uid(2)}/confirmacao`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ propriedadeId: 2, chave: uid(9), itens: [{ participanteId: uid(3), status: "CONFIRMADO" }] }),
    });
    expect(confirmacao.status).toBe(200);
    expect(await confirmacao.json()).toMatchObject({ participantes: [{ rascunho: esperado }] });
  });
});

describe("respostas de parto protegem custos e conservam escore", () => {
  it("mascara criação, reenvio e correção quando falta Financeiro ou verValores", async () => {
    for (const u of [usuario, { ...usuario, flags: ["lancar", "verValores"] }, { ...usuario, areas: ["pecuaria", "financeiro"] }]) {
      for (const r of rotas) for (let envio = 0; envio < 2; envio++) {
        const resposta = await app(u).request(r.rota, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r.corpo) });
        expect(resposta.status).toBe(r.status);
        expect(await resposta.json()).toMatchObject({ examesPosParto: [{ valorServicoAtribuido: null, resultados: parto().examesPosParto[0].resultados }] });
      }
    }
  });
  it("mantém a leitura clínica da ficha sem acesso financeiro", async () => {
    const resposta = await app({ ...usuario, flags: [] }).request(`/reproducao/animais/${uid(2)}`);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ partos: [{ examesPosParto: [{ valorServicoAtribuido: null, resultados: parto().examesPosParto[0].resultados }] }] });
  });
  it("permite custos apenas com área e permissão financeiras juntas", async () => {
    for (const r of rotas) {
      const resposta = await app({ ...usuario, areas: ["pecuaria", "financeiro"], flags: ["lancar", "verValores"] }).request(r.rota,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r.corpo) });
      expect(resposta.status).toBe(r.status); expect(await resposta.json()).toEqual(parto());
    }
  });
});

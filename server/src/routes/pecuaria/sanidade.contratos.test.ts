import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({ leitura: vi.fn(), escrita: vi.fn(), listar: vi.fn(), paginar: vi.fn(), detalhe: vi.fn(), reconciliar: vi.fn(), criar: vi.fn(), historico: vi.fn(), ocorrencias: vi.fn(), exames: vi.fn() }));
vi.mock("../../services/propriedade.js", () => ({ resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita }));
vi.mock("../../services/pecuaria/sanidade/aplicacoes.js", async (original) => ({ ...await original<typeof import("../../services/pecuaria/sanidade/aplicacoes.js")>(), listarAplicacoes: mocks.listar, listarAplicacoesPaginadas: mocks.paginar, reconciliarOrigem: mocks.reconciliar, criarAplicacao: mocks.criar }));
vi.mock("../../services/pecuaria/sanidade/detalhes.js", async (original) => ({ ...await original<typeof import("../../services/pecuaria/sanidade/detalhes.js")>(), obterAplicacao: mocks.detalhe }));
vi.mock("../../services/pecuaria/sanidade/exames.js", async (original) => ({ ...await original<typeof import("../../services/pecuaria/sanidade/exames.js")>(), obterHistoricoExame: mocks.historico, listarExames: mocks.exames }));
vi.mock("../../services/pecuaria/sanidade/ocorrencias.js", async (original) => ({ ...await original<typeof import("../../services/pecuaria/sanidade/ocorrencias.js")>(), listarOcorrencias: mocks.ocorrencias }));

import { sanidadeRouter } from "./sanidade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";

const usuario = { id: 7, dono: false, areas: ["pecuaria"], flags: ["lancar"], abas: [] };
const app = (verValores = false) => new Hono().use("*", async (c, next) => { c.set("usuario" as never, (verValores ? { ...usuario, areas: ["pecuaria", "financeiro"], flags: ["lancar", "verValores"] } : usuario) as never); await next(); }).route("/", sanidadeRouter);
const fato = { id: uid(1), animal: { id: uid(2), brinco: "GV3-01", nome: "Mimosa" }, dose: "2", valorProdutoAtribuido: "6", valorServicoAtribuido: null };
const json = { "content-type": "application/json" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.leitura.mockResolvedValue(2); mocks.escrita.mockResolvedValue(2);
  mocks.listar.mockResolvedValue([fato]); mocks.paginar.mockResolvedValue({ itens: [fato], pagina: 2, porPagina: 1, total: 3 });
});

describe("contratos sanitários de rastreabilidade", () => {
  it("opções de ocorrência e exames respeitam o sítio histórico explícito, não o cabeçalho atual", async () => {
    mocks.leitura.mockResolvedValue(3); mocks.escrita.mockResolvedValue(2);
    mocks.ocorrencias.mockResolvedValue([]); mocks.exames.mockResolvedValue([]);
    for (const [rota, consulta] of [["ocorrencias", mocks.ocorrencias], ["exames", mocks.exames]] as const) {
      const res = await app().request(`/${rota}?animalId=${uid(2)}&propriedadeId=2`, { headers: { "X-Propriedade-Id": "3" } });
      expect(res.status).toBe(200);
      expect(consulta).toHaveBeenCalledWith(uid(2), 2, expect.any(Object));
    }
    expect(mocks.leitura).not.toHaveBeenCalled();
  });
  it("consulta histórico paginado no sítio do exame e mascara valores dos snapshots", async () => {
    mocks.historico.mockResolvedValue({ exameId: uid(1), itens: [{ id: uid(2), antes: { valorServicoAtribuido: "120", valor: "120" }, depois: { valorServicoAtribuido: "200", valor: "200", resultadoNumero: "0" } }], total: 3, pagina: 2, tamanho: 1 });
    const resposta = await app().request(`/exames/${uid(1)}/historico?propriedadeId=2&pagina=2&tamanho=1`);
    expect(resposta.status).toBe(200);
    expect(mocks.historico).toHaveBeenCalledWith(uid(1), [2], 2, 1);
    expect(await resposta.json()).toMatchObject({ total: 3, itens: [{ antes: { valorServicoAtribuido: null, valor: null }, depois: { valorServicoAtribuido: null, valor: null, resultadoNumero: "0" } }] });
    const visivel = await app(true).request(`/exames/${uid(1)}/historico`);
    expect(await visivel.json()).toMatchObject({ itens: [{ depois: { valorServicoAtribuido: "200" } }] });
  });

  it("não consulta auditoria com paginação inválida", async () => {
    expect((await app().request(`/exames/${uid(1)}/historico?tamanho=101`)).status).toBe(400);
    expect(mocks.historico).not.toHaveBeenCalled();
  });
  it("mantém array padrão e fornece envelope paginado somente quando solicitado", async () => {
    const padrao = await app().request("/aplicacoes");
    expect(await padrao.json()).toEqual([{ ...fato, valorProdutoAtribuido: null }]);
    expect(mocks.paginar).not.toHaveBeenCalled();
    const pagina = await app(true).request("/aplicacoes?paginado=true&pagina=2&porPagina=1");
    expect(await pagina.json()).toEqual({ itens: [fato], pagina: 2, porPagina: 1, total: 3 });
    expect(mocks.paginar).toHaveBeenCalledWith(undefined, 2, expect.objectContaining({ pagina: 2, porPagina: 1 }));
  });

  it("oculta também valores da compra vinculada sem perder origem nem quantidades", async () => {
    mocks.detalhe.mockResolvedValue({ ...fato, produto: { id: uid(3), nome: "Vacina", unidade: "ML" }, compraDireta: { id: uid(4), quantidade: "10", unidade: "ML", quantidadeDestinada: "2", quantidadeDisponivel: "8", valorTotal: "30", operacao: { id: uid(5), numero: 11, descricao: "Vacina comprada", data: "2026-09-01" } } });
    const oculto = await app().request(`/aplicacoes/${uid(1)}`);
    expect(await oculto.json()).toMatchObject({ dose: "2", valorProdutoAtribuido: null, compraDireta: { quantidadeDisponivel: "8", valorTotal: null, operacao: { id: uid(5), numero: 11 } } });
    const visivel = await app(true).request(`/aplicacoes/${uid(1)}`);
    expect(await visivel.json()).toMatchObject({ valorProdutoAtribuido: "6", compraDireta: { valorTotal: "30" } });
  });

  it("encaminha ciência explícita e devolve o campo acionável quando falta equivalência", async () => {
    const payload = { propriedadeId: 2, origemInsumo: "BAIXA_ESTOQUE", produtoId: uid(3), motivo: "Embalagem conferida no almoxarifado", confirmarEquivalencia: true };
    mocks.reconciliar.mockResolvedValue(fato);
    const salva = await app().request(`/aplicacoes/${uid(1)}/origem`, { method: "POST", headers: json, body: JSON.stringify(payload) });
    expect(salva.status).toBe(200);
    expect(mocks.reconciliar).toHaveBeenCalledWith(uid(1), 2, expect.objectContaining({ confirmarEquivalencia: true, motivo: payload.motivo }), 7);
    mocks.reconciliar.mockRejectedValue(new RebanhoError("VALIDACAO", "Confirme que o Produto corresponde ao medicamento aplicado", "confirmarEquivalencia"));
    const erro = await app().request(`/aplicacoes/${uid(1)}/origem`, { method: "POST", headers: json, body: JSON.stringify({ ...payload, confirmarEquivalencia: false }) });
    expect(erro.status).toBe(422);
    expect(await erro.json()).toEqual({ error: "Confirme que o Produto corresponde ao medicamento aplicado", code: "VALIDACAO", campo: "confirmarEquivalencia" });
  });

  it("recusa texto como ciência e conserva erro em português", async () => {
    const erro = await app().request(`/aplicacoes/${uid(1)}/origem`, { method: "POST", headers: json, body: JSON.stringify({ propriedadeId: 2, origemInsumo: "BAIXA_ESTOQUE", produtoId: uid(3), motivo: "Produto conferido", confirmarEquivalencia: "true" }) });
    expect(erro.status).toBe(422);
    expect(await erro.json()).toEqual({ error: "Confirme que o Produto corresponde ao medicamento aplicado", code: "VALIDACAO", campo: "confirmarEquivalencia" });
    expect(mocks.reconciliar).not.toHaveBeenCalled();
  });
  it("conflito final do adapter responde em português com possibilidade de reenvio", async () => {
    mocks.reconciliar.mockRejectedValue(Object.assign(new Error("TransactionWriteConflict"), { name: "DriverAdapterError", cause: { kind: "TransactionWriteConflict" } }));
    const erro = await app().request(`/aplicacoes/${uid(1)}/origem`, { method: "POST", headers: json, body: JSON.stringify({ propriedadeId: 2, origemInsumo: "BAIXA_ESTOQUE", produtoId: uid(3), motivo: "Produto conferido", confirmarEquivalencia: true }) });
    expect(erro.status).toBe(409);
    expect(await erro.json()).toEqual({ error: "Os dados mudaram durante a confirmação. Recarregue e tente novamente.", code: "CONFLITO" });
  });

  it("compra direta recebe apenas dose e o item, recusando quantidade de destinação enviada pelo cliente", async () => {
    const payload = { animalId: uid(2), propriedadeId: 2, data: "2026-09-01", aplicadaEm: "2026-09-01T10:00:00-03:00", origemInsumo: "COMPRA_CONSUMO_DIRETO", produtoId: uid(3), nomeProdutoAplicado: "Vacina", dose: "2", unidadeDose: "ML", itemCompraDiretaId: uid(4) };
    mocks.criar.mockResolvedValue(fato);
    expect((await app().request("/aplicacoes", { method: "POST", headers: json, body: JSON.stringify(payload) })).status).toBe(201);
    expect(mocks.criar).toHaveBeenCalledWith(payload, 7);
    const indevida = await app().request("/aplicacoes", { method: "POST", headers: json, body: JSON.stringify({ ...payload, quantidadeCompraDireta: "20" }) });
    expect(indevida.status).toBe(422);
    expect(await indevida.json()).toMatchObject({ error: "Confira os campos informados para a aplicação", code: "VALIDACAO" });
    expect(mocks.criar).toHaveBeenCalledOnce();
  });
});

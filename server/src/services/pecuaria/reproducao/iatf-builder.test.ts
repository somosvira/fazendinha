import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ tx: { protocolo: { findFirst: vi.fn() }, produto: { findUnique: vi.fn() }, produtoCatalogo: { findUnique: vi.fn() }, materialGenetico: { findMany: vi.fn() } }, resolver: vi.fn(), criar: vi.fn(), auditar: vi.fn() }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: (f: (tx: unknown) => unknown) => f(m.tx), conflitoTransacaoPecuaria: vi.fn() }));
vi.mock("../../estoque/produtos-catalogo.js", () => ({ resolverProdutoIdTx: m.resolver, prefixarCampoErro: (e: unknown, prefixo: string) => { if (e && typeof e === "object" && "campo" in e) (e as { campo: string }).campo = prefixo + (e as { campo: string }).campo; return e; } }));
vi.mock("../../estoque/usos.js", () => ({ travarUsosProduto: vi.fn() }));
vi.mock("../sanidade/exames.js", () => ({ travarTiposExame: vi.fn(), registrarExameTx: vi.fn() }));
vi.mock("../protocolos/reproducao.js", async importOriginal => ({ ...await importOriginal<typeof import("../protocolos/reproducao.js")>(), criarProtocoloReprodutivoTx: m.criar }));
vi.mock("../rebanho/regras.js", async importOriginal => ({ ...await importOriginal<typeof import("../rebanho/regras.js")>(), auditar: m.auditar }));
import { criarProtocolo } from "./iatf.js";
import { protocoloSchema } from "./schemas.js";
const id = "00000000-0000-4000-8000-000000000001", catalogo = "00000000-0000-4000-8000-000000000002";
const input = () => protocoloSchema.parse({ nome: "Modelo", versao: 2, finalidade: "PRE_SINCRONIZACAO", origemVersaoId: id, etapas: [{ nome: "Aplicação", tipo: "APLICACAO", intervalo: 0, unidade: "DIAS", planoAplicacao: { produtoCatalogoId: catalogo, dose: "2", unidadeDose: "ML" } }] });
beforeEach(() => { vi.clearAllMocks(); m.tx.protocolo.findFirst.mockResolvedValue({ id, nome: "Modelo", referenciaTecnica: null }); m.tx.materialGenetico.findMany.mockResolvedValue([]); m.tx.produtoCatalogo.findUnique.mockResolvedValue({ ativo: true, usoSanitario: true }); m.tx.produto.findUnique.mockResolvedValue({ id, nome: "Medicamento", unidade: "ML", ativo: true, usoSanitario: true, perfilSanitarioProduto: null }); m.resolver.mockResolvedValue(id); m.criar.mockResolvedValue({ id, nome: "Modelo", versao: 2 }); });
it("resolve catálogo na transação e registra origem mesmo sem referência técnica", async () => {
  await criarProtocolo(input(), 7);
  expect(m.resolver).toHaveBeenCalledWith(m.tx, { produtoId: undefined, produtoCatalogoId: catalogo, categoriaId: undefined }, 7);
  const dado = m.criar.mock.calls[0][1].data;
  expect(dado.referenciaTecnica).toMatchObject({ protocoloOrigemId: id });
  expect(dado.etapas[0].planoAplicacao).toMatchObject({ produtoId: id, dose: "2" });
  expect(dado.etapas[0].planoAplicacao).not.toHaveProperty("produtoCatalogoId");
  expect(m.auditar).toHaveBeenCalledWith(m.tx, expect.objectContaining({ usuarioId: 7 }));
});
it("recusa unidade divergente do produto já adotado antes de criar a versão", async () => {
  m.tx.produto.findUnique.mockResolvedValue({ id, nome: "Medicamento", unidade: "L", ativo: true, usoSanitario: true, perfilSanitarioProduto: null });
  await expect(criarProtocolo(input(), 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "etapas.0.planoAplicacao.unidadeDose" });
  expect(m.criar).not.toHaveBeenCalled();
});
it("mantém produto existente e conversão de unidade do fluxo legado", async () => {
  m.tx.produto.findUnique.mockResolvedValue({ id, nome: "Medicamento", unidade: "L", ativo: true, usoSanitario: true, perfilSanitarioProduto: null });
  const legacy = protocoloSchema.parse({ nome: "Modelo", versao: 2, origemVersaoId: id, etapas: [{ nome: "Aplicação", tipo: "APLICACAO", intervalo: 0, unidade: "DIAS", planoAplicacao: { produtoId: id, dose: "2", unidadeDose: "ML" } }] });
  await criarProtocolo(legacy, 7);
  expect(m.criar.mock.calls[0][1].data.etapas[0].planoAplicacao).toMatchObject({ produtoId: id, unidadeDose: "ML" });
});
it("não copia referência de material do modelo antigo para o novo builder", async () => {
  const entrada = input();
  entrada.etapas[0].referenciasCusto = { material: { valorUnitario: "99", unidade: "ML", origem: "Tabela antiga", data: "2026-01-01" }, servico: { valorUnitario: "3", unidade: "POR_ATENDIMENTO", origem: "Tabela", data: "2026-01-01" } };
  await criarProtocolo(entrada, 7);
  expect(m.criar.mock.calls[0][1].data.etapas[0].referenciasCusto).toEqual({ servico: entrada.etapas[0].referenciasCusto.servico });
});
it("revalida catálogo mesmo quando pode haver produto já adotado", async () => {
  m.tx.produtoCatalogo.findUnique.mockResolvedValue({ ativo: false, usoSanitario: true });
  await expect(criarProtocolo(input(), 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "etapas.0.planoAplicacao.produtoCatalogoId" });
  expect(m.resolver).not.toHaveBeenCalled();
});

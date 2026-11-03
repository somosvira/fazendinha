import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({ preparar: vi.fn(), vincular: vi.fn(), travar: vi.fn() }));
vi.mock("../reproducao/peso-secagem.js", () => ({ prepararVinculoPesoSecagemTx: mocks.preparar, vincularPesoSecagemTx: mocks.vincular }));
vi.mock("../rebanho/regras.js", async original => ({ ...await original<typeof import("../rebanho/regras.js")>(), travarAnimais: mocks.travar }));
import { RebanhoError } from "../rebanho/regras.js";
import { prepararAssociacaoPesoSecagemHistoricaTx, registrarAssociacaoPesoSecagemHistoricaTx, associacaoPesoSecagemHistoricaSchema } from "./peso-secagem.js";
const pesoId = "00000000-0000-7000-8000-000000000001", lactacaoId = "00000000-0000-7000-8000-000000000002", animalId = "00000000-0000-7000-8000-000000000003", vinculoId = "00000000-0000-7000-8000-000000000004";
const peso = { id: pesoId, animalId, data: new Date("2024-01-05"), pesoKg: new Prisma.Decimal("510"), tipo: "SECAGEM", origem: "MANUAL", precisao: "ESTIMADO", contextoHistorico: "INTERNO", propriedadeId: 7 };
const entrada = () => ({ bancoOrigem: "IDEAGRI", chaveOrigem: "ASSOCIACAO_SECAGEM:1", pesagem: { id: pesoId }, lactacaoId, propriedadeId: 7, evidenciaEncerramento: "Encerramento conferido na ficha histórica da fazenda" });
function banco() {
  const tx = { pesagem: { findUnique: vi.fn().mockResolvedValue(peso), create: vi.fn() }, vinculoImportacaoPecuaria: { findUnique: vi.fn().mockResolvedValue({ entidadeDestino: "Pesagem", destinoId: pesoId }) } };
  return { tx: tx as unknown as Prisma.TransactionClient, spies: tx };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.preparar.mockResolvedValue({ lactacao: { id: lactacaoId, animalId, versao: 1, encerradaEm: new Date("2024-01-05") }, pesagem: peso, localizacao: { id: "local", propriedadeId: 7 }, vinculoExistente: null, snapshot: { versao: 1, lactacao: { id: lactacaoId, animalId, encerradaEm: "2024-01-05", versao: 1 }, pesagem: { id: pesoId, precisao: "ESTIMADO", pesoKg: "510" } } });
  mocks.vincular.mockResolvedValue({ id: vinculoId, lactacaoId, pesagemId: pesoId });
});
it("prévia comprovada reutiliza a pesagem e conserva identidade/precisão sem escrever", async () => {
  const { tx, spies } = banco(); const r = await prepararAssociacaoPesoSecagemHistoricaTx(tx, entrada(), 1);
  expect(r.contexto.associacaoSecagem).toMatchObject({ estado: "COMPROVADA", pesagemId: pesoId, lactacaoId });
  expect(JSON.stringify(r.contexto)).toContain("ESTIMADO"); expect(mocks.vincular).not.toHaveBeenCalled(); expect(spies.pesagem.create).not.toHaveBeenCalled();
});
it("referência por origem resolve somente o vínculo persistido da pesagem", async () => {
  const { tx, spies } = banco(); await prepararAssociacaoPesoSecagemHistoricaTx(tx, { ...entrada(), pesagem: { chaveOrigem: "PESO:1" } }, 1);
  expect(spies.vinculoImportacaoPecuaria.findUnique).toHaveBeenCalledWith({ where: { bancoOrigem_tabelaOrigem_chaveOrigem: { bancoOrigem: "IDEAGRI", tabelaOrigem: "PESO", chaveOrigem: "1" } } });
  expect(mocks.preparar).toHaveBeenCalledWith(tx, expect.objectContaining({ pesagemId: pesoId, lactacaoId }), 1);
});
it("sem lactação/evidência registra somente pendência sem ID de associação", async () => {
  const { tx } = banco(); const r = await prepararAssociacaoPesoSecagemHistoricaTx(tx, { ...entrada(), lactacaoId: null, evidenciaEncerramento: null }, 1);
  expect(r.pendente?.motivo).toMatch(/encerramento|lactação/i); expect(r.existenteId).toBeNull();
  expect(r.contexto.associacaoSecagem.estado).toBe("PENDENTE"); expect(mocks.preparar).not.toHaveBeenCalled(); expect(mocks.vincular).not.toHaveBeenCalled();
});
it("origem ainda não conciliada fica pendente, sem pesagem ou associação fictícia", async () => {
  const { tx, spies } = banco(); spies.vinculoImportacaoPecuaria.findUnique.mockResolvedValue(null);
  const r = await prepararAssociacaoPesoSecagemHistoricaTx(tx, { ...entrada(), pesagem: { chaveOrigem: "PESO:1" } }, 1);
  expect(r.pendente?.motivo).toMatch(/pesagem.*conciliada/i); expect(r.pesagemId).toBeNull(); expect(mocks.vincular).not.toHaveBeenCalled();
});
it("lactação aberta é pendência e nunca é encerrada pelo importador", async () => {
  mocks.preparar.mockRejectedValue(new RebanhoError("VALIDACAO", "A lactação ainda não foi encerrada", "encerradaEm"));
  const r = await prepararAssociacaoPesoSecagemHistoricaTx(banco().tx, entrada(), 1);
  expect(r.pendente).toBeTruthy(); expect(mocks.vincular).not.toHaveBeenCalled();
});
it("incompatibilidade comprovada de animal/data/sítio é conflito", async () => {
  mocks.preparar.mockRejectedValue(new RebanhoError("VALIDACAO", "A pesagem é de outro animal ou data", "pesoSecagem"));
  await expect(prepararAssociacaoPesoSecagemHistoricaTx(banco().tx, entrada(), 1)).rejects.toMatchObject({ campo: "pesoSecagem" });
});
it("grava somente pelo núcleo, retornando a identidade do vínculo e nunca outra pesagem", async () => {
  const { tx, spies } = banco(); const r = await registrarAssociacaoPesoSecagemHistoricaTx(tx, entrada(), 1);
  expect(r).toEqual({ id: vinculoId }); expect(mocks.travar).toHaveBeenCalledWith(tx, [animalId]);
  expect(mocks.vincular).toHaveBeenCalledWith(tx, expect.objectContaining({ lactacaoId, pesagemId: pesoId, propriedadeId: 7, evidenciaOrigem: expect.objectContaining({ bancoOrigem: "IDEAGRI", chaveOrigem: "ASSOCIACAO_SECAGEM:1" }) }), 1);
  expect(spies.pesagem.create).not.toHaveBeenCalled();
});
it("execução direta de associação pendente recusa retornar um ID fictício", async () => {
  await expect(registrarAssociacaoPesoSecagemHistoricaTx(banco().tx, { ...entrada(), lactacaoId: null }, 1)).rejects.toMatchObject({ code: "CONFLITO" }); expect(mocks.vincular).not.toHaveBeenCalled();
});
it("recusa origem que aponta a outra entidade e campos extras", async () => {
  const { tx, spies } = banco(); spies.vinculoImportacaoPecuaria.findUnique.mockResolvedValue({ entidadeDestino: "ExameAnimal", destinoId: pesoId });
  await expect(prepararAssociacaoPesoSecagemHistoricaTx(tx, { ...entrada(), pesagem: { chaveOrigem: "PESO:1" } }, 1)).rejects.toMatchObject({ code: "CONFLITO" });
  expect(associacaoPesoSecagemHistoricaSchema.safeParse({ ...entrada(), encerrarAutomaticamente: true }).success).toBe(false);
});

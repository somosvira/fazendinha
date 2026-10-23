import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const db = vi.hoisted(() => ({
  $executeRaw: vi.fn(), produto: { findFirst: vi.fn() },
  tipoAplicacaoSanitaria: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn() },
  protocolo: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
  etapaProtocolo: { update: vi.fn(), updateMany: vi.fn() }, momentoProtocolo: { create: vi.fn() }, auditoriaPecuaria: { create: vi.fn() },
}));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: vi.fn(async (fn: (tx: typeof db) => unknown) => fn(db)) } }));
import { criarProtocolo, publicarProtocolo } from "./protocolos.js";
const produtoId = "c0000000-0000-4000-8000-000000000001";
const tipoId = "c0000000-0000-4000-8000-000000000002";
const entrada = (modoAtendimento: "MANUAL" | "AUTOMATIZADA") => ({ nome: "Aplicação nova", finalidade: "SANITARIO" as const, etapas: [{ tipo: "APLICACAO" as const, diaRelativo: 0, produtoId, dose: 2, unidade: "ML", momento: { nome: "Aplicar", ordem: 1, modoAtendimento } }] });
beforeEach(() => {
  vi.clearAllMocks();
  db.protocolo.findFirst.mockResolvedValue(null); db.protocolo.findUnique.mockResolvedValue(null);
  db.tipoAplicacaoSanitaria.findFirst.mockResolvedValue(null);
  db.produto.findFirst.mockResolvedValue({ id: produtoId, nome: "Produto", unidade: "ML", perfilSanitarioProduto: null });
  db.protocolo.create.mockResolvedValue({ id: "protocolo" }); db.protocolo.update.mockResolvedValue({ id: "protocolo" });
  db.protocolo.findUniqueOrThrow.mockResolvedValue({ id: "protocolo" }); db.momentoProtocolo.create.mockResolvedValue({ id: "momento" });
});
it("salva aplicação manual sem classificação, via ou orientação e sem presumir TRATAMENTO", async () => {
  await criarProtocolo(entrada("MANUAL"), null);
  expect(db.tipoAplicacaoSanitaria.findFirst).not.toHaveBeenCalled();
  expect(db.protocolo.create.mock.calls[0][0].data).toMatchObject({ finalidade: "SANITARIO", etapas: { create: [{ tipoAplicacaoId: null, via: null, configuracao: { produtoSnapshot: { orientacaoUso: null, viaPadrao: null } } }] } });
});
it("rejeita modo automatizado sem padrão mas preserva o contrato sanitário legado", async () => {
  await expect(criarProtocolo(entrada("AUTOMATIZADA"), null)).rejects.toThrow("atendimento manual");
  const { finalidade: _, ...semFinalidade } = entrada("MANUAL");
  await expect(criarProtocolo(semFinalidade, null)).rejects.toThrow("finalidade");
});
it("resolve padrão declarado do produto e não exige via ou orientação", async () => {
  db.produto.findFirst.mockResolvedValue({ id: produtoId, nome: "Produto", unidade: "ML", perfilSanitarioProduto: { tipoAplicacaoId: tipoId } });
  db.tipoAplicacaoSanitaria.findFirst.mockResolvedValue({ id: tipoId, nome: "Classificação" });
  await criarProtocolo(entrada("AUTOMATIZADA"), null);
  expect(db.protocolo.create.mock.calls[0][0].data.etapas.create[0]).toMatchObject({ tipoAplicacaoId: tipoId, via: null });
});
it("publica modo manual sem classificação e conserva padrão resolvido em snapshot da ação", async () => {
  const etapa = { id: "acao", ordem: 1, ...entrada("MANUAL").etapas[0], unidadeIntervalo: "DIAS", dose: new Prisma.Decimal(2), configuracao: {} };
  db.protocolo.findFirst.mockResolvedValue({ id: "protocolo", tipo: "SANITARIO", ativo: true, publicado: false, publicadoEm: null, finalidade: "SANITARIO", etapas: [etapa], _count: { execucoes: 0, rodadas: 0 } });
  await publicarProtocolo("protocolo", null);
  expect(db.etapaProtocolo.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipoAplicacaoId: null, tipoAplicacaoNomeSnapshot: null }) }));
  expect(db.protocolo.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ publicado: true }) }));
});
it("publicação congela o ID e nome da classificação junto à orientação herdada", async () => {
  const etapa = { id: "acao", ordem: 1, ...entrada("AUTOMATIZADA").etapas[0], unidadeIntervalo: "DIAS", dose: new Prisma.Decimal(2), configuracao: {} };
  db.protocolo.findFirst.mockResolvedValue({ id: "protocolo", tipo: "SANITARIO", ativo: true, publicado: false, publicadoEm: null, finalidade: "SANITARIO", etapas: [etapa], _count: { execucoes: 0, rodadas: 0 } });
  db.produto.findFirst.mockResolvedValue({ id: produtoId, nome: "Produto", unidade: "ML", perfilSanitarioProduto: { tipoAplicacaoId: tipoId, orientacaoUso: "Conferir o frasco" } });
  db.tipoAplicacaoSanitaria.findFirst.mockResolvedValue({ id: tipoId, nome: "Classificação" });
  db.tipoAplicacaoSanitaria.findUniqueOrThrow.mockResolvedValue({ id: tipoId, nome: "Classificação" });
  await publicarProtocolo("protocolo", null);
  expect(db.etapaProtocolo.update.mock.calls[0][0].data).toMatchObject({ tipoAplicacaoId: tipoId, tipoAplicacaoNomeSnapshot: "Classificação", configuracao: { produtoSnapshot: { orientacaoUso: "Conferir o frasco", viaPadrao: null } } });
});
it("salva e publica na mesma transação, congelando o tipo resolvido sem segundo comando", async () => {
  const etapa = { id: "acao", ordem: 1, ...entrada("MANUAL").etapas[0], unidadeIntervalo: "DIAS", dose: new Prisma.Decimal(2), configuracao: {} };
  const protocolo = { id: "protocolo", nome: "Aplicação nova", tipo: "SANITARIO", ativo: true, publicado: false, publicadoEm: null, finalidade: "SANITARIO", etapas: [etapa], _count: { execucoes: 0, rodadas: 0 } };
  db.protocolo.findFirst.mockResolvedValue(protocolo);
  db.protocolo.findUniqueOrThrow.mockResolvedValue(protocolo);
  await criarProtocolo({ ...entrada("MANUAL"), publicado: true, versao: 2 }, 7);
  expect(db.protocolo.create).toHaveBeenCalledTimes(1);
  expect(db.protocolo.create.mock.calls[0][0].data).toMatchObject({ versao: 2, criadoPorId: 7 });
  expect(db.etapaProtocolo.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipoAplicacaoNomeSnapshot: null }) }));
  expect(db.protocolo.update).toHaveBeenCalledWith(expect.objectContaining({ data: { publicado: true, publicadoEm: expect.any(Date) } }));
  expect(db.auditoriaPecuaria.create.mock.calls.map(([args]) => args.data.acao)).toEqual(["VERSAO_CRIADA", "PUBLICACAO"]);
});
it("uma falha na conclusão rejeita a transação inteira em vez de retornar versão incompleta", async () => {
  const protocolo = { id: "protocolo", ativo: false, etapas: [], _count: { execucoes: 0, rodadas: 0 } };
  db.protocolo.findFirst.mockResolvedValue(protocolo);
  await expect(criarProtocolo({ ...entrada("MANUAL"), publicado: true }, null)).rejects.toThrow("inativa");
  expect(db.protocolo.update).not.toHaveBeenCalled();
});
it("derivação sanitária preserva identidade da base e rejeita mudar o nome", async () => {
  db.protocolo.findFirst.mockResolvedValue({ id: "base", nome: "Original", tipo: "SANITARIO" });
  await expect(criarProtocolo({ ...entrada("MANUAL"), origemVersaoId: produtoId }, null)).rejects.toThrow("preservar o protocolo-base");
  expect(db.protocolo.create).not.toHaveBeenCalled();
});

it("aceita e conserva o nome opcional do procedimento sanitário", async () => {
  const input = entrada("MANUAL");
  await criarProtocolo({ ...input, etapas: input.etapas.map(e => ({ ...e, nome: "Aplicação inicial" })) }, null);
  expect(db.protocolo.create.mock.calls[0][0].data.etapas.create[0].nome).toBe("Aplicação inicial");
});

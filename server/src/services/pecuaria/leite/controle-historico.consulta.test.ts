import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
import { consultarControlesColetivosLeiteTx, consultarControlesHistoricosLeiteTx } from "./controle-historico.js";

const db = { propriedade: { findUnique: vi.fn() }, controleHistoricoLeite: { findMany: vi.fn(), count: vi.fn() } };
// Fronteira de persistência; a leitura não tem métodos de escrita disponíveis.
const tx = db as unknown as Prisma.TransactionClient;
const documento = {
  id: "documento", tipo: "CONTROLE_PERIODICO", inicio: new Date("2024-10-20"), fim: new Date("2024-10-20"),
  animalId: "animal", propriedadeId: 2, lactacaoId: null, origemColetiva: null,
  total: new Prisma.Decimal(0), unidade: "L", referenciaUnidade: "Litros adotados por declaração; fonte sem unidade explícita",
  parcelas: [{ rotulo: "Manhã", hora: null, quantidade: 12 }, { rotulo: null, hora: null, quantidade: null }],
  contextoHistorico: "INTERNO", versao: 1,
  provenienciaSnapshot: { bancoOrigem: "IDEAGRI", chaveOrigem: "CONTROLE:0001", usuarioId: 99,
    dados: { evidencia: "Ficha original conferida", snapshotOrigem: { valorOriginal: "12,0", unidadeOriginal: "não informada", custoUnitario: 99999 } } },
};
beforeEach(() => {
  vi.resetAllMocks();
  db.propriedade.findUnique.mockResolvedValue({ id: 2, ativo: true });
  db.controleHistoricoLeite.findMany.mockResolvedValue([documento]);
  db.controleHistoricoLeite.count.mockResolvedValue(35);
});
it("DTO preserva zero, parcelas ausentes/divergentes e referência exata sem afirmar comprovação", async () => {
  const [r] = await consultarControlesHistoricosLeiteTx(tx, 2, "animal", "2024-10-01", "2024-10-31");
  expect(r).toMatchObject({ total: "0", unidade: "L", referenciaUnidade: documento.referenciaUnidade,
    parcelas: documento.parcelas, semEfeitoEstoqueFinanceiro: true,
    origem: { banco: "IDEAGRI", chave: "CONTROLE:0001", evidencia: "Ficha original conferida" } });
  expect(r.origem).not.toHaveProperty("usuarioId");
  expect(r.origem).not.toHaveProperty("dadosOriginais");
  expect(r).not.toHaveProperty("provenienciaSnapshot");
  expect(JSON.stringify(r)).not.toContain("custoUnitario");
  expect(r).not.toHaveProperty("unidadeComprovada");
  expect(db.controleHistoricoLeite.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { propriedadeId: 2, animalId: "animal", inicio: { lte: new Date("2024-10-31") }, fim: { gte: new Date("2024-10-01") } } }));
});
it("ausência de total/origem permanece desconhecida; kg não são convertidos", async () => {
  db.controleHistoricoLeite.findMany.mockResolvedValue([{ ...documento, total: null, unidade: "KG", provenienciaSnapshot: null }]);
  const [r] = await consultarControlesHistoricosLeiteTx(tx, 2, "animal", "2024-10-01", "2024-10-31");
  expect(r).toMatchObject({ total: null, unidade: "KG", origem: { banco: null, chave: null, evidencia: null } });
});
it("coletivo pagina somente agregados internos do sítio por sobreposição, preservando o mês completo", async () => {
  db.controleHistoricoLeite.findMany.mockResolvedValue([{ ...documento, animalId: null, tipo: "AGREGADO_MENSAL", inicio: new Date("2024-10-01"), fim: new Date("2024-10-31"), origemColetiva: "Tanque da sede" }]);
  const r = await consultarControlesColetivosLeiteTx(tx, 2, { inicio: "2024-10-15", fim: "2024-10-20", pagina: 2, tamanho: 10 });
  const where = { propriedadeId: 2, contextoHistorico: "INTERNO", tipo: "AGREGADO_MENSAL", animalId: null, inicio: { lte: new Date("2024-10-20") }, fim: { gte: new Date("2024-10-15") } };
  expect(db.controleHistoricoLeite.findMany).toHaveBeenCalledWith({ where, orderBy: [{ inicio: "desc" }, { id: "asc" }], skip: 10, take: 10 });
  expect(db.controleHistoricoLeite.count).toHaveBeenCalledWith({ where });
  expect(r).toMatchObject({ propriedadeId: 2, total: 35, pagina: 2, tamanho: 10, itens: [{ inicio: "2024-10-01", fim: "2024-10-31", origemColetiva: "Tanque da sede" }] });
});
it("coletivo valida sítio e intervalo antes de consultar documentos", async () => {
  const filtro = { inicio: "2024-10-01", fim: "2024-10-31", pagina: 1, tamanho: 20 };
  await expect(consultarControlesColetivosLeiteTx(tx, 2, { ...filtro, fim: "2099-01-01" })).rejects.toThrow();
  db.propriedade.findUnique.mockResolvedValue(null);
  await expect(consultarControlesColetivosLeiteTx(tx, 2, filtro)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
  expect(db.controleHistoricoLeite.findMany).not.toHaveBeenCalled();
});

it("leitura aceita o fim futuro usado pela Produção e conserva o período consultado", async () => {
  const r = await consultarControlesColetivosLeiteTx(tx, 2, { inicio: "2099-01-01", fim: "2099-01-31", pagina: 1, tamanho: 20 });
  expect(r.periodo).toEqual({ inicio: "2099-01-01", fim: "2099-01-31" });
  expect(db.controleHistoricoLeite.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ inicio: { lte: new Date("2099-01-31") }, fim: { gte: new Date("2099-01-01") } }) }));
});

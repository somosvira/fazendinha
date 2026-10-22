import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ obter: vi.fn(), dto: vi.fn() }));
vi.mock("./qualidade.js", () => ({ obterAmostraQualidadeTx: m.obter, amostraQualidadeDTO: m.dto }));
import { prepararVinculosQualidadeFechamentoTx } from "./qualidade.fechamentos.js";
import type { Prisma } from "@prisma/client";
const tx = { $queryRaw: vi.fn() };
const periodo = { propriedadeId: 2, inicio: new Date("2026-10-01"), fim: new Date("2026-10-31") };
beforeEach(() => { vi.resetAllMocks(); m.obter.mockResolvedValue({ id: "a", versao: 2, data: new Date("2026-10-10"), exameAnimalId: null }); m.dto.mockReturnValue({ id: "a", versao: 2, status: "VALIDO", resultados: [{ campo: "NU", valor: 0 }], laudos: [] }); });
it("vínculo é opcional e preserva a versão sem criar amostra ou resultado", async () => {
  const vazio = await prepararVinculosQualidadeFechamentoTx(tx as unknown as Prisma.TransactionClient, [], periodo, 7);
  expect(vazio).toEqual([]); expect(m.obter).not.toHaveBeenCalled();
  const r = await prepararVinculosQualidadeFechamentoTx(tx as unknown as Prisma.TransactionClient, [{ amostraId: "a", versaoEsperada: 2 }], periodo, 7);
  expect(m.obter).toHaveBeenCalledWith(tx, "a", 2);
  expect(r).toEqual([{ amostraId: "a", versaoAmostra: 2, snapshot: { id: "a", versao: 2, status: "VALIDO", resultados: [{ campo: "NU", valor: 0 }], laudos: [] }, criadoPorId: 7 }]);
});
it("recusa versão alterada, anulação e amostra fora do período", async () => {
  const executar = () => prepararVinculosQualidadeFechamentoTx(tx as unknown as Prisma.TransactionClient, [{ amostraId: "a", versaoEsperada: 2 }], periodo, 7);
  m.obter.mockResolvedValueOnce({ id: "a", versao: 3, data: new Date("2026-10-10") });
  await expect(executar()).rejects.toMatchObject({ code: "CONFLITO" });
  m.dto.mockReturnValueOnce({ status: "ANULADO" }); await expect(executar()).rejects.toMatchObject({ code: "CONFLITO" });
  m.obter.mockResolvedValueOnce({ id: "a", versao: 2, data: new Date("2026-11-01") });
  await expect(executar()).rejects.toMatchObject({ code: "VALIDACAO" });
});

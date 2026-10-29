import { beforeEach, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
vi.mock("./elegibilidade.js", () => ({ obterElegibilidadesNaDataTx: vi.fn() }));
import { obterElegibilidadesNaDataTx } from "./elegibilidade.js";
import { carregarFilasAptidaoTx } from "./filas-aptidao.js";
import type { ElegibilidadeNaData } from "./elegibilidade.calc.js";
const base = { animalId: "a", necessidadeAptidao: { necessidadeId: "APTIDAO:a:PARTO:p", estado: "AVALIACAO_DEVIDA" }, aptidaoClinica: { estado: "NAO_DETERMINADA", exameId: null, retornoEm: null } } as ElegibilidadeNaData;
const agendados = vi.fn();
const tx = { tipoExame: { findUnique: vi.fn(async () => ({ id: "tipo" })) }, participanteVisita: { findMany: agendados } } as unknown as Prisma.TransactionClient;
beforeEach(() => { vi.clearAllMocks(); agendados.mockResolvedValue([]); vi.mocked(obterElegibilidadesNaDataTx).mockResolvedValue(new Map([["a", base]])); });
it("avaliação devida não vira agendamento e consulta não cria registros", async () => {
  const [fila] = await carregarFilasAptidaoTx(tx, ["a"], 1, new Date("2026-10-29"));
  expect(fila).toMatchObject({ fila: "AVALIACAO_DEVIDA", necessidadeId: "APTIDAO:a:PARTO:p", visitasAbertas: [] });
  expect(agendados).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ AtividadeVisita: expect.objectContaining({ VisitaVeterinaria: { propriedadeId: 1, encerradaEm: null } }) }) }));
});
it("retorno inconclusivo conserva a mesma identidade e não cria DG", async () => {
  vi.mocked(obterElegibilidadesNaDataTx).mockResolvedValue(new Map([["a", { ...base, aptidaoClinica: { estado: "NAO_DETERMINADA", exameId: "e", data: "2026-10-29", resultado: "INCONCLUSIVO", retornoEm: "2026-11-01" } }]]));
  expect(await carregarFilasAptidaoTx(tx, ["a"], 1, new Date("2026-10-29"))).toMatchObject([{ fila: "RETORNO", necessidadeId: "APTIDAO:a:PARTO:p" }]);
});
it("visita aberta reconhece a necessidade compartilhada sem duplicá-la", async () => {
  agendados.mockResolvedValue([{ animalId: "a", snapshot: { necessidadeAptidaoId: "APTIDAO:a:PARTO:p" }, AtividadeVisita: { VisitaVeterinaria: { id: "v", nome: "Visita" } } }]);
  expect(await carregarFilasAptidaoTx(tx, ["a"], 1, new Date("2026-10-29"))).toMatchObject([{ fila: "AGENDAMENTO", necessidadeId: "APTIDAO:a:PARTO:p", visitasAbertas: [{ id: "v" }] }]);
});

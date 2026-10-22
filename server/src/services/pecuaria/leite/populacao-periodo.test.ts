import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type { AnimalContextoLeite } from "./populacao.calc.js";
import { consultarPopulacaoPeriodoLeiteTx } from "./populacao-periodo.js";
const d = (s: string) => new Date(s);
function banco(aptidao: string | null) {
 const animal: AnimalContextoLeite = { id: "vaca", sexo: "F", brinco: "1", nome: null, dataNascimento: d("2020-01-01"), dataEntrada: d("2020-01-01"), baixas: [],
 localizacoes: [{ id: "local", propriedadeId: 1, desde: d("2020-01-01"), ate: null }], destinos: aptidao ? [{ id: "f", aptidao, desde: d("2020-01-01"), ate: null }] : [] };
 const db = { animal: { findMany: vi.fn(async () => [animal]) }, lactacaoAnimal: { findMany: vi.fn(async () => [{ id: "l", animalId: "vaca", inicio: d("2026-01-01"), encerradaEm: null }]) } };
 return { db, tx: db as unknown as Prisma.TransactionClient, animal };
}
describe("prova de calendário leiteiro", () => {
 it("distingue Reprodução comprovada, lacuna de cadastro e Leite sem folha", async () => {
  for (const [aptidao, estado] of [["REPRODUCAO", "SEM_ANIMAIS_ELEGIVEIS"], [null, "FINALIDADE_PENDENTE"], ["LEITE", "ELEGIVEIS"]]) {
   const { tx } = banco(aptidao);
   expect((await consultarPopulacaoPeriodoLeiteTx(tx, 1, "2026-10-01", "2026-10-01"))[0].estado).toBe(estado);
  }
 });
 it("respeita o limite exato e não usa a finalidade atual para dias anteriores", async () => {
  const b = banco("LEITE"); b.animal.destinos[0].ate = d("2026-10-15");
  b.animal.destinos.push({ id: "r", aptidao: "REPRODUCAO", desde: d("2026-10-15"), ate: null });
  expect((await consultarPopulacaoPeriodoLeiteTx(b.tx, 1, "2026-10-14", "2026-10-15")).map(d => d.estado)).toEqual(["ELEGIVEIS", "SEM_ANIMAIS_ELEGIVEIS"]);
 });
});

it("lactação desconhecida permanece possível para cobertura sem promover o animal a produtor efetivo", async () => {
  const b = banco("LEITE"); b.db.lactacaoAnimal.findMany.mockResolvedValue([]);
  const r = (await consultarPopulacaoPeriodoLeiteTx(b.tx, 1, "2026-10-01", "2026-10-01"))[0];
  expect(r).toMatchObject({ estado: "ELEGIVEIS", elegiveis: [], potenciais: ["vaca"] });
});

it("o calendário conserva a produtora e seus custos possíveis no próprio dia da baixa", async () => {
  const b = banco("LEITE"), data = d("2026-10-15");
  b.animal.destinos[0].ate = data;
  b.animal.localizacoes[0].ate = data;
  b.animal.baixas.push({ id: "baixa", data, localizacaoFechadaId: "local", destinoFechadoId: "f" });
  const r = await consultarPopulacaoPeriodoLeiteTx(b.tx, 1, "2026-10-15", "2026-10-16");
  expect(r.map(d => [d.estado,d.elegiveis])).toEqual([["ELEGIVEIS",["vaca"]],["SEM_ANIMAIS_ELEGIVEIS",[]]]);
});

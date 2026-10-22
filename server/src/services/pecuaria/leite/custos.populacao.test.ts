import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FonteCusto } from "../custos/custos.calc.js";
import { consultarCustosLeiteTx } from "./custos.js";
const fontes = vi.hoisted(() => vi.fn());
vi.mock("../../../db.js", () => ({ prisma: {} }));
vi.mock("../custos/custos.js", () => ({ carregarFontesCustoTx: fontes }));
const data = "2026-10-01", periodo = { inicio: data, fim: data }, d = (s: string) => new Date(s);
const animal = (id: string) => ({ id, sexo: "F", brinco: id, nome: null, dataEntrada: d("2026-01-01"), dataNascimento: d("2025-01-01"), baixas: [],
  destinos: [{ id: `f-${id}`, animalId: id, aptidao: "LEITE", desde: d("2026-01-01"), ate: null }],
  localizacoes: [{ id: `loc-${id}`, propriedadeId: 3, desde: d("2026-01-01"), ate: null }] });
const vaca = animal("vaca"), bezerra = animal("bezerra");
const participante = (id: string, litros: number) => ({ id: `p-${id}`, animalId: id, brinco: id, nome: null, lactacaoId: id === "vaca" ? "l" : null, localizacaoId: `loc-${id}`, pendencias: id === "vaca" ? [] : ["LACTACAO_NAO_INFORMADA"], excluidoEm: null, motivoExclusao: null,
  finalidadeId: `f-${id}`, finalidadeSnapshot: { finalidadeId: `f-${id}`, aptidao: "LEITE", regra: "FINALIDADE_LEITE_V1", dataOperacional: data, desde: "2026-01-01", ate: null },
  medicoes: [{ id: `m-${id}`, sessaoId: "s", estado: "MEDIDO", litros: new Prisma.Decimal(litros), motivo: null, versao: 1 }] });
const fonte = (id: string, valor: number): FonteCusto => ({ id: `custo-${id}`, tipo: "NUTRICAO", animalId: id, propriedadeId: 3, data, descricao: "Alimentação", estadoFato: "CONFIRMADO", participacaoId: null, origemMaterial: "ESTOQUE", movimentoEstoqueId: `mov-${id}`, operacaoServicoId: null, valorMaterial: new Prisma.Decimal(valor), valorServico: null, classificacao: null, componenteId: `alimento-${id}`, periodoConsumo: periodo });
function banco(incluirBezerra = false) {
  const dia = { id: "dia", propriedadeId: 3, dataOperacional: d(data), configuracaoId: "c", versao: 1,
    configuracao: { id: "c", propriedadeId: 3, vigenteDesde: d(data), ordenhas: [{ posicaoId: "manha", nome: "Manhã", ordem: 1, horario: null }] },
    sessoes: [{ id: "s", posicaoId: "manha", ordem: 1, versao: 1 }], participantes: [participante("vaca", 10), ...(incluirBezerra ? [participante("bezerra", 2)] : [])] };
  const db = { medicaoLeite: { count: async () => 1 }, diaProducaoLeite: { findMany: async () => [dia] },
    animal: { findMany: async () => [vaca, bezerra] }, lactacaoAnimal: { findMany: async () => [{ id: "l", animalId: "vaca", inicio: d("2026-01-01"), encerradaEm: null }] },
    finalidadeAnimal: { findMany: async () => [...vaca.destinos, ...bezerra.destinos] }, baixaAnimal: { findMany: async () => [] } };
  return { db, tx: db as unknown as Prisma.TransactionClient };
}
beforeEach(() => {
  fontes.mockReset();
  fontes.mockImplementation(async (_tx: unknown, _sitio: number, filtro: { animalIds: string[] }) => [fonte("vaca", 20), fonte("bezerra", 200)].filter(f => filtro.animalIds.includes(f.animalId)));
});
describe("população efetiva de custo usa a mesma folha e a lactação histórica", () => {
  it("bezerra Leite sem lactação nem inclusão explícita não contamina o custo da vaca", async () => {
    const { tx } = banco();
    const r = await consultarCustosLeiteTx(tx, 3, periodo, true);
    expect(r.animais.map(a => a.animalId)).toEqual(["vaca"]);
    expect(r.coberturaPeriodo.completa).toBe(true);
    expect(r.consolidado).toMatchObject({ custos: { totalConhecido: "20.00" }, custoPorLitro: "2.00", motivos: [] });
    expect(fontes).toHaveBeenCalledWith(tx, 3, { animalIds: ["vaca"] });
  });
  it("preserva a inclusão explícita sem lactação como produtor conciliado", async () => {
    const r = await consultarCustosLeiteTx(banco(true).tx, 3, periodo, true);
    expect(r.animais.map(a => a.animalId)).toEqual(["vaca", "bezerra"]);
    expect(r.consolidado).toMatchObject({ custos: { totalConhecido: "220.00" }, producao: { litros: 12 }, custoPorLitro: "18.33" });
  });
});

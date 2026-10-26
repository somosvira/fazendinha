import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { classificarCarenciaProducao, conferirCarenciaOrigensVendaTx, type AplicacaoCarenciaProducao } from "./carencia-producao.js";
const dados = { data: new Date("2026-10-19"), horario: "08:00", animalIds: ["vaca"] };
const aplicacao: AplicacaoCarenciaProducao = { id: "aplicacao", animalId: "vaca", data: new Date("2026-10-18"), aplicadaEm: new Date("2026-10-18T13:00:00Z"), precisaoTemporal: "HORA", estadoCarenciaLeite: "INFORMADO", carenciaLeiteHoras: 24, aptidaoCarenciaSnapshot: "LEITE", consumoMantido: false, administracaoMantida: null };
const estado = (aplicacoes: AplicacaoCarenciaProducao[], horario: string | null = "08:00") => classificarCarenciaProducao({ ...dados, horario }, aplicacoes).animais[0].estado;
describe("carência comercial na data da produção", () => {
  it("considera instante e preserva evidência/versão sem inventar liberação", () => {
    const c = classificarCarenciaProducao(dados, [aplicacao]);
    expect(c).toMatchObject({ versao: 1, finalidade: "VENDA", dataOperacional: "2026-10-19", horarioOrdenha: "08:00", animais: [{ estado: "EM_CARENCIA", evidencias: [{ aplicacaoId: "aplicacao", carenciaLeiteHoras: 24 }] }] });
    expect(estado([aplicacao], "10:00")).toBe("SEM_RESTRICAO_REGISTRADA");
    expect(estado([aplicacao], null)).toBe("NAO_AFERIVEL");
  });
  it("horário desconhecido da aplicação impede liberar no dia limítrofe", () => {
    const historica = { ...aplicacao, aplicadaEm: null, precisaoTemporal: "DIA" };
    expect(estado([historica], "10:00")).toBe("NAO_AFERIVEL");
    expect(classificarCarenciaProducao({ ...dados, data: new Date("2026-10-20") }, [historica]).animais[0].estado).toBe("SEM_RESTRICAO_REGISTRADA");
  });
  it("preserva zero e distingue informação ausente, administração em revisão e não aplicabilidade", () => {
    expect(estado([{ ...aplicacao, carenciaLeiteHoras: 0 }])).toBe("SEM_RESTRICAO_REGISTRADA");
    expect(estado([{ ...aplicacao, estadoCarenciaLeite: "NAO_INFORMADO", carenciaLeiteHoras: null }])).toBe("NAO_AFERIVEL");
    expect(estado([{ ...aplicacao, consumoMantido: true, administracaoMantida: null }])).toBe("NAO_AFERIVEL");
    expect(estado([{ ...aplicacao, estadoCarenciaLeite: "NAO_APLICAVEL", carenciaLeiteHoras: null }])).toBe("SEM_RESTRICAO_REGISTRADA");
    expect(estado([{ ...aplicacao, estadoCarenciaLeite: "NAO_APLICAVEL", carenciaLeiteHoras: null, aptidaoCarenciaSnapshot: "CORTE" }])).toBe("NAO_AFERIVEL");
  });
  it("não transporta aplicações de outro animal, de data futura ou depois da ordenha conhecida", () => {
    expect(estado([{ ...aplicacao, animalId: "outra" }, { ...aplicacao, data: new Date("2026-10-20") }, { ...aplicacao, data: dados.data, aplicadaEm: new Date("2026-10-19T15:00:00Z") }])).toBe("SEM_RESTRICAO_REGISTRADA");
  });
  it("restrição retroativa exige regularização da origem e não altera consumos ou a classificação histórica", async () => {
    const tx = {
      entradaProducaoLeite: { findMany: vi.fn(async () => [{ id: "origem", movimento: { data: dados.data }, sessao: { horario: dados.horario }, vinculosMedicoes: [{ medicao: { participante: { animalId: "vaca" } } }] }]) },
      aplicacaoProduto: { findMany: vi.fn(async () => [aplicacao]) },
    };
    await expect(conferirCarenciaOrigensVendaTx(tx as unknown as Prisma.TransactionClient, ["origem"])).rejects.toMatchObject({ code: "CONFLITO" });
    expect(Object.keys(tx.entradaProducaoLeite)).toEqual(["findMany"]);
    tx.aplicacaoProduto.findMany.mockResolvedValue([]);
    await expect(conferirCarenciaOrigensVendaTx(tx as unknown as Prisma.TransactionClient, ["origem"])).resolves.toBeUndefined();
  });
});

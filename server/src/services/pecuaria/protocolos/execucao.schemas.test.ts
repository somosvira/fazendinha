import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { execucaoProtocoloSchema, confirmarExecucaoProtocoloSchema, paginaExecucaoSchema } from "./execucao.schemas.js";

const aplicacao = () => ({ tipo: "APLICACAO" as const, animalId: randomUUID(), tarefaId: randomUUID(), propriedadeId: 114,
  data: "2026-10-01", aplicadaEm: "2026-10-01T12:00:00Z", nomeProdutoAplicado: "Produto da fixture",
  dose: "2", unidadeDose: "ML" as const, origemInsumo: "SEM_ORIGEM_JUSTIFICADA" as const,
  justificativaSemOrigem: "Comprovante apresentado na execução individual" });
const conjunto = (total: number) => ({ versao: 1, propriedadeId: 114, itens: Array.from({ length: total }, aplicacao) });

describe("contrato de execução comum", () => {
  it("aceita um ou cem animais e rejeita conjunto vazio/acima de cem", () => {
    for (const total of [1, 100]) expect(execucaoProtocoloSchema.safeParse(conjunto(total)).success).toBe(true);
    for (const total of [0, 101]) expect(execucaoProtocoloSchema.safeParse(conjunto(total)).success).toBe(false);
  });

  it("recusa repetição de tarefa ou de animal, mesmo com a outra identidade diferente", () => {
    const a = aplicacao();
    for (const repetida of [{ ...aplicacao(), tarefaId: a.tarefaId }, { ...aplicacao(), animalId: a.animalId }]) {
      expect(execucaoProtocoloSchema.safeParse({ versao: 1, propriedadeId: 114, itens: [a, repetida] }).success).toBe(false);
    }
  });

  it("recusa sítio divergente, versão de contrato desconhecida e dados externos ao contrato", () => {
    const entrada = conjunto(1);
    for (const invalida of [{ ...entrada, propriedadeId: 115 }, { ...entrada, versao: 2 }, { ...entrada, saldoInformado: "1000" },
      { ...entrada, itens: [{ ...entrada.itens[0], gestacaoCriada: true }] }]) {
      expect(execucaoProtocoloSchema.safeParse(invalida).success).toBe(false);
    }
  });

  it("confirmação exige identidade de reenvio e fingerprint válidos", () => {
    const entrada = { execucao: conjunto(1), chave: randomUUID(), fingerprint: "a".repeat(64) };
    expect(confirmarExecucaoProtocoloSchema.safeParse(entrada).success).toBe(true);
    expect(confirmarExecucaoProtocoloSchema.safeParse({ ...entrada, chave: "invalida" }).success).toBe(false);
    expect(confirmarExecucaoProtocoloSchema.safeParse({ ...entrada, fingerprint: "a".repeat(63) }).success).toBe(false);
  });

  it("paginação do resultado é independente do limite de cem da confirmação", () => {
    expect(execucaoProtocoloSchema.safeParse(conjunto(100)).success).toBe(true);
    expect(paginaExecucaoSchema.parse({ pagina: "2" })).toEqual({ pagina: 2, porPagina: 10 });
    expect(paginaExecucaoSchema.safeParse({ porPagina: 100 }).success).toBe(false);
  });
});

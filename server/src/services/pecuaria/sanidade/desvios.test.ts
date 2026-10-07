import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { compararExecucaoProtocolo, conferirTarefaProtocoloTx } from "./desvios.js";

type Tarefa = Parameters<typeof compararExecucaoProtocolo>[0];
const tarefa = { id: "tarefa", etapaId: "etapa", previstaPara: new Date("2026-10-05T00:00:00Z"), parametros: { tipo: "APLICACAO", produtoId: "produto", dose: "0.100", unidade: "ML", via: "Intramuscular", tipoAplicacaoId: "tipo" },
  etapa: { id: "etapa", protocoloId: "versao", tipo: "APLICACAO", produtoId: "outro-atual", dose: new Prisma.Decimal("9"), unidade: "ML" },
  execucao: { id: "execucao", animalId: "animal", protocoloId: "versao", canceladaEm: null }, aplicacoes: [], exames: [], dispensadaEm: null } as unknown as Tarefa;
const realizado = { tipo: "APLICACAO" as const, data: "2026-10-05", produtoId: "produto", dose: "0.1", unidade: "ML", via: "Intramuscular", tipoAplicacaoId: "tipo" };

describe("desvios derivados do planejamento sanitário", () => {
  it("compara decimais exatos e usa os parâmetros congelados", () => {
    expect(compararExecucaoProtocolo(tarefa, realizado)).toMatchObject({ referencia: "SNAPSHOT_PLANEJADO", diferencas: [], motivoObrigatorio: false, planejado: { dose: "0.1", produtoId: "produto" } });
  });
  it.each(["data", "produtoId", "dose", "unidade", "via", "tipoAplicacaoId"] as const)("exige motivo ao alterar %s", (campo) => {
    const alterado = { ...realizado, [campo]: campo === "dose" ? "0.101" : "alterado" };
    expect(() => compararExecucaoProtocolo(tarefa, alterado)).toThrow("Explique o desvio");
    expect(compararExecucaoProtocolo(tarefa, alterado, { motivo: "Orientação do veterinário" })).toMatchObject({ diferencas: [{ campo }], motivo: "Orientação do veterinário" });
  });
  it("a prévia exibe diferenças sem exigir motivo e a confirmação valida seu tamanho", () => {
    expect(compararExecucaoProtocolo(tarefa, { ...realizado, data: "2026-10-06" }, undefined, false).motivoObrigatorio).toBe(true);
    expect(() => compararExecucaoProtocolo(tarefa, realizado, { motivo: "abc" })).toThrow("5 a 500");
    expect(() => compararExecucaoProtocolo(tarefa, realizado, { motivo: "a".repeat(501) })).toThrow("5 a 500");
  });
  it("usa a data adiada sem alterar a etapa seguinte", () => {
    const adiada = { ...tarefa, previstaPara: new Date("2026-10-06T00:00:00Z") };
    expect(compararExecucaoProtocolo(adiada, { ...realizado, data: "2026-10-06" }).diferencas).toEqual([]);
    expect(tarefa.previstaPara.toISOString().slice(0, 10)).toBe("2026-10-05");
  });
  it("bloqueia mudança de natureza mesmo com justificativa", () => {
    expect(() => compararExecucaoProtocolo(tarefa, { tipo: "EXAME", data: "2026-10-05", tipoExameId: "exame" }, { motivo: "Alterado pelo veterinário" })).toThrow("natureza");
  });
  it("preserva o aviso explícito no legado sem inventar parâmetros publicados", () => {
    const legado = { ...tarefa, parametros: null, etapa: { ...tarefa.etapa, tipoAplicacaoId: null, finalidade: "VACINA" as const, produtoId: "produto", dose: new Prisma.Decimal("0.1"), via: null } };
    expect(compararExecucaoProtocolo(legado, { ...realizado, via: null, finalidade: "VACINA", tipoAplicacaoId: "a0300000-0000-4000-8000-000000000002" })).toMatchObject({ referencia: "LEGADO_SEM_SNAPSHOT", diferencas: [] });
  });
  it("exige motivo para trocar o tipo efetivo mesmo repetindo a finalidade planejada legada", () => {
    const legado = { ...tarefa, parametros: { ...tarefa.parametros as Record<string, unknown>, tipoAplicacaoId: null, finalidade: "VACINA" } } as Tarefa;
    const alterado = { ...realizado, finalidade: "VACINA", tipoAplicacaoId: "a0300000-0000-4000-8000-000000000001" };
    expect(() => compararExecucaoProtocolo(legado, alterado)).toThrow("Explique o desvio");
    expect(compararExecucaoProtocolo(legado, alterado, { motivo: "Tipo revisado pelo veterinário" })).toMatchObject({ diferencas: [{ campo: "tipoAplicacaoId", planejado: "a0300000-0000-4000-8000-000000000002", realizado: alterado.tipoAplicacaoId }] });
  });
  it("permite troca de tipo de exame com motivo e guarda planejado e realizado", () => {
    const exame = { ...tarefa, parametros: { tipo: "EXAME", tipoExameId: "exame-original" } };
    expect(compararExecucaoProtocolo(exame, { tipo: "EXAME", data: "2026-10-05", tipoExameId: "novo" }, { motivo: "Solicitado pelo veterinário" })).toMatchObject({ diferencas: [{ campo: "tipoExameId", planejado: "exame-original", realizado: "novo" }] });
  });
  it.each([
    { execucao: { ...tarefa.execucao, animalId: "outro" } }, { execucao: { ...tarefa.execucao, canceladaEm: new Date() } },
    { dispensadaEm: new Date() }, { aplicacoes: [{ id: "fato" }] }, { exames: [{ id: "coleta" }] }, { etapa: { ...tarefa.etapa, protocoloId: "outra-versao" } },
  ])("revalida animal, disponibilidade e versão ao reler tarefa: %j", async (mudanca) => {
    const tx = { tarefaSanitaria: { findUnique: vi.fn().mockResolvedValue({ ...tarefa, ...mudanca }) } };
    await expect(conferirTarefaProtocoloTx(tx as unknown as Prisma.TransactionClient, "tarefa", "animal", realizado)).rejects.toMatchObject({ code: "CONFLITO" });
  });
});

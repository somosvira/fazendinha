import { describe, expect, it } from "vitest";
import { condicaoSituacaoTarefa, propriedadeRegularizacao, situacaoTarefaComum, sqlSituacaoOperacional } from "./situacao.js";
const base = { execucao: { canceladaEm: null }, dispensadaEm: null, realizadaEm: null, aplicacoes: [], exames: [] };
describe("situação de tarefas comum aos domínios", () => {
  it("não realização não atende pela data legada nem pelo vínculo atual", () => {
    const exame = { status: "VALIDO", realizacao: "NAO_REALIZADO" };
    expect(situacaoTarefaComum({ ...base, realizadaEm: new Date(), exames: [exame] })).toBe("PENDENTE");
    expect(situacaoTarefaComum({ ...base, realizadaEm: new Date(), vinculos: [{ estado: "ATUAL", exame }] })).toBe("PENDENTE");
    expect(situacaoTarefaComum({ ...base, exames: [{ status: "VALIDO", realizacao: "COLETA_REGISTRADA" }] })).toBe("REALIZADA");
    expect(situacaoTarefaComum({ ...base, exames: [exame, { status: "VALIDO", realizacao: "REALIZADO" }] })).toBe("REALIZADA");
  });
  it("projeções Prisma e SQL excluem não realização inclusive no fallback de data", () => {
    const prisma = JSON.stringify(condicaoSituacaoTarefa("REALIZADA"));
    expect(prisma.match(/NAO_REALIZADO/g)?.length).toBeGreaterThanOrEqual(4);
    const sql = sqlSituacaoOperacional(new Date()).text;
    expect(sql.match(/NAO_REALIZADO/g)?.length).toBeGreaterThanOrEqual(4);
  });
  it("anulação não torna a execução automaticamente pendente", () => {
    expect(situacaoTarefaComum({ ...base, realizadaEm: new Date(), regularizacaoPendente: true, exames: [{ status: "ANULADO" }] })).toBe("REGULARIZACAO_PENDENTE");
    expect(situacaoTarefaComum({ ...base, historicoRegularizacao: [{ acao: "ENCERRAR_SEM_SUBSTITUICAO" }], realizadaEm: new Date() })).toBe("ENCERRADA_SEM_SUBSTITUICAO");
    expect(situacaoTarefaComum({ ...base, historicoRegularizacao: [{ acao: "REABRIR" }], exames: [{ status: "ANULADO" }] })).toBe("PENDENTE");
  });
  it("execução histórica continua realizada depois da retirada da participação", () => {
    expect(situacaoTarefaComum({ ...base, execucao: { canceladaEm: new Date() }, realizadaEm: new Date() })).toBe("REALIZADA");
    expect(situacaoTarefaComum({ ...base, execucao: { canceladaEm: new Date() } })).toBe("EXECUCAO_CANCELADA");
  });
  it("o sítio da regularização vem do último vínculo, preservando transferências", () => {
    expect(propriedadeRegularizacao({ execucao: { propriedadeId: 1 }, vinculos: [{ exame: { propriedadeId: 2 } }] })).toBe(2);
    expect(propriedadeRegularizacao({ execucao: { propriedadeId: 1 } })).toBe(1);
  });
});

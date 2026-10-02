import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ocorrencias: vi.fn(), exames: vi.fn(), aplicacoes: vi.fn(), tarefas: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: {
  ocorrenciaSanitaria: { findMany: mocks.ocorrencias },
  exameAnimal: { findMany: mocks.exames },
  aplicacaoProduto: { findMany: mocks.aplicacoes },
  tarefaSanitaria: { findMany: mocks.tarefas },
} }));

import { consultaSanitariaSchema } from "./consulta.js";
import { listarOcorrencias } from "./ocorrencias.js";
import { listarExames } from "./exames.js";
import { listarAplicacoes } from "./aplicacoes.js";
import { listarTarefas } from "./protocolos.js";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.ocorrencias.mockResolvedValue([]);
  mocks.exames.mockResolvedValue([]);
  mocks.aplicacoes.mockResolvedValue([]);
  mocks.tarefas.mockResolvedValue([]);
});

describe("filtros operacionais antes da paginação", () => {
  it("separa ocorrência aberta de encerrada no banco", async () => {
    await listarOcorrencias(undefined, 2, consultaSanitariaSchema.parse({ situacao: "ABERTA", pagina: "3" }));
    expect(mocks.ocorrencias).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ fim: null, status: "VALIDO", propriedadeId: 2 }), skip: 100, take: 50 }));
    await listarOcorrencias(undefined, 2, consultaSanitariaSchema.parse({ situacao: "ENCERRADA" }));
    expect(mocks.ocorrencias).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ fim: { not: null } }) }));
  });

  it("distingue coleta sem resultado de resultado informado", async () => {
    await listarExames(undefined, 2, consultaSanitariaSchema.parse({ situacao: "AGUARDANDO_RESULTADO" }));
    expect(mocks.exames).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ resultadoTexto: null, resultadoNumero: null, resultadoOpcao: null }) }));
    await listarExames(undefined, 2, consultaSanitariaSchema.parse({ situacao: "RESULTADO_INFORMADO" }));
    expect(mocks.exames).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: expect.arrayContaining([{ resultadoNumero: { not: null } }]) }) }));
  });

  it("limita a origem pendente e tarefas atrasadas antes de buscar a página", async () => {
    await listarAplicacoes(undefined, 2, consultaSanitariaSchema.parse({ situacao: "ORIGEM_PENDENTE" }));
    expect(mocks.aplicacoes).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ origemInsumo: "SEM_ORIGEM_JUSTIFICADA", status: "VALIDO" }) }));
    await listarTarefas(2, undefined, consultaSanitariaSchema.parse({ situacao: "ATRASADA" }));
    expect(mocks.tarefas).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ AND: expect.arrayContaining([{ previstaPara: { lt: expect.any(Date) } }]) }) }));
  });
});

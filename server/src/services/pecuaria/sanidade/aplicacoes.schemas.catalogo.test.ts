import { describe, expect, it } from "vitest";
import { uid } from "../../../lib/uid.fixture.js";
import { aplicacaoSchema, aplicacaoSemCatalogoSchema } from "./aplicacoes.schemas.js";
import { executarAplicacaoEtapaSchema } from "./execucao-etapas.schemas.js";
import { aplicacaoProtocoloSchema } from "../protocolos/execucao.schemas.js";

const base = {
  animalId: uid(1), propriedadeId: 1, data: "2026-09-10", origemInsumo: "INCLUSO_SERVICO",
  nomeProdutoAplicado: "Ivermectina", dose: "1", unidadeDose: "ML",
};
const comCatalogo = { ...base, produtoCatalogoId: uid(2), categoriaId: uid(3) };

describe("aplicação sanitária com item do catálogo", () => {
  it("o fluxo individual/coletivo aceita produtoCatalogoId", () => {
    expect(aplicacaoSchema.safeParse(comCatalogo).success).toBe(true);
  });

  it("tarefa, visita e IATF (aplicacaoSemCatalogoSchema) recusam produtoCatalogoId", () => {
    const r = aplicacaoSemCatalogoSchema.safeParse(comCatalogo);
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join("."))).toContain("produtoCatalogoId");
  });

  it("sem catálogo, o schema sem catálogo continua aceitando produtoId", () => {
    expect(aplicacaoSemCatalogoSchema.safeParse({ ...base, produtoId: uid(4) }).success).toBe(true);
  });

  it.each([
    ["execução de etapas", executarAplicacaoEtapaSchema],
    ["execução de protocolo", aplicacaoProtocoloSchema],
  ])("%s é estrito e não aceita produtoCatalogoId", (_n, schema) => {
    const r = (schema as { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ code: string; keys?: string[] }> } } })
      .safeParse({ ...comCatalogo, tipo: "APLICACAO", tarefaId: uid(5) });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.code === "unrecognized_keys" && i.keys?.includes("produtoCatalogoId"))).toBe(true);
  });
});

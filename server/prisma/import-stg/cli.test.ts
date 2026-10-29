import { expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const mocks = vi.hoisted(() => ({ importar: vi.fn(), desconectar: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../src/env.js", () => ({ env: { DATABASE_URL: "postgresql://test:test@127.0.0.1:1/fazendinha_seedatev3", STORAGE_NAMESPACE: "dev" } }));
vi.mock("../../src/db.js", () => ({ prisma: { $disconnect: mocks.desconectar } }));
vi.mock("./importador.js", () => ({ importarStg: mocks.importar }));
it("CLI publica contagem e recibo pendentes com exit 2 sem alegar lote concluído", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fazendinha-cli-secagem-")), fonte = join(dir, "carga.json"), recibo = join(dir, "recibo.json");
  writeFileSync(fonte, "{}");
  const argv = process.argv, exitCode = process.exitCode;
  const log = vi.spyOn(console, "log").mockImplementation(() => {}), erro = vi.spyOn(console, "error").mockImplementation(() => {});
  const relatorio = { modo: "EXECUCAO", destino: { ambiente: "dev", host: "127.0.0.1:1", banco: "fazendinha_seedatev3" }, autorId: 7,
    manifesto: { hash: "a".repeat(64) }, reenvioIntegral: false, planejados: 1, pendentes: 1, criados: 0, reutilizados: 0, vinculados: 0, corrigidos: 0, conflitos: [],
    pesosSecagem: { total: 0, aCriar: 0, reutilizaveis: 0, comCandidatosDuplicidade: 0, conflitos: 0 },
    associacoesSecagem: [{ chave: "ASSOCIACAO_SECAGEM:1", estado: "PENDENTE", executada: false, vinculoId: null }],
    recibo: [{ chave: "ASSOCIACAO_SECAGEM:1", estado: "PENDENTE", motivo: "Encerramento não comprovado" }] };
  mocks.importar.mockResolvedValue(relatorio);
  try {
    process.argv = [process.execPath, "import-pecuaria-stg.ts", `--arquivo=${fonte}`, `--relatorio=${recibo}`];
    await import("../import-pecuaria-stg.js");
    await vi.waitFor(() => expect(mocks.desconectar).toHaveBeenCalled());
    expect(process.exitCode).toBe(2); expect(erro).not.toHaveBeenCalled();
    const resumo = JSON.parse(String(log.mock.calls[0][0])); expect(resumo).toMatchObject({ pendentes: 1, reenvioIntegral: false, associacoesSecagem: { pendentes: 1, comprovadas: 0 } });
    const salvo = JSON.parse(readFileSync(recibo, "utf8")); expect(salvo.recibo[0]).toMatchObject({ estado: "PENDENTE" }); expect(salvo.recibo[0]).not.toHaveProperty("destinoId");
  } finally { process.argv = argv; process.exitCode = exitCode; log.mockRestore(); erro.mockRestore(); rmSync(dir, { recursive: true, force: true }); }
});

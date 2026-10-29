import { afterEach, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync, symlinkSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const temporarios: string[] = [];
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "fazendinha-v4-recibo-"));
  temporarios.push(dir);
  const arquivo = join(dir, "carga.json"), mapeamento = join(dir, "mapa.json"), relatorio = join(dir, "recibo.json");
  writeFileSync(arquivo, "{}"); writeFileSync(mapeamento, "{}");
  return { dir, arquivo, mapeamento, relatorio };
}
function executar(arquivo: string, mapeamento: string, relatorio: string) {
  return spawnSync(process.execPath, ["--import", "tsx", fileURLToPath(new URL("../import-pecuaria-v4.ts", import.meta.url)), `--arquivo=${arquivo}`, `--mapeamento=${mapeamento}`, `--relatorio=${relatorio}`, "--executar"], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)), encoding: "utf8", env: { ...process.env, DATABASE_URL: "", STORAGE_NAMESPACE: "" },
  });
}
afterEach(() => { for (const dir of temporarios.splice(0)) rmSync(dir, { recursive: true, force: true }); });

it("V4 recusa destino inválido antes de carregar ambiente, banco ou JSON", () => {
  const f = fixture(); mkdirSync(f.relatorio); writeFileSync(f.arquivo, "{inválido");
  const r = executar(f.arquivo, f.mapeamento, f.relatorio);
  expect(r.status).toBe(1); expect(r.stderr).toMatch(/relatório.*arquivo regular/i);
  expect(r.stderr).not.toMatch(/configuração inválida|ZodError/);
});
it.each(["arquivo", "mapeamento"] as const)("V4 protege %s de sobrescrita inclusive por alias", origem => {
  const f = fixture(); symlinkSync(f[origem], f.relatorio);
  const r = executar(f.arquivo, f.mapeamento, f.relatorio);
  expect(r.status).toBe(1); expect(r.stderr).toMatch(/diferente.*origem/i);
  expect(readFileSync(f[origem], "utf8")).toBe("{}");
});
it("V4 conserva recibo anterior e limpa só reserva própria se JSON é inválido", () => {
  const f = fixture(); writeFileSync(f.arquivo, "{inválido"); writeFileSync(f.relatorio, "anterior");
  const r = executar(f.arquivo, f.mapeamento, f.relatorio);
  expect(r.status).toBe(1); expect(r.stderr).not.toMatch(/configuração inválida/);
  expect(readFileSync(f.relatorio, "utf8")).toBe("anterior");
  expect(readdirSync(f.dir).sort()).toEqual(["carga.json", "mapa.json", "recibo.json"]);
});

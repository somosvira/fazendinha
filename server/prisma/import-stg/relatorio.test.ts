import { afterEach, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync, symlinkSync, linkSync, chmodSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { prepararArquivoRelatorio } from "./relatorio.js";
const temporarios: string[] = [];
const pasta = () => { const dir = mkdtempSync(join(tmpdir(), "fazendinha-relatorio-stg-")); temporarios.push(dir); return dir; };
afterEach(() => { for (const dir of temporarios.splice(0)) rmSync(dir, { recursive: true, force: true }); });

it.each(["{}", "{json inválido"])("CLI recusa diretório de relatório antes de analisar JSON ou carregar ambiente: %s", (conteudo) => {
  const dir = pasta(), origem = join(dir, "carga.json"), destino = join(dir, "relatorio");
  writeFileSync(origem, conteudo); mkdirSync(destino);
  const r = spawnSync(process.execPath, ["--import", "tsx", fileURLToPath(new URL("../import-pecuaria-stg.ts", import.meta.url)), `--arquivo=${origem}`, `--relatorio=${destino}`, "--executar"], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)), encoding: "utf8", env: { ...process.env, DATABASE_URL: "", STORAGE_NAMESPACE: "" },
  });
  expect(r.status).toBe(1); expect(r.stderr).toMatch(/relatório.*arquivo regular/i); expect(r.stderr).not.toContain("ZodError");
});
it("recusa arquivo sem permissão de escrita antes de criar uma reserva", () => {
  const dir = pasta(), origem = join(dir, "carga.json"), destino = join(dir, "recibo.json");
  writeFileSync(origem, "{}"); writeFileSync(destino, "artefato anterior"); chmodSync(destino, 0o444);
  expect(() => prepararArquivoRelatorio(origem, destino)).toThrow(/permissão.*escrita/i);
  expect(readFileSync(destino, "utf8")).toBe("artefato anterior"); expect(readdirSync(dir).sort()).toEqual(["carga.json", "recibo.json"]);
});
it.each(["symlink", "hardlink"] as const)("recusa %s para a origem sem alterar seu conteúdo", tipo => {
  const dir = pasta(), origem = join(dir, "carga.json"), destino = join(dir, "recibo.json"); writeFileSync(origem, "{}");
  if (tipo === "symlink") symlinkSync(origem, destino); else linkSync(origem, destino);
  expect(() => prepararArquivoRelatorio(origem, destino)).toThrow(/diferente.*origem/i); expect(readFileSync(origem, "utf8")).toBe("{}");
});
it("reserva a escrita sem truncar o artefato e publica o relatório completo por substituição atômica", () => {
  const dir = pasta(), origem = join(dir, "carga.json"), destino = join(dir, "recibo.json"); writeFileSync(origem, "{}"); writeFileSync(destino, "anterior");
  const reservado = prepararArquivoRelatorio(origem, destino); expect(readFileSync(destino, "utf8")).toBe("anterior");
  reservado.gravar('{"recibo":"completo"}\n'); expect(readFileSync(destino, "utf8")).toBe('{"recibo":"completo"}\n');
  expect(readdirSync(dir).sort()).toEqual(["carga.json", "recibo.json"]);
});
it("destino novo é reservado sem publicar arquivo vazio; cancelar remove somente a própria reserva", () => {
  const dir = pasta(), origem = join(dir, "carga.json"), destino = join(dir, "recibo.json"); writeFileSync(origem, "{}");
  const reservado = prepararArquivoRelatorio(origem, destino); expect(readdirSync(dir)).not.toContain("recibo.json");
  reservado.cancelar(); expect(readdirSync(dir)).toEqual(["carga.json"]);
});
it("preserva recibo temporário recuperável quando o destino é substituído durante a carga", () => {
  const dir = pasta(), origem = join(dir, "carga.json"), destino = join(dir, "recibo.json"); writeFileSync(origem, "{}");
  const reservado = prepararArquivoRelatorio(origem, destino); mkdirSync(destino);
  expect(() => reservado.gravar('{"recibo":"completo"}\n')).toThrow(/recuperação/i);
  reservado.cancelar();
  expect(readFileSync(reservado.caminhoRecuperacao, "utf8")).toContain('"recibo":"completo"');
});


it("erro no JSON limpa só a reserva e conserva o relatório anterior, antes de importar ambiente", () => {
  const dir = pasta(), origem = join(dir, "carga.json"), destino = join(dir, "recibo.json"); writeFileSync(origem, "{inválido"); writeFileSync(destino, "artefato anterior");
  const r = spawnSync(process.execPath, ["--import", "tsx", fileURLToPath(new URL("../import-pecuaria-stg.ts", import.meta.url)), `--arquivo=${origem}`, `--relatorio=${destino}`], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)), encoding: "utf8", env: { ...process.env, DATABASE_URL: "", STORAGE_NAMESPACE: "" },
  });
  expect(r.status).toBe(1); expect(r.stderr).not.toContain("configuração inválida");
  expect(readFileSync(destino, "utf8")).toBe("artefato anterior"); expect(readdirSync(dir).sort()).toEqual(["carga.json", "recibo.json"]);
});
it("não sobrescreve artefato alterado entre reserva e publicação", () => {
  const dir = pasta(), origem = join(dir, "carga.json"), destino = join(dir, "recibo.json"); writeFileSync(origem, "{}"); writeFileSync(destino, "anterior");
  const reservado = prepararArquivoRelatorio(origem, destino); writeFileSync(destino, "outro resultado salvo durante a carga");
  expect(() => reservado.gravar('{"recibo":"novo"}')).toThrow(/recuperação/);
  expect(readFileSync(destino, "utf8")).toBe("outro resultado salvo durante a carga");
  expect(readFileSync(reservado.caminhoRecuperacao, "utf8")).toBe('{"recibo":"novo"}');
});

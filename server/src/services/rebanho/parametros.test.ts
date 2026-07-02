// Integridade dos defaults Embrapa do serviço de parâmetros de manejo.
// Só testa o que é puro/exportado — nada de prisma aqui.
import { describe, it, expect } from "vitest";
import { PARAMETRO_DEFAULTS, CHAVES_PARAMETRO } from "./parametros.js";

const CATEGORIAS = ["MANEJO", "PRODUCAO", "REPRODUCAO", "GESTAO", "SANITARIO"];

describe("PARAMETRO_DEFAULTS", () => {
  it("toda chave de CHAVES_PARAMETRO tem default com categoria válida, descrição e ordem", () => {
    expect(CHAVES_PARAMETRO.length).toBeGreaterThan(0);
    for (const chave of CHAVES_PARAMETRO) {
      const d = PARAMETRO_DEFAULTS[chave];
      expect(d, chave).toBeDefined();
      expect(CATEGORIAS, `${chave}: categoria`).toContain(d.categoria);
      expect(d.descricao.length, `${chave}: descrição vazia`).toBeGreaterThan(0);
      expect(Number.isFinite(d.ordem), `${chave}: ordem`).toBe(true);
    }
  });

  it("toda META_* tem valor ideal, aceitável e direção", () => {
    const metas = CHAVES_PARAMETRO.filter((c) => c.startsWith("META_"));
    expect(metas.length).toBe(24); // 24 metas Embrapa
    for (const chave of metas) {
      const d = PARAMETRO_DEFAULTS[chave];
      expect(d.valor, `${chave}: valor ideal`).not.toBeNull();
      expect(d.aceitavel, `${chave}: aceitável`).not.toBeNull();
      expect(["maior_melhor", "menor_melhor"], `${chave}: direção`).toContain(d.direcao);
    }
  });

  it("desmame: modo default DIAS, 120 dias e 180 kg (caso da reunião)", () => {
    expect(PARAMETRO_DEFAULTS.DESMAME_MODO.modo).toBe("DIAS");
    expect(PARAMETRO_DEFAULTS.DESMAME_DIAS.valor).toBe(120);
    expect(PARAMETRO_DEFAULTS.DESMAME_PESO_KG.valor).toBe(180);
  });

  it("ordens são únicas (ordenação estável na tela de Configurações)", () => {
    const ordens = CHAVES_PARAMETRO.map((c) => PARAMETRO_DEFAULTS[c].ordem);
    expect(new Set(ordens).size).toBe(ordens.length);
  });
});

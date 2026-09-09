// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  SECOES,
  alternarSecao,
  carregarTemplate,
  editarTexto,
  moverSecao,
  salvarTemplate,
  secoesVisiveis,
  templatePadrao,
} from "./template";

afterEach(() => localStorage.clear());

describe("templatePadrao", () => {
  it("traz todas as seções visíveis, na ordem do catálogo, com textos padrão", () => {
    const t = templatePadrao();
    expect(t.secoes.map((s) => s.id)).toEqual(SECOES.map((s) => s.id));
    expect(t.secoes.every((s) => s.visivel)).toBe(true);
    expect(t.titulo).toBe("Relatório financeiro gerencial");
    expect(t.observacoes).toBe("");
  });
});

describe("edição do template", () => {
  it("move uma seção para cima e para baixo sem sair dos limites", () => {
    const t = templatePadrao();
    const ids = t.secoes.map((s) => s.id);
    const desceu = moverSecao(t, ids[0], 1);
    expect(desceu.secoes.map((s) => s.id).slice(0, 2)).toEqual([ids[1], ids[0]]);
    const subiu = moverSecao(desceu, ids[0], -1);
    expect(subiu.secoes.map((s) => s.id)).toEqual(ids);
    expect(moverSecao(t, ids[0], -1)).toEqual(t);
    expect(moverSecao(t, ids[ids.length - 1], 1)).toEqual(t);
  });

  it("alterna a visibilidade sem mudar a ordem", () => {
    const t = alternarSecao(templatePadrao(), "categorias");
    expect(t.secoes.find((s) => s.id === "categorias")?.visivel).toBe(false);
    expect(t.secoes.map((s) => s.id)).toEqual(SECOES.map((s) => s.id));
    expect(alternarSecao(t, "categorias").secoes.find((s) => s.id === "categorias")?.visivel).toBe(true);
  });

  it("edita só o texto pedido e não toca nas seções", () => {
    const t = editarTexto(templatePadrao(), "subtitulo", "Sítio Sede");
    expect(t.subtitulo).toBe("Sítio Sede");
    expect(t.titulo).toBe("Relatório financeiro gerencial");
    expect(t.secoes).toEqual(templatePadrao().secoes);
  });
});

describe("secoesVisiveis", () => {
  it("omite seções invisíveis e as que não pertencem ao regime", () => {
    const t = alternarSecao(templatePadrao(), "operacoes");
    expect(secoesVisiveis(t, "realizado")).not.toContain("compromissos");
    expect(secoesVisiveis(t, "previsto")).toEqual(["resumo", "compromissos", "rastreabilidade"]);
    expect(secoesVisiveis(t, "ambos")).not.toContain("operacoes");
    expect(secoesVisiveis(t, "ambos")).toContain("compromissos");
  });
});

describe("persistência", () => {
  it("salva e recarrega por propriedade, completando seções que faltarem", () => {
    const t = editarTexto(alternarSecao(templatePadrao(), "resultado"), "titulo", "Meu relatório");
    salvarTemplate(7, t);
    expect(carregarTemplate(7)).toEqual(t);
    expect(carregarTemplate(null)).toEqual(templatePadrao());
    localStorage.setItem("terrano:relatorio-gerencial:template:7", JSON.stringify({ titulo: "Antigo", secoes: [{ id: "resumo", visivel: false }, { id: "inexistente", visivel: true }] }));
    const migrado = carregarTemplate(7);
    expect(migrado.titulo).toBe("Antigo");
    expect(migrado.secoes[0]).toEqual({ id: "resumo", visivel: false });
    expect(migrado.secoes.map((s) => s.id)).toEqual(SECOES.map((s) => s.id));
  });
});

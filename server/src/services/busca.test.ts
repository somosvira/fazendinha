import { beforeEach, describe, it, expect, vi } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../db.js", () => ({ prisma: { $queryRaw: query } }));
import { qValido, buscarEntidades } from "./busca.js";
import type { UsuarioContexto } from "./auth/sessao.js";
const dono: UsuarioContexto = { id: 1, nome: "Dono", email: "", papel: "proprietario", abas: [], areas: [], flags: [], dono: true, status: "ATIVO" };
beforeEach(() => { query.mockReset(); query.mockResolvedValue([]); });
describe("consulta da busca", () => {
  it("rejeita consulta vazia ou uma letra, mas permite brinco de um dígito", () => {
    for (const q of ["", " ", "a", " a "]) expect(qValido(q)).toBe(false);
    for (const q of ["ca", " CA ", "1"]) expect(qValido(q)).toBe(true);
  });
  it("não consulta banco sem termo ou fontes autorizadas", async () => {
    expect(await buscarEntidades("", dono, null)).toEqual([]);
    expect(await buscarEntidades("leite", { ...dono, dono: false }, null)).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
  it("devolve o destino exato com sítio e sem dados de consulta internos", async () => {
    query.mockResolvedValue([{ tipo: "animal", id: "animal-184", label: "184 — Estrela", contexto: "Rebanho › Principal", alvoId: "animal-184", propriedadeId: 7 }]);
    const [r] = await buscarEntidades("184", dono, 7);
    expect(r).toEqual({ tipo: "animal", entidadeId: "animal-184", label: "184 — Estrela", sublabel: "Rebanho › Principal", grupo: "Animais", tab: "pec-rebanho", caminho: "/pecuaria/rebanho/animais/animal-184?propriedadeId=7&sitio=7" });
  });
  it("categorias vão à consulta atual e parceiros à ficha de leitura", async () => {
    query.mockResolvedValue([
      { tipo: "categoria", id: "c1", label: "Ração & sal", contexto: "Categorias", alvoId: "c1", propriedadeId: null },
      { tipo: "parceiro", id: "p1", label: "Loja", contexto: "Parceiros", alvoId: "p1", propriedadeId: null },
    ]);
    const r = await buscarEntidades("racao", dono, null);
    expect(r[0].caminho).toBe("/financeiro/configuracoes?aba=categorias&busca=Ra%C3%A7%C3%A3o%20%26%20sal");
    expect(r[1].caminho).toBe("/financeiro/configuracoes?aba=parceiros&parceiro=p1");
  });
});

import { expect, it, vi } from "vitest";
vi.mock("../../env.js", () => ({
  env: { JWT_SECRET: "segredo-unitario-sem-uso-real" },
}));
import { assinarProposta, lerProposta, podeEditarRebanho } from "./pesagem.js";
const usuario = { id: 4, dono: false, areas: ["pecuaria"], flags: ["lancar"] };
it("vincula confirmação a usuário, sítio e prazo e recusa adulteração", () => {
  const dados = {
    chave: "chave",
    usuarioId: 4,
    propriedadeId: 7,
    animalId: "animal",
    data: "2026-11-02",
    pesoKg: 450,
    expiraEm: Date.now() + 60000,
  };
  const token = assinarProposta(dados);
  expect(lerProposta(token, 4, 7)).toEqual(dados);
  expect(() => lerProposta(token, 5, 7)).toThrow();
  expect(() => lerProposta(token, 4, 8)).toThrow();
  expect(() => lerProposta(token + "x", 4, 7)).toThrow();
  expect(() =>
    lerProposta(assinarProposta({ ...dados, expiraEm: 1 }), 4, 7),
  ).toThrow();
});
it("consulta não concede lançamento e exige pecuária", () => {
  expect(podeEditarRebanho(usuario)).toBe(true);
  expect(podeEditarRebanho({ ...usuario, flags: [] })).toBe(false);
  expect(podeEditarRebanho({ ...usuario, areas: [] })).toBe(false);
});

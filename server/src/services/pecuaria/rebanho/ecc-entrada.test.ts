import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ registrar: vi.fn() }));
vi.mock("../sanidade/exames.js", () => ({ registrarExameTx: mocks.registrar }));
import { registrarEccEntradaTx } from "./ecc-entrada.js";
import { RebanhoError } from "./regras.js";
describe("ECC de entrada", () => {
  it("registra escala estruturada, data, sítio e autor", async () => {
    const tx = {} as never;
    await registrarEccEntradaTx(tx, { animalId: "a", propriedadeId: 1, data: "2026-01-10", valor: 3.25 }, 7);
    expect(mocks.registrar).toHaveBeenCalledWith(tx, expect.objectContaining({ animalId: "a", propriedadeId: 1, data: "2026-01-10", resultados: [{ campo: "ESCORE", valor: 3.25 }, { campo: "ESCALA_MIN", valor: 1 }, { campo: "ESCALA_MAX", valor: 5 }] }), 7);
  });
  it("aponta falha de domínio ao campo ECC e propaga falha técnica", async () => {
    mocks.registrar.mockRejectedValueOnce(new RebanhoError("CONFLITO", "formato mudou", "tipoExameId"));
    await expect(registrarEccEntradaTx({} as never, { animalId: "a", propriedadeId: 1, data: "2026-01-10", valor: 3 }, 7)).rejects.toMatchObject({ campo: "eccEntrada" });
    const erro = new Error("falha técnica"); mocks.registrar.mockRejectedValueOnce(erro);
    await expect(registrarEccEntradaTx({} as never, { animalId: "a", propriedadeId: 1, data: "2026-01-10", valor: 3 }, 7)).rejects.toBe(erro);
  });
});

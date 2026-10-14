import { describe, expect, it } from "vitest";
import { camposExameSchema, validarObservacoesExame } from "./formatos.js";
const formato = [{ codigo: "MEDIDA", tipo: "NUMERO", unidade: "mm", obrigatorio: true }, { codigo: "OBSERVADO", tipo: "BOOLEANO" }, { codigo: "CONCLUSAO", tipo: "OPCAO", opcoes: ["A", "B"] }];
describe("observações do exame comum", () => {
  it("conserva zero, falso e precisão decimal sem converter ausência em valor", () => {
    expect(validarObservacoesExame(formato, [{ campo: "MEDIDA", valor: "0.0000" }, { campo: "OBSERVADO", valor: false }])).toEqual([
      { campo: "MEDIDA", valor: "0", unidade: "mm" }, { campo: "OBSERVADO", valor: false, unidade: null },
    ]);
    expect(() => validarObservacoesExame(formato, [])).toThrow(/obrigatórios/);
    expect(validarObservacoesExame(formato, [], false)).toEqual([]);
  });
  it("recusa campos/opções desconhecidos, repetição e formato ambíguo", () => {
    expect(() => validarObservacoesExame(formato, [{ campo: "MEDIDA", valor: "Infinity" }])).toThrow(/incompatível/);
    expect(() => validarObservacoesExame(formato, [{ campo: "INVENTADO", valor: "P+" }])).toThrow(/formato/);
    expect(() => validarObservacoesExame(formato, [{ campo: "CONCLUSAO", valor: "P+" }])).toThrow(/incompatível/);
    expect(() => validarObservacoesExame(formato, [{ campo: "MEDIDA", valor: 0 }, { campo: "MEDIDA", valor: 1 }])).toThrow(/repetidos/);
    expect(camposExameSchema.safeParse([...formato, formato[0]]).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { conferirOrdem, conferirDestino, conferirSnapshots } from "./manifesto.js";

describe("manifesto da reconciliação IDEAGRI", () => {
  it("impede executar uma unidade antes da dependência ou repetir a origem", () => {
    expect(() => conferirOrdem([{ chave: "PESO:2", dependencias: ["ANIMAL:1"] }, { chave: "ANIMAL:1", dependencias: [] }])).toThrow(/dependência/i);
    expect(() => conferirOrdem([{ chave: "PESO:2", dependencias: [] }, { chave: "PESO:2", dependencias: [] }])).toThrow(/duplicada/i);
    expect(() => conferirOrdem([{ chave: "ANIMAL:1", dependencias: [] }, { chave: "PESO:2", dependencias: ["ANIMAL:1"] }])).not.toThrow();
  });

  it("compara os registros por identidade e detecta alteração e acréscimo", () => {
    const antes = [{ id: "a", data: "2026-10-31" }, { id: "b", data: "2026-11-02" }];
    expect(() => conferirSnapshots("Pesagem", antes, [...antes].reverse())).not.toThrow();
    expect(() => conferirSnapshots("Pesagem", antes, [antes[0], { ...antes[1], data: "2026-11-11" }])).toThrow(/Pesagem.*b/);
    expect(() => conferirSnapshots("Pesagem", antes, [...antes, { id: "c", data: null }])).toThrow(/Pesagem.*c/);
  });

  it("restringe o manifesto remoto à branch staging selecionada e a validação local ao banco único", () => {
    const host = "ep-green-recipe-acyjvbqp.sa-east-1.aws.neon.tech";
    expect(() => conferirDestino(`postgresql://${host}/neondb?sslmode=require`, "staging")).not.toThrow();
    expect(() => conferirDestino("postgresql://outro.neon.tech/neondb?sslmode=require", "staging")).toThrow(/destino/i);
    expect(() => conferirDestino("postgresql://localhost/fazendinha_seedatev3", "dev")).not.toThrow();
    expect(() => conferirDestino("postgresql://localhost/outro", "dev")).toThrow(/destino/i);
  });
});

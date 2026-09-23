import { describe, expect, it } from "vitest";
import { incluirInativosQuerySchema } from "./schemas.js";

describe("incluirInativosQuerySchema", () => {
  it("'false' vira false", () => {
    expect(incluirInativosQuerySchema.parse({ incluirInativos: "false" })).toEqual({ incluirInativos: false });
  });

  it("'true' vira true", () => {
    expect(incluirInativosQuerySchema.parse({ incluirInativos: "true" })).toEqual({ incluirInativos: true });
  });

  it("ausente vira false", () => {
    expect(incluirInativosQuerySchema.parse({})).toEqual({ incluirInativos: false });
  });

  it("qualquer outro valor é rejeitado", () => {
    expect(() => incluirInativosQuerySchema.parse({ incluirInativos: "1" })).toThrow();
  });
});

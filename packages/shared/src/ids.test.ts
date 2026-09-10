import { describe, expect, it } from "vitest";
import { entityIdSchema, newEntityId } from "./index.js";

describe("identidade compartilhada", () => {
  it("gera UUID aceito pelo contrato", () => {
    expect(entityIdSchema.safeParse(newEntityId()).success).toBe(true);
  });

  it("rejeita ids incrementais e temporários", () => {
    expect(entityIdSchema.safeParse("42").success).toBe(false);
    expect(entityIdSchema.safeParse("local:abc").success).toBe(false);
  });
});

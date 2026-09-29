import { describe, expect, it } from "vitest";
import { ehOfflineSemDados } from "./estadoQuery";

describe("ehOfflineSemDados", () => {
  it("true só quando pendente e pausada", () => {
    expect(ehOfflineSemDados({ isPending: true, fetchStatus: "paused" })).toBe(true);
  });

  it("false quando pendente mas ainda buscando (fetchStatus fetching)", () => {
    expect(ehOfflineSemDados({ isPending: true, fetchStatus: "fetching" })).toBe(false);
  });

  it("false quando já resolveu, mesmo pausada", () => {
    expect(ehOfflineSemDados({ isPending: false, fetchStatus: "paused" })).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { buildTimeline } from "./timeline";
import { eventos } from "../mock/eventos";

describe("buildTimeline", () => {
  it("filtra por animal e ordena do mais recente pro mais antigo", () => {
    const tl = buildTimeline(eventos, "1234");
    expect(tl).toHaveLength(7);
    expect(tl[0].data).toBe("2026-05-28");
    expect(tl[tl.length - 1].data).toBe("2025-12-18");
  });
  it("retorna vazio pra animal sem eventos", () => {
    expect(buildTimeline(eventos, "9999")).toEqual([]);
  });
});

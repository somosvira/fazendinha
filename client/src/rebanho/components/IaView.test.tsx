import { describe, expect, it, vi } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { IaView } from "./IaView";

vi.mock("../api", () => ({
  perguntarIA: vi.fn(),
  useInsights: () => ({ data: [], loading: false }),
}));

describe("IaView — reflow", () => {
  it("empilha conversa e insights antes do breakpoint largo", () => {
    const html = renderToString(h(IaView));
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("min-[1000px]:grid-cols-[minmax(0,1fr)_300px]");
    expect(html).toContain("min-w-0");
  });
});

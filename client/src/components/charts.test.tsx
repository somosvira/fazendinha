import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EntradaSaidaChart } from "./charts";

describe("EntradaSaidaChart", () => {
  it("compacta os rótulos do eixo e mantém valores exatos nos tooltips", () => {
    const html = renderToStaticMarkup(<EntradaSaidaChart data={[{ data: "2026-09-01", entradas: 1_000_000, saidas: 0 }]} />);
    expect(html).toContain("R$ 1,00 mi");
    expect(html).toContain("Entradas: R$ 1.000.000,00");
  });
});

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { csvProducaoLeite, ExportacaoProducaoLeite } from "./ExportacaoProducaoLeite";
import { consultarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({consultarLeite:vi.fn()}));
afterEach(cleanup);
it("exportação preserva zero, desconhecido e escapa fórmulas no CSV", () => {
  const csv=csvProducaoLeite([{data:"2026-10-01",brinco:"=1+1",nome:null,ordenha:"Manhã",natureza:"COLOSTRO",estado:"MEDIDA",litros:0,confirmada:false}]);
  expect(csv).toContain('"\'=1+1"'); expect(csv).toContain('"0"'); expect(csv).toContain('"Não informado"'); expect(csv).toContain('"Colostro"');
});
it("consulta sem exportar não oferece comando nem requisita arquivos", () => {
  render(<ExportacaoProducaoLeite podeExportar={false} />);
  expect(screen.queryByRole("button",{name:"Exportar produção do período"})).toBeNull(); expect(consultarLeite).not.toHaveBeenCalled();
});

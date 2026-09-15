import type { Tab } from "../components/Shell";
import { CompromissosFinanceiros } from "./CompromissosFinanceiros";
import { ConfiguracoesFinanceiras } from "./ConfiguracoesFinanceiras";
import { ContasFinanceiras } from "./ContasFinanceiras";
import { OperacoesFinanceiras } from "./OperacoesFinanceiras";
import { RelatoriosFinanceiros } from "./RelatoriosFinanceiros";
import { VisaoGeralFinanceira } from "./VisaoGeralFinanceira";

export function FinanceiroContent({ tab, onNav, podeEditarCadastros = true, podeExportar = true }: { tab: Tab; onNav: (tab: Tab) => void; podeEditarCadastros?: boolean; podeExportar?: boolean }) {
  if (tab === "dashboard") return <VisaoGeralFinanceira onNav={onNav} />;
  if (tab === "lancar") return <OperacoesFinanceiras />;
  if (tab === "gastos") return <CompromissosFinanceiros onNav={onNav} />;
  if (tab === "caixinha") return <ContasFinanceiras onNav={onNav} />;
  if (tab === "cadastros" || tab === "plano") return <ConfiguracoesFinanceiras abaInicial={tab === "plano" ? "categorias" : "contas"} podeEditar={podeEditarCadastros} />;
  return <RelatoriosFinanceiros podeExportar={podeExportar} />;
}

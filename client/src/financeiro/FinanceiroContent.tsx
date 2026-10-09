import "./financeiro-theme.css";
import type { Tab } from "../components/Shell";
import { CompromissosFinanceiros } from "./CompromissosFinanceiros";
import { ConfiguracoesFinanceiras } from "./ConfiguracoesFinanceiras";
import { ContasFinanceiras } from "./ContasFinanceiras";
import { OperacoesFinanceiras } from "./OperacoesFinanceiras";
import { RelatoriosFinanceiros } from "./RelatoriosFinanceiros";
import { VisaoGeralFinanceira } from "./VisaoGeralFinanceira";

function ConteudoFinanceiro({ tab, onNav, podeEditarCadastros = true, podeLancar = true, podeExportar = true }: { tab: Tab; onNav: (tab: Tab) => void; podeEditarCadastros?: boolean; podeLancar?: boolean; podeExportar?: boolean }) {
  if (tab === "dashboard") return <VisaoGeralFinanceira onNav={onNav} podeLancar={podeLancar} />;
  if (tab === "lancar") return <OperacoesFinanceiras podeLancar={podeLancar} />;
  if (tab === "gastos") return <CompromissosFinanceiros onNav={onNav} podeLancar={podeLancar} />;
  if (tab === "caixinha") return <ContasFinanceiras onNav={onNav} />;
  if (tab === "cadastros" || tab === "plano") return <ConfiguracoesFinanceiras abaInicial={tab === "plano" ? "categorias" : "contas"} podeEditar={podeEditarCadastros} />;
  return <RelatoriosFinanceiros podeExportar={podeExportar} />;
}

export function FinanceiroContent(props: Parameters<typeof ConteudoFinanceiro>[0]) {
  return <div className="financeiro-content"><ConteudoFinanceiro {...props} /></div>;
}

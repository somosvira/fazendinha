import "./financeiro-theme.css";
import type { Tab } from "../components/Shell";
import { CompromissosFinanceiros } from "./CompromissosFinanceiros";
import { ConfiguracoesFinanceiras } from "./ConfiguracoesFinanceiras";
import { ContasFinanceiras } from "./ContasFinanceiras";
import { OperacoesFinanceiras } from "./OperacoesFinanceiras";
import { RelatoriosFinanceiros } from "./RelatoriosFinanceiros";
import { VisaoGeralFinanceira } from "./VisaoGeralFinanceira";
import { PageHeader, PaginaFinanceira } from "./financeiro-ui";

function ConteudoFinanceiro({ tab, onNav, podeEditarCadastros = true, podeLancar = true, podeExportar = true, podeVerValores = true }: { tab: Tab; onNav: (tab: Tab) => void; podeEditarCadastros?: boolean; podeLancar?: boolean; podeExportar?: boolean; podeVerValores?: boolean }) {
  if (!podeVerValores && ["dashboard", "gastos", "caixinha", "relatorio"].includes(tab)) return <PaginaFinanceira><PageHeader titulo={{ dashboard: "Visão geral financeira", gastos: "Compromissos", caixinha: "Contas e extratos", relatorio: "Relatórios" }[tab as "dashboard" | "gastos" | "caixinha" | "relatorio"]} /><section className="mt-5 rounded-xl border border-border bg-card p-6" role="status"><h2 className="text-lg font-semibold">Valores financeiros restritos</h2><p className="mt-2 text-sm text-muted-foreground">Seu perfil não tem permissão para consultar valores financeiros. As consultas operacionais de rebanho, sanidade, nutrição e estoque continuam disponíveis conforme suas áreas.</p></section></PaginaFinanceira>;
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

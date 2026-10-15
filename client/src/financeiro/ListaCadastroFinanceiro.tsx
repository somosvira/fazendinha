import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Empty, Paginacao, Panel, SelectFiltro, TabelaFinanceira, type ColunaTabela } from "./financeiro-ui";

export const normalizarBuscaFinanceira = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "");

export function ListaCadastroFinanceiro<T extends { id: string; nome: string; ativo?: boolean }>({ itens, colunas, rotulo, rotuloBusca, termosDe, onAbrir, filtros, mostrarSituacao = true }: {
  itens: T[]; colunas: ColunaTabela<T>[]; rotulo: string; rotuloBusca?: string;
  termosDe?: (item: T) => string; onAbrir?: (item: T) => void; filtros?: ReactNode; mostrarSituacao?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), [itens]);
  const consulta = normalizarBuscaFinanceira(busca);
  const filtrados = itens.filter(item => normalizarBuscaFinanceira(termosDe?.(item) ?? item.nome).includes(consulta)
    && (!situacao || (situacao === "ATIVOS" ? item.ativo !== false : item.ativo === false)));
  const porPagina = 15;
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const atual = Math.min(pagina, totalPaginas);
  return <Panel className="mt-4 overflow-hidden" tom="info">
    <div className="fin-filtros-barra flex flex-wrap items-end gap-3 border-b border-border p-4" onChange={() => setPagina(1)}>
      <label className="fin-filtro-busca min-w-0 flex-[1_1_220px] text-sm font-medium">Buscar<span className="relative mt-1 block"><Search size={18} strokeWidth={1.8} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" /><Input aria-label={rotuloBusca ?? `Buscar ${rotulo.toLocaleLowerCase("pt-BR")}`} placeholder={rotulo === "Clientes e fornecedores" ? "Nome, documento ou contato…" : `Nome de ${rotulo.toLocaleLowerCase("pt-BR")}…`} value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} className="bg-card pl-10" /></span></label>
      {mostrarSituacao && <label className="fin-filtro-campo text-sm font-medium">Situação<SelectFiltro rotulo={`Situação: ${rotulo}`} valor={situacao} onChange={v => { setSituacao(v); setPagina(1); }} opcoes={[{ valor: "", texto: "Ativos e inativos" }, { valor: "ATIVOS", texto: "Ativos" }, { valor: "INATIVOS", texto: "Inativos" }]} className="mt-1" /></label>}
      {filtros}
    </div>
    {filtrados.length ? <TabelaFinanceira compacta rotulo={rotulo} itens={filtrados.slice((atual - 1) * porPagina, atual * porPagina)} colunas={colunas} chaveDe={item => item.id} onAbrir={onAbrir} /> : <Empty>Nenhum cadastro encontrado. Ajuste a busca ou os filtros.</Empty>}
    <Paginacao pagina={atual} totalPaginas={totalPaginas} total={filtrados.length} porPagina={porPagina} rotulo={`Paginação: ${rotulo}`} substantivo="cadastros" idSelect={`pagina-${rotulo}`} onPagina={setPagina} />
  </Panel>;
}

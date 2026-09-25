import { useState } from "react";
import { MultiSelect } from "../components/MultiSelect";
import { MonetaryDonutChart } from "../components/charts";
import type { Categoria, DashboardFinanceiro } from "./novo-api";
import { Panel } from "./financeiro-ui";
import { SEM_VINCULO } from "../lib/ids";

export function AnaliseCategorias({ despesas, categorias }: {
  despesas: DashboardFinanceiro["despesasPorCategoria"];
  categorias: Pick<Categoria, "id" | "nome">[];
}) {
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const options = [...categorias.map(item => ({ value: item.id, label: item.nome })), { value: SEM_VINCULO, label: "Sem categoria" }];
  for (const item of despesas) {
    const chave = item.categoriaId ?? SEM_VINCULO;
    if (!options.some(option => option.value === chave)) options.push({ value: chave, label: item.categoria });
  }
  const filtradas = despesas.filter(item => !selecionadas.length || selecionadas.includes(item.categoriaId ?? SEM_VINCULO));
  return <Panel className="mt-6 overflow-hidden">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5"><div><h2 className="font-serif text-xl">Despesas por categoria</h2><p className="mt-1 text-xs text-ink-3">Pagamentos realizados no período do topo, líquidos de estornos.</p></div><div className="w-full sm:max-w-xs"><MultiSelect label="Categorias" placeholder="Todas as categorias" helpText="Sem seleção, inclui todas as categorias." options={options} value={selecionadas} onValueChange={setSelecionadas} /></div></div>
    <MonetaryDonutChart label="Despesas por categoria" emptyLabel="Nenhuma despesa nas categorias selecionadas no período." data={filtradas.map(item => ({ label: item.categoria, value: Number(item.valor) }))} />
  </Panel>;
}

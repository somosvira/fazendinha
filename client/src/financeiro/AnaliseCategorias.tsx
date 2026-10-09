import { RankingCategorias } from "./RankingCategorias";
import { useState } from "react";
import { MultiSelect } from "../components/MultiSelect";
import { DetalheCategoriaDespesa } from "./DetalheCategoriaDespesa";
import { MonetaryDonutChart, type MonetaryChartItem } from "../components/charts";
import type { Categoria, DashboardFinanceiro } from "./novo-api";
import { Card } from "@/components/ui/card";
import { SEM_VINCULO } from "../lib/ids";

export function AnaliseCategorias({ despesas, categorias, compacto = false, inicio, fim }: {
  compacto?: boolean; inicio?: string; fim?: string;
  despesas: DashboardFinanceiro["despesasPorCategoria"];
  categorias: Pick<Categoria, "id" | "nome">[];
}) {
  const [detalhe, setDetalhe] = useState<MonetaryChartItem[] | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const options = [...categorias.map(item => ({ value: item.id, label: item.nome })), { value: SEM_VINCULO, label: "Sem categoria" }];
  for (const item of despesas) {
    const chave = item.categoriaId ?? SEM_VINCULO;
    if (!options.some(option => option.value === chave)) options.push({ value: chave, label: item.categoria });
  }
  const filtradas = despesas.filter(item => !selecionadas.length || selecionadas.includes(item.categoriaId ?? SEM_VINCULO));
  if (compacto) return <RankingCategorias despesas={despesas} categorias={categorias} inicio={inicio} fim={fim} />;
  return <Card data-fin-tom="saida" className={`fin-painel ${compacto ? "" : "mt-6"} @container min-w-0 gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none`}>
    <div className="fin-cabecalho flex flex-wrap items-start justify-between gap-2 p-4 pb-0"><div><h2 className="font-serif text-xl">Despesas por categoria</h2><p className="sr-only">Pagamentos realizados no período do topo, líquidos de estornos.</p></div><div className="w-full sm:max-w-[210px]"><MultiSelect label="Categorias" placeholder="Todas as categorias" ajuda="Sem seleção, inclui todas as categorias." options={options} value={selecionadas} onValueChange={setSelecionadas} /></div></div>
    <MonetaryDonutChart compacto={compacto} label="Despesas por categoria" emptyLabel="Nenhuma despesa nas categorias selecionadas no período." onSelect={inicio && fim ? setDetalhe : undefined} data={filtradas.map(item => ({ id: item.categoriaId ?? SEM_VINCULO, label: item.categoria, value: Number(item.valor) }))} />
    {detalhe && inicio && fim && <DetalheCategoriaDespesa categorias={detalhe} inicio={inicio} fim={fim} onClose={() => setDetalhe(null)} />}
  </Card>;
}

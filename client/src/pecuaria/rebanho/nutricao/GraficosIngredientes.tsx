import { ComparacaoPecuaria, type ItemDistribuicao } from "../components/DistribuicaoPecuaria";

/** Não soma nem compara ingredientes de unidades diferentes no mesmo eixo. */
export function GraficosIngredientes({ itens, titulo, embutido = false }: { itens: Array<{ id: string; nome: string; quantidade: string; unidade: string }>; titulo: string; embutido?: boolean }) {
  const grupos = new Map<string, ItemDistribuicao[]>();
  for (const item of itens) {
    if (!item.quantidade.trim()) continue;
    const qtd = Number(item.quantidade);
    if (!Number.isFinite(qtd) || qtd < 0) continue;
    const grupo = grupos.get(item.unidade) ?? [];
    grupo.push({ id: item.id, nome: item.nome, qtd });
    grupos.set(item.unidade, grupo);
  }
  if (!grupos.size) return null;
  return <div className="pec-ingredientes-graficos">{[...grupos].map(([unidade, dados]) => <ComparacaoPecuaria embutido={embutido} key={unidade} titulo={`${titulo} · ${unidade}`} descricao="Quantidades na mesma unidade · sem conversão de matéria seca" unidade={unidade} itens={dados} inteiro={false} />)}</div>;
}

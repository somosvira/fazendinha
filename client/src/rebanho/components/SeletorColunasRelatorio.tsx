import { RebButton } from "@/components/rb/RebButton";
import type { ResultadoRelatorioRebanhoDTO } from "../api";
import { colunasDisponiveis } from "./relatorioColunas";

export function SeletorColunasRelatorio({ data, valor, onChange }: {
  data: ResultadoRelatorioRebanhoDTO;
  valor: string[];
  onChange: (valor: string[]) => void;
}) {
  const colunas = colunasDisponiveis(data);
  const selecionadas = valor.length ? valor : colunas.map((c) => c.chave);
  const restantes = colunas.filter((c) => !selecionadas.includes(c.chave));

  function mover(chave: string, direcao: -1 | 1) {
    const proxima = [...selecionadas];
    const atual = proxima.indexOf(chave);
    const destino = atual + direcao;
    if (atual < 0 || destino < 0 || destino >= proxima.length) return;
    [proxima[atual], proxima[destino]] = [proxima[destino], proxima[atual]];
    onChange(proxima);
  }

  return <div className="mb-4 rounded-lg border border-border bg-card p-4 print:hidden">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="m-0 font-serif text-lg font-medium">Colunas do relatório</h3><p className="mb-0 mt-1 text-xs text-ink-3">Marque apenas o que será exibido e exportado. Use as setas para definir a ordem.</p></div>
      <RebButton onClick={() => onChange(colunas.map((c) => c.chave))}>Restaurar padrão</RebButton>
    </div>
    <div className="flex flex-wrap gap-2">
      {selecionadas.map((chave, indice) => {
        const coluna = colunas.find((c) => c.chave === chave);
        if (!coluna) return null;
        return <div key={chave} className="flex items-center rounded-md border border-border bg-background text-xs">
          <label className="flex cursor-pointer items-center gap-2 px-3 py-2"><input type="checkbox" checked onChange={() => onChange(selecionadas.filter((item) => item !== chave))} />{coluna.rotulo}</label>
          <button type="button" aria-label={`Mover ${coluna.rotulo} para a esquerda`} className="border-0 border-l border-border bg-transparent px-2 py-2 disabled:opacity-30" disabled={indice === 0} onClick={() => mover(chave, -1)}>←</button>
          <button type="button" aria-label={`Mover ${coluna.rotulo} para a direita`} className="border-0 border-l border-border bg-transparent px-2 py-2 disabled:opacity-30" disabled={indice === selecionadas.length - 1} onClick={() => mover(chave, 1)}>→</button>
        </div>;
      })}
      {restantes.map((coluna) => <label key={coluna.chave} className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-ink-3"><input type="checkbox" checked={false} onChange={() => onChange([...selecionadas, coluna.chave])} />{coluna.rotulo}</label>)}
    </div>
    {!selecionadas.length && <p role="alert" className="mb-0 mt-3 text-xs text-prejuizo">Selecione ao menos uma coluna para visualizar ou exportar.</p>}
  </div>;
}

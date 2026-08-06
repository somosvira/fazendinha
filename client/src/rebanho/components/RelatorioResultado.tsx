import { Loader } from "../../components/Loading";
import { RebButton } from "@/components/rb/RebButton";
import { RebEmpty } from "@/components/rb/RebPrimitives";
import { RebTable } from "@/components/rb/RebTable";
import type { LinhaRelatorioRebanhoDTO, ResultadoRelatorioRebanhoDTO } from "../api";
import { AnimalIdentity } from "./AnimalIdentity";
import { resolverColunas } from "./relatorioColunas";
import { SeletorColunasRelatorio } from "./SeletorColunasRelatorio";

type AcaoRelatorio = NonNullable<ResultadoRelatorioRebanhoDTO["acao"]>;

export function RelatorioResultado({
  data, loading, erro, onAbrirFicha, onRegistrar, onExportarCsv, onExportarPdf, onMontarFormulario, exportandoPdf, colunasVisiveis, onColunasVisiveis,
}: {
  data: ResultadoRelatorioRebanhoDTO | null;
  loading: boolean;
  erro: string | null;
  onAbrirFicha: (id: string) => void;
  onRegistrar: (payload: { linha: LinhaRelatorioRebanhoDTO; acao: AcaoRelatorio }) => void;
  onExportarCsv: (colunas: string[]) => void;
  onExportarPdf: (colunas: string[]) => void;
  onMontarFormulario: () => void;
  exportandoPdf: boolean;
  colunasVisiveis: string[];
  onColunasVisiveis: (colunas: string[]) => void;
}) {
  if (loading && !data) return <div className="mt-8"><Loader /></div>;
  if (erro) return <p role="alert" className="mt-6 text-sm text-prejuizo">Erro: {erro}</p>;
  if (!data) return <RebEmpty className="mt-8">Escolha um modelo, ajuste os filtros e gere o relatório.</RebEmpty>;

  const colunas = resolverColunas(data, colunasVisiveis);
  const ordem = colunas.map((c) => c.chave);
  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h2 className="m-0 font-serif text-2xl font-medium">{data.titulo}</h2>
          <p className="mt-1 text-sm text-ink-3">{data.total} {data.total === 1 ? "linha" : "linhas"} · {data.granularidade === "evento" ? "uma por evento" : "uma por animal"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.templateId !== "novilhas-aptas" && <RebButton variant="pri" onClick={onMontarFormulario} disabled={!data.linhas.length || data.truncado}>Montar formulário</RebButton>}
          <RebButton onClick={() => onExportarCsv(ordem)} disabled={!data.linhas.length || !colunas.length}>↓ CSV</RebButton>
          <RebButton onClick={() => onExportarPdf(ordem)} disabled={!data.linhas.length || !colunas.length || exportandoPdf}>{exportandoPdf ? "Gerando PDF…" : "↓ PDF"}</RebButton>
        </div>
      </div>
      {data.truncado && <p role="status" className="mb-3 text-sm text-prejuizo">Exibindo as primeiras 2.000 linhas de {data.total}. Refine os filtros antes de exportar.</p>}
      <SeletorColunasRelatorio data={data} valor={colunasVisiveis} onChange={onColunasVisiveis} />
      {!data.linhas.length ? <RebEmpty>Nenhum animal encontrado com estes filtros.</RebEmpty> : (
        <div className="bg-[color:var(--bg)] p-1 print:p-0">
          <div className="mb-4 hidden print:block">
            <p className="text-xs uppercase tracking-[.12em] text-ink-3">Rebanho · Relatório</p>
            <h1 className="font-serif text-2xl">{data.titulo}</h1>
            <p className="text-sm text-ink-3">{data.descricao} · {data.total} {data.total === 1 ? "linha" : "linhas"}</p>
          </div>
          <RebTable className="relatorio-export-table table-auto">
            <colgroup>{colunas.map((c) => <col key={c.chave} />)}<col data-export-ignore /></colgroup>
            <thead><tr>{colunas.map((c) => <th key={c.chave}>{c.rotulo}</th>)}<th data-export-ignore className="print:hidden">Ações</th></tr></thead>
            <tbody>{data.linhas.map((linha, index) => (
              <tr key={`${linha.eventoId ?? linha.animalId}-${index}`}>
                {colunas.map((coluna) => <td key={coluna.chave} className={coluna.chave === "data" ? "tabular-nums" : undefined}>{coluna.chave === "animal" ? <button type="button" aria-label={`Abrir ficha do animal ${linha.numero}`} className="min-w-[190px] border-0 bg-transparent p-0 text-left" onClick={() => onAbrirFicha(String(linha.animalId))}><AnimalIdentity numero={linha.numero} nome={linha.nome ?? ""} className="max-w-full" nameClassName="whitespace-normal break-words [overflow:visible] [text-overflow:clip]" /></button> : coluna.valor(linha) ?? "—"}</td>)}
                <td data-export-ignore className="print:hidden"><div className="flex flex-wrap gap-2">{data.acao && <RebButton variant="pri" onClick={() => onRegistrar({ linha, acao: data.acao as AcaoRelatorio })}>{data.acao.rotulo}</RebButton>}<RebButton onClick={() => onAbrirFicha(String(linha.animalId))}>Abrir ficha</RebButton></div></td>
              </tr>
            ))}</tbody>
          </RebTable>
        </div>
      )}
    </section>
  );
}

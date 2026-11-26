import { Button, Empty } from "@/financeiro/financeiro-ui";

export type ResumoOcorrencias = { abertas: number; encerradas: number; anuladas: number; porDoenca: { id: string; nome: string; quantidade: number }[] };

/** Distribuição dos casos abertos por doença; clicar numa barra filtra a lista abaixo. */
export function CasosPorDoenca({ resumo, doencaId, onDoenca }: { resumo: ResumoOcorrencias; doencaId: string; onDoenca: (id: string) => void }) {
  const maior = Math.max(1, ...resumo.porDoenca.map(d => d.quantidade));
  return <div className="san-ocorrencias-operacionais">
    <section className="san-ocorrencias-distribuicao san-ocorrencias-resumo" aria-label="Casos abertos por doença">
      <header>
        <h2>Casos abertos por doença</h2>
        <p>{resumo.abertas} {resumo.abertas === 1 ? "ocorrência aberta" : "ocorrências abertas"} no recorte filtrado</p>
      </header>
      <div className="san-ocorrencias-doencas">
        {resumo.porDoenca.map((d, i) => <button type="button" key={`${d.id}-${i}`} aria-pressed={doencaId === d.id} onClick={() => onDoenca(doencaId === d.id ? "" : d.id)}>
          <span>{d.nome}</span><span className="san-doenca-barra"><i style={{ width: `${d.quantidade / maior * 100}%` }} /></span><strong>{d.quantidade}</strong>
        </button>)}
        {!resumo.porDoenca.length && <Empty>Nenhum caso aberto neste recorte.</Empty>}
        {doencaId && <Button secondary onClick={() => onDoenca("")}>Todas as doenças</Button>}
      </div>
    </section>
  </div>;
}

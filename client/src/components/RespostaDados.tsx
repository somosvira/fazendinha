import type { DadosResposta } from "../api/assistente";

/** Resposta de consulta em formato de dados: título, contexto em uma linha,
 * números com o principal em destaque, uma frase de leitura e a tabela curta. */
export function RespostaDados({ dados }: { dados: DadosResposta }) {
  return <article className="resposta-dados" aria-label={dados.titulo}>
    <header>
      <h3>{dados.titulo}</h3>
      <p>{dados.contexto}</p>
    </header>
    {dados.numeros.length > 0 && <dl className="resposta-dados-numeros" data-quantidade={dados.numeros.length}>
      {dados.numeros.map((n) => <div key={n.rotulo} className={n.destaque ? "destaque" : undefined}>
        <dt>{n.rotulo}</dt>
        <dd>{n.valor}</dd>
        {n.detalhe && <small>{n.detalhe}</small>}
      </div>)}
    </dl>}
    {dados.leitura && <p className="resposta-dados-leitura">{dados.leitura}</p>}
    {dados.tabela && dados.tabela.linhas.length > 0 && <div className="resposta-dados-tabela">
      <table>
        <thead><tr>{dados.tabela.colunas.map((c) => <th key={c.titulo} className={c.valor ? "valor" : undefined} scope="col">{c.titulo}</th>)}</tr></thead>
        <tbody>{dados.tabela.linhas.map((l, i) => <tr key={i} className={l.atraso ? "atraso" : undefined}>
          {l.celulas.map((celula, j) => <td key={j} className={dados.tabela!.colunas[j]?.valor ? "valor" : undefined}>{celula}</td>)}
        </tr>)}</tbody>
      </table>
      {dados.tabela.nota && <p className="resposta-dados-nota">{dados.tabela.nota}</p>}
    </div>}
  </article>;
}

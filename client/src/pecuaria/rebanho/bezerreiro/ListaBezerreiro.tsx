import type { Key } from 'react';
import type { ModoConsulta } from '@/components/VisualizacaoConsulta';
import { TabelaFinanceira, type ColunaTabela } from '@/financeiro/financeiro-ui';

export type ListaBezerreiroProps<T> = {
  rotulo: string;
  itens: T[];
  chaveDe: (item: T) => Key;
  colunas: ColunaTabela<T>[];
  destaque?: string;
  subtitulo?: string;
  modo?: ModoConsulta;
};

export function ListaBezerreiro<T>({ rotulo, itens, chaveDe, colunas, destaque, subtitulo, modo }: ListaBezerreiroProps<T>) {
  if (modo !== 'visual') {
    return <TabelaFinanceira rotulo={rotulo} itens={itens} chaveDe={chaveDe} colunas={colunas}
      visualizacao={modo === 'tabela' ? 'tabela' : 'automatica'} />;
  }

  if (!itens.length) return null;
  const principal = colunas.find(coluna => coluna.principal) ?? colunas[0];
  const selo = colunas.find(coluna => coluna.chave === destaque);
  const secundario = colunas.find(coluna => coluna.chave === subtitulo);
  const campos = colunas.filter(coluna => coluna !== principal && coluna !== selo && coluna !== secundario && !coluna.acoes);
  const acoes = colunas.find(coluna => coluna.acoes);

  return <ul className="bez-lista-cartoes" aria-label={rotulo}>
    {itens.map(item => {
      const comandos = acoes?.celula(item);
      return <li className="bez-lista-cartao" key={chaveDe(item)}>
        <div className="bez-lista-cartao-topo">
          <div>
            <div className="bez-lista-cartao-titulo">{principal.celula(item)}</div>
            {secundario && <span className="bez-subtexto">{secundario.celula(item)}</span>}
          </div>
          {selo && <span className="bez-selo">{selo.celula(item)}</span>}
        </div>
        <dl>
          {campos.map(campo => <div key={campo.chave}>
            <dt>{campo.titulo}</dt>
            <dd>{campo.celula(item)}</dd>
          </div>)}
        </dl>
        {comandos && comandos !== '—' && <div className="bez-lista-cartao-acoes">{comandos}</div>}
      </li>;
    })}
  </ul>;
}

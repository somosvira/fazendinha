import type { Key, ReactNode } from "react";
import { CartaoConsulta, FatoConsulta } from "@/components/ConsultaVisual";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { TabelaFinanceira, type ColunaTabela } from "@/financeiro/financeiro-ui";
import "./consultas-leite.css";

/** As duas apresentações compartilham as mesmas células, permissões e ações. */
export function ListaConsultaLeite<T>({ preferencia, rotulo, itens, colunas, chaveDe, onAbrir, compacta, tituloDe, detalheDe, destaque, visualizacao, renderizarVisual, layout }: {
  renderizarVisual?: (item: T) => ReactNode; layout?: "grade" | "linhas";
  visualizacao?: ReturnType<typeof useVisualizacaoConsulta>;
  preferencia: string; rotulo: string; itens: T[]; colunas: ColunaTabela<T>[];
  tituloDe?: (item: T) => ReactNode; detalheDe?: (item: T) => ReactNode; destaque?: string;
  chaveDe: (item: T) => Key; onAbrir?: (item: T) => void; compacta?: boolean;
}) {
  const preferenciaLocal = useVisualizacaoConsulta(preferencia, "leite");
  const { modo, mudar } = visualizacao ?? preferenciaLocal;
  const principal = colunas.find(c => c.principal) ?? colunas[0];
  const acoes = colunas.filter(c => c.acoes || c.chave === "acao");
  const volume = colunas.find(c => c.chave === destaque);
  const fatos = colunas.filter(c => c !== principal && c !== volume && !c.ocultarNoCartao && !acoes.includes(c));
  return <div className="leite-lista-consulta" data-layout={layout}>
    {!visualizacao && <div className="leite-lista-opcoes"><AlternarVisualizacaoConsulta modo={modo} mudar={mudar} rotulo={`Visualização de ${rotulo.toLocaleLowerCase("pt-BR")}`} /></div>}
    {modo === "tabela" ? <TabelaFinanceira visualizacao="tabela" barraRolagemSuperior rotulo={rotulo} itens={itens} colunas={colunas} chaveDe={chaveDe} onAbrir={onAbrir} compacta={compacta} /> : <div className="leite-cartoes-consulta" role="list" aria-label={rotulo}>
      {itens.map(item => <div role="listitem" key={chaveDe(item)}>{renderizarVisual ? renderizarVisual(item) : <CartaoConsulta className={layout === "linhas" ? "leite-linha-consulta" : ""} titulo={tituloDe ? tituloDe(item) : principal?.celula(item)} detalhe={detalheDe?.(item)} onAbrir={onAbrir ? () => onAbrir(item) : undefined} acoes={acoes.length ? acoes.map(c => <span key={c.chave}>{c.celula(item)}</span>) : undefined}>
        {volume && <div className="leite-cartao-volume"><strong>{volume.celula(item)}</strong><span>{volume.titulo}</span></div>}
        {fatos.map(c => <FatoConsulta key={c.chave} rotulo={c.titulo}>{c.celula(item)}</FatoConsulta>)}
      </CartaoConsulta>}</div>)}
      {!itens.length && <p>Nenhum registro neste recorte.</p>}
    </div>}
  </div>;
}

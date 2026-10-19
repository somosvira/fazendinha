import { useId, useState, type ReactNode } from "react";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { Paginacao } from "../ui";
/** Os valores dos rascunhos ficam no formulário chamador; trocar a página só altera o recorte. */
export function ListaRascunho<T>({ itens, rotulo, texto, renderizar }: { itens: T[]; rotulo: string; texto?: (item: T) => string; renderizar: (item: T, indiceOriginal: number) => ReactNode }) {
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const id = useId();
  const filtrados = itens.map((item, indice) => ({ item, indice })).filter(({ item }) => !texto || texto(item).toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const atual = Math.min(pagina, Math.max(1, Math.ceil(filtrados.length / 10)));
  return <div className="grid gap-3">{texto && <label className="text-sm">Buscar {rotulo}<input type="search" className={classeInput} value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} /></label>}{filtrados.slice((atual - 1) * 10, atual * 10).map(({ item, indice }) => renderizar(item, indice))}{!filtrados.length && <p>Nenhum item corresponde à busca.</p>}{filtrados.length > 10 && <Paginacao paginaAtual={atual} totalPaginas={Math.ceil(filtrados.length / 10)} totalItens={filtrados.length} itensPorPagina={10} onPaginaChange={setPagina} rotulo={rotulo} idSelect={id} />}</div>;
}

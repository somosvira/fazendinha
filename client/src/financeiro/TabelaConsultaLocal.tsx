import { useBuscaUrl } from "../lib/useBuscaUrl";
import { useOrdenacaoTabela, type DefinicaoOrdenacao } from "./OrdenarConsulta";
import type { ReactNode } from "react";
import { filtrosDasColunas, type CampoConsulta, type EdicaoConsulta } from "./FiltroColunaConsulta";
import type { CriterioConsulta } from "./BarraConsulta";
import { useId, useState } from "react";
import { BuscaLista } from "@/components/BuscaLista";
import { BarraConsulta } from "./BarraConsulta";
import { Paginacao, TabelaFinanceira } from "./financeiro-ui";
import { useFiltrosTabelaLocal, type DefinicaoFiltroLocal } from "./useFiltrosTabelaLocal";

type Props<T> = Parameters<typeof TabelaFinanceira<T>>[0] & {
  parametroBusca?: string;
  camposOrdenaveis?: DefinicaoOrdenacao<T>[];
  acao?: ReactNode;
  camposExternos?: CampoConsulta[];
  criteriosExternos?: CriterioConsulta[];
  edicaoExterna?: EdicaoConsulta;
  definicoes: DefinicaoFiltroLocal<T>[];
  buscarPor: (item: T) => string;
  porPagina?: number;
};
/** Lista de registros já carregada integralmente. Nunca recebe uma página da API. */
export function TabelaConsultaLocal<T>({ definicoes, camposOrdenaveis = [], buscarPor, porPagina = 15, itens, acao, camposExternos = [], criteriosExternos = [], edicaoExterna, parametroBusca, ...tabela }: Props<T>) {
  const id = useId();
  const camposOrdenacao: DefinicaoOrdenacao<T>[] = [...camposOrdenaveis, ...definicoes.filter(d => d.tipo !== "opcoes" && !camposOrdenaveis.some(c => c.chave === d.chave)).map<DefinicaoOrdenacao<T>>(d => ({ chave: d.chave, rotulo: d.rotulo, tipo: d.tipo === "valor" ? "numero" : d.tipo === "data" ? "data" : "texto", obter: item => { const v = d.obter(item); return Array.isArray(v) ? null : v; } }))];
  const [busca, setBusca] = useBuscaUrl(parametroBusca);
  const [pagina, setPagina] = useState(1);
  const ordem = useOrdenacaoTabela(camposOrdenacao, `ordem-${tabela.rotulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`, () => setPagina(1));
  const principal = tabela.colunas.find(c => c.principal)?.chave ?? tabela.colunas[0]?.chave;
  const consulta = useFiltrosTabelaLocal(definicoes.map(d => d.chave === principal && d.tipo === "texto" ? {...d, naBarra: true} : d), () => setPagina(1));
  const campos = [...consulta.campos,...camposExternos];
  const edicao = {iniciar:()=>{consulta.edicao.iniciar();edicaoExterna?.iniciar();},limpar:()=>{consulta.edicao.limpar();edicaoExterna?.limpar();},aplicar:()=>{consulta.edicao.aplicar();edicaoExterna?.aplicar();setPagina(1);}};
  const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const filtrados = ordem.ordenar(consulta.filtrar(itens).filter(i => normalizar(buscarPor(i)).includes(normalizar(busca))));
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const atual = Math.min(pagina, totalPaginas);
  return <>
    <BarraConsulta ordenacao={ordem.controle} acao={acao} campos={campos} edicaoFiltros={edicao} erroFiltros={consulta.erro} criterios={[...consulta.criterios,...criteriosExternos]} onLimpar={() => { setBusca(""); consulta.limpar(); criteriosExternos.forEach(c=>c.limpar()); }}>
      <BuscaLista rotulo={`Buscar ${tabela.rotulo.toLocaleLowerCase("pt-BR")}`} placeholder="Buscar registros…" valor={busca} onChange={v => { setBusca(v); setPagina(1); }} />
    </BarraConsulta>
    <TabelaFinanceira {...tabela} ordenacao={ordem.controle} itens={filtrados.slice((atual - 1) * porPagina, atual * porPagina)} filtrosColunas={filtrosDasColunas(campos,edicao,consulta.erro)} />
    {!filtrados.length && <p className="p-4 text-sm text-muted-foreground">Nenhum registro corresponde aos filtros.</p>}
    <Paginacao pagina={atual} totalPaginas={totalPaginas} total={filtrados.length} porPagina={porPagina} onPagina={setPagina} substantivo="registros" rotulo={`Paginação de ${tabela.rotulo.toLocaleLowerCase("pt-BR")}`} idSelect={`pagina-consulta-${id}`} />
  </>;
}

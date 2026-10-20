import type { ReactNode } from "react";
import { filtrosDasColunas, type CampoConsulta, type EdicaoConsulta } from "./FiltroColunaConsulta";
import type { CriterioConsulta } from "./BarraConsulta";
import { useId, useState } from "react";
import { BuscaLista } from "@/components/BuscaLista";
import { BarraConsulta } from "./BarraConsulta";
import { Paginacao, TabelaFinanceira } from "./financeiro-ui";
import { useFiltrosTabelaLocal, type DefinicaoFiltroLocal } from "./useFiltrosTabelaLocal";

type Props<T> = Parameters<typeof TabelaFinanceira<T>>[0] & {
  acao?: ReactNode;
  camposExternos?: CampoConsulta[];
  criteriosExternos?: CriterioConsulta[];
  edicaoExterna?: EdicaoConsulta;
  definicoes: DefinicaoFiltroLocal<T>[];
  buscarPor: (item: T) => string;
  porPagina?: number;
};
/** Lista de registros já carregada integralmente. Nunca recebe uma página da API. */
export function TabelaConsultaLocal<T>({ definicoes, buscarPor, porPagina = 15, itens, acao, camposExternos = [], criteriosExternos = [], edicaoExterna, ...tabela }: Props<T>) {
  const id = useId();
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const principal = tabela.colunas.find(c => c.principal)?.chave ?? tabela.colunas[0]?.chave;
  const consulta = useFiltrosTabelaLocal(definicoes.map(d => d.chave === principal && d.tipo === "texto" ? {...d, naBarra: true} : d), () => setPagina(1));
  const campos = [...consulta.campos,...camposExternos];
  const edicao = {iniciar:()=>{consulta.edicao.iniciar();edicaoExterna?.iniciar();},limpar:()=>{consulta.edicao.limpar();edicaoExterna?.limpar();},aplicar:()=>{consulta.edicao.aplicar();edicaoExterna?.aplicar();setPagina(1);}};
  const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const filtrados = consulta.filtrar(itens).filter(i => normalizar(buscarPor(i)).includes(normalizar(busca)));
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const atual = Math.min(pagina, totalPaginas);
  return <>
    <BarraConsulta acao={acao} campos={campos} edicaoFiltros={edicao} erroFiltros={consulta.erro} criterios={[...consulta.criterios,...criteriosExternos]} onLimpar={() => { setBusca(""); consulta.limpar(); criteriosExternos.forEach(c=>c.limpar()); }}>
      <BuscaLista rotulo={`Buscar ${tabela.rotulo.toLocaleLowerCase("pt-BR")}`} placeholder="Buscar registros…" valor={busca} onChange={v => { setBusca(v); setPagina(1); }} />
    </BarraConsulta>
    <TabelaFinanceira {...tabela} itens={filtrados.slice((atual - 1) * porPagina, atual * porPagina)} filtrosColunas={filtrosDasColunas(campos,edicao,consulta.erro)} />
    {!filtrados.length && <p className="p-4 text-sm text-muted-foreground">Nenhum registro corresponde aos filtros.</p>}
    <Paginacao pagina={atual} totalPaginas={totalPaginas} total={filtrados.length} porPagina={porPagina} onPagina={setPagina} substantivo="registros" rotulo={`Paginação de ${tabela.rotulo.toLocaleLowerCase("pt-BR")}`} idSelect={`pagina-consulta-${id}`} />
  </>;
}

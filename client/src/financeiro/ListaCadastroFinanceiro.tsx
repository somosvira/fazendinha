import { useBuscaUrl } from "../lib/useBuscaUrl";
import { useOrdenacaoTabela } from "./OrdenarConsulta";
import { useFiltrosTabelaLocal, type DefinicaoFiltroLocal } from "./useFiltrosTabelaLocal";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Empty, Paginacao, Panel, TabelaFinanceira, type ColunaTabela } from "./financeiro-ui";

export const normalizarBuscaFinanceira = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "");

export function ListaCadastroFinanceiro<T extends { id: string; nome: string; ativo?: boolean }>({ itens, colunas, rotulo, rotuloBusca, termosDe, onAbrir, filtros, acao, filtrosAdicionais, criteriosAdicionais = [], onLimparAdicionais, mostrarSituacao = true, edicaoFiltros, camposLocais = [], parametroBusca }: {
  parametroBusca?: string;
  camposLocais?: DefinicaoFiltroLocal<T>[];
  edicaoFiltros?: { iniciar: () => void; aplicar: () => void; limpar: () => void };
  itens: T[]; colunas: ColunaTabela<T>[]; rotulo: string; rotuloBusca?: string;
  termosDe?: (item: T) => string; onAbrir?: (item: T) => void; filtros?: ReactNode; acao?: ReactNode; filtrosAdicionais?: ReactNode; criteriosAdicionais?: import("./BarraConsulta").CriterioConsulta[]; onLimparAdicionais?: () => void; mostrarSituacao?: boolean;
}) {
  const [busca, setBusca] = useBuscaUrl(parametroBusca);
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), [itens]);
  const consultaColunas = useFiltrosTabelaLocal<T>([
    { chave: colunas.find(c => c.principal)?.chave ?? colunas[0].chave, rotulo: "Nome", naBarra: true, tipo: "texto", obter: item => item.nome },
    ...(mostrarSituacao ? [{ chave: "situacao", rotulo: "Situação", tipo: "opcoes" as const, obter: (item: T) => item.ativo !== false ? "ATIVOS" : "INATIVOS", opcoes: [{ valor: "ATIVOS", texto: "Ativos" }, { valor: "INATIVOS", texto: "Inativos" }] }] : []),
    ...camposLocais,
  ], () => setPagina(1));
  const edicao = { iniciar: () => { consultaColunas.edicao.iniciar(); edicaoFiltros?.iniciar(); }, limpar: () => { consultaColunas.edicao.limpar(); edicaoFiltros?.limpar(); }, aplicar: () => { consultaColunas.edicao.aplicar(); edicaoFiltros?.aplicar(); setPagina(1); } };
  const consulta = normalizarBuscaFinanceira(busca);
  const ordem = useOrdenacaoTabela<T>([{chave:colunas.find(c=>c.principal)?.chave ?? colunas[0].chave,rotulo:"Nome",tipo:"texto",obter:i=>i.nome},...camposLocais.filter(c=>c.tipo==="valor").map(c=>({chave:c.chave,rotulo:c.rotulo,tipo:"numero" as const,obter:(i:T)=>{const v=c.obter(i);return Array.isArray(v)?null:v;}}))], `ordemCadastro-${rotulo}`, ()=>setPagina(1));
  const filtrados = ordem.ordenar(consultaColunas.filtrar(itens).filter(item => normalizarBuscaFinanceira(termosDe?.(item) ?? item.nome).includes(consulta)));
  const porPagina = 15;
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const atual = Math.min(pagina, totalPaginas);
  return <Panel className="fin-lista-cadastro mt-4 overflow-hidden" tom="info">
    <BarraConsulta ordenacao={ordem.controle} edicaoFiltros={edicao} campos={consultaColunas.campos} erroFiltros={consultaColunas.erro} acao={acao} adicionais={filtrosAdicionais} criterios={[...consultaColunas.criterios, ...criteriosAdicionais]} onLimpar={() => {setBusca("");consultaColunas.limpar();setPagina(1);onLimparAdicionais?.();}}>
      <label className="fin-filtro-busca min-w-0 flex-[1_1_220px] text-sm font-medium"><span className="sr-only">Buscar</span><span className="relative mt-1 block"><Search size={18} strokeWidth={1.8} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" /><Input aria-label={rotuloBusca ?? `Buscar ${rotulo.toLocaleLowerCase("pt-BR")}`} placeholder={rotulo === "Clientes e fornecedores" ? "Nome, documento ou contato…" : `Nome de ${rotulo.toLocaleLowerCase("pt-BR")}…`} value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} className="bg-card pl-10" /></span></label>
      {filtros}
    </BarraConsulta>
    {filtrados.length ? <TabelaFinanceira ordenacao={ordem.controle} filtrosColunas={consultaColunas.colunas} compacta rotulo={rotulo} itens={filtrados.slice((atual - 1) * porPagina, atual * porPagina)} colunas={colunas} chaveDe={item => item.id} onAbrir={onAbrir} /> : <Empty>Nenhum cadastro encontrado. Ajuste a busca ou os filtros.</Empty>}
    <Paginacao pagina={atual} totalPaginas={totalPaginas} total={filtrados.length} porPagina={porPagina} rotulo={`Paginação: ${rotulo}`} substantivo="cadastros" idSelect={`pagina-${rotulo}`} onPagina={setPagina} />
  </Panel>;
}

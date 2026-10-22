import { PanoramaDietas, CartoesNutricao } from "./PanoramaDietas";
import { useVisualizacaoConsulta, AlternarVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { useOrdenacaoTabela } from "@/financeiro/OrdenarConsulta";
import { useFiltrosTabelaLocal } from "@/financeiro/useFiltrosTabelaLocal";
import { useRascunhoConsulta } from "@/financeiro/useRascunhoConsulta";
import { filtrosDasColunas, type CampoConsulta } from "@/financeiro/FiltroColunaConsulta";
import { CampoFiltro } from "@/financeiro/PainelFiltros";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { AjudaCampo } from "@/components/Dica";
import { BarraConsulta } from "@/financeiro/BarraConsulta";

import { useCallback } from "react";
import { Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";

import { formatarDataBR } from "../lib/rotulos";
import { consultarVisaoNutricional } from "./api";
import { useFiltrosNutricionais } from "./navegacao";
import { useConsulta } from "./consulta";
import { custoTexto, EstadoConsulta, LinkNutricional, rotaNutricao } from "./componentes";

import { BuscaLista } from "../../../components/BuscaLista";
import { PaginacaoLocal, usePaginacaoLocal } from "@/components/PaginacaoLocal";

export function VisaoGeralNutricao() {
  const { dados, erro, carregando, carregar } = useConsulta(
    useCallback(consultarVisaoNutricional, []),
  );
  const { params, atualizar } = useFiltrosNutricionais();
  const visualizacao = useVisualizacaoConsulta("visualNutricao");
  const busca = params.get("buscaLote") ?? "";
  const situacao = params.get("situacaoDieta") ?? "";
  const consultaColunas = useFiltrosTabelaLocal<NonNullable<typeof dados>["lotes"][number]>([
    {chave:"lote", naBarra: true,rotulo:"Lote / sítio",tipo:"texto",obter:r=>`${r.lote.nome} ${r.lote.propriedade.nome}`},
    ...(dados?.verValores ? [{chave:"custo",rotulo:"Custo histórico",tipo:"valor" as const,obter:(r: NonNullable<typeof dados>["lotes"][number])=>r.custos.custoConhecido,limiteSugerido:Math.max(1,...dados.lotes.map(r=>Number(r.custos.custoConhecido ?? 0)))}] : []),
  ]);
  const edicaoSituacao = useRascunhoConsulta({situacao},{situacao:""},v=>atualizar({situacaoDieta:v.situacao}));
  const edicao = {iniciar:()=>{edicaoSituacao.iniciar();consultaColunas.edicao.iniciar();},limpar:()=>{edicaoSituacao.limpar();consultaColunas.edicao.limpar();},aplicar:()=>{edicaoSituacao.aplicar();consultaColunas.edicao.aplicar();}};
  const campoDieta: CampoConsulta = {chave:"dieta",ativo:!!situacao,limpar:edicaoSituacao.limpar,conteudo:<CampoFiltro rotulo="Situação da dieta"><SelectCampo aria-label="Situação da dieta" value={edicaoSituacao.rascunho.situacao} onValueChange={v=>edicaoSituacao.editar("situacao",v)}><option value="">Todas as dietas</option><option value="com">Com dieta vigente</option><option value="sem">Sem dieta vigente</option></SelectCampo></CampoFiltro>};
  const campos = [...consultaColunas.campos,campoDieta];
  const ordem = useOrdenacaoTabela<NonNullable<typeof dados>["lotes"][number]>([{chave:"lote",rotulo:"Lote",tipo:"texto",obter:r=>r.lote.nome},{chave:"animais",rotulo:"Animais",tipo:"numero",obter:r=>r.lote.animaisAtivos},...(dados?.verValores?[{chave:"custo",rotulo:"Custo histórico",tipo:"numero" as const,obter:(r:NonNullable<typeof dados>["lotes"][number])=>r.custos.custoConhecido}]:[])],"ordemNutricao");
  const itensBase =
    consultaColunas.filtrar(dados?.lotes ?? []).filter(
      (r) =>
        `${r.lote.nome} ${r.lote.propriedade.nome}`
          .toLocaleLowerCase("pt-BR")
          .includes(busca.toLocaleLowerCase("pt-BR")) &&
        (!situacao || (situacao === "com") === !!r.vigente),
    );
  const itens = ordem.ordenar(itensBase);
  const paginacao = usePaginacaoLocal(itens, `${ordem.controle.campo}|${ordem.controle.direcao}|${busca}|${situacao}|${consultaColunas.criterios.map(c=>c.rotulo).join("|")}`);
  return <div className="nutricao-conteudo"><EstadoConsulta erro={erro} carregando={carregando} recarregar={carregar} estrutura="panorama" label="Carregando panorama nutricional…" />{dados && <>
    <PanoramaDietas lotes={dados.lotes} situacao={situacao} filtrar={valor => atualizar({situacaoDieta:valor})} />
    <Panel>
      <BarraConsulta ordenacao={ordem.controle} campos={campos} edicaoFiltros={edicao} erroFiltros={consultaColunas.erro} criterios={[...consultaColunas.criterios,...(situacao?[{id:"situacao",rotulo:situacao==="com"?"Com dieta vigente":"Sem dieta vigente",limpar:()=>atualizar({situacaoDieta:""})}]:[])]} resumo={<div className="consulta-ajuda flex items-center gap-2">
        {dados.verValores && <AjudaCampo rotulo="Sobre o custo histórico" texto="Animais e dieta vigente refletem hoje. O custo histórico inclui todo o consumo confirmado de cada lote, excluindo estornos; não é apenas o custo da dieta vigente." />}
      </div>}>
        <BuscaLista rotulo="Buscar lote ou sítio" valor={busca} placeholder="Buscar lote ou sítio" onChange={valor => atualizar({ buscaLote: valor })} />

      </BarraConsulta>
      <div className="dietas-lista-cabecalho"><h2>Nutrição por lote <span>{itens.length} lotes</span></h2><AlternarVisualizacaoConsulta {...visualizacao} rotulo="Visualização da nutrição por lote" /></div>
      {!itens.length ? <div className="nutricao-vazio">{dados.lotes.length ? "Nenhum lote corresponde aos filtros." : <>Nenhum lote ativo neste contexto. <LinkNutricional href="/pecuaria/rebanho/lotes">Ver lotes do rebanho</LinkNutricional></>}</div> : visualizacao.modo === "visual" ? <CartoesNutricao lotes={paginacao.itens} verValores={dados.verValores} /> : <TabelaFinanceira ordenacao={ordem.controle} filtrosColunas={filtrosDasColunas(campos,edicao,consultaColunas.erro)} rotulo="Nutrição por lote" itens={paginacao.itens} chaveDe={(r) => r.lote.id} colunas={[
        { chave: "lote", titulo: "Lote / sítio", principal: true, celula: (r) => <><LinkNutricional href={rotaNutricao({ loteId: r.lote.id })}>{r.lote.nome}</LinkNutricional><p className="nutricao-secundario">{r.lote.propriedade.nome}</p></> },
        { chave: "animais", titulo: "Animais", alinhamento: "direita", larguraMinima: 90, celula: (r) => r.lote.animaisAtivos },
        { chave: "dieta", titulo: "Dieta vigente", larguraMinima: 220, celula: (r) => r.vigente ? <><strong>{r.vigente.dieta.nome}</strong><p className="nutricao-secundario">v{r.vigente.dieta.versao} · desde {formatarDataBR(r.vigente.desde)}</p></> : <Pill tone="amber">Sem dieta vigente</Pill> },
        ...(dados.verValores ? [{ chave: "custo", titulo: "Custo histórico", alinhamento: "direita" as const, celula: (r: typeof itens[number]) => <>{custoTexto(r.custos.custoConhecido)}{r.custos.custoConhecido != null && !r.custos.coberturaCustoCompleta && <p className="nutricao-secundario">Parcial</p>}</> }] : []),
      ]} />}
      <PaginacaoLocal controles={paginacao.controles} substantivo="lotes" id="pagina-nutricao-lotes" />
    </Panel>
  </>}</div>;
}

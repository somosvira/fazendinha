import { SelectCampo } from "@/financeiro/SelectCampo";
import { useCallback } from "react";
import { Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { formatarDataBR } from "../lib/rotulos";
import { consultarVisaoNutricional } from "./api";
import { useFiltrosNutricionais } from "./navegacao";
import { useConsulta } from "./consulta";
import { custoTexto, EstadoConsulta, LinkNutricional, rotaNutricao } from "./componentes";
import { ComparacaoPecuaria, DistribuicaoPecuaria } from "../components/DistribuicaoPecuaria";
import { BuscaLista } from "../../../components/BuscaLista";

export function VisaoGeralNutricao() {
  const { dados, erro, carregando, carregar } = useConsulta(useCallback(consultarVisaoNutricional, []));
  const { params, atualizar } = useFiltrosNutricionais();
  const busca = params.get("buscaLote") ?? "";
  const situacao = params.get("situacaoDieta") ?? "";
  const itens = dados?.lotes.filter((r) => `${r.lote.nome} ${r.lote.propriedade.nome}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")) && (!situacao || (situacao === "com") === !!r.vigente)) ?? [];
  const comDieta = dados?.lotes.filter((r) => r.vigente).length ?? 0;
  const animaisAtivos = dados?.lotes.reduce((soma, r) => soma + r.lote.animaisAtivos, 0) ?? 0;
  return <div className="nutricao-conteudo"><EstadoConsulta erro={erro} carregando={carregando} recarregar={carregar} estrutura="panorama" label="Carregando panorama nutricional…" />{dados && <>
    <Panel className="nutricao-panorama"><details><summary className="nutricao-card-cabecalho cursor-pointer"><div><h2 className="h3">Panorama nutricional</h2><p>{animaisAtivos} animais ativos nos lotes · contexto de hoje, independente dos filtros da tabela · {comDieta} de {dados.lotes.length} lotes com dieta · expandir comparativos</p></div></summary><div className="nutricao-panorama-graficos">
      <DistribuicaoPecuaria embutido titulo="Cobertura das dietas" descricao="Lotes com e sem dieta vigente" total={dados.lotes.length} rotuloCentro="lotes ativos" unidade="lotes" itens={[{ id: "com", nome: "Com dieta vigente", qtd: comDieta, href: rotaNutricao({ ...Object.fromEntries(params), situacaoDieta: "com" }) }, { id: "sem", nome: "Sem dieta vigente", qtd: dados.lotes.length - comDieta, href: rotaNutricao({ ...Object.fromEntries(params), situacaoDieta: "sem" }) }]} />
      <ComparacaoPecuaria embutido titulo="Efetivo por lote" descricao="Até 6 lotes com mais animais ativos" itens={[...dados.lotes].sort((a, b) => b.lote.animaisAtivos - a.lote.animaisAtivos).slice(0, 6).map(r => ({ id: r.lote.id, nome: r.lote.nome, qtd: r.lote.animaisAtivos, href: rotaNutricao({ loteId: r.lote.id }) }))} />
    </div></details></Panel>
    <Panel><div className="nutricao-card-cabecalho"><div><h2 className="h3">Nutrição por lote</h2><p>Compare as dietas e abra um lote para consultar seu histórico.{(busca || situacao) && <> Mostrando {itens.length} de {dados.lotes.length} lotes.</>}</p></div></div>
      <div className="nutricao-filtros"><BuscaLista rotulo="Buscar lote ou sítio" valor={busca} placeholder="Buscar lote ou sítio" onChange={valor => atualizar({ buscaLote: valor })} /><label><span className="sr-only">Situação da dieta</span><SelectCampo className={classeInput} value={situacao} onValueChange={(valorSelecionado) => atualizar({ situacaoDieta: valorSelecionado })}><option value="">Todas as situações</option><option value="com">Com dieta vigente</option><option value="sem">Sem dieta vigente</option></SelectCampo></label></div>
      {!itens.length ? <div className="nutricao-vazio">{dados.lotes.length ? "Nenhum lote corresponde aos filtros." : <>Nenhum lote ativo neste contexto. <LinkNutricional href="/pecuaria/rebanho/lotes">Ver lotes do rebanho</LinkNutricional></>}</div> : <TabelaFinanceira rotulo="Nutrição por lote" itens={itens} chaveDe={(r) => r.lote.id} colunas={[
        { chave: "lote", titulo: "Lote / sítio", principal: true, celula: (r) => <><LinkNutricional href={rotaNutricao({ loteId: r.lote.id })}>{r.lote.nome}</LinkNutricional><p className="nutricao-secundario">{r.lote.propriedade.nome}</p></> },
        { chave: "animais", titulo: "Animais", celula: (r) => r.lote.animaisAtivos },
        { chave: "dieta", titulo: "Dieta vigente", larguraMinima: 220, celula: (r) => r.vigente ? <><strong>{r.vigente.dieta.nome}</strong><p className="nutricao-secundario">v{r.vigente.dieta.versao} · desde {formatarDataBR(r.vigente.desde)}</p></> : <Pill tone="amber">Sem dieta vigente</Pill> },
        ...(dados.verValores ? [{ chave: "custo", titulo: "Custo total", celula: (r: typeof itens[number]) => <>{custoTexto(r.custos.custoConhecido)}{r.custos.custoConhecido != null && !r.custos.coberturaCustoCompleta && <p className="nutricao-secundario">Parcial</p>}</> }] : []),
        { chave: "abrir", titulo: "", acoes: true, celula: (r) => <LinkNutricional href={rotaNutricao({ loteId: r.lote.id })}>Abrir lote →</LinkNutricional> },
      ]} />}
    </Panel><p className="nutricao-nota">Dieta vigente e animais refletem o contexto de hoje. Custos incluem todo o histórico confirmado de cada lote.</p>
  </>}</div>;
}

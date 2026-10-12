import { useCallback } from "react";
import { Leaf, Layers3, Users, TriangleAlert } from "lucide-react";
import { Metric, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { formatarDataBR } from "../lib/rotulos";
import { consultarVisaoNutricional } from "./api";
import { useFiltrosNutricionais } from "./navegacao";
import { useConsulta } from "./consulta";
import { custoTexto, EstadoConsulta, LinkNutricional, rotaNutricao } from "./componentes";

export function VisaoGeralNutricao() {
  const { dados, erro, carregando, carregar } = useConsulta(useCallback(consultarVisaoNutricional, []));
  const { params, atualizar } = useFiltrosNutricionais();
  const busca = params.get("buscaLote") ?? "";
  const situacao = params.get("situacaoDieta") ?? "";
  const itens = dados?.lotes.filter((r) => `${r.lote.nome} ${r.lote.propriedade.nome}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")) && (!situacao || (situacao === "com") === !!r.vigente)) ?? [];
  const comDieta = dados?.lotes.filter((r) => r.vigente).length ?? 0;
  return <div className="nutricao-conteudo"><EstadoConsulta erro={erro} carregando={carregando} recarregar={carregar} />{dados && <>
    <div className="nutricao-metricas">
      <Metric icon={Layers3} label="Lotes ativos" valor={String(dados.lotes.length)} detalhe="No contexto de fazenda selecionado" />
      <Metric icon={Users} label="Animais nos lotes" valor={String(dados.lotes.reduce((s, r) => s + r.lote.animaisAtivos, 0))} detalhe="Animais ativos hoje" />
      <Metric icon={Leaf} label="Com dieta vigente" valor={String(comDieta)} detalhe="Receita publicada em uso" tone="green" />
      <Metric icon={TriangleAlert} label="Sem dieta vigente" valor={String(dados.lotes.length - comDieta)} detalhe="Lotes que precisam de atenção" />
    </div>
    <Panel><div className="nutricao-card-cabecalho"><div><h2 className="h3">Nutrição por lote</h2><p>Compare as dietas e abra um lote para consultar seu histórico.</p></div><Pill>{dados.lotes.length} lotes</Pill></div>
      <div className="nutricao-filtros"><label>Buscar lote ou sítio<input className={classeInput} type="search" value={busca} placeholder="Nome do lote ou sítio" onChange={(e) => atualizar({ buscaLote: e.target.value })} /></label><label>Situação da dieta<select className={classeInput} value={situacao} onChange={(e) => atualizar({ situacaoDieta: e.target.value })}><option value="">Todas as situações</option><option value="com">Com dieta vigente</option><option value="sem">Sem dieta vigente</option></select></label></div>
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

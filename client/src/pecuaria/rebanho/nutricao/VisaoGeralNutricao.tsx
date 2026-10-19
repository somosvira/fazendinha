import { AjudaCampo } from "@/components/Dica";
import { BarraConsulta, SituacoesConsulta } from "@/financeiro/BarraConsulta";

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
  const busca = params.get("buscaLote") ?? "";
  const situacao = params.get("situacaoDieta") ?? "";
  const itens =
    dados?.lotes.filter(
      (r) =>
        `${r.lote.nome} ${r.lote.propriedade.nome}`
          .toLocaleLowerCase("pt-BR")
          .includes(busca.toLocaleLowerCase("pt-BR")) &&
        (!situacao || (situacao === "com") === !!r.vigente),
    ) ?? [];
  const comDieta = dados?.lotes.filter((r) => r.vigente).length ?? 0;
  const paginacao = usePaginacaoLocal(itens, `${busca}|${situacao}`);
  const animaisAtivos = dados?.lotes.reduce((soma, r) => soma + r.lote.animaisAtivos, 0) ?? 0;
  return <div className="nutricao-conteudo"><EstadoConsulta erro={erro} carregando={carregando} recarregar={carregar} estrutura="panorama" label="Carregando panorama nutricional…" />{dados && <>
    <Panel>
      <BarraConsulta resumo={<div className="consulta-ajuda flex items-center gap-2" aria-label="Efetivo nos lotes">
        <span>{animaisAtivos} animais ativos nos lotes</span>
        {dados.verValores && <AjudaCampo rotulo="Sobre o custo histórico" texto="Animais e dieta vigente refletem hoje. O custo histórico inclui todo o consumo confirmado de cada lote, excluindo estornos; não é apenas o custo da dieta vigente." />}
      </div>}>
        <BuscaLista rotulo="Buscar lote ou sítio" valor={busca} placeholder="Buscar lote ou sítio" onChange={valor => atualizar({ buscaLote: valor })} />
        {dados.lotes.length > 0 && <SituacoesConsulta
          rotulo="Situação da dieta"
          valor={situacao}
          onChange={valor => atualizar({ situacaoDieta: valor })}
          opcoes={[
            { valor: "", texto: `Todos (${dados.lotes.length})` },
            { valor: "com", texto: `Com dieta (${comDieta})` },
            { valor: "sem", texto: `Sem dieta (${dados.lotes.length - comDieta})` },
          ]}
        />}
      </BarraConsulta>
      {!itens.length ? <div className="nutricao-vazio">{dados.lotes.length ? "Nenhum lote corresponde aos filtros." : <>Nenhum lote ativo neste contexto. <LinkNutricional href="/pecuaria/rebanho/lotes">Ver lotes do rebanho</LinkNutricional></>}</div> : <TabelaFinanceira rotulo="Nutrição por lote" itens={paginacao.itens} chaveDe={(r) => r.lote.id} colunas={[
        { chave: "lote", titulo: "Lote / sítio", principal: true, celula: (r) => <><LinkNutricional href={rotaNutricao({ loteId: r.lote.id })}>{r.lote.nome}</LinkNutricional><p className="nutricao-secundario">{r.lote.propriedade.nome}</p></> },
        { chave: "animais", titulo: "Animais", alinhamento: "direita", larguraMinima: 90, celula: (r) => r.lote.animaisAtivos },
        { chave: "dieta", titulo: "Dieta vigente", larguraMinima: 220, celula: (r) => r.vigente ? <><strong>{r.vigente.dieta.nome}</strong><p className="nutricao-secundario">v{r.vigente.dieta.versao} · desde {formatarDataBR(r.vigente.desde)}</p></> : <Pill tone="amber">Sem dieta vigente</Pill> },
        ...(dados.verValores ? [{ chave: "custo", titulo: "Custo histórico", alinhamento: "direita" as const, celula: (r: typeof itens[number]) => <>{custoTexto(r.custos.custoConhecido)}{r.custos.custoConhecido != null && !r.custos.coberturaCustoCompleta && <p className="nutricao-secundario">Parcial</p>}</> }] : []),
      ]} />}
      <PaginacaoLocal controles={paginacao.controles} substantivo="lotes" id="pagina-nutricao-lotes" />
    </Panel>
  </>}</div>;
}

import { rotaFechamento } from "../nutricao/navegacao";
import { navegarPara } from "../../../router";
import { AjudaCampo } from "../../../components/Dica";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { CustosDiretos } from "./CustosDiretos";
import type { EscopoCustos, ProcedimentoCusto, ParcelaProcedimento } from "./api";
import { Paginacao } from "../ui";
import { LinkInterno } from "../../../components/LinkInterno";
import { linkOperacaoFinanceira } from "../../../financeiro/navegacao";
import { brl } from "../../../financeiro/financeiro-ui";
import { Button } from "../../../components/ui/button";
import { descricaoCusto } from "./apresentacao";
import type { Componente, CustosDTO } from "./api";

const rotulos: Record<string, string> = {
  VALIDO: "Válido", ATIVA: "Ativa", CONFIRMADO: "Confirmado", INTERROMPIDA: "Interrompida",
  COMPLETO: "Completo", PARCIAL: "Parcial", DESCONHECIDO: "Desconhecido", OCULTO: "Valores ocultos", CONHECIDO: "Conhecido",
  NAO_APLICAVEL: "Não aplicável", INCLUIDO_PACOTE: "Incluído no pacote", REPRODUCAO: "Reprodução", SANIDADE: "Sanidade", ROTINA: "Rotina/manutenção",
};

function linkFato(c: Componente, propriedadeId: number) {
  if (c.tipoFonte === "MANEJO") return `/pecuaria/rebanho/animais/${encodeURIComponent(c.animalId)}`;
  if (c.tipoFonte === "NUTRICAO") return `/pecuaria/rebanho/animais/${encodeURIComponent(c.animalId)}#nutricao`;
  const query = new URLSearchParams({ animalId: c.animalId, propriedadeId: String(propriedadeId) });
  if (c.tipoFonte === "TENTATIVA") {
    query.set("fatoId", c.fonteId);
    return `/pecuaria/reproducao?${query}`;
  }
  query.set("detalheTipo", c.tipoFonte === "APLICACAO" ? "aplicacao" : c.tipoFonte === "EXAME" ? "exame" : "execucao");
  query.set("detalheId", c.fonteId);
  return `/pecuaria/sanidade?${query}`;
}

function linkOrigem(c: Componente, propriedadeId: number) {
  return c.natureza === "SERVICO" ? linkOperacaoFinanceira(c.origemId!) : `/estoque?movimentoId=${encodeURIComponent(c.origemId!)}&propriedadeId=${propriedadeId}`;
}

type Props = {
  mostrarMediaPorTentativa?:boolean;
  aoMudarPaginaPreparos?:(pagina:number)=>void;
  fatoEmConsulta?: Pick<Componente, "tipoFonte" | "fonteId">;
  linksJaExibidos?: readonly string[];
  dados: CustosDTO;
  propriedadeId: number;
  porAnimal: boolean;
  tentativaId?: string;
  comRecorte: boolean;
  pagina: number;
  aoMudarPagina: (pagina: number) => void;
};

export function ResumoCustosDiretos({ mostrarMediaPorTentativa=false, dados, aoMudarPaginaPreparos, propriedadeId, porAnimal, tentativaId, comRecorte, pagina, aoMudarPagina, fatoEmConsulta, linksJaExibidos = [] }: Props) {
  const [procedimento,setProcedimento]=useState<ProcedimentoCusto|null>(null);
  const escopoProcedimento=(p:ProcedimentoCusto):EscopoCustos=>p.tipoFonte==="NUTRICAO"?{}:({[({TENTATIVA:"tentativaId",APLICACAO:"aplicacaoId",EXAME:"exameId",PARTICIPACAO:"participacaoId",MANEJO:"manejoId"} as const)[p.tipoFonte]]:p.fonteId});
  const mostrarFato = (c: Componente) => !fatoEmConsulta || c.tipoFonte !== fatoEmConsulta.tipoFonte || c.fonteId !== fatoEmConsulta.fonteId;
  const mostrarOrigem = (c: Componente) => !!c.origemId && dados.situacao !== "OCULTO" && !linksJaExibidos.includes(linkOrigem(c, propriedadeId));
  const temAcoes = dados.componentes.some(c => mostrarFato(c) || mostrarOrigem(c));
  const vazio = dados.totalComponentes === 0 && dados.situacao !== "OCULTO";
  const moeda=(valor:string|null|undefined)=>dados.situacao==="OCULTO"?"Valores ocultos":valor==null?"Não apurado":brl(Number(valor));
  const media=dados.mediaPorTentativa;
  const parcela=(p:ParcelaProcedimento)=>dados.situacao==="OCULTO"?"Valores ocultos":p.situacao==="NAO_APLICAVEL"?"Não aplicável":p.situacao==="INCLUIDO_PACOTE"?"Incluído no pacote":moeda(p.totalConhecido);
  return <>
    {mostrarMediaPorTentativa&&<><dl className="repro-metricas custos-ficha-metricas"><div><dt>Total conhecido</dt><dd>{moeda(dados.totalConhecido)}</dd><small>{dados.situacao==="OCULTO"?"Valores ocultos":dados.cobertura==="COMPLETO"?"Composição completa":"Composição parcial ou desconhecida"}</small></div><div><dt>Material</dt><dd>{moeda(dados.totaisNatureza?.material)}</dd></div><div><dt>Serviços vinculados</dt><dd>{moeda(dados.totaisNatureza?.servico)}</dd></div><div><dt>Custo médio por tentativa <AjudaCampo rotulo="Ajuda sobre custo médio por tentativa" texto="A média considera tentativas válidas e apenas seus custos e preparatórios explicitamente atribuídos neste recorte. Custos sem vínculo ficam fora da média."/></dt><dd>{moeda(media?.mediaConhecida)}</dd><small>{media?`${media.tentativas} tentativa${media.tentativas===1?"":"s"} no período · ${media.situacao==="OCULTO"?"Valores ocultos":media.cobertura==="COMPLETO"?"Custo conhecido":"Custo conhecido parcial ou desconhecido"}`:"Base não informada"}</small></div></dl></>}
    <section className="custos-cobertura" aria-label="Cobertura dos custos">
      {vazio ? <p><strong>Nenhum custo neste recorte</strong></p> : <p><strong>{rotulos[dados.situacao] ?? dados.situacao}</strong>{dados.situacao !== "OCULTO" && <> · {dados.totalConhecido == null ? "Valor ainda não comprovado" : `${brl(Number(dados.totalConhecido))}${dados.cobertura !== "COMPLETO" ? " de parcelas conhecidas" : ""}`}</>}</p>}
      <span className="custos-contagem">{dados.totalComponentes} {dados.totalComponentes === 1 ? "componente" : "componentes"}</span>
      {dados.situacao === "OCULTO" && <p className="mt-1 text-sm text-ink-3">Você não tem permissão para visualizar os valores deste item.</p>}
      <span className="custos-contagem">Cobertura <AjudaCampo rotulo="Ajuda sobre cobertura dos custos" texto={<><p>{porAnimal ? "Período pela data do fato." : "Mesmos fatos da tentativa ou protocolo; não somar visões."}</p>{dados.limitacoes.map((limitacao, indice) => <p key={indice}>{limitacao}</p>)}</>}/></span>
      {dados.componentesPendentes > 0 && <p>{dados.componentesPendentes} componente(s) com valor pendente.</p>}
    </section>
    {dados.totalIntegral && comRecorte && <p className="text-sm">Tentativa/protocolo inteiro, sem recorte: {dados.totalIntegral.situacao === "OCULTO" ? "Valores ocultos" : dados.totalIntegral.totalConhecido == null ? "Valor ainda não comprovado" : brl(Number(dados.totalIntegral.totalConhecido))}. O valor acima é o recorte consultado.</p>}
    {mostrarMediaPorTentativa&&dados.procedimentos&&!!dados.procedimentos.total&&<><div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[720px] text-left text-sm consulta-tabela"><caption className="sr-only">Custos diretos por fato</caption><thead><tr>{["Data","Fato","Material","Serviço","Total conhecido","Ações"].map(t=><th scope="col" key={t} className="px-3 py-3">{t}</th>)}</tr></thead><tbody>{dados.procedimentos.itens.map(p=><tr key={p.chave} className="border-t border-border"><td className="px-3 py-3">{p.data.split("-").reverse().join("/")}</td><td className="px-3 py-3">{descricaoCusto(p.descricao)}</td><td className="px-3 py-3">{parcela(p.material)}</td><td className="px-3 py-3">{parcela(p.servico)}</td><td className="px-3 py-3">{moeda(p.totalConhecido)}{p.cobertura!=="COMPLETO"&&p.situacao!=="OCULTO"&&<small className="block text-ink-3">Composição {p.cobertura==="PARCIAL"?"parcial":"desconhecida"}</small>}</td><td className="px-3 py-3"><Button disabled={p.tipoFonte==="NUTRICAO"&&!p.fechamentoId} onClick={()=>p.tipoFonte==="NUTRICAO"?p.fechamentoId&&navegarPara(rotaFechamento(p.fechamentoId)):setProcedimento(p)}>Detalhes</Button></td></tr>)}</tbody></table></div>{dados.procedimentos.total>10&&<Paginacao paginaAtual={dados.procedimentos.pagina} totalPaginas={Math.ceil(dados.procedimentos.total/10)} totalItens={dados.procedimentos.total} itensPorPagina={10} onPaginaChange={aoMudarPagina} rotulo="fatos" idSelect="custos-fatos-ficha"/>}</>}
    {procedimento&&procedimento.tipoFonte!=="NUTRICAO"&&<Dialog open onOpenChange={aberto=>{if(!aberto)setProcedimento(null);}}><DialogContent className="max-w-[min(68rem,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto p-6"><DialogHeader><DialogTitle>Composição do custo</DialogTitle><DialogDescription>{descricaoCusto(procedimento.descricao)} · {procedimento.data.split("-").reverse().join("/")}</DialogDescription></DialogHeader><CustosDiretos {...escopoProcedimento(procedimento)} propriedadeId={propriedadeId} podeLancar={false} mostrarTitulo={false}/></DialogContent></Dialog>}
    {(!mostrarMediaPorTentativa||!dados.procedimentos)&&!!dados.componentes.length && <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[780px] text-left text-sm consulta-tabela">
        <caption className="sr-only">Componentes do custo direto registrado</caption>
        <thead className="bg-muted/40 text-xs text-ink-3"><tr>{["Data", "Fato de origem", "Componente", "Finalidade", "Situação", "Valor", ...(temAcoes ? ["Ações"] : [])].map(t => <th key={t} scope="col" className="px-3 py-3 font-medium">{t}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{dados.componentes.map(i => <tr key={i.chave}>
          <td className="whitespace-nowrap px-3 py-3">{i.data.split("-").reverse().join("/")}</td>
          <td className="px-3 py-3">{descricaoCusto(i.descricao)}{i.periodoConsumo && <p className="mt-1 text-xs text-ink-3">Consumo: {i.periodoConsumo.inicio.split("-").reverse().join("/")} a {i.periodoConsumo.fim.split("-").reverse().join("/")}</p>}</td>
          <td className="px-3 py-3">{i.natureza === "MATERIAL" ? "Material" : "Serviço/procedimento"}</td>
          <td className="px-3 py-3">{i.finalidade ? rotulos[i.finalidade] ?? i.finalidade : "Finalidade a classificar"}</td>
          <td className="px-3 py-3"><span className="inline-flex rounded-full border border-border bg-muted/40 px-2 py-1 text-xs">{rotulos[i.estadoFato] ?? i.estadoFato}</span></td>
          <td className="whitespace-nowrap px-3 py-3 tabular-nums">{dados.situacao === "OCULTO" ? "Valores ocultos" : i.valor != null ? brl(Number(i.valor)) : rotulos[i.estado] ?? i.estado}</td>
          {temAcoes && <td className="px-3 py-3"><div className="flex flex-col items-start gap-2">
            {mostrarFato(i) && <LinkInterno aparencia="botao-secundario" area="pecuaria" href={linkFato(i, propriedadeId)}>Ver fato de origem</LinkInterno>}
            {mostrarOrigem(i) && <LinkInterno aparencia="botao-secundario" area={i.natureza === "SERVICO" ? "financeiro" : "estoque"} href={linkOrigem(i, propriedadeId)}>{i.natureza === "SERVICO" ? "Ver Serviço" : "Ver movimento"}</LinkInterno>}
          </div></td>}
        </tr>)}</tbody>
      </table>
    </div>}
    {!dados.componentes.length && dados.totalComponentes > 0 && <p>Nenhum componente nesta página.</p>}
    {(!mostrarMediaPorTentativa||!dados.procedimentos)&&dados.totalComponentes > dados.limite && <nav className="flex items-center gap-3" aria-label="Páginas dos componentes">
      <Button variant="outline" disabled={pagina === 1} onClick={() => aoMudarPagina(pagina - 1)}>Anterior</Button>
      <span>Página {pagina} · {dados.totalComponentes} componentes</span>
      <Button variant="outline" disabled={pagina * dados.limite >= dados.totalComponentes} onClick={() => aoMudarPagina(pagina + 1)}>Próxima</Button>
    </nav>}
    {(dados.atribuicoesPaginadas?.total || dados.atribuicoesPreparos.some(a => a.aAtribuir)) && !tentativaId && <section className="custos-preparos" aria-label="Preparatórios a atribuir">
      <header><h4>Preparatórios a atribuir <AjudaCampo rotulo="Ajuda sobre preparatórios a atribuir" texto="Incluídos no animal/protocolo até a atribuição; não somar novamente."/></h4><span>{dados.atribuicoesPaginadas?.total ?? dados.atribuicoesPreparos.filter(a => a.aAtribuir).length} registros</span></header>
      <dl className="custos-preparos-linhas">{dados.atribuicoesPreparos.filter(a => a.aAtribuir).map(a => <div key={`${a.tipo}:${a.fonteId}`}>
        <dt>{descricaoCusto(a.descricao)}</dt>
        <dd>{dados.situacao === "OCULTO" ? "Valores ocultos" : a.parcelas.filter(p => p.restante != null && Number(p.restante) > 0).map(p => `${p.natureza === "MATERIAL" ? "Material" : "Serviço"}: ${brl(Number(p.restante))} a atribuir`).join(" · ") || "Valor pendente de comprovação ou atribuição"}</dd>
      </div>)}</dl>
      {!dados.atribuicoesPreparos.some(a=>a.aAtribuir)&&<p>Nenhum preparatório pendente nesta página.</p>}
      {dados.atribuicoesPaginadas&&dados.atribuicoesPaginadas.total>10&&aoMudarPaginaPreparos&&<Paginacao paginaAtual={dados.atribuicoesPaginadas.pagina} totalPaginas={Math.max(1,Math.ceil(dados.atribuicoesPaginadas.total/10))} totalItens={dados.atribuicoesPaginadas.total} itensPorPagina={10} onPaginaChange={aoMudarPaginaPreparos} rotulo="preparatórios" idSelect="custos-preparos-pagina"/>}
    </section>}
  </>;
}

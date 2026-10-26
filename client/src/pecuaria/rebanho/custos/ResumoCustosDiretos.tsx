import { AjudaCampo } from "../../../components/Dica";
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

export function ResumoCustosDiretos({ dados, aoMudarPaginaPreparos, propriedadeId, porAnimal, tentativaId, comRecorte, pagina, aoMudarPagina, fatoEmConsulta, linksJaExibidos = [] }: Props) {
  const mostrarFato = (c: Componente) => !fatoEmConsulta || c.tipoFonte !== fatoEmConsulta.tipoFonte || c.fonteId !== fatoEmConsulta.fonteId;
  const mostrarOrigem = (c: Componente) => !!c.origemId && dados.situacao !== "OCULTO" && !linksJaExibidos.includes(linkOrigem(c, propriedadeId));
  const temAcoes = dados.componentes.some(c => mostrarFato(c) || mostrarOrigem(c));
  const vazio = dados.totalComponentes === 0 && dados.situacao !== "OCULTO";
  return <>
    <section className="custos-cobertura" aria-label="Cobertura dos custos">
      {vazio ? <p><strong>Nenhum custo neste recorte</strong></p> : <p><strong>{rotulos[dados.situacao] ?? dados.situacao}</strong>{dados.situacao !== "OCULTO" && <> · {dados.totalConhecido == null ? "Valor ainda não comprovado" : `${brl(Number(dados.totalConhecido))}${dados.cobertura !== "COMPLETO" ? " de parcelas conhecidas" : ""}`}</>}</p>}
      <span className="custos-contagem">{dados.totalComponentes} {dados.totalComponentes === 1 ? "componente" : "componentes"}</span>
      {dados.situacao === "OCULTO" && <p className="mt-1 text-sm text-ink-3">Você não tem permissão para visualizar os valores deste item.</p>}
      <span className="custos-contagem">Cobertura <AjudaCampo rotulo="Ajuda sobre cobertura dos custos" texto={<><p>{porAnimal ? "Período pela data do fato." : "Mesmos fatos da tentativa ou protocolo; não somar visões."}</p>{dados.limitacoes.map((limitacao, indice) => <p key={indice}>{limitacao}</p>)}</>}/></span>
      {dados.componentesPendentes > 0 && <p>{dados.componentesPendentes} componente(s) com valor pendente.</p>}
    </section>
    {dados.totalIntegral && comRecorte && <p className="text-sm">Tentativa/protocolo inteiro, sem recorte: {dados.totalIntegral.situacao === "OCULTO" ? "Valores ocultos" : dados.totalIntegral.totalConhecido == null ? "Valor ainda não comprovado" : brl(Number(dados.totalIntegral.totalConhecido))}. O valor acima é o recorte consultado.</p>}
    {!!dados.componentes.length && <div className="overflow-x-auto rounded-lg border border-border">
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
    {dados.totalComponentes > dados.limite && <nav className="flex items-center gap-3" aria-label="Páginas dos componentes">
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

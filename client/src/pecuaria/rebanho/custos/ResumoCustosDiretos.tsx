import { LinkInterno } from "../../../components/LinkInterno";
import { linkOperacaoFinanceira } from "../../../financeiro/navegacao";
import { Button, brl } from "../../../financeiro/financeiro-ui";
import { descricaoCusto } from "./apresentacao";
import type { Componente, CustosDTO } from "./api";

const rotulos: Record<string, string> = {
  VALIDO: "Válido", ATIVA: "Ativa", CONFIRMADO: "Confirmado", INTERROMPIDA: "Interrompida",
  COMPLETO: "Completo", PARCIAL: "Parcial", DESCONHECIDO: "Desconhecido", OCULTO: "Valores ocultos", CONHECIDO: "Conhecido",
  NAO_APLICAVEL: "Não aplicável", INCLUIDO_PACOTE: "Incluído no pacote", REPRODUCAO: "Reprodução", SANIDADE: "Sanidade", ROTINA: "Rotina/manutenção",
};

function linkFato(c: Componente, propriedadeId: number) {
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

type Props = {
  dados: CustosDTO;
  propriedadeId: number;
  porAnimal: boolean;
  tentativaId?: string;
  comRecorte: boolean;
  pagina: number;
  aoMudarPagina: (pagina: number) => void;
};

export function ResumoCustosDiretos({ dados, propriedadeId, porAnimal, tentativaId, comRecorte, pagina, aoMudarPagina }: Props) {
  const vazio = dados.totalComponentes === 0 && dados.situacao !== "OCULTO";
  return <>
    <div className={`rounded-lg border p-4 ${dados.situacao === "OCULTO" ? "border-amber-200 bg-amber-50/50" : "border-border bg-muted/30"}`}>
      {vazio ? <p><strong>Nenhum custo neste recorte</strong></p> : <p><strong>{rotulos[dados.situacao] ?? dados.situacao}</strong>{dados.situacao !== "OCULTO" && <> · {dados.totalConhecido == null ? "Valor ainda não comprovado" : `${brl(Number(dados.totalConhecido))}${dados.cobertura !== "COMPLETO" ? " de parcelas conhecidas" : ""}`}</>}</p>}
      {dados.situacao === "OCULTO" && <p className="mt-1 text-sm text-ink-3">Você não tem permissão para visualizar os valores deste item.</p>}
      <p className="mt-1 text-sm text-ink-3">{porAnimal ? "Recorte pela data do fato operacional." : "Total da tentativa ou protocolo. Estas visões consultam os mesmos fatos e não devem ser somadas."} {dados.componentesPendentes > 0 ? `${dados.componentesPendentes} componente(s) com valor pendente.` : ""}</p>
    </div>
    {dados.totalIntegral && comRecorte && <p className="text-sm">Tentativa/protocolo inteiro, sem recorte: {dados.totalIntegral.situacao === "OCULTO" ? "Valores ocultos" : dados.totalIntegral.totalConhecido == null ? "Valor ainda não comprovado" : brl(Number(dados.totalIntegral.totalConhecido))}. O valor acima é o recorte consultado.</p>}
    {!!dados.componentes.length && <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[780px] text-left text-sm">
        <caption className="sr-only">Componentes do custo direto registrado</caption>
        <thead className="bg-muted/40 text-xs text-ink-3"><tr>{["Data", "Fato de origem", "Componente", "Finalidade", "Situação", "Valor", "Ações"].map(t => <th key={t} scope="col" className="px-3 py-3 font-medium">{t}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{dados.componentes.map(i => <tr key={i.chave}>
          <td className="whitespace-nowrap px-3 py-3">{i.data.split("-").reverse().join("/")}</td>
          <td className="px-3 py-3">{descricaoCusto(i.descricao)}{i.periodoConsumo && <p className="mt-1 text-xs text-ink-3">Consumo: {i.periodoConsumo.inicio.split("-").reverse().join("/")} a {i.periodoConsumo.fim.split("-").reverse().join("/")}</p>}</td>
          <td className="px-3 py-3">{i.natureza === "MATERIAL" ? "Material" : "Serviço/procedimento"}</td>
          <td className="px-3 py-3">{i.finalidade ? rotulos[i.finalidade] ?? i.finalidade : "Finalidade a classificar"}</td>
          <td className="px-3 py-3"><span className="inline-flex rounded-full border border-border bg-muted/40 px-2 py-1 text-xs">{rotulos[i.estadoFato] ?? i.estadoFato}</span></td>
          <td className="whitespace-nowrap px-3 py-3 tabular-nums">{dados.situacao === "OCULTO" ? "Valores ocultos" : i.valor != null ? brl(Number(i.valor)) : rotulos[i.estado] ?? i.estado}</td>
          <td className="px-3 py-3"><div className="flex flex-col items-start gap-2">
            <LinkInterno aparencia="botao-secundario" area="pecuaria" href={linkFato(i, propriedadeId)}>Ver fato de origem</LinkInterno>
            {i.origemId && dados.situacao !== "OCULTO" && <LinkInterno aparencia="botao-secundario" area={i.natureza === "SERVICO" ? "financeiro" : "estoque"} href={i.natureza === "SERVICO" ? linkOperacaoFinanceira(i.origemId) : `/estoque?movimentoId=${encodeURIComponent(i.origemId)}&propriedadeId=${propriedadeId}`}>{i.natureza === "SERVICO" ? "Ver Serviço" : "Ver movimento"}</LinkInterno>}
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>}
    {!dados.componentes.length && <p>Nenhum componente registrado neste recorte.</p>}
    {dados.totalComponentes > 0 && <nav className="flex items-center gap-3" aria-label="Páginas dos componentes">
      <Button secondary disabled={pagina === 1} onClick={() => aoMudarPagina(pagina - 1)}>Anterior</Button>
      <span>Página {pagina} · {dados.totalComponentes} componentes</span>
      <Button secondary disabled={pagina * dados.limite >= dados.totalComponentes} onClick={() => aoMudarPagina(pagina + 1)}>Próxima</Button>
    </nav>}
    {dados.atribuicoesPreparos.some(a => a.aAtribuir) && !tentativaId && <section className="space-y-2 rounded-lg border border-border p-3" aria-label="Preparatórios a atribuir">
      <h4 className="font-semibold">Preparatórios a atribuir</h4>
      <p className="text-xs text-ink-3">O custo permanece nesta visão do protocolo/animal até a atribuição.</p>
      <dl className="divide-y divide-border">{dados.atribuicoesPreparos.filter(a => a.aAtribuir).map(a => <div key={`${a.tipo}:${a.fonteId}`} className="grid gap-1 py-2 text-sm sm:grid-cols-2">
        <dt>{descricaoCusto(a.descricao)}</dt>
        <dd>{dados.situacao === "OCULTO" ? "Valores ocultos" : a.parcelas.filter(p => p.restante != null && Number(p.restante) > 0).map(p => `${p.natureza === "MATERIAL" ? "Material" : "Serviço"}: ${brl(Number(p.restante))} a atribuir`).join(" · ") || "Valor pendente de comprovação ou atribuição"}</dd>
      </div>)}</dl>
    </section>}
    <p className="text-xs text-ink-3">{dados.limitacoes.join(". ")}</p>
  </>;
}

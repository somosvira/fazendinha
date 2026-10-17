import { LinkInterno } from "../../../components/LinkInterno";
import { linkOperacaoFinanceira } from "../../../financeiro/navegacao";
import { Button, brl } from "../../../financeiro/financeiro-ui";
import type { Componente, CustosDTO } from "./api";

const rotulos: Record<string, string> = {
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
  return <>
    <p><strong>{rotulos[dados.situacao] ?? dados.situacao}</strong>{dados.situacao !== "OCULTO" && <> · {dados.totalConhecido == null ? "Valor ainda não comprovado" : `${brl(Number(dados.totalConhecido))}${dados.cobertura !== "COMPLETO" ? " de parcelas conhecidas" : ""}`}</>}</p>
    <p className="text-sm text-ink-3">{porAnimal ? "Recorte pela data do fato operacional." : "Total da tentativa ou protocolo. Estas visões consultam os mesmos fatos e não devem ser somadas."} {dados.componentesPendentes > 0 ? `${dados.componentesPendentes} componente(s) com valor pendente.` : ""}</p>
    {dados.totalIntegral && comRecorte && <p className="text-sm">Tentativa/protocolo inteiro, sem recorte: {dados.totalIntegral.situacao === "OCULTO" ? "Valores ocultos" : dados.totalIntegral.totalConhecido == null ? "Valor ainda não comprovado" : brl(Number(dados.totalIntegral.totalConhecido))}. O valor acima é o recorte consultado.</p>}
    <ul className="divide-y divide-border">{dados.componentes.map(i => <li key={i.chave} className="py-2 text-sm">
      <strong>{i.descricao} · {i.natureza === "MATERIAL" ? "Material" : "Serviço/procedimento"}</strong>
      <p>{i.data.split("-").reverse().join("/")} · {i.finalidade ? rotulos[i.finalidade] : "Finalidade a classificar"} · {i.estadoFato}</p>
      <p>{dados.situacao === "OCULTO" ? "Valores ocultos" : i.valor != null ? brl(Number(i.valor)) : rotulos[i.estado] ?? i.estado}</p>
      <div className="flex gap-3">
        <LinkInterno area="pecuaria" href={linkFato(i, propriedadeId)}>Ver fato de origem</LinkInterno>
        {i.origemId && dados.situacao !== "OCULTO" && <LinkInterno area={i.natureza === "SERVICO" ? "financeiro" : "estoque"} href={i.natureza === "SERVICO" ? linkOperacaoFinanceira(i.origemId) : `/estoque?movimentoId=${encodeURIComponent(i.origemId)}&propriedadeId=${propriedadeId}`}>{i.natureza === "SERVICO" ? "Ver Serviço" : "Ver movimento"}</LinkInterno>}
      </div>
    </li>)}</ul>
    {!dados.componentes.length && <p>Nenhum componente registrado neste recorte.</p>}
    <nav className="flex items-center gap-3" aria-label="Páginas dos componentes">
      <Button secondary disabled={pagina === 1} onClick={() => aoMudarPagina(pagina - 1)}>Anterior</Button>
      <span>Página {pagina} · {dados.totalComponentes} componentes</span>
      <Button secondary disabled={pagina * dados.limite >= dados.totalComponentes} onClick={() => aoMudarPagina(pagina + 1)}>Próxima</Button>
    </nav>
    {dados.atribuicoesPreparos.some(a => a.aAtribuir) && !tentativaId && <div>
      <h4 className="font-semibold">Preparatórios a atribuir</h4>
      {dados.atribuicoesPreparos.filter(a => a.aAtribuir).map(a => <p key={`${a.tipo}:${a.fonteId}`} className="text-sm">{a.descricao} · o custo permanece nesta visão do protocolo/animal{dados.situacao !== "OCULTO" ? a.parcelas.filter(p => p.restante != null && Number(p.restante) > 0).map(p => ` · ${p.natureza === "MATERIAL" ? "material" : "Serviço"}: ${brl(Number(p.restante))} a atribuir`).join("") : ""}.</p>)}
    </div>}
    <p className="text-xs text-ink-3">{dados.limitacoes.join(". ")}</p>
  </>;
}

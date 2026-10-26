import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "../../../components/VisualizacaoConsulta";
import { Button } from "../../../components/ui/button";
import { LinkReproducao } from "./ConsultaReproducaoUI";
import { CalendarioAgenda } from "./CalendarioAgenda";
import { useFiltrosTabelaLocal } from "@/financeiro/useFiltrosTabelaLocal";
import { BuscaLista } from "@/components/BuscaLista";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { getHojeISO as hoje } from "../../../lib/hoje";
import { horarioIatf, inputHorarioIatf } from "./CampoDataIatf";
import { useEffect, useState } from "react";
import { dataBR, Empty, ErrorBox, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import {
  DateRangePicker,
  dateFromIso,
  isoDate,
} from "../../../components/DateRangePicker";
import { Paginacao } from "../ui";
import { obterSugestoesVisita, type SugestoesVisita } from "./visitas-api";
import { dataValida } from "./periodo-consulta";
import { navegarPara } from "../../../router";
const origens: Record<string, string> = {
  DIAGNOSTICO_PENDENTE: "Diagnóstico pendente",
  TENTATIVA: "Diagnóstico pendente",
  AVALIACAO: "Retorno da avaliação",
  TAREFA_IATF: "Tarefa IATF",
  PREVISAO_PARTO: "Previsão de parto",
};
const situacoes: Record<string, string> = {
  PREVISAO_PENDENTE: "Previsão a definir",
  PENDENTE: "Pendente",
  PREVISTO: "Previsto",
  ATRASADO: "Atrasado",
  AGUARDANDO_DIAGNOSTICO: "Aguardando diagnóstico",
};
export function AcompanhamentoReprodutivo({
  atualizacao,
  propriedadeId,
  podeLancar = true,
}: {
  atualizacao: unknown;
  propriedadeId?: number;
  podeLancar?: boolean;
}) {
  const visual = useVisualizacaoConsulta("visualAgendaReproducao", "reproducao");
  const [dados, setDados] = useState<SugestoesVisita | null>(null),
    [erro, setErro] = useState<string | null>(null),
    [carregando, setCarregando] = useState(true);
  const [inicio, setInicio] = useState(
      () =>
        new URLSearchParams(window.location.search).get("agendaInicio") ?? "",
    ),
    [fim, setFim] = useState(
      () => new URLSearchParams(window.location.search).get("agendaFim") ?? "",
    );
  const [crescente, setCrescente] = useState(
      () =>
        new URLSearchParams(window.location.search).get("agendaOrdem") !==
        "desc",
    ),
    [pagina, setPagina] = useState(() =>
      Math.max(
        1,
        Math.floor(
          Number(
            new URLSearchParams(window.location.search).get("agendaPagina"),
          ) || 1,
        ),
      ),
    ),
    [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let vigente = true;
    setDados(null);
    setErro(null);
    setCarregando(true);
    obterSugestoesVisita(hoje(), {}, propriedadeId)
      .then((d) => {
        if (vigente) setDados(d);
      })
      .catch((e) => {
        if (vigente) setErro(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (vigente) setCarregando(false);
      });
    return () => {
      vigente = false;
    };
  }, [atualizacao, propriedadeId, revisao]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    ["agendaInicio", "agendaFim", "agendaOrdem", "agendaPagina"].forEach((k) =>
      p.delete(k),
    );
    if (!crescente) p.set("agendaOrdem", "desc");
    if (pagina > 1) p.set("agendaPagina", String(pagina));
    if (inicio) p.set("agendaInicio", inicio);
    if (fim) p.set("agendaFim", fim);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}?${p}${window.location.hash}`,
    );
  }, [inicio, fim, crescente, pagina]);
  useEffect(() => {
    const restaurar = () => {
      const p = new URLSearchParams(window.location.search);
      setInicio(p.get("agendaInicio") ?? "");
      setFim(p.get("agendaFim") ?? "");
      setPagina(Math.max(1, Math.floor(Number(p.get("agendaPagina")) || 1)));
      setCrescente(p.get("agendaOrdem") !== "desc");
    };
    window.addEventListener("popstate", restaurar);
    return () => window.removeEventListener("popstate", restaurar);
  }, []);
  const animais = dados
    ? Array.isArray(dados.animais)
      ? dados.animais
      : dados.animais.animais
    : [];
  const invalido =
    (!!inicio && !dataValida(inicio)) ||
    (!!fim && !dataValida(fim)) ||
    (!!inicio && !!fim && inicio > fim);
  const referenciaRetorno = (r: NonNullable<SugestoesVisita["retornos"]>[number]) =>
    r.status === "PREVISAO_PENDENTE" || !r.data ? null
      : r.origem === "TAREFA_IATF" ? inputHorarioIatf(r.data, r.precisaoTemporal) : r.data.slice(0, 10);
  const [busca,setBusca] = useState("");
  const consulta = useFiltrosTabelaLocal<NonNullable<SugestoesVisita["retornos"]>[number]>([
    {chave:"animal", naBarra: true,rotulo:"Animal",tipo:"texto",obter:r=>{const a=animais.find(a=>a.animalId===r.animalId);return `${a?.brinco??""} ${a?.nome??""}`;}},
    {chave:"origem",rotulo:"Origem",tipo:"opcoes",obter:r=>r.origem,opcoes:Object.entries(origens).map(([valor,texto])=>({valor,texto}))},
    {chave:"situacao",rotulo:"Situação",tipo:"opcoes",obter:r=>r.status,opcoes:Object.entries(situacoes).map(([valor,texto])=>({valor,texto}))},
  ],()=>setPagina(1));
  const retornos = consulta.filtrar(dados?.retornos ?? []).filter(r=>{const a=animais.find(a=>a.animalId===r.animalId);return `${a?.brinco??""} ${a?.nome??""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"));})
    .filter(
      (r) =>
        !invalido &&
        (r.status === "PREVISAO_PENDENTE" ||
          !r.data ||
          ((!inicio || referenciaRetorno(r)!.slice(0, 10) >= inicio) &&
            (!fim || referenciaRetorno(r)!.slice(0, 10) <= fim))),
    )
    .sort((a, b) => {
      const da = referenciaRetorno(a), db = referenciaRetorno(b);
      if (!da && db) return 1;
      if (da && !db) return -1;
      return (
        (da && db ? (crescente ? 1 : -1) * da.localeCompare(db) : 0) ||
        `${a.animalId}:${a.origemId}`.localeCompare(
          `${b.animalId}:${b.origemId}`,
        )
      );
    });
  const totalPaginas = Math.max(1, Math.ceil(retornos.length / 10)),
    atual = Math.min(pagina, totalPaginas);
  function destino(r: NonNullable<SugestoesVisita["retornos"]>[number]) {
    const retorno = new URL(window.location.href);
    for (const [chave, valor] of Object.entries({ agendaInicio: inicio, agendaFim: fim, agendaOrdem: crescente ? "" : "desc", agendaPagina: pagina > 1 ? String(pagina) : "" })) valor ? retorno.searchParams.set(chave, valor) : retorno.searchParams.delete(chave);
    const sitio = propriedadeId != null ? `&sitio=${propriedadeId}` : "";
    return r.programacaoId
        ? `/pecuaria/reproducao/programacoes/${encodeURIComponent(r.programacaoId)}?retorno=${encodeURIComponent(retorno.pathname + retorno.search + retorno.hash)}${sitio}`
        : r.origem === "PREVISAO_PARTO" && !podeLancar
          ? `/pecuaria/rebanho/animais/${r.animalId}#reproducao`
          : `/pecuaria/reproducao?animalId=${encodeURIComponent(r.animalId)}${r.origem === "PREVISAO_PARTO" ? "&acao=parto" : r.origemConsultavel !== false && r.origemId ? `&fatoId=${encodeURIComponent(r.origemId)}` : ""}${sitio}`;
  }
  return (
    <Panel className="repro-agenda-superficie">

      <div className="p-4 space-y-4">
        <p className="text-sm text-ink-3">
          Datas registradas e ações pendentes. Registros sem previsão ficam ao
          final; ausência de diagnóstico não significa resultado negativo.
        </p>
        <BarraConsulta campos={consulta.campos} edicaoFiltros={consulta.edicao} criterios={consulta.criterios}>
          <BuscaLista rotulo="Buscar animal na agenda" placeholder="Brinco ou nome" valor={busca} onChange={v=>{setBusca(v);setPagina(1);}}/>
          <DateRangePicker
            value={{
              start: dataValida(inicio) ? dateFromIso(inicio) : null,
              end: dataValida(fim) ? dateFromIso(fim) : null,
            }}
            triggerAriaLabel="Período da agenda"
            triggerLabel={!inicio && !fim ? "Todos os retornos" : undefined}
            onChange={(r) => {
              setInicio(r.start ? isoDate(r.start) : "");
              setFim(r.end ? isoDate(r.end) : "");
              setPagina(1);
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              setCrescente((v) => !v);
              setPagina(1);
            }}
          >
            Data {crescente ? "crescente" : "decrescente"}
          </Button>
          {(inicio || fim) && (
            <Button
              variant="outline"
              onClick={() => {
                setInicio("");
                setFim("");
                setPagina(1);
              }}
            >
              Limpar período
            </Button>
          )}
        </BarraConsulta>
        <ErrorBox
          erro={
            erro ??
            (invalido
              ? "Informe datas válidas e início anterior ou igual ao fim."
              : null)
          }
        />
        {erro && (
          <Button variant="outline" onClick={() => setRevisao((v) => v + 1)}>
            Tentar novamente
          </Button>
        )}
        {carregando && <p role="status">Carregando acompanhamento…</p>}
        {!carregando && !erro && dados && (
          <>
            <div className="repro-consulta-titulo"><div><h2>Próximas atividades <span>{retornos.length} acompanhamentos</span></h2><p>Datas registradas, sem presumir resultado clínico.</p></div><AlternarVisualizacaoConsulta {...visual} visual="Calendário" rotulo="Visualização da agenda reprodutiva"/></div>
            {visual.modo === "visual" ? <div className="repro-agenda-grade"><section aria-label="Lista de próximas atividades"><ol className="repro-agenda-lista">{retornos.slice((atual - 1) * 10, atual * 10).map(r => {
              const a = animais.find(a => a.animalId === r.animalId);
              return <li key={`${r.animalId}:${r.origem}:${r.origemId}`}><time>{r.status === "PREVISAO_PENDENTE" ? "Previsão a definir" : r.data ? r.origem === "TAREFA_IATF" ? horarioIatf(r.data, r.precisaoTemporal) : dataBR(r.data) : "Sem data informada"}</time><div><h3>{origens[r.origem] ?? "Acompanhamento"}</h3><p>{a ? `${a.brinco ?? "Sem brinco"}${a.nome ? ` · ${a.nome}` : ""}` : "Animal não identificado"}</p><Pill tone={r.status === "ATRASADO" ? "red" : "amber"}>{situacoes[r.status] ?? "A conferir"}</Pill></div><LinkReproducao botao href={destino(r)} sitio={propriedadeId}>Ver ação</LinkReproducao></li>;
            })}</ol></section><CalendarioAgenda itens={retornos} dataDe={referenciaRetorno} chaveDe={r => `${r.animalId}:${r.origem}:${r.origemId}`} render={r => <div><strong>{origens[r.origem] ?? "Acompanhamento"}</strong><p>{animais.find(a => a.animalId === r.animalId)?.brinco ?? "Animal não identificado"}</p><LinkReproducao botao href={destino(r)} sitio={propriedadeId}>Abrir origem</LinkReproducao></div>}/></div> : <TabelaFinanceira visualizacao="tabela" filtrosColunas={consulta.colunas}
              rotulo="Agenda reprodutiva"
              itens={retornos.slice((atual - 1) * 10, atual * 10)}
              chaveDe={(r) => `${r.animalId}:${r.origem}:${r.origemId}`}
              colunas={[
                {
                  chave: "data",
                  titulo: "Data prevista",
                  larguraMinima: 150,
                  celula: (r) =>
                    r.status === "PREVISAO_PENDENTE"
                      ? "Previsão a definir"
                      : r.data
                        ? r.origem === "TAREFA_IATF"
                          ? horarioIatf(r.data, r.precisaoTemporal)
                          : dataBR(r.data)
                        : "Sem data informada",
                },
                {
                  chave: "animal",
                  titulo: "Animal",
                  principal: true,
                  larguraMinima: 120,
                  celula: (r) =>
                    animais.find((a) => a.animalId === r.animalId)?.brinco ??
                    "Animal não identificado",
                },
                {
                  chave: "acao",
                  titulo: "Acompanhamento",
                  larguraFlexivel: true,
                  celula: (r) => origens[r.origem] ?? "Acompanhamento",
                },
                {
                  chave: "situacao",
                  titulo: "Situação",
                  larguraMinima: 160,
                  celula: (r) => (
                    <Pill tone={r.status === "ATRASADO" ? "red" : "amber"}>
                      {situacoes[r.status] ?? "A conferir"}
                    </Pill>
                  ),
                },
                {
                  chave: "detalhe",
                  titulo: "Ação",
                  acoes: true,
                  larguraMinima: 130,
                  celula: (r) => (
                    <LinkReproducao botao href={destino(r)} sitio={propriedadeId}>Ver ação</LinkReproducao>
                  ),
                },
              ]}
            />}
            {!retornos.length && (
              <Empty>
                Nenhum retorno ou previsão com os critérios atuais. Ajuste o
                período ou consulte a seleção livre de uma visita.
              </Empty>
            )}
            <Paginacao
              paginaAtual={atual}
              totalPaginas={totalPaginas}
              totalItens={retornos.length}
              itensPorPagina={10}
              onPaginaChange={setPagina}
              rotulo="acompanhamentos"
              idSelect="pagina-agenda-reprodutiva"
            />
          </>
        )}
        {podeLancar && (
          <Button variant="outline" onClick={() => navegarPara("/pecuaria/visitas")}>
            Preparar ou retomar visita
          </Button>
        )}
      </div>
    </Panel>
  );
}

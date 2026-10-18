import { getHojeISO as hoje } from "../../../lib/hoje";
import { horarioIatf, inputHorarioIatf } from "./CampoDataIatf";
import { useEffect, useState } from "react";
import {
  Button,
  CabecalhoTabela,
  dataBR,
  Empty,
  ErrorBox,
  Panel,
  Pill,
  TabelaFinanceira,
} from "../../../financeiro/financeiro-ui";
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
  const retornos = (dados?.retornos ?? [])
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
  function abrir(r: NonNullable<SugestoesVisita["retornos"]>[number]) {
    const sitio = propriedadeId != null ? `&sitio=${propriedadeId}` : "";
    navegarPara(
      r.programacaoId
        ? `/pecuaria/reproducao/programacoes/${encodeURIComponent(r.programacaoId)}?retorno=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}${sitio}`
        : r.origem === "PREVISAO_PARTO" && !podeLancar
          ? `/pecuaria/rebanho/animais/${r.animalId}#reproducao`
          : `/pecuaria/reproducao?animalId=${encodeURIComponent(r.animalId)}${r.origem === "PREVISAO_PARTO" ? "&acao=parto" : r.origemConsultavel !== false && r.origemId ? `&fatoId=${encodeURIComponent(r.origemId)}` : ""}${sitio}`,
    );
  }
  return (
    <Panel>
      <CabecalhoTabela titulo="Retornos e previsões" />
      <div className="p-4 space-y-4">
        <p className="text-sm text-ink-3">
          Datas registradas e ações pendentes. Registros sem previsão ficam ao
          final; ausência de diagnóstico não significa resultado negativo.
        </p>
        <div className="flex flex-wrap items-center gap-3">
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
            secondary
            onClick={() => {
              setCrescente((v) => !v);
              setPagina(1);
            }}
          >
            Data {crescente ? "crescente" : "decrescente"}
          </Button>
          {(inicio || fim) && (
            <Button
              secondary
              onClick={() => {
                setInicio("");
                setFim("");
                setPagina(1);
              }}
            >
              Limpar período
            </Button>
          )}
        </div>
        <ErrorBox
          erro={
            erro ??
            (invalido
              ? "Informe datas válidas e início anterior ou igual ao fim."
              : null)
          }
        />
        {erro && (
          <Button secondary onClick={() => setRevisao((v) => v + 1)}>
            Tentar novamente
          </Button>
        )}
        {carregando && <p role="status">Carregando acompanhamento…</p>}
        {!carregando && !erro && dados && (
          <>
            <TabelaFinanceira
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
                    <Button secondary onClick={() => abrir(r)}>
                      Ver ação
                    </Button>
                  ),
                },
              ]}
            />
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
          <Button secondary onClick={() => navegarPara("/pecuaria/visitas")}>
            Preparar ou retomar visita
          </Button>
        )}
      </div>
    </Panel>
  );
}

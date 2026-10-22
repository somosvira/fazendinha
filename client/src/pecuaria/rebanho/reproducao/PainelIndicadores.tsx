import { useState } from "react";
import {
  ArrowRight,
  ChartNoAxesColumnIncreasing,
  CircleCheck,
  Clock3,
  Info,
  Search,
  Users,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Paginacao } from "../ui";
import { descreverMotivo } from "./elegibilidade-api";
import { IndicadoresAcompanhamento } from "./IndicadoresAcompanhamento";
import {
  navegarConsultaComSitio,
  urlConsultaComSitio,
} from "./contexto-consulta";
import type {
  ContagensIndicadores,
  DetalheAnimalIndicador,
  PeriodoIndicadores,
  SnapshotIndicadoresReprodutivos,
} from "./indicadores-api";

const numero = (v: number | null) =>
  v === null
    ? "Não calculável"
    : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const taxa = (v: number | null) => (v === null ? "Pendente" : `${numero(v)}%`);
const data = (v: string) => v.slice(0, 10).split("-").reverse().join("/");
const curto = (v: string, ano: boolean) => data(v).slice(0, ano ? 10 : 5);
const periodoCompleto = (p: PeriodoIndicadores) =>
  `${data(p.inicio)} a ${data(p.fim)}`;
type Aba = "geral" | "desempenho" | "fila" | "pendencias";

function motivosServico(s: SnapshotIndicadoresReprodutivos) {
  const c = s.totais.contagens;
  if (!s.periodos.length)
    return "O intervalo não contém um período completo de 21 dias.";
  const razoes: string[] = [];
  if (c.animaisComPendenciaElegibilidade)
    razoes.push(
      `${c.animaisComPendenciaElegibilidade} participações com aptidão a conferir`,
    );
  if (c.estimativaVaziasAnteriores === null)
    razoes.push(
      "Tentativas anteriores sem diagnóstico e sem estimativa informada",
    );
  if (c.elegiveis === 0) razoes.push("Sem denominador de elegíveis");
  return (
    razoes.join(". ") ||
    s.pendencias.map(descreverMotivo).join(" ") ||
    "Denominador não comprovado."
  );
}

export function PainelIndicadores({
  snapshot: s,
}: {
  snapshot: SnapshotIndicadoresReprodutivos;
}) {
  const [aba, setAba] = useState<Aba>("geral");
  const [pagina, setPagina] = useState(1);
  const [tamanho, setTamanho] = useState(4);
  const [selecionado, setSelecionado] = useState(s.periodos.at(-1)?.id ?? "");
  const [animaisAbertos, setAnimaisAbertos] = useState(false);
  const [paginaAnimais, setPaginaAnimais] = useState(1);
  const periodos = [...s.periodos].reverse();
  const paginas = Math.max(1, Math.ceil(periodos.length / tamanho));
  const paginaAtual = Math.min(pagina, paginas);
  const p = s.periodos.find((p) => p.id === selecionado) ?? periodos[0];
  const c = s.totais.contagens;
  const anos = new Set(
    s.periodos.flatMap((p) => [p.inicio.slice(0, 4), p.fim.slice(0, 4)]),
  );
  const mostrarAno = anos.size > 1;
  function selecionar(p: PeriodoIndicadores) {
    setSelecionado(p.id);
    setPaginaAnimais(1);
    setAnimaisAbertos(false);
  }
  function paginar(n: number) {
    setPagina(n);
    const proximo = periodos[(n - 1) * tamanho];
    if (proximo) selecionar(proximo);
  }
  const cards = [
    {
      nome: "serviço",
      valor: s.totais.taxas.servico,
      explicacao:
        s.totais.taxas.servico === null
          ? motivosServico(s)
          : `${numero(c.matrizesServidas)} participações de matrizes servidas / ${numero(c.elegiveis)} elegíveis ponderadas.`,
    },
    {
      nome: "concepção",
      valor: s.totais.taxas.concepcao,
      explicacao:
        s.totais.taxas.concepcao === null
          ? (c.naoClassificaveis
              ? `${c.naoClassificaveis} tentativas não classificáveis. `
              : "") +
            (c.denominadorConcepcao === 0
              ? "Sem tentativas com resultado para calcular concepção."
              : "Resultado não calculável; confira as pendências.")
          : `${c.positivas} positivas / ${c.denominadorConcepcao} no denominador de concepção.`,
    },
    {
      nome: "prenhez",
      valor: s.totais.taxas.prenhez,
      explicacao:
        s.totais.taxas.prenhez === null
          ? `Depende ${s.totais.taxas.servico === null && s.totais.taxas.concepcao === null ? "das taxas de serviço e concepção" : s.totais.taxas.servico === null ? "da taxa de serviço" : "da taxa de concepção"}.`
          : "Taxa de serviço × taxa de concepção / 100.",
    },
  ];
  const pendenciasAnimais = s.periodos.flatMap((p) =>
    p.detalhamento
      .filter((a) => a.contribuicaoElegiveis === null || a.motivos.length > 0)
      .map((a) => ({ p, a })),
  );
  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Indicadores reprodutivos"
        onKeyDown={(e) => {
          const ids: Aba[] = ["geral", "desempenho", "fila", "pendencias"];
          const atual = ids.indexOf(aba);
          const indice =
            e.key === "ArrowRight"
              ? (atual + 1) % ids.length
              : e.key === "ArrowLeft"
                ? (atual + ids.length - 1) % ids.length
                : e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? ids.length - 1
                    : null;
          if (indice !== null) {
            e.preventDefault();
            setAba(ids[indice]);
            e.currentTarget
              .querySelectorAll<HTMLButtonElement>("[role=tab]")
              [indice]?.focus();
          }
        }}
        className="abas-pasta"
      >
        {(
          [
            ["geral", "Visão geral"],
            ["desempenho", "Desempenho"],
            ["fila", "Fila de manejo"],
            ["pendencias", "Pendências"],
          ] as const
        ).map(([id, nome]) => (
          <button
            key={id}
            id={`indicadores-aba-${id}`}
            role="tab"
            aria-selected={aba === id}
            tabIndex={aba === id ? 0 : -1}
            aria-controls="indicadores-conteudo"
            className={`shrink-0 border-b-2 px-4 py-3 text-base ${aba === id ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground"}`}
            onClick={() => setAba(id)}
          >
            {nome}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="indicadores-conteudo"
        aria-labelledby={`indicadores-aba-${aba}`}
        className="space-y-6"
      >
        {(aba === "geral" || aba === "desempenho") && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {cards.map((card) => (
                <article
                  key={card.nome}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Taxa de {card.nome}
                  </h3>
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex size-12 shrink-0 items-center justify-center rounded-full ${card.valor === null ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-900"}`}
                    >
                      {card.valor === null ? (
                        <Clock3 size={27} aria-hidden="true" />
                      ) : (
                        <ChartNoAxesColumnIncreasing
                          size={27}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <div>
                      <p
                        className={`text-3xl font-semibold ${card.valor === null ? "text-amber-900" : "text-primary"}`}
                      >
                        {taxa(card.valor)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {card.explicacao}
                      </p>
                      {card.valor === null && card.nome !== "prenhez" && (
                        <button
                          className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-primary underline underline-offset-2"
                          onClick={() => setAba("pendencias")}
                        >
                          Conferir pendências{" "}
                          <ArrowRight size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-5">
                  <h3 className="text-xl font-semibold">
                    Desempenho por período
                    {anos.size === 1 ? ` · ${[...anos][0]}` : ""}
                  </h3>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Linhas por página
                    <select
                      aria-label="Períodos por página"
                      value={tamanho}
                      className="rounded-md border bg-background p-1.5"
                      onChange={(e) => {
                        const novo = Number(e.target.value);
                        setTamanho(novo);
                        setPagina(1);
                        if (periodos[0]) selecionar(periodos[0]);
                      }}
                    >
                      {[4, 8, 12, 24].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full whitespace-nowrap text-left text-base consulta-tabela">
                    <thead className="bg-muted/35">
                      <tr>
                        {[
                          "Período",
                          "Servidas",
                          "Positivas",
                          "Sem diagnóstico",
                          "Concepção",
                          "Situação",
                        ].map((t) => (
                          <th
                            className="px-4 py-4 text-sm font-semibold"
                            key={t}
                          >
                            {t}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periodos
                        .slice(
                          (paginaAtual - 1) * tamanho,
                          paginaAtual * tamanho,
                        )
                        .map((periodo) => (
                          <tr
                            className={`border-t ${p?.id === periodo.id ? "bg-primary/10" : ""}`}
                            key={periodo.id}
                          >
                            <td className="px-4 py-4">
                              <button
                                className="text-left font-medium hover:underline focus-visible:outline-2"
                                aria-label={periodoCompleto(periodo)}
                                aria-pressed={p?.id === periodo.id}
                                title={periodoCompleto(periodo)}
                                onClick={() => selecionar(periodo)}
                              >
                                {curto(periodo.inicio, mostrarAno)} –{" "}
                                {curto(periodo.fim, mostrarAno)}
                              </button>
                            </td>
                            <td className="px-4">
                              {periodo.contagens.matrizesServidas}
                            </td>
                            <td className="px-4">
                              {periodo.contagens.positivas}
                            </td>
                            <td className="px-4">
                              {periodo.contagens.abertas}
                            </td>
                            <td className="px-4">
                              {taxa(periodo.taxas.concepcao)}
                            </td>
                            <td className="px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-sm ${periodo.pendencias.length ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}
                              >
                                {periodo.pendencias.length ? (
                                  <Clock3 size={13} aria-hidden="true" />
                                ) : (
                                  <CircleCheck size={13} aria-hidden="true" />
                                )}
                                {periodo.pendencias.length
                                  ? "Pendente"
                                  : "Calculado"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      {!periodos.length && (
                        <tr>
                          <td colSpan={6} className="p-5 text-muted-foreground">
                            Nenhum período completo de 21 dias neste intervalo.
                            Amplie o período para consultar o desempenho.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Paginacao
                  paginaAtual={paginaAtual}
                  totalPaginas={paginas}
                  totalItens={periodos.length}
                  itensPorPagina={tamanho}
                  onPaginaChange={paginar}
                  rotulo="períodos"
                  idSelect="indicadores-pagina-periodos"
                />
                <details className="border-t p-4 text-sm">
                  <summary className="cursor-pointer font-medium">
                    Total recalculado
                  </summary>
                  <p className="mt-2">
                    {s.totais.animaisUnicos} animais únicos ·{" "}
                    {s.totais.participacoesAnimalPeriodo} participações
                    animal-período. Elegíveis são participações ponderadas;
                    totais não são médias dos percentuais.
                  </p>
                  <Contagens dados={c} />
                </details>
              </div>
              {p && (
                <aside className="space-y-5 rounded-xl border bg-card p-5">
                  <header className="border-b pb-4">
                    <h3
                      className="text-xl font-semibold"
                      title={periodoCompleto(p)}
                    >
                      {curto(p.inicio, mostrarAno)} – {curto(p.fim, mostrarAno)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Período selecionado · {p.inicio.slice(0, 4)}
                      {p.inicio.slice(0, 4) !== p.fim.slice(0, 4)
                        ? ` / ${p.fim.slice(0, 4)}`
                        : ""}
                    </p>
                  </header>
                  <section>
                    <h4 className="mb-4 text-sm font-semibold">
                      População e resultados
                    </h4>
                    <dl className="space-y-4 text-sm">
                      {[
                        {
                          label: "Elegíveis conhecidas (ponderadas)",
                          valor: p.contagens.elegiveisConhecidas,
                          Icon: Users,
                        },
                        {
                          label: "Aptidão a conferir",
                          valor: p.contagens.animaisComPendenciaElegibilidade,
                          Icon: Search,
                        },
                        {
                          label: "Tentativas positivas",
                          valor: p.contagens.positivas,
                          Icon: CircleCheck,
                        },
                      ].map(({ label, valor, Icon }) => (
                        <div className="flex items-center gap-3" key={label}>
                          <Icon
                            size={19}
                            className="shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <dt className="flex-1">{label}</dt>
                          <dd className="text-lg font-semibold">
                            {numero(valor)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section className="border-t pt-4">
                    <h4 className="mb-3 text-sm font-semibold">
                      Aptidão reprodutiva
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Denominador ponderado:{" "}
                      <strong>{numero(p.contagens.elegiveis)}</strong>. A base
                      conhecida e as pendências têm naturezas diferentes e não
                      formam um percentual de animais.
                    </p>
                    {p.pendencias.length > 0 && (
                      <details className="mt-3 text-sm text-amber-900"><summary className="cursor-pointer font-medium">Motivos das pendências ({p.pendencias.length})</summary><ul className="mt-3 space-y-2">
                        {p.pendencias.map((m) => (
                          <li key={m}>{descreverMotivo(m)}</li>
                        ))}
                      </ul></details>
                    )}
                  </section>
                  <Button
                    className="w-full gap-2"
                    onClick={() => {
                      setAnimaisAbertos(!animaisAbertos);
                      setPaginaAnimais(1);
                    }}
                  >
                    {animaisAbertos
                      ? "Recolher animais"
                      : "Ver animais deste período"}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                  <details className="border-t pt-3 text-sm">
                    <summary className="cursor-pointer font-medium">
                      Detalhes do cálculo
                    </summary>
                    <Contagens dados={p.contagens} />
                    <p className="mt-3">
                      Corte {data(p.maturidade.corte)} ·{" "}
                      {p.maturidade.diasAposFim} dias após o fim ·{" "}
                      {p.maturidade.tentativasAbertas} tentativas abertas.
                    </p>
                    <p>
                      Serviço: {taxa(p.taxas.servico)} · Concepção:{" "}
                      {taxa(p.taxas.concepcao)} · Prenhez:{" "}
                      {taxa(p.taxas.prenhez)}
                    </p>
                  </details>
                </aside>
              )}
            </div>
            {animaisAbertos && p && (
              <section className="rounded-xl border bg-card p-5">
                <h3 className="mb-4 font-semibold">
                  Animais considerados no período selecionado
                </h3>
                {p.detalhamento
                  .slice((paginaAnimais - 1) * 10, paginaAnimais * 10)
                  .map((a) => (
                    <DetalheAnimal
                      key={a.animalId}
                      animal={a}
                      propriedadeId={s.filtros.propriedadeId}
                    />
                  ))}
                {!p.detalhamento.length && <p>Nenhum animal neste período.</p>}
                <Paginacao
                  paginaAtual={paginaAnimais}
                  totalPaginas={Math.max(
                    1,
                    Math.ceil(p.detalhamento.length / 10),
                  )}
                  totalItens={p.detalhamento.length}
                  itensPorPagina={10}
                  onPaginaChange={setPaginaAnimais}
                  rotulo="animais do período"
                  idSelect="indicadores-pagina-animais"
                />
              </section>
            )}
            {aba === "desempenho" && s.acompanhamento && (
              <IndicadoresAcompanhamento
                dados={s.acompanhamento}
                secao="desempenho"
                propriedadeId={s.filtros.propriedadeId}
              />
            )}
            <details className="rounded-xl border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-semibold">
                Critérios de cálculo e filtros aplicados
              </summary>
              <p className="mt-3">
                {s.metodologia.rotulo} · {s.versaoMetodologia}. Não há
                certificação de equivalência integral ao IDEAGRI/IILB.
              </p>
              <p>
                Período: {data(s.filtros.inicio)} a {data(s.filtros.fim)} ·
                Corte: {data(s.filtros.corte)}.
              </p>
              <p>
                Concepção estimada:{" "}
                {s.metodologia.concepcaoEstimada === null
                  ? "Não informada"
                  : `${numero(s.metodologia.concepcaoEstimada)}%`}{" "}
                · Deslocamento TE: {s.metodologia.deslocamentoTeDias} dias.
              </p>
              <p>
                Lote: {s.filtros.loteId ?? "Todos"} · Tentativas:{" "}
                {s.filtros.tiposTentativa?.join(", ") ?? "Todas"} · Papéis:{" "}
                {s.filtros.papeis?.join(", ") ?? "Todos"}
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                {s.metodologia.regras.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              {s.metodologia.fontes.map((f) => (
                <p key={f}>
                  <a
                    href={f}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Referência metodológica
                  </a>
                </p>
              ))}
            </details>
          </>
        )}
        {aba === "fila" &&
          (s.acompanhamento ? (
            <IndicadoresAcompanhamento
              dados={s.acompanhamento}
              secao="fila"
              propriedadeId={s.filtros.propriedadeId}
            />
          ) : (
            <p className="rounded-xl border bg-card p-5">
              Esta consulta não contém acompanhamento gerencial da fila.
              Emissões antigas conservam apenas os dados preservados.
            </p>
          ))}
        {aba === "pendencias" && (
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h3 className="text-xl font-semibold">
              Pendências de cálculo e conferência
            </h3>
            {s.pendencias.length ? (
              <ul className="space-y-2 text-sm">
                {s.pendencias.map((m) => (
                  <li key={m}>{descreverMotivo(m)}</li>
                ))}
              </ul>
            ) : (
              <p>Nenhuma pendência de cálculo nesta consulta.</p>
            )}
            <TabelaPendencias
              linhas={pendenciasAnimais}
              propriedadeId={s.filtros.propriedadeId}
            />
            {s.acompanhamento && (
              <IndicadoresAcompanhamento
                dados={s.acompanhamento}
                secao="pendencias"
                propriedadeId={s.filtros.propriedadeId}
              />
            )}
          </section>
        )}
        {s.sobraInicial && (
          <p role="status" className="text-sm text-muted-foreground">
            {s.sobraInicial.dias} dia(s) iniciais ({data(s.sobraInicial.inicio)}{" "}
            a {data(s.sobraInicial.fim)}) fora dos períodos completos de 21
            dias.
          </p>
        )}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Info size={15} aria-hidden="true" />
        Atualizado até {data(s.filtros.corte)} · Ausência de informação não é
        zero.
      </p>
    </div>
  );
}

function Contagens({ dados: c }: { dados: ContagensIndicadores }) {
  return (
    <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
      {Object.entries({
        "Vazias aptas no início": c.vaziasAptasInicio,
        "Negativas anteriores": c.negativasAnteriores,
        "Anteriores sem diagnóstico": c.anterioresSemDiagnostico,
        "Estimativa de vazias": c.estimativaVaziasAnteriores,
        "Saídas do PEV": c.saidasPev,
        "Contribuição do PEV": c.contribuicaoPev,
        "Elegíveis conhecidas": c.elegiveisConhecidas,
        "Elegíveis ponderadas": c.elegiveis,
        "Matrizes servidas": c.matrizesServidas,
        Tentativas: c.tentativas,
        Positivas: c.positivas,
        Negativas: c.negativas,
        "Sem diagnóstico": c.abertas,
        "Não classificáveis": c.naoClassificaveis,
        "Denominador concepção": c.denominadorConcepcao,
        "Elegibilidade pendente": c.animaisComPendenciaElegibilidade,
      }).map(([label, v]) => (
        <div className="contents" key={label}>
          <dt>{label}</dt>
          <dd className="text-right font-semibold">{numero(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
function DetalheAnimal({
  animal: a,
  propriedadeId,
}: {
  animal: DetalheAnimalIndicador;
  propriedadeId: number;
}) {
  const destino = `/pecuaria/rebanho/animais/${a.animalId}#reproducao`;
  return (
    <details className="border-t py-3 text-sm">
      <summary className="cursor-pointer">
        {a.brinco ?? "Sem brinco"}
        {a.nome ? ` · ${a.nome}` : ""} · contribuição{" "}
        {numero(a.contribuicaoElegiveis)} ·{" "}
        {descreverMotivo(a.origemElegibilidade)}
      </summary>
      <div className="space-y-2 pt-3">
        <a
          className="text-primary underline"
          href={urlConsultaComSitio(destino, propriedadeId)}
          onClick={(e) => {
            e.preventDefault();
            navegarConsultaComSitio(destino, propriedadeId);
          }}
        >
          Abrir ficha do animal
        </a>
        <p>
          Animal: {a.animalId} · Política:{" "}
          {a.elegibilidadeInicio.politicaVersao ?? "Sem versão vinculada"} ·
          Apta desde:{" "}
          {a.elegibilidadeInicio.aptaDesde
            ? data(a.elegibilidadeInicio.aptaDesde)
            : "Não informada"}
        </p>
        {a.motivos.map((m) => (
          <p key={m}>{descreverMotivo(m)}</p>
        ))}
        {[
          ...(a.tentativaAnterior ? [a.tentativaAnterior] : []),
          ...a.tentativas,
        ].map((t) => (
          <section className="border-t pt-2" key={t.id}>
            <p>
              {t.id === a.tentativaAnterior?.id
                ? "Tentativa anterior"
                : "Tentativa"}
              : {t.tipo} · {data(t.dataFactual)} · data analítica{" "}
              {data(t.dataAnalitica)} · {descreverMotivo(t.resultado)}
            </p>
            <p>
              ID: {t.id} · Resultado em:{" "}
              {t.resultadoEm ? data(t.resultadoEm) : "Sem diagnóstico"}
            </p>
            {t.motivos.map((m) => (
              <p key={m}>{descreverMotivo(m)}</p>
            ))}
            {t.evidencias.map((e) => (
              <p key={e.id}>
                Evidência: {descreverMotivo(e.tipo)} · {data(e.data)} · {e.id}
              </p>
            ))}
          </section>
        ))}
      </div>
    </details>
  );
}
function TabelaPendencias({
  linhas,
  propriedadeId,
}: {
  linhas: Array<{ p: PeriodoIndicadores; a: DetalheAnimalIndicador }>;
  propriedadeId: number;
}) {
  const [pagina, setPagina] = useState(1);
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm consulta-tabela">
          <caption className="pb-3 text-left font-semibold">
            Animais e participações a conferir
          </caption>
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3">Animal</th>
              <th className="p-3">Período</th>
              <th className="p-3">Motivos</th>
            </tr>
          </thead>
          <tbody>
            {linhas.slice((pagina - 1) * 10, pagina * 10).map(({ p, a }) => (
              <tr key={`${p.id}:${a.animalId}`} className="border-t">
                <td className="p-3">
                  <a
                    className="underline"
                    href={urlConsultaComSitio(
                      `/pecuaria/rebanho/animais/${a.animalId}#reproducao`,
                      propriedadeId,
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      navegarConsultaComSitio(
                        `/pecuaria/rebanho/animais/${a.animalId}#reproducao`,
                        propriedadeId,
                      );
                    }}
                  >
                    {a.brinco ?? "Sem brinco"} {a.nome}
                  </a>
                </td>
                <td className="whitespace-nowrap p-3">{periodoCompleto(p)}</td>
                <td className="p-3">
                  {a.motivos.length
                    ? a.motivos.map(descreverMotivo).join(" ")
                    : "Contribuição de elegibilidade não comprovada."}
                </td>
              </tr>
            ))}
            {!linhas.length && (
              <tr>
                <td className="p-3" colSpan={3}>
                  Nenhuma participação individual pendente nesta consulta.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Paginacao
        paginaAtual={pagina}
        totalPaginas={Math.max(1, Math.ceil(linhas.length / 10))}
        totalItens={linhas.length}
        itensPorPagina={10}
        onPaginaChange={setPagina}
        rotulo="participações pendentes"
        idSelect="indicadores-pagina-pendencias"
      />
    </>
  );
}

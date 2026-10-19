import { DateRangePicker } from "../../../components/DateRangePicker";
import { getHojeISO } from "../../../lib/hoje";
import { periodoPadrao, usePeriodoConsulta } from "./periodo-consulta";
import { PainelIndicadores } from "./PainelIndicadores";
import { IndicadoresAcompanhamento } from "./IndicadoresAcompanhamento";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Panel } from "../../../financeiro/financeiro-ui";
import { reqV4 } from "./api";
import { descreverMotivo } from "./elegibilidade-api";
import {
  abrirEmissaoIndicadores,
  consultarIndicadores,
  emitirIndicadores,
  exportarIndicadoresCsv,
  listarEmissoesIndicadores,
  type EmissaoIndicadores,
  type FiltrosIndicadores,
  type PeriodoIndicadores,
  type SnapshotIndicadoresReprodutivos,
} from "./indicadores-api";
export const numeroIndicador = (v: number | null) =>
  v === null
    ? "Não calculável"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v);
export const taxaIndicador = (v: number | null) =>
  v === null ? "Não calculável" : `${numeroIndicador(v)}%`;
const data = (v: string) => v.slice(0, 10).split("-").reverse().join("/");
function assinaturaFiltros(f: FiltrosIndicadores) {
  return JSON.stringify([f.propriedadeId, f.inicio, f.fim, f.corte, f.deslocamentoTeDias,
    f.janelaPerdaDias ?? null, f.iepModo ?? "VIVOS_NATIMORTOS", f.concepcaoEstimada ?? null,
    f.loteId ?? "", [...(f.tiposTentativa ?? [])].sort(), [...(f.papeis ?? [])].sort()]);
}
export function IndicadoresReprodutivos({
  propriedadeId,
  podeLancar,
  modo = "relatorio",
}: {
  propriedadeId: number;
  podeLancar: boolean;
  modo?: "painel" | "relatorio";
}) {
  const periodoConsulta = usePeriodoConsulta("indicadores");
  const [inicio, setInicio] = useState(
    () => periodoPadrao("indicadores").inicio,
  );
  const [fim, setFim] = useState(() => periodoPadrao("indicadores").fim);
  const [corte, setCorte] = useState(getHojeISO);
  const [q, setQ] = useState("");
  const [te, setTe] = useState("7");
  const [janelaPerda, setJanelaPerda] = useState("");
  const [iepModo, setIepModo] = useState<"VIVOS_NATIMORTOS" | "TODOS_PARTOS">(
    "VIVOS_NATIMORTOS",
  );
  const [lote, setLote] = useState("");
  const [lotes, setLotes] = useState<Array<{ id: string; nome: string }>>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [papeis, setPapeis] = useState<string[]>([]);
  const [snapshot, setSnapshot] =
    useState<SnapshotIndicadoresReprodutivos | null>(null);
  const [periodoId, setPeriodoId] = useState("");
  const [aba, setAba] = useState("resumo");
  const [emissoes, setEmissoes] = useState<EmissaoIndicadores[]>([]);
  const [emissao, setEmissao] = useState<EmissaoIndicadores | null>(null);
  const [erro, setErro] = useState("");
  const [erroEmissoes, setErroEmissoes] = useState("");
  const [carregandoEmissoes, setCarregandoEmissoes] = useState(false);
  const [avisoLotes, setAvisoLotes] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const ref = useRef(propriedadeId);
  ref.current = propriedadeId;
  const sequencia = useRef(0);
  const sequenciaEmissoes = useRef(0);
  const criteriosAplicados = useRef<FiltrosIndicadores | null>(null);
  const ultimaOperacao = useRef<(() => void) | null>(null);
  const chave = useRef<{ assinatura: string; chave: string } | null>(null);
  useEffect(() => {
    let ativo = true;
    setSnapshot(null);
    setEmissao(null);
    setEmissoes([]);
    setLotes([]);
    setAvisoLotes("");
    setLote("");
    setErro("");
    setErroEmissoes("");
    setCarregandoEmissoes(false);
    sequencia.current++;
    sequenciaEmissoes.current++;
    setOcupado(false);
    chave.current = null;
    criteriosAplicados.current = null;
    ultimaOperacao.current = null;
    if (modo === "relatorio") void carregarEmissoes();
    // O catálogo de lotes segue o mesmo escopo da emissão.
    void reqV4<Array<{ id: string; nome: string }>>(
      `/lotes?propriedadeId=${propriedadeId}`,
      undefined,
      "GET",
      propriedadeId,
    )
      .then((v) => {
        if (ativo && Array.isArray(v)) setLotes(v);
      })
      .catch(() => {
        if (ativo)
          setAvisoLotes(
            "Não foi possível carregar os lotes. A consulta permanece disponível para todos os lotes.",
          );
      });
    return () => {
      ativo = false;
      sequencia.current++;
      sequenciaEmissoes.current++;
    };
  }, [propriedadeId, modo]);
  const visivel =
    snapshot?.filtros.propriedadeId === propriedadeId ? snapshot : null;
  const periodo =
    visivel?.periodos.find((p) => p.id === periodoId) ?? visivel?.periodos[0];
  function filtros(): FiltrosIndicadores {
    return {
      propriedadeId,
      inicio: modo === "painel" ? periodoConsulta.inicio : inicio,
      fim: modo === "painel" ? periodoConsulta.fim : fim,
      corte: modo === "painel" ? getHojeISO() : corte,
      deslocamentoTeDias: Number(te),
      ...(janelaPerda !== "" ? { janelaPerdaDias: Number(janelaPerda) } : {}),
      iepModo,
      ...(q !== "" ? { concepcaoEstimada: Number(q) } : {}),
      ...(lote ? { loteId: lote } : {}),
      ...(tipos.length
        ? { tiposTentativa: tipos as FiltrosIndicadores["tiposTentativa"] }
        : {}),
      ...(papeis.length
        ? { papeis: papeis as FiltrosIndicadores["papeis"] }
        : {}),
    };
  }
  async function executar(
    acao: (atual: () => boolean) => Promise<void>,
    bloquear = true,
  ) {
    const pedido = ++sequencia.current;
    const atual = () =>
      sequencia.current === pedido && ref.current === propriedadeId;
    if (bloquear) setOcupado(true);
    setErro("");
    try {
      await acao(atual);
    } catch (e) {
      if (atual())
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível consultar os indicadores.",
        );
    } finally {
      if (bloquear && atual()) setOcupado(false);
    }
  }
  async function carregarEmissoes() {
    const pedido = ++sequenciaEmissoes.current;
    const atual = () => sequenciaEmissoes.current === pedido && ref.current === propriedadeId;
    setCarregandoEmissoes(true);
    setErroEmissoes("");
    try {
      const lista = await listarEmissoesIndicadores(propriedadeId);
      if (atual()) setEmissoes(lista);
    } catch (e) {
      if (atual()) setErroEmissoes(e instanceof Error ? e.message : "Não foi possível carregar as emissões.");
    } finally {
      if (atual()) setCarregandoEmissoes(false);
    }
  }
  function carregar(consulta = filtros()) {
    ultimaOperacao.current = () => carregar(consulta);
    setSnapshot(null);
    void executar(async (atual) => {
      const s = await consultarIndicadores(consulta);
      if (atual()) {
        setSnapshot(s);
        setEmissao(null);
        setPeriodoId(
          (modo === "painel" ? s.periodos.at(-1) : s.periodos[0])?.id ?? "",
        );
      }
    });
  }
  useEffect(() => {
    if (modo === "painel") {
      const consulta = {
        ...(criteriosAplicados.current ?? {
          deslocamentoTeDias: 7,
          iepModo: "VIVOS_NATIMORTOS" as const,
          corte: getHojeISO(),
        }),
        propriedadeId,
        inicio: periodoConsulta.inicio,
        fim: periodoConsulta.fim,
      };
      consulta.corte = getHojeISO();
      carregar(consulta);
    }
    // Filtros avançados só são aplicados por confirmação; o período recarrega automaticamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propriedadeId, modo, periodoConsulta.inicio, periodoConsulta.fim]);
  function aplicar(e: FormEvent) {
    e.preventDefault();
    const consulta = filtros();
    criteriosAplicados.current = consulta;
    carregar(consulta);
  }
  function abrirEmissao(id: string) {
    ultimaOperacao.current = () => abrirEmissao(id);
    setSnapshot(null);
    void executar(async (atual) => {
      const v = await abrirEmissaoIndicadores(id, propriedadeId);
      if (atual()) {
        setSnapshot(v.snapshot);
        const f = v.snapshot.filtros;
        setInicio(f.inicio);
        setFim(f.fim);
        setCorte(f.corte);
        setQ(f.concepcaoEstimada == null ? "" : String(f.concepcaoEstimada));
        setTe(String(f.deslocamentoTeDias));
        setJanelaPerda(
          f.janelaPerdaDias == null ? "" : String(f.janelaPerdaDias),
        );
        setIepModo(f.iepModo ?? "VIVOS_NATIMORTOS");
        setLote(f.loteId ?? "");
        setTipos(f.tiposTentativa ?? []);
        setPapeis(f.papeis ?? []);
        setEmissao(v);
        setPeriodoId(v.snapshot.periodos[0]?.id ?? "");
      }
    });
  }
  function emitir() {
    if (!visivel) return;
    ultimaOperacao.current = emitir;
    const f = visivel.filtros;
    const assinatura = JSON.stringify(f);
    if (chave.current?.assinatura !== assinatura)
      chave.current = { assinatura, chave: crypto.randomUUID() };
    const id = chave.current.chave;
    void executar(async (atual) => {
      const e = await emitirIndicadores(f, id);
      if (atual()) {
        setEmissao(e);
        setSnapshot(e.snapshot);
        void carregarEmissoes();
      }
    });
  }
  function exportar() {
    if (!visivel) return;
    const url = URL.createObjectURL(
      new Blob([exportarIndicadoresCsv(visivel)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `indicadores-${visivel.filtros.inicio}-${visivel.filtros.fim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const alternar = (valores: string[], v: string) =>
    valores.includes(v) ? valores.filter((x) => x !== v) : [...valores, v];
  const filtrosAlterados = modo === "relatorio" && !!visivel && assinaturaFiltros(filtros()) !== assinaturaFiltros(visivel.filtros);
  return (
    <section className="space-y-5">
      <div className="space-y-5 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {modo === "painel" ? <h1 className="text-3xl font-semibold tracking-tight">Indicadores reprodutivos</h1> : <h2 className="text-2xl font-semibold">Desempenho reprodutivo</h2>}
            <p className="text-muted-foreground">
              {modo === "painel"
                ? "Resultados do rebanho e qualidade dos registros"
                : "Entenda os resultados e os animais considerados em cada período."}
            </p>
          </div>
          {modo === "painel" && (
            <DateRangePicker
              value={periodoConsulta.range}
              onChange={periodoConsulta.alterar}
            />
          )}
        </div>
        {modo === "painel" && periodoConsulta.aviso && (
          <p
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
          >
            {periodoConsulta.aviso}
          </p>
        )}
        <form
          onSubmit={aplicar}
          className={
            modo === "painel"
              ? "space-y-3 print:hidden"
              : "space-y-4 rounded-xl border bg-card p-5 print:hidden"
          }
        >
          {modo === "relatorio" && (
            <>
            <div><h3 className="font-semibold">Filtros da consulta</h3><p className="text-sm text-muted-foreground">Defina o período e o corte dos resultados. Os critérios são aplicados ao confirmar a consulta.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Início
                <Input
                  type="date"
                  required
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                />
              </label>
              <label>
                Fim
                <Input
                  type="date"
                  required
                  min={inicio}
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                />
              </label>
            </div>
            </>
          )}
          <details open={modo === "relatorio" ? true : undefined}>
            <summary
              className={
                modo === "painel"
                  ? "w-fit cursor-pointer rounded-lg border bg-card px-4 py-2 text-sm font-semibold"
                  : "cursor-pointer font-semibold"
              }
            >
              Filtros avançados
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label>
                Janela de perdas desde o primeiro DG positivo (dias, opcional)
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={janelaPerda}
                  onChange={(e) => setJanelaPerda(e.target.value)}
                  placeholder="Sem janela: contagens"
                />
              </label>
              <label>
                Intervalo entre partos
                <select
                  className="h-10 w-full min-w-0 rounded-md border bg-card px-3"
                  value={iepModo}
                  onChange={(e) => setIepModo(e.target.value as typeof iepModo)}
                >
                  <option value="VIVOS_NATIMORTOS">
                    Vivos e natimortos comprovados
                  </option>
                  <option value="TODOS_PARTOS">
                    Todos os partos (alternativa)
                  </option>
                </select>
              </label>
              {modo === "relatorio" && (
                <label>
                  Corte dos resultados
                  <Input
                    type="date"
                    required
                    min={fim}
                    value={corte}
                    onChange={(e) => setCorte(e.target.value)}
                  />
                </label>
              )}
              <label>
                Concepção estimada (%) — opcional
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  placeholder="Sem estimativa"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
              <label>
                Deslocamento analítico da TE (dias)
                <Input
                  type="number"
                  required
                  min="0"
                  max="30"
                  value={te}
                  onChange={(e) => setTe(e.target.value)}
                />
              </label>
              <label>
                Lote
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={lote}
                  onChange={(e) => setLote(e.target.value)}
                >
                  <option value="">Todos os lotes</option>
                  {lotes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend>Tentativas (sem seleção: todas)</legend>
                {["IA", "TE", "COBERTURA"].map((t) => (
                  <label className="mr-3 inline-flex gap-1" key={t}>
                    <input
                      type="checkbox"
                      checked={tipos.includes(t)}
                      onChange={() => setTipos(alternar(tipos, t))}
                    />
                    {t === "COBERTURA" ? "Cobertura" : t}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Papel (sem seleção: todos)</legend>
                {["NENHUM", "DOADORA", "RECEPTORA"].map((t) => (
                  <label className="mr-3 inline-flex gap-1" key={t}>
                    <input
                      type="checkbox"
                      checked={papeis.includes(t)}
                      onChange={() => setPapeis(alternar(papeis, t))}
                    />
                    {t === "NENHUM"
                      ? "Nenhum"
                      : t === "DOADORA"
                        ? "Doadora"
                        : "Receptora"}
                  </label>
                ))}
              </fieldset>
              <Button disabled={ocupado} type="submit">
                {ocupado ? "Consultando…" : "Aplicar"}
              </Button>
              <p className="text-sm text-muted-foreground sm:col-span-3">
                A estimativa é uma escolha explícita para ponderar tentativas
                anteriores sem diagnóstico. Deixá-la em branco conserva essa
                pendência.
              </p>
            </div>
          </details>
        </form>
        {ocupado && <p role="status">Carregando indicadores…</p>}
        {erro && (
          <Button variant="outline" onClick={() => ultimaOperacao.current?.()}>
            Tentar novamente
          </Button>
        )}
        {avisoLotes && (
          <p role="status" className="text-sm text-muted-foreground">
            {avisoLotes}
          </p>
        )}
        {erro && (
          <p role="alert" className="rounded-md border border-destructive p-3">
            {erro}
          </p>
        )}
        {modo === "relatorio" && (
          <Panel className="space-y-3 p-5 print:hidden">
            <div><h3 className="font-semibold">Histórico de emissões e exportação</h3><p className="text-sm text-muted-foreground">Emissões preservadas mantêm os dados e critérios originais, sem recalcular os fatos atuais.</p></div>
            {carregandoEmissoes && <p role="status" className="text-sm text-muted-foreground">Carregando emissões…</p>}
            {erroEmissoes && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{erroEmissoes}</p><Button variant="outline" onClick={() => void carregarEmissoes()}>Tentar carregar emissões</Button></div>}
          <div className="flex flex-wrap items-end gap-3">
            <label>
              Emissões preservadas{" "}
              <select
                aria-label="Emissões preservadas"
                className="mt-1 block w-full rounded border bg-card p-2"
                value={emissao?.id ?? ""}
                disabled={ocupado}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) abrirEmissao(id);
                }}
              >
                <option value="">Selecione uma emissão</option>
                {emissoes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {new Date(e.criadoEm).toLocaleString("pt-BR")}
                  </option>
                ))}
              </select>
            </label>
            {modo === "relatorio" && visivel && (
              <>
                <Button variant="outline" onClick={exportar}>
                  Exportar CSV
                </Button>
                {podeLancar && (
                  <Button disabled={ocupado || !!emissao} onClick={emitir}>
                    Preservar emissão
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={!emissao}
                  onClick={() => window.print()}
                >
                  Imprimir emissão
                </Button>
              </>
            )}
          </div>
          </Panel>
        )}
        {modo === "relatorio" && !visivel && !ocupado && <Panel className="p-5"><p className="text-sm text-muted-foreground">{inicio && fim ? "O período inicial já está preenchido. Use Aplicar para consultar os indicadores ou ajuste os critérios acima." : "Defina o período acima e use Aplicar para consultar os indicadores."}</p></Panel>}
        {modo === "painel" && visivel && (
          <PainelIndicadores
            key={JSON.stringify(visivel.filtros)}
            snapshot={visivel}
          />
        )}
        {modo === "relatorio" && visivel && (
          <>
            <Panel className="space-y-3 p-5">
            <h3 className="font-semibold">Resultado exibido</h3>
            <p className="text-sm">
              {emissao
                ? `Emissão preservada em ${new Date(emissao.criadoEm).toLocaleString("pt-BR")}`
                : "Consulta atual — preserve uma emissão para reimprimir estes resultados."}{" "}
              · Corte: {data(visivel.filtros.corte)}
            </p>
            <p className="text-sm text-muted-foreground">
              Filtros aplicados: {data(visivel.filtros.inicio)} a{" "}
              {data(visivel.filtros.fim)} · Concepção estimada:{" "}
              {visivel.metodologia.concepcaoEstimada === null
                ? "Não informada"
                : `${visivel.metodologia.concepcaoEstimada}%`}{" "}
              · Deslocamento TE: {visivel.metodologia.deslocamentoTeDias} dias.
            </p>
            {filtrosAlterados && <p className="rounded-lg border bg-muted p-3 text-sm">Os filtros editados ainda não foram aplicados. O resultado e as exportações mantêm os critérios exibidos; use Aplicar para atualizar a consulta.</p>}
            </Panel>
            {visivel.acompanhamento && <Panel className="min-w-0 p-5"><IndicadoresAcompanhamento dados={visivel.acompanhamento} propriedadeId={propriedadeId}/></Panel>}
            <div
              role="tablist"
              aria-label="Conteúdo do relatório"
              className="flex flex-wrap gap-2 print:hidden"
            >
              {[
                ["resumo", "Resumo por período"],
                ["animais", "Animais considerados"],
                ["criterios", "Critérios de cálculo"],
              ].map(([id, nome]) => (
                <Button
                  role="tab"
                  aria-selected={aba === id}
                  key={id}
                  variant={aba === id ? "default" : "outline"}
                  onClick={() => setAba(id)}
                >
                  {nome}
                </Button>
              ))}
            </div>
            {visivel.sobraInicial && (
              <p className="rounded border bg-muted p-3">
                {visivel.sobraInicial.dias} dia(s) iniciais (
                {data(visivel.sobraInicial.inicio)} a{" "}
                {data(visivel.sobraInicial.fim)}) fora dos períodos completos de
                21 dias.
              </p>
            )}
            {visivel.pendencias.length > 0 && (
              <div
                role="status"
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950"
              >
                {visivel.pendencias.map((p) => (
                  <p key={p}>{descreverMotivo(p)}</p>
                ))}
              </div>
            )}
            {aba === "criterios" ? (
              <div className="rounded-xl border bg-card p-5">
                <h3 className="font-semibold">{visivel.metodologia.rotulo}</h3>
                <p>{visivel.versaoMetodologia}</p>
                <p>
                  Não há certificação de equivalência integral ao IDEAGRI/IILB.
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  {visivel.metodologia.regras.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p>
                  Concepção estimada:{" "}
                  {visivel.metodologia.concepcaoEstimada === null
                    ? "Não informada"
                    : `${visivel.metodologia.concepcaoEstimada}%`}
                  . Deslocamento TE: {visivel.metodologia.deslocamentoTeDias}{" "}
                  dias.
                </p>
                {visivel.metodologia.fontes.map((f) => (
                  <p key={f}>
                    <a
                      className="underline"
                      href={f}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Referência metodológica
                    </a>
                  </p>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="overflow-x-auto rounded-xl border bg-card">
                  <table className="w-full text-left text-sm">
                    <caption className="p-4 text-left text-lg font-semibold">
                      Desempenho por período de 21 dias
                    </caption>
                    <thead className="bg-muted/50">
                      <tr>
                        {[
                          "Período",
                          "Elegíveis ponderadas",
                          "Tentativas",
                          "Positivas",
                          "Sem diagnóstico",
                          "Serviço",
                          "Concepção",
                          "Prenhez",
                        ].map((t) => (
                          <th className="p-3" key={t}>
                            {t}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visivel.periodos.map((p) => (
                        <LinhaPeriodo
                          key={p.id}
                          p={p}
                          selecionado={p.id === periodo?.id}
                          selecionar={() => setPeriodoId(p.id)}
                        />
                      ))}
                      <tr className="border-t bg-muted/50 font-semibold">
                        <td className="p-3">Total recalculado</td>
                        <td>
                          {numeroIndicador(visivel.totais.contagens.elegiveis)}
                        </td>
                        <td>{visivel.totais.contagens.tentativas}</td>
                        <td>{visivel.totais.contagens.positivas}</td>
                        <td>{visivel.totais.contagens.abertas}</td>
                        <td>{taxaIndicador(visivel.totais.taxas.servico)}</td>
                        <td>{taxaIndicador(visivel.totais.taxas.concepcao)}</td>
                        <td>{taxaIndicador(visivel.totais.taxas.prenhez)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="p-4 text-sm text-muted-foreground">
                    Elegíveis são participações ponderadas por período.{" "}
                    {visivel.totais.animaisUnicos} animais únicos;{" "}
                    {visivel.totais.participacoesAnimalPeriodo} participações
                    animal-período. Totais não são médias dos percentuais.
                  </p>
                </div>
                {periodo && (
                  <aside className="space-y-3 rounded-xl border bg-card p-5">
                    <h3 className="font-semibold">
                      {data(periodo.inicio)} a {data(periodo.fim)}
                    </h3>
                    <dl className="grid grid-cols-2 gap-2">
                      {Object.entries({
                        "Vazias aptas no início":
                          periodo.contagens.vaziasAptasInicio,
                        "Negativas anteriores":
                          periodo.contagens.negativasAnteriores,
                        "Anteriores sem diagnóstico":
                          periodo.contagens.anterioresSemDiagnostico,
                        "Estimativa de vazias":
                          periodo.contagens.estimativaVaziasAnteriores,
                        "Saídas do PEV": periodo.contagens.saidasPev,
                        "Contribuição do PEV":
                          periodo.contagens.contribuicaoPev,
                        "Elegíveis conhecidas":
                          periodo.contagens.elegiveisConhecidas,
                        "Elegíveis ponderadas": periodo.contagens.elegiveis,
                        "Matrizes servidas": periodo.contagens.matrizesServidas,
                        "Denominador concepção":
                          periodo.contagens.denominadorConcepcao,
                        Negativas: periodo.contagens.negativas,
                        "Não classificáveis":
                          periodo.contagens.naoClassificaveis,
                        "Elegibilidade pendente":
                          periodo.contagens.animaisComPendenciaElegibilidade,
                      }).map(([k, v]) => (
                        <div className="contents" key={k}>
                          <dt>{k}</dt>
                          <dd className="text-right font-semibold">
                            {numeroIndicador(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="border-t pt-3 text-sm">
                      Corte {data(periodo.maturidade.corte)} ·{" "}
                      {periodo.maturidade.diasAposFim} dias após o fim ·{" "}
                      {periodo.maturidade.tentativasAbertas} tentativas abertas.
                    </p>
                    <Button variant="outline" onClick={() => setAba("animais")}>
                      Ver animais e tentativas
                    </Button>
                  </aside>
                )}
                {aba === "animais" && periodo && (
                  <div className="space-y-3 xl:col-span-2">
                    <h3 className="font-semibold">
                      Animais considerados no período selecionado
                    </h3>
                    {periodo.detalhamento.length === 0 && (
                      <p>Nenhum animal neste período.</p>
                    )}
                    {periodo.detalhamento.map((a) => (
                      <details
                        key={a.animalId}
                        className="rounded-lg border bg-card p-4"
                      >
                        <summary className="cursor-pointer">
                          {a.brinco ?? "Sem brinco"} {a.nome ?? ""} ·
                          contribuição{" "}
                          {numeroIndicador(a.contribuicaoElegiveis)} ·{" "}
                          {descreverMotivo(a.origemElegibilidade)}
                        </summary>
                        <p>
                          Animal: {a.animalId} · Política:{" "}
                          {a.elegibilidadeInicio.politicaVersao ??
                            "Sem versão vinculada"}{" "}
                          · Apta desde:{" "}
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
                          <div className="mt-2 border-t pt-2" key={t.id}>
                            <p>
                              {t.id === a.tentativaAnterior?.id
                                ? "Tentativa anterior"
                                : "Tentativa"}
                              : {t.tipo} · {data(t.dataFactual)} · data
                              analítica {data(t.dataAnalitica)} ·{" "}
                              {descreverMotivo(t.resultado)}
                            </p>
                            <p>
                              ID: {t.id} · Resultado em:{" "}
                              {t.resultadoEm
                                ? data(t.resultadoEm)
                                : "Sem diagnóstico"}
                            </p>
                            {t.motivos.map((m) => (
                              <p key={m}>{descreverMotivo(m)}</p>
                            ))}
                            {t.evidencias.map((e) => (
                              <p key={e.id}>
                                Evidência: {descreverMotivo(e.tipo)} ·{" "}
                                {data(e.data)} · {e.id}
                              </p>
                            ))}
                          </div>
                        ))}
                      </details>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {modo === "relatorio" && emissao && visivel && (
        <ImpressaoIndicadores emissao={emissao} snapshot={visivel} />
      )}
    </section>
  );
}
function LinhaPeriodo({
  p,
  selecionado,
  selecionar,
}: {
  p: PeriodoIndicadores;
  selecionado: boolean;
  selecionar: () => void;
}) {
  return (
    <tr className={`border-t ${selecionado ? "bg-primary/10" : ""}`}>
      <td className="p-3">
        <button
          className="text-left underline underline-offset-4"
          onClick={selecionar}
          aria-pressed={selecionado}
        >
          {data(p.inicio)} a {data(p.fim)}
        </button>
      </td>
      <td className="p-3">{numeroIndicador(p.contagens.elegiveis)}</td>
      <td className="p-3">{p.contagens.tentativas}</td>
      <td className="p-3">{p.contagens.positivas}</td>
      <td className="p-3">{p.contagens.abertas}</td>
      <td className="p-3">{taxaIndicador(p.taxas.servico)}</td>
      <td className="p-3">{taxaIndicador(p.taxas.concepcao)}</td>
      <td className="p-3">{taxaIndicador(p.taxas.prenhez)}</td>
    </tr>
  );
}

function ImpressaoIndicadores({
  emissao,
  snapshot: s,
}: {
  emissao: EmissaoIndicadores;
  snapshot: SnapshotIndicadoresReprodutivos;
}) {
  return (
    <div className="hidden space-y-4 print:block">
      <h2 className="text-2xl font-semibold">Desempenho reprodutivo</h2>
      <p>
        Emissão {emissao.id} ·{" "}
        {new Date(emissao.criadoEm).toLocaleString("pt-BR")} · Sítio{" "}
        {s.filtros.propriedadeId}
      </p>
      <p>
        Período: {data(s.filtros.inicio)} a {data(s.filtros.fim)} · Corte dos
        resultados: {data(s.filtros.corte)}
      </p>
      <p>
        {s.metodologia.rotulo} · {s.versaoMetodologia}
      </p>
      <p>
        Concepção estimada:{" "}
        {s.metodologia.concepcaoEstimada === null
          ? "Não informada"
          : `${s.metodologia.concepcaoEstimada}%`}{" "}
        · Deslocamento TE: {s.metodologia.deslocamentoTeDias} dias
      </p>
      <p>
        Lote: {s.filtros.loteId ?? "Todos"} · Tentativas:{" "}
        {s.filtros.tiposTentativa?.join(", ") ?? "Todas"} · Papéis:{" "}
        {s.filtros.papeis?.join(", ") ?? "Todos"}
      </p>
      {s.acompanhamento && (
        <IndicadoresAcompanhamento dados={s.acompanhamento} />
      )}
      {s.sobraInicial && (
        <p>
          Sobra inicial excluída: {data(s.sobraInicial.inicio)} a{" "}
          {data(s.sobraInicial.fim)} ({s.sobraInicial.dias} dias)
        </p>
      )}
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {[
              "Período",
              "Elegíveis",
              "Servidas",
              "Tentativas",
              "Positivas",
              "Sem diagnóstico",
              "Serviço",
              "Concepção",
              "Prenhez",
            ].map((t) => (
              <th className="border p-2" key={t}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ...s.periodos.map((p) => ({
              rotulo: `${data(p.inicio)} a ${data(p.fim)}`,
              contagens: p.contagens,
              taxas: p.taxas,
            })),
            { rotulo: "Total recalculado", ...s.totais },
          ].map((p) => (
            <tr key={p.rotulo}>
              <td className="border p-2">{p.rotulo}</td>
              {[
                p.contagens.elegiveis,
                p.contagens.matrizesServidas,
                p.contagens.tentativas,
                p.contagens.positivas,
                p.contagens.abertas,
              ].map((v, i) => (
                <td className="border p-2" key={i}>
                  {numeroIndicador(v)}
                </td>
              ))}
              {[p.taxas.servico, p.taxas.concepcao, p.taxas.prenhez].map(
                (v, i) => (
                  <td className="border p-2" key={i}>
                    {taxaIndicador(v)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        {s.totais.animaisUnicos} animais únicos ·{" "}
        {s.totais.participacoesAnimalPeriodo} participações animal-período.
      </p>
      {s.pendencias.map((p) => (
        <p key={p}>{descreverMotivo(p)}</p>
      ))}
      <details open>
        <summary>Critérios preservados nesta emissão</summary>
        {s.metodologia.regras.map((r) => (
          <p key={r}>{r}</p>
        ))}
      </details>
      {s.periodos.map((p) => (
        <div className="space-y-2" key={p.id}>
          <h3 className="font-semibold">
            Conferência: {data(p.inicio)} a {data(p.fim)}
          </h3>
          <p>
            Vazias aptas: {p.contagens.vaziasAptasInicio}; negativas anteriores:{" "}
            {p.contagens.negativasAnteriores}; anteriores sem diagnóstico:{" "}
            {p.contagens.anterioresSemDiagnostico}; estimativa de vazias:{" "}
            {numeroIndicador(p.contagens.estimativaVaziasAnteriores)};
            contribuição PEV: {numeroIndicador(p.contagens.contribuicaoPev)};
            denominador concepção: {p.contagens.denominadorConcepcao}.
          </p>
          {p.detalhamento.map((a) => (
            <p key={a.animalId}>
              {a.brinco ?? a.animalId} {a.nome ?? ""} · contribuição{" "}
              {numeroIndicador(a.contribuicaoElegiveis)} · política{" "}
              {a.elegibilidadeInicio.politicaVersao ?? "Não vinculada"} ·{" "}
              {a.motivos.map(descreverMotivo).join("; ")}. Tentativas:{" "}
              {a.tentativas
                .map(
                  (t) =>
                    `${t.tipo} ${data(t.dataFactual)} (${descreverMotivo(t.resultado)}; ${t.id})`,
                )
                .join("; ") || "Nenhuma no período"}
              .
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

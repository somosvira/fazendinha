import {DetalhesIndicadoresVisuais} from "./DetalhesIndicadoresVisuais";
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator} from "@/components/ui/dropdown-menu";
import {Card} from "@/components/ui/card";
import {CalendarDays,FileText,Download,History,Archive} from "lucide-react";
import {DatePicker} from "@/components/DatePicker";
import {ControleRelatorio} from "../../relatorios/ControlesRelatorio";
import {SelectCampo} from "@/financeiro/SelectCampo";
import {AjudaCampo} from "@/components/Dica";
import { ConsultaIndicadoresOperacionais } from "./ConsultaIndicadoresOperacionais";
import { DateRangePicker } from "../../../components/DateRangePicker";
import { getHojeISO } from "../../../lib/hoje";
import { periodoPadrao, usePeriodoConsulta } from "./periodo-consulta";
import { PainelIndicadores } from "./PainelIndicadores";
import { IndicadoresAcompanhamento } from "./IndicadoresAcompanhamento";
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Panel } from "../../../financeiro/financeiro-ui";
import { reqV4 } from "./api";
import {
  abrirEmissaoIndicadores,
  consultarIndicadores,
  emitirIndicadores,
  exportarIndicadoresCsv,
  listarEmissoesIndicadores,
  type EmissaoIndicadores,
  type FiltrosIndicadores,
  type SnapshotIndicadoresReprodutivos,
} from "./indicadores-api";
const PreviaIndicadoresPDF=lazy(()=>import("./PreviaIndicadoresPDF"));
function GrupoFiltrosIndicadores({ relatorio, children }: { relatorio: boolean; children: ReactNode }) {
  return relatorio ? <div>{children}</div> : <details><summary className="w-fit cursor-pointer rounded-lg border bg-card px-4 py-2 text-sm font-semibold">Filtros avançados</summary>{children}</details>;
}
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
function RelatorioIndicadores({
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
  const [previaPDF,setPreviaPDF]=useState(false);
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
    setPreviaPDF(false);
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
    if (modo === "painel" || modo === "relatorio") {
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
  const formularioPeriodo = (<ControleRelatorio tipo="filtros" ativo={modo === "relatorio"}><form
          onSubmit={aplicar}
          className={
            modo === "painel"
              ? "space-y-3 print:hidden"
              : "space-y-4 rounded-xl border bg-card p-5 print:hidden"
          }
        >
          {modo === "relatorio" && (
            <>

            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Início
                <DatePicker
                  required
                  value={inicio}
                  onChange={setInicio}/>
              </label>
              <label>
                Fim
                <DatePicker
                  required
                  min={inicio}
                  value={fim}
                  onChange={setFim}/>
              </label>
            </div>
            </>
          )}
          <GrupoFiltrosIndicadores relatorio={modo === "relatorio"}>
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
                <SelectCampo
                  className="h-10 w-full min-w-0 rounded-md border bg-card px-3"
                  value={iepModo}
                  onValueChange={(v) => setIepModo(v as typeof iepModo)}
                >
                  <option value="VIVOS_NATIMORTOS">
                    Vivos e natimortos comprovados
                  </option>
                  <option value="TODOS_PARTOS">
                    Todos os partos (alternativa)
                  </option>
                </SelectCampo>
              </label>
              {modo === "relatorio" && (
                <label>
                  Corte dos resultados
                  <DatePicker
                    required
                    min={fim}
                    value={corte}
                    onChange={setCorte}/>
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
                <SelectCampo
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={lote}
                  onValueChange={setLote}
                >
                  <option value="">Todos os lotes</option>
                  {lotes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </SelectCampo>
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
              <AjudaCampo rotulo="Sobre a estimativa de concepção" texto="A estimativa é uma escolha explícita para ponderar tentativas anteriores sem diagnóstico. Deixá-la em branco conserva essa pendência."/>
            </div>
          </GrupoFiltrosIndicadores>
        </form></ControleRelatorio>);
  return (
    <section className="rel-indicadores space-y-5">
      <div className="space-y-5 print:hidden">
        {modo === "painel" && <div className="flex flex-wrap items-center justify-end gap-4">
          {modo === "painel" && (
            <DateRangePicker
              value={periodoConsulta.range}
              onChange={periodoConsulta.alterar}
            />
          )}
        </div>}
        {modo === "painel" && periodoConsulta.aviso && (
          <p
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
          >
            {periodoConsulta.aviso}
          </p>
        )}
        <div className={modo === "relatorio" ? "rel-consulta-toolbar" : undefined}>

        {modo === "relatorio" ? <Card className="rel-periodo-compacto">{visivel&&<><CalendarDays size={19} aria-hidden/><strong>{data(visivel.filtros.inicio)} a {data(visivel.filtros.fim)}</strong><span className="sr-only">{emissao ? `Emissão preservada em ${new Date(emissao.criadoEm).toLocaleString("pt-BR")}` : "Consulta atual"}</span></>}{formularioPeriodo}{filtrosAlterados&&<AjudaCampo rotulo="Filtros ainda não aplicados" texto="Há filtros editados ainda não aplicados. O resultado mantém o período consultado."/>}</Card> : formularioPeriodo}
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
          <ControleRelatorio tipo="emissoes" gatilho={abrir=><div className="rel-acoes-icones">
            <Button variant="outline" size="icon" aria-label="Ver prévia do PDF" title="Ver prévia do PDF" disabled={!visivel||ocupado} onClick={()=>setPreviaPDF(true)}><FileText size={18}/></Button>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Exportar relatório" title="Exportar relatório"><Download size={18}/></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
              <DropdownMenuItem disabled={!visivel||ocupado} onSelect={exportar}><Download/>Exportar CSV</DropdownMenuItem>
              {podeLancar&&<DropdownMenuItem disabled={!visivel||ocupado||!!emissao} onSelect={()=>void emitir()}><Archive/>Preservar emissão</DropdownMenuItem>}
              <DropdownMenuSeparator/><DropdownMenuItem onSelect={abrir}><History/>Emissões anteriores</DropdownMenuItem>
            </DropdownMenuContent></DropdownMenu>
          </div>}><Panel className="space-y-3 p-5 print:hidden">
            <div><h3 className="font-semibold">Histórico de emissões e exportação</h3><p className="text-sm text-muted-foreground">Emissões preservadas mantêm os dados e critérios originais, sem recalcular os fatos atuais.</p></div>
            {carregandoEmissoes && <p role="status" className="text-sm text-muted-foreground">Carregando emissões…</p>}
            {erroEmissoes && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{erroEmissoes}</p><Button variant="outline" onClick={() => void carregarEmissoes()}>Tentar carregar emissões</Button></div>}
          <div className="flex flex-wrap items-end gap-3">
            <label>
              Emissões preservadas{" "}
              <SelectCampo
                aria-label="Emissões preservadas"
                className="mt-1 block w-full rounded border bg-card p-2"
                value={emissao?.id ?? ""}
                disabled={ocupado}
                onValueChange={(id) => {
                  if (id) abrirEmissao(id);
                }}
              >
                <option value="">Selecione uma emissão</option>
                {emissoes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {new Date(e.criadoEm).toLocaleString("pt-BR")}
                  </option>
                ))}
              </SelectCampo>
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
                  onClick={() => setPreviaPDF(true)}
                >
                  Imprimir emissão
                </Button>
              </>
            )}
          </div>
          </Panel></ControleRelatorio>
        )}
        </div>
        {modo === "painel" && visivel && (
          <PainelIndicadores
            key={JSON.stringify(visivel.filtros)}
            snapshot={visivel}
          />
        )}
        {modo === "relatorio" && visivel && (
          <>
            <PainelIndicadores key={`resultado:${JSON.stringify(visivel.filtros)}`} snapshot={visivel} mostrarMetodo={false} exibirDesempenho={false} mostrarPeriodo={false}/>
            <div
              role="tablist"
              aria-label="Conteúdo do relatório"
              className="abas-pasta print:hidden"
            >
              {[
                ["resumo", "Desempenho por período"],
                ["bases", "Bases e contagens"],
                ...(visivel.acompanhamento ? [["acompanhamento", "Acompanhamento"]] : []),
                ["animais", "Animais considerados"],

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
            {aba === "acompanhamento" && visivel.acompanhamento ? <Panel className="min-w-0 p-5"><IndicadoresAcompanhamento dados={visivel.acompanhamento} propriedadeId={propriedadeId}/></Panel> : aba === "resumo" ? <PainelIndicadores key={JSON.stringify(visivel.filtros)} snapshot={visivel} mostrarMetodo={false} exibirResultado={false}/> : <DetalhesIndicadoresVisuais key={`${aba}:${JSON.stringify(visivel.filtros)}`} snapshot={visivel} aba={aba==='animais'?'animais':'bases'} periodo={periodo} selecionar={setPeriodoId} verAnimais={()=>setAba('animais')}/>}
          </>
        )}
      </div>
      {modo === "relatorio" && previaPDF && visivel && <Suspense fallback={<p role="status">Preparando prévia do PDF…</p>}><PreviaIndicadoresPDF key={`${propriedadeId}:${emissao?.id??'consulta'}`} snapshot={visivel} emissao={emissao} fechar={()=>setPreviaPDF(false)} ocupado={ocupado} preservar={podeLancar&&!emissao?()=>void emitir():undefined}/></Suspense>}
    </section>
  );
}
export function IndicadoresReprodutivos(props: { propriedadeId: number; podeLancar: boolean; modo?: "painel" | "relatorio" }) {
  return props.modo === "painel" ? <ConsultaIndicadoresOperacionais propriedadeId={props.propriedadeId}/> : <RelatorioIndicadores {...props}/>;
}

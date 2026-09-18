import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FileDown, Trash2 } from "lucide-react";
import { MultiSelect, type MultiSelectOption } from "@/components/MultiSelect";
import { DateRangePicker, type DateRange } from "@/components/DateRangePicker";
import { getPropriedadeAtiva } from "../propriedadeScope";
import { usePropriedades } from "../rebanho/api";
import { descartarRascunhoRelatorioFinanceiro, gerarRelatorioFinanceiro, salvarPdfRelatorioFinanceiro, salvarRascunhoRelatorioFinanceiro, type ConfiguracaoRelatorioFinanceiro, type ConfiguracoesFinanceiras, type RascunhoRelatorioFinanceiro, type RelatorioFinanceiro } from "./novo-api";
import { Button, ErrorBox, ReviewLine, TIPO_OPERACAO } from "./financeiro-ui";
import { marcarEdicaoRascunhoRelatorio } from "./rascunhoRelatorioAtivo";
import { CLASSIFICACOES_RELATORIO, REGIMES_RELATORIO, SEM_CATEGORIA, SEM_CENTRO, STATUS_RELATORIO, TIPOS_RELATORIO, configuracaoPadrao, erroPeriodo, isoLocal, mesclarRascunho, podeGerar, resumoConfiguracao, secoesDoRelatorio } from "./lib/relatorios";

const CAMPO = "mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-normal";
const TITULO_SECAO = "mb-3 text-xs font-semibold uppercase tracking-[.12em] text-ink-3";
const mensagem = (falha: unknown) => falha instanceof Error ? falha.message : String(falha);
const dateFromIso = (iso: string): Date | null => {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return ano && mes && dia ? new Date(ano, mes - 1, dia) : null;
};

type Estado = "ALTERADO" | "SALVANDO" | "SALVO" | "ERRO";
type OpcaoNumero = readonly [number, string];
const opcoesMultiSelect = <T extends string | number>(opcoes: readonly (readonly [T, string])[]): MultiSelectOption<T>[] =>
  opcoes.map(([value, label]) => ({ value, label }));

export function NovoRelatorioFinanceiro({ cadastros, rascunho, onVoltar, onGerado }: {
  cadastros: ConfiguracoesFinanceiras;
  rascunho: RascunhoRelatorioFinanceiro | null;
  onVoltar: () => void;
  onGerado: (relatorio: RelatorioFinanceiro, avisoDownload: string | null) => void;
}) {
  const [config, setConfig] = useState(() => mesclarRascunho(rascunho?.configuracao));
  const [estado, setEstado] = useState<Estado>(rascunho ? "SALVO" : "ALTERADO");
  const [temRascunho, setTemRascunho] = useState(!!rascunho);
  const [erro, setErro] = useState<string | null>(null);
  const [erroRascunho, setErroRascunho] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const { data: propriedades } = usePropriedades();
  const configRef = useRef(config);
  configRef.current = config;
  const versaoRef = useRef(rascunho?.versao);
  // Um salvamento por vez, sempre com a configuração mais recente: dois
  // salvamentos sobre a mesma versão gerariam conflito falso.
  const filaRef = useRef<Promise<void>>(Promise.resolve());
  const timerRef = useRef<number | null>(null);
  const pendenteRef = useRef(false);
  // Enquanto gera ou descarta, nada grava: o servidor consome ou apaga o rascunho.
  const pausadoRef = useRef(false);
  const iniciouRef = useRef(false);

  const executarSalvamento = async () => {
    if (pausadoRef.current || !pendenteRef.current) return;
    pendenteRef.current = false;
    setEstado("SALVANDO");
    try {
      const salvo = await salvarRascunhoRelatorioFinanceiro(configRef.current, versaoRef.current);
      versaoRef.current = salvo.versao;
      setTemRascunho(true); setErroRascunho(null); setEstado(pendenteRef.current ? "ALTERADO" : "SALVO");
    } catch (falha) { pendenteRef.current = true; setEstado("ERRO"); setErroRascunho(mensagem(falha)); }
  };
  const enfileirar = () => { filaRef.current = filaRef.current.then(executarSalvamento); return filaRef.current; };
  const cancelarTimer = () => { if (timerRef.current != null) { window.clearTimeout(timerRef.current); timerRef.current = null; } };

  useEffect(() => {
    if (!iniciouRef.current) { iniciouRef.current = true; return; }
    pendenteRef.current = true; setEstado("ALTERADO");
    cancelarTimer();
    timerRef.current = window.setTimeout(() => { timerRef.current = null; void enfileirar(); }, 700);
    return cancelarTimer;
    // `config` é todo o estado editável; o resto são refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Mantém a sidebar e o leitor de tela informados sobre qual trabalho está aberto.
  useEffect(() => marcarEdicaoRascunhoRelatorio(), []);
  useEffect(() => {
    if (estado !== "ALTERADO" && estado !== "SALVANDO") return;
    const avisar = (evento: BeforeUnloadEvent) => { evento.preventDefault(); evento.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [estado]);

  const alterar = <K extends keyof ConfiguracaoRelatorioFinanceiro>(campo: K, valor: ConfiguracaoRelatorioFinanceiro[K]) => setConfig((atual) => ({ ...atual, [campo]: valor }));
  const sair = async () => {
    cancelarTimer();
    if (pendenteRef.current) void enfileirar();
    await filaRef.current;
    onVoltar();
  };
  const limpar = async () => {
    setErro(null); cancelarTimer(); pausadoRef.current = true;
    try {
      await filaRef.current;
      await descartarRascunhoRelatorioFinanceiro();
      versaoRef.current = undefined; pendenteRef.current = false; iniciouRef.current = false;
      setTemRascunho(false); setErroRascunho(null); setEstado("ALTERADO"); setConfig(configuracaoPadrao());
    } catch (falha) { setErro(mensagem(falha)); }
    finally { pausadoRef.current = false; }
  };
  const gerar = async () => {
    if (!podeGerar(config) || gerando) return;
    setErro(null); setGerando(true); cancelarTimer();
    try {
      // A versão enviada precisa representar a configuração efetivamente gerada.
      // Salva antes de pausar o autosave e só então congela o formulário.
      if (pendenteRef.current) await enfileirar();
      await filaRef.current;
      pausadoRef.current = true;
      const relatorio = await gerarRelatorioFinanceiro(configRef.current, versaoRef.current);
      let aviso: string | null = null;
      try { await salvarPdfRelatorioFinanceiro(relatorio); }
      catch { aviso = `O relatório “${relatorio.nome}” foi gerado, mas o download não começou. Use “Baixar PDF” no histórico.`; }
      onGerado(relatorio, aviso);
    } catch (falha) {
      // A falha não consome o rascunho: volta a salvar o que está na tela.
      pausadoRef.current = false; setGerando(false); setErro(mensagem(falha));
      if (pendenteRef.current) void enfileirar();
    }
  };

  const range: DateRange = { start: dateFromIso(config.dataInicio), end: dateFromIso(config.dataFim) };
  const problemaPeriodo = erroPeriodo(config);
  const tipos = useMemo(() => TIPOS_RELATORIO.map((tipo) => [tipo, TIPO_OPERACAO[tipo] ?? tipo] as const), []);
  const centros = useMemo<OpcaoNumero[]>(() => [[0, SEM_CENTRO], ...cadastros.centrosCusto.map((c): OpcaoNumero => [c.id, `${c.nome}${c.ativo ? "" : " (inativo)"}`])], [cadastros.centrosCusto]);
  const categorias = useMemo<OpcaoNumero[]>(() => [[0, SEM_CATEGORIA], ...cadastros.categorias.map((c): OpcaoNumero => [c.id, `${c.nome}${c.ativo ? "" : " (inativa)"}`])], [cadastros.categorias]);
  const parceiros = useMemo<OpcaoNumero[]>(() => [[0, "Sem parceiro"], ...cadastros.parceiros.map((p): OpcaoNumero => [p.id, `${p.nome}${p.ativo ? "" : " (inativo)"}`])], [cadastros.parceiros]);
  const resumo = resumoConfiguracao(config, { categorias: cadastros.categorias, centrosCusto: cadastros.centrosCusto, parceiros: cadastros.parceiros, tipos: TIPO_OPERACAO });
  const bloqueio = !config.nome.trim() ? "Informe um nome para o relatório." : problemaPeriodo;
  // Fazenda de um sítio não vê a camada; na visão consolidada o servidor emite para a principal.
  const ativas = propriedades.filter((p) => p.ativo);
  const idAtivo = getPropriedadeAtiva();
  const destino = ativas.length > 1 ? (idAtivo != null ? ativas.find((p) => p.id === idAtivo)?.nome : `${ativas.find((p) => p.principal)?.nome ?? "Propriedade principal"} (principal)`) : null;

  return <div className="shell-wide pb-10">
    <div className="mb-5 flex min-h-[82px] flex-wrap items-center justify-between gap-4 border-b border-border pb-5 pt-3">
      <div><div className="text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Relatórios financeiros</div><h1 className="mt-1 font-serif text-3xl text-ink md:text-4xl">Novo relatório</h1></div>
      <div className="flex flex-wrap items-center gap-3">
        {temRascunho && <span aria-live="polite" className={`text-xs font-medium ${estado === "ERRO" ? "text-red-700" : "text-ink-3"}`}>{estado === "SALVANDO" ? "Salvando…" : estado === "SALVO" ? "Rascunho salvo" : estado === "ERRO" ? "Falha ao salvar" : "Alterações não salvas"}</span>}
        {temRascunho && <Button secondary disabled={gerando} onClick={() => void limpar()}><Trash2 size={15} /> Limpar rascunho</Button>}
        <Button secondary disabled={gerando} onClick={() => void sair()}><ArrowLeft size={15} /> Relatórios</Button>
      </div>
    </div>

    <div className="relative grid overflow-hidden rounded-xl border border-border bg-white xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-7 p-5 md:p-7">
        <ErrorBox erro={erro} />
        <ErrorBox erro={erroRascunho} />
        <section>
          <h3 className={TITULO_SECAO}>Identificação</h3>
          <label className="block text-sm font-medium">Nome do relatório *<input aria-label="Nome do relatório" maxLength={120} className={CAMPO} value={config.nome} onChange={(e) => alterar("nome", e.target.value)} /></label>
        </section>

        <section>
          <h3 className={TITULO_SECAO}>Período</h3>
          <DateRangePicker value={range} triggerAriaLabel="Período do relatório" onChange={({ start, end }) => {
            if (start && end) setConfig(atual => ({ ...atual, dataInicio: isoLocal(start), dataFim: isoLocal(end) }));
          }} />
          {problemaPeriodo && <p role="alert" className="mt-2 text-sm text-red-700">{problemaPeriodo}</p>}
        </section>

        <fieldset>
          <legend className={TITULO_SECAO}>Leitura financeira</legend>
          <div className="grid gap-2 md:grid-cols-3">{REGIMES_RELATORIO.map((regime) => <label key={regime.id} className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 text-sm has-checked:border-mast has-checked:bg-[#eef1e9]">
            <input type="radio" name="regime" checked={config.regime === regime.id} onChange={() => alterar("regime", regime.id)} className="mt-1" />
            <span><strong className="block">{regime.rotulo}</strong><span className="mt-0.5 block text-xs text-ink-3">{regime.dica}</span></span>
          </label>)}</div>
        </fieldset>

        <div className="grid gap-5 md:grid-cols-2">
          <MultiSelect label="Tipos de operação" placeholder="Todos os tipos" helpText="Sem seleção, inclui todos os tipos." options={opcoesMultiSelect(tipos)} value={config.tipos} onValueChange={(value) => alterar("tipos", value)} />
          <MultiSelect label="Situação da operação" placeholder="Todas as situações" helpText="O filtro vale para operações e itens; o caixa inclui todo movimento." options={opcoesMultiSelect(STATUS_RELATORIO)} value={config.status} onValueChange={(value) => alterar("status", value)} />
          <MultiSelect label="Centro de custo" placeholder="Todos os centros de custo" helpText="Sem seleção, inclui todos os centros." options={opcoesMultiSelect(centros)} value={config.centroCustoIds} onValueChange={(value) => alterar("centroCustoIds", value)} />
          <MultiSelect label="Parceiro" placeholder="Todos os parceiros" helpText="Sem seleção, inclui todos os parceiros." options={opcoesMultiSelect(parceiros)} value={config.parceiroIds} onValueChange={(value) => alterar("parceiroIds", value)} />
          <MultiSelect label="Categoria dos itens" placeholder="Todas as categorias" helpText="Sem seleção, inclui todas as categorias." options={opcoesMultiSelect(categorias)} value={config.categoriaIds} onValueChange={(value) => alterar("categoriaIds", value)} />
          <MultiSelect label="Classificação" placeholder="Todas as classificações" helpText="Sem seleção, inclui todas as classificações." options={opcoesMultiSelect(CLASSIFICACOES_RELATORIO)} value={config.classificacoes} onValueChange={(value) => alterar("classificacoes", value)} />
        </div>
        <p className="text-xs leading-5 text-ink-3">Categoria e classificação valem por item: numa compra com itens de categorias diferentes, entra só a parte de cada item que corresponde ao filtro.</p>
      </div>

      <aside aria-label="Resumo do relatório" className="border-t border-border bg-[#1f2b21] text-white xl:absolute xl:inset-y-0 xl:right-0 xl:w-[330px] xl:border-l xl:border-t-0">
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1 p-6 xl:overflow-y-auto">
          <div className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">Resumo do relatório</div>
          <div className="mt-3 break-words font-serif text-2xl">{config.nome.trim() || "Sem nome"}</div>
          <dl className="mt-5 space-y-3 border-y border-white/10 py-4 text-xs">{(destino ? [["Propriedade", destino] as [string, string], ...resumo] : resumo).map(([rotulo, valor]) => <div key={rotulo}><dt className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">{rotulo}</dt><dd className="mt-0.5 break-words leading-5 text-white">{valor}</dd></div>)}</dl>
          <div className="mt-4 text-[10px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">O documento terá</div>
          <div className="mt-2 space-y-2 text-sm leading-5">{secoesDoRelatorio(config).map((secao) => <ReviewLine key={secao}>{secao}</ReviewLine>)}</div>
          </div>
          <div className="mt-auto shrink-0 border-t border-white/10 bg-[#1f2b21] px-6 pb-2 pt-4">
            <p className="text-[11px] leading-4 text-[#aeb9aa]">O PDF é baixado ao gerar e fica salvo no histórico da propriedade.</p>
            <Button onClick={() => void gerar()} disabled={!!bloqueio || gerando} className="mt-3 w-full !bg-[#e9e3d2] !text-[#1f2b21]"><FileDown size={16} /> {gerando ? "Gerando…" : "Gerar relatório"}</Button>
            {bloqueio && <p className="mt-2 text-center text-[11px] text-[#e3c66f]">{bloqueio}</p>}
          </div>
        </div>
      </aside>
    </div>
  </div>;
}

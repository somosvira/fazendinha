import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FileDown, Trash2 } from "lucide-react";
import { getHoje } from "../lib/hoje";
import { getPropriedadeAtiva } from "../propriedadeScope";
import { usePropriedades } from "../rebanho/api";
import { descartarRascunhoRelatorioFinanceiro, gerarRelatorioFinanceiro, salvarPdfRelatorioFinanceiro, salvarRascunhoRelatorioFinanceiro, type ConfiguracaoRelatorioFinanceiro, type ConfiguracoesFinanceiras, type RascunhoRelatorioFinanceiro, type RelatorioFinanceiro } from "./novo-api";
import { Button, ErrorBox, ReviewLine, TIPO_OPERACAO } from "./financeiro-ui";
import { marcarEdicaoRascunhoRelatorio } from "./rascunhoRelatorioAtivo";
import { CLASSIFICACOES_RELATORIO, REGIMES_RELATORIO, SEM_CATEGORIA, SEM_CENTRO, STATUS_RELATORIO, TIPOS_RELATORIO, alternar, configuracaoPadrao, erroPeriodo, isoLocal, mesclarRascunho, periodoMes, podeGerar, resumoConfiguracao, secoesDoRelatorio } from "./lib/relatorios";

const CAMPO = "mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-normal";
const TITULO_SECAO = "mb-3 text-xs font-semibold uppercase tracking-[.12em] text-ink-3";
const mensagem = (falha: unknown) => falha instanceof Error ? falha.message : String(falha);

type Estado = "ALTERADO" | "SALVANDO" | "SALVO" | "ERRO";
type Opcao = readonly [string | number, string];

function Multisselecao({ titulo, ajuda, opcoes, selecionados, onAlternar, onLimpar }: { titulo: string; ajuda: string; opcoes: readonly Opcao[]; selecionados: readonly (string | number)[]; onAlternar: (id: string | number) => void; onLimpar: () => void }) {
  return <fieldset>
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <legend className={`${TITULO_SECAO} mb-0`}>{titulo}</legend>
      {selecionados.length > 0 ? <button type="button" onClick={onLimpar} className="text-xs font-semibold text-green-800 hover:underline">Limpar ({selecionados.length})</button> : <span className="text-xs text-ink-3">{ajuda}</span>}
    </div>
    <div className="flex flex-wrap gap-2">
      {opcoes.map(([id, nome]) => <label key={String(id)} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-mast has-checked:bg-[#eef1e9]">
        <input type="checkbox" checked={selecionados.includes(id)} onChange={() => onAlternar(id)} />{nome}
      </label>)}
    </div>
  </fieldset>;
}

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

  const hoje = getHoje();
  const atalhos = [
    { rotulo: "Mês passado", ...periodoMes(hoje, -1) },
    { rotulo: "Mês atual", dataInicio: periodoMes(hoje).dataInicio, dataFim: isoLocal(hoje) },
    { rotulo: "Ano atual", dataInicio: `${hoje.getFullYear()}-01-01`, dataFim: isoLocal(hoje) },
  ];
  const problemaPeriodo = erroPeriodo(config);
  const tipos = useMemo(() => TIPOS_RELATORIO.map((tipo) => [tipo, TIPO_OPERACAO[tipo] ?? tipo] as const), []);
  const centros = useMemo<Opcao[]>(() => [[0, SEM_CENTRO], ...cadastros.centrosCusto.map((c): Opcao => [c.id, `${c.nome}${c.ativo ? "" : " (inativo)"}`])], [cadastros.centrosCusto]);
  const categorias = useMemo<Opcao[]>(() => [[0, SEM_CATEGORIA], ...cadastros.categorias.map((c): Opcao => [c.id, `${c.nome}${c.ativo ? "" : " (inativa)"}`])], [cadastros.categorias]);
  const parceiros = useMemo<Opcao[]>(() => [[0, "Sem parceiro"], ...cadastros.parceiros.map((p): Opcao => [p.id, `${p.nome}${p.ativo ? "" : " (inativo)"}`])], [cadastros.parceiros]);
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

    <div className="grid overflow-hidden rounded-xl border border-border bg-white xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-7 p-5 md:p-7">
        <ErrorBox erro={erro} />
        <ErrorBox erro={erroRascunho} />
        <section>
          <h3 className={TITULO_SECAO}>Identificação</h3>
          <label className="block text-sm font-medium">Nome do relatório *<input aria-label="Nome do relatório" maxLength={120} className={CAMPO} value={config.nome} onChange={(e) => alterar("nome", e.target.value)} /></label>
        </section>

        <section>
          <h3 className={TITULO_SECAO}>Período</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Data inicial *<input aria-label="Data inicial" type="date" required max={config.dataFim || undefined} className={CAMPO} value={config.dataInicio} onChange={(e) => alterar("dataInicio", e.target.value)} /></label>
            <label className="text-sm font-medium">Data final *<input aria-label="Data final" type="date" required min={config.dataInicio || undefined} className={CAMPO} value={config.dataFim} onChange={(e) => alterar("dataFim", e.target.value)} /></label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">{atalhos.map((atalho) => <button key={atalho.rotulo} type="button" onClick={() => setConfig((atual) => ({ ...atual, dataInicio: atalho.dataInicio, dataFim: atalho.dataFim }))} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink-2 hover:bg-surface-2">{atalho.rotulo}</button>)}</div>
          {problemaPeriodo && <p role="alert" className="mt-2 text-sm text-red-700">{problemaPeriodo}</p>}
        </section>

        <fieldset>
          <legend className={TITULO_SECAO}>Leitura financeira</legend>
          <div className="grid gap-2 md:grid-cols-3">{REGIMES_RELATORIO.map((regime) => <label key={regime.id} className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 text-sm has-checked:border-mast has-checked:bg-[#eef1e9]">
            <input type="radio" name="regime" checked={config.regime === regime.id} onChange={() => alterar("regime", regime.id)} className="mt-1" />
            <span><strong className="block">{regime.rotulo}</strong><span className="mt-0.5 block text-xs text-ink-3">{regime.dica}</span></span>
          </label>)}</div>
        </fieldset>

        <Multisselecao titulo="Tipos de operação" ajuda="Nenhum marcado inclui todos" opcoes={tipos} selecionados={config.tipos} onAlternar={(id) => alterar("tipos", alternar(config.tipos, String(id)))} onLimpar={() => alterar("tipos", [])} />
        <Multisselecao titulo="Situação da operação" ajuda="Vale para operações e itens; o caixa inclui todo movimento" opcoes={STATUS_RELATORIO} selecionados={config.status} onAlternar={(id) => alterar("status", alternar(config.status, String(id)))} onLimpar={() => alterar("status", [])} />
        <Multisselecao titulo="Centro de custo" ajuda="Nenhum marcado inclui todos" opcoes={centros} selecionados={config.centroCustoIds} onAlternar={(id) => alterar("centroCustoIds", alternar(config.centroCustoIds, Number(id)))} onLimpar={() => alterar("centroCustoIds", [])} />
        <Multisselecao titulo="Parceiro" ajuda="Nenhum marcado inclui todos" opcoes={parceiros} selecionados={config.parceiroIds} onAlternar={(id) => alterar("parceiroIds", alternar(config.parceiroIds, Number(id)))} onLimpar={() => alterar("parceiroIds", [])} />
        <Multisselecao titulo="Categoria dos itens" ajuda="Nenhuma marcada inclui todas" opcoes={categorias} selecionados={config.categoriaIds} onAlternar={(id) => alterar("categoriaIds", alternar(config.categoriaIds, Number(id)))} onLimpar={() => alterar("categoriaIds", [])} />
        <Multisselecao titulo="Classificação" ajuda="Nenhuma marcada inclui todas" opcoes={CLASSIFICACOES_RELATORIO} selecionados={config.classificacoes} onAlternar={(id) => alterar("classificacoes", alternar(config.classificacoes, id as (typeof config.classificacoes)[number]))} onLimpar={() => alterar("classificacoes", [])} />
        <p className="text-xs leading-5 text-ink-3">Categoria e classificação valem por item: numa compra com itens de categorias diferentes, entra só a parte de cada item que corresponde ao filtro.</p>
      </div>

      <aside aria-label="Resumo do relatório" className="flex flex-col border-t border-border bg-[#1f2b21] p-6 text-white xl:sticky xl:top-0 xl:max-h-screen xl:overflow-y-auto xl:border-l xl:border-t-0">
        <div className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">Resumo do relatório</div>
        <div className="mt-3 break-words font-serif text-2xl">{config.nome.trim() || "Sem nome"}</div>
        <dl className="mt-5 space-y-3 border-y border-white/10 py-4 text-xs">{(destino ? [["Propriedade", destino] as [string, string], ...resumo] : resumo).map(([rotulo, valor]) => <div key={rotulo}><dt className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">{rotulo}</dt><dd className="mt-0.5 break-words leading-5 text-white">{valor}</dd></div>)}</dl>
        <div className="mt-4 text-[10px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">O documento terá</div>
        <div className="mt-2 space-y-2 text-sm leading-5">{secoesDoRelatorio(config).map((secao) => <ReviewLine key={secao}>{secao}</ReviewLine>)}</div>
        <div className="mt-auto border-t border-white/10 pt-5">
          <p className="mb-3 mt-5 text-center text-[11px] leading-4 text-[#aeb9aa]">O PDF é baixado ao gerar e fica salvo no histórico da propriedade.</p>
          <Button onClick={() => void gerar()} disabled={!!bloqueio || gerando} className="w-full !bg-[#e9e3d2] !text-[#1f2b21]"><FileDown size={16} /> {gerando ? "Gerando…" : "Gerar relatório"}</Button>
          {bloqueio && <p className="mt-2 text-center text-[11px] text-[#e3c66f]">{bloqueio}</p>}
        </div>
      </aside>
    </div>
  </div>;
}

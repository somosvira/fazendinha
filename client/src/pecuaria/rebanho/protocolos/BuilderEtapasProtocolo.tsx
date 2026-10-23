import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { Paginacao } from "../ui";
import type { MomentoCadastro } from "./CamposMomentoAcao";
import { obterAcoesCadastro, type CadastroProtocoloMeta } from "./cadastros-api";
import "./BuilderEtapasProtocolo.css";

export type AcaoBuilderEtapas = { chaveEdicao?: string; ordem?: number; momento?: MomentoCadastro | null };
export type BuilderEtapasProtocoloProps<T extends AcaoBuilderEtapas> = {
  origem: CadastroProtocoloMeta | null;
  itens: T[];
  onChange: (itens: T[]) => void;
  converter: (item: T) => T;
  onCompletoChange: (completo: boolean) => void;
  criarAcao: (momento: MomentoCadastro, referenciaDaEtapa?: T) => T;
  renderizarAcao: (item: T, indiceOriginal: number) => ReactNode;
  renderizarCalendario?: (item: T, indicesDoMomento: number[]) => ReactNode;
  indiceErro?: number | null;
};

type Grupo<T> = { chave: string; momento: MomentoCadastro | null; acoes: { item: T; indice: number }[] };
const chaveAcao = (item: AcaoBuilderEtapas, indice: number) => item.chaveEdicao ?? `acao-${item.ordem ?? indice}`;

/** Agrupa apenas vínculos explícitos. Coincidência de dia ou intervalo nunca cria uma etapa. */
function agrupar<T extends AcaoBuilderEtapas>(itens: T[]): Grupo<T>[] {
  const grupos = new Map<string, Grupo<T>>();
  itens.forEach((item, indice) => {
    const chave = item.momento ? `momento-${item.momento.ordem}` : `legado-${chaveAcao(item, indice)}`;
    const grupo = grupos.get(chave) ?? { chave, momento: item.momento ?? null, acoes: [] };
    grupo.acoes.push({ item, indice });
    grupos.set(chave, grupo);
  });
  return [...grupos.values()].sort((a, b) => (a.momento?.ordem ?? a.acoes[0].item.ordem ?? a.acoes[0].indice) - (b.momento?.ordem ?? b.acoes[0].item.ordem ?? b.acoes[0].indice));
}

export function BuilderEtapasProtocolo<T extends AcaoBuilderEtapas>({ origem, itens, onChange, converter, onCompletoChange, criarAcao, renderizarAcao, renderizarCalendario, indiceErro }: BuilderEtapasProtocoloProps<T>) {
  const id = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const adicionarEtapa = useRef<HTMLButtonElement>(null);
  const refs = useRef({ itens, onChange, converter });
  refs.current = { itens, onChange, converter };
  const geracao = useRef(0);
  const origemChave = origem ? `${origem.id}:${origem.atualizadoEm}` : "nova";
  const [carga, setCarga] = useState({ origem: origemChave, paginas: 0 });
  const [carregando, setCarregando] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const paginas = carga.origem === origemChave ? carga.paginas : 0;
  const completo = !origem || paginas >= Math.ceil(origem.totalEtapas / 10);
  const editavel = completo && itens.length <= 100;

  async function carregar(pagina: number, token = geracao.current) {
    if (!origem) return;
    setCarregando(true);
    setErroCarga(null);
    try {
      const resposta = await obterAcoesCadastro<T>(origem, pagina);
      if (token !== geracao.current) return;
      if (resposta.revisao && resposta.revisao !== origem.atualizadoEm) throw new Error("Esta versão mudou. Reabra o modelo para carregar a revisão atual.");
      const momentosEditados = new Map(refs.current.itens.flatMap(item => item.momento ? [[item.momento.ordem, item.momento] as const] : []));
      const novos = resposta.itens.map(item => {
        const convertido = refs.current.converter(item);
        const editado = convertido.momento && momentosEditados.get(convertido.momento.ordem);
        return editado ? { ...convertido, momento: { ...editado } } : convertido;
      });
      refs.current.onChange([...refs.current.itens, ...novos].sort((a, b) => (a.ordem ?? Infinity) - (b.ordem ?? Infinity)));
      setCarga({ origem: origemChave, paginas: pagina });
    } catch (erro) {
      if (token === geracao.current) setErroCarga(erro instanceof Error ? erro.message : "Não foi possível carregar os procedimentos.");
    } finally {
      if (token === geracao.current) setCarregando(false);
    }
  }
  useEffect(() => {
    const token = ++geracao.current;
    setCarga({ origem: origemChave, paginas: 0 });
    setErroCarga(null);
    setCarregando(false);
    if (origem && origem.totalEtapas > 0) void carregar(1, token);
    return () => { geracao.current++; };
    // A revisão define a sessão de edição; callbacks usam refs para conservar edições.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origemChave]);
  const podeSalvar = editavel && itens.length > 0;
  useEffect(() => { onCompletoChange(podeSalvar); }, [podeSalvar, onCompletoChange]);

  const grupos = agrupar(itens);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [paginaEtapas, setPaginaEtapas] = useState(1);
  const [paginasAcoes, setPaginasAcoes] = useState<Record<string, number>>({});
  const grupo = grupos.find(g => g.chave === selecionada) ?? grupos[0];
  const paginaEtapasAtual = Math.min(paginaEtapas, Math.max(1, Math.ceil(grupos.length / 10)));
  const paginaAcoes = grupo ? Math.min(paginasAcoes[grupo.chave] ?? 1, Math.max(1, Math.ceil(grupo.acoes.length / 10))) : 1;
  const foco = useRef<{ tipo: "nome" | "etapa" | "acao" | "adicionar"; indice?: number } | null>(null);
  useLayoutEffect(() => {
    const destino = foco.current;
    if (!destino) return;
    let elemento: HTMLElement | null | undefined;
    if (destino.tipo === "nome") elemento = raiz.current?.querySelector("[data-nome-etapa]");
    if (destino.tipo === "adicionar") elemento = adicionarEtapa.current;
    if (destino.tipo === "etapa") elemento = raiz.current?.querySelector(`[data-selecionar-etapa="${destino.indice}"]`);
    if (destino.tipo === "acao") {
      const linha = raiz.current?.querySelector(`[data-indice-acao="${destino.indice}"]`);
      elemento = linha?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? linha?.querySelector<HTMLElement>("input, select, textarea") ?? linha?.querySelector<HTMLElement>("button");
    }
    (elemento ?? raiz.current)?.focus();
    foco.current = null;
  }, [itens, selecionada, paginaEtapasAtual, paginaAcoes]);
  useEffect(() => {
    if (indiceErro == null) return;
    const indiceGrupo = grupos.findIndex(g => g.acoes.some(a => a.indice === indiceErro));
    if (indiceGrupo < 0) return;
    const comErro = grupos[indiceGrupo];
    setSelecionada(comErro.chave);
    setPaginaEtapas(Math.floor(indiceGrupo / 10) + 1);
    setPaginasAcoes(ps => ({ ...ps, [comErro.chave]: Math.floor(comErro.acoes.findIndex(a => a.indice === indiceErro) / 10) + 1 }));
    foco.current = { tipo: "acao", indice: indiceErro };
    // A posição do erro é fornecida pelo formulário ao validar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indiceErro]);

  const prepararNovoMomento = (): { base: T[]; momento: MomentoCadastro } => {
    const ordens = [...new Set(itens.flatMap(item => item.momento ? [item.momento.ordem] : []))].sort((a, b) => a - b);
    const renumerar = (ordens.at(-1) ?? 0) >= 100;
    const novasOrdens = new Map(ordens.map((ordem, indice) => [ordem, indice + 1]));
    // O rascunho recebe uma nova estrutura sem mudar a sequência das ações ou inferir grupos legados.
    const base = renumerar ? itens.map(item => item.momento ? { ...item, momento: { ...item.momento, ordem: novasOrdens.get(item.momento.ordem)! } } : item) : itens;
    const ordem = (renumerar ? ordens.length : ordens.at(-1) ?? 0) + 1;
    return { base, momento: { nome: `Etapa ${ordem}`, ordem, modoAtendimento: "MANUAL" } };
  };
  function mudarMomento(patch: Partial<MomentoCadastro>) {
    if (!grupo?.momento) return;
    const indices = new Set(grupo.acoes.map(a => a.indice));
    onChange(itens.map((item, i) => indices.has(i) ? { ...item, momento: { ...grupo.momento!, ...patch } } : item));
  }
  function removerEtapa() {
    if (!grupo) return;
    const indice = grupos.indexOf(grupo);
    const restantes = grupos.filter(g => g !== grupo);
    const proxima = Math.min(indice, restantes.length - 1);
    setSelecionada(restantes[proxima]?.chave ?? null);
    setPaginaEtapas(Math.max(1, Math.floor(proxima / 10) + 1));
    foco.current = restantes.length ? { tipo: "etapa", indice: proxima } : { tipo: "adicionar" };
    const removidos = new Set(grupo.acoes.map(a => a.indice));
    onChange(itens.filter((_, indiceItem) => !removidos.has(indiceItem)));
  }
  function removerAcao(indice: number) {
    if (!grupo) return;
    if (grupo.acoes.length === 1) { removerEtapa(); return; }
    const posicao = grupo.acoes.findIndex(a => a.indice === indice);
    const restantes = grupo.acoes.filter(a => a.indice !== indice);
    const vizinha = restantes[Math.min(posicao, restantes.length - 1)];
    setPaginasAcoes(ps => ({ ...ps, [grupo.chave]: Math.floor(Math.min(posicao, restantes.length - 1) / 10) + 1 }));
    foco.current = { tipo: "acao", indice: vizinha.indice - (vizinha.indice > indice ? 1 : 0) };
    onChange(itens.filter((_, i) => i !== indice));
  }

  return <div ref={raiz} className="builder-etapas" tabIndex={-1}>
    {!completo && <div className="builder-etapas-carga"><p role="status">{itens.length} de {origem?.totalEtapas} procedimentos carregados. Carregue todos para salvar, adicionar ou remover sem perder ações.</p><Button secondary type="button" disabled={carregando} onClick={() => void carregar(paginas + 1)}>{erroCarga ? "Tentar carregar novamente" : "Carregar próximos 10 procedimentos"}</Button></div>}
    <ErrorBox erro={erroCarga} />
    {carregando && <p role="status">Carregando procedimentos…</p>}
    {(origem?.totalEtapas ?? itens.length) > 100 && <p role="alert">Esta versão excede o limite de 100 procedimentos deste editor.</p>}
    <div className="builder-etapas-layout">
      <section className="builder-etapas-lista" aria-labelledby={`${id}-lista`}>
        <div className="builder-etapas-titulo"><h3 id={`${id}-lista`}>Etapas do modelo</h3><Button ref={adicionarEtapa} secondary type="button" disabled={!editavel || itens.length >= 100} onClick={() => {
          const { base, momento } = prepararNovoMomento();
          setSelecionada(`momento-${momento.ordem}`);
          foco.current = { tipo: "nome" };
          const novos = [...base, criarAcao(momento)];
          setPaginaEtapas(Math.floor(agrupar(novos).findIndex(g => g.chave === `momento-${momento.ordem}`) / 10) + 1);
          onChange(novos);
        }}>Adicionar etapa</Button></div>
        <p className="builder-etapas-ajuda">{grupos.length} {grupos.length === 1 ? "etapa" : "etapas"} · {itens.length} de 100 procedimentos</p>
        {grupos.slice((paginaEtapasAtual - 1) * 10, paginaEtapasAtual * 10).map((g, indice) => <button type="button" className="builder-etapas-opcao" key={g.chave} data-selecionar-etapa={(paginaEtapasAtual - 1) * 10 + indice} aria-pressed={grupo?.chave === g.chave} aria-controls={`${id}-editor`} onClick={() => setSelecionada(g.chave)}>
          <strong>{g.momento?.nome || (g.momento ? `Etapa ${g.momento.ordem}` : `Ação legada ${g.acoes[0].item.ordem ?? g.acoes[0].indice + 1}`)}</strong>{" "}<span>{g.acoes.length} {g.acoes.length === 1 ? "procedimento" : "procedimentos"} · {g.momento?.modoAtendimento === "AUTOMATIZADA" ? "Automatizada" : g.momento?.modoAtendimento === "MANUAL" ? "Manual" : "Modo não declarado"}</span>
        </button>)}
        {grupos.length > 10 && <Paginacao paginaAtual={paginaEtapasAtual} totalPaginas={Math.ceil(grupos.length / 10)} totalItens={grupos.length} itensPorPagina={10} onPaginaChange={setPaginaEtapas} rotulo="etapas" idSelect={`${id}-pagina-etapas`} />}
      </section>
      <section id={`${id}-editor`} className="builder-etapas-editor" aria-label="Etapa selecionada">
        {!grupo ? <p className="builder-etapas-vazio">Adicione uma etapa para definir seus procedimentos e a forma de atendimento.</p> : <>
          <h3>{grupo.momento?.nome || "Ação legada sem etapa"}</h3>
          {grupo.momento ? <>
            <label className="builder-etapas-campo">Nome da etapa<input data-nome-etapa className={classeInput} required minLength={1} maxLength={120} value={grupo.momento.nome} onChange={e => mudarMomento({ nome: e.target.value })} /></label>
            {renderizarCalendario?.(grupo.acoes[0].item, grupo.acoes.map(a => a.indice))}
            <label className="builder-etapas-campo">Instruções gerais da etapa (opcional)<textarea className={classeInput} rows={3} maxLength={2000} value={grupo.momento.instrucoesGerais ?? ""} onChange={e => mudarMomento({ instrucoesGerais: e.target.value })} /></label>
            <fieldset className="builder-etapas-modo"><legend>Como esta etapa será atendida?</legend>{([{ valor: "AUTOMATIZADA", nome: "Automatizada", ajuda: "Procedimentos e produtos predefinidos. A equipe confirma os OKs e ajusta as exceções." }, { valor: "MANUAL", nome: "Manual", ajuda: "A equipe registra produtos e resultados por animal ou para um grupo de animais." }] as const).map(modo => <label key={modo.valor}><input type="radio" name={`${id}-modo`} value={modo.valor} checked={grupo.momento?.modoAtendimento === modo.valor} onChange={() => mudarMomento({ modoAtendimento: modo.valor })} /><span><strong>{modo.nome}</strong><small>{modo.ajuda}</small></span></label>)}</fieldset>
            {!grupo.momento.modoAtendimento && <p className="builder-etapas-ajuda">Etapa legada sem modo declarado. Escolha o modo para a nova versão.</p>}
          </> : <div className="builder-etapas-legado"><p>Esta ação não possui etapa declarada. A data não a agrupa com outras ações.</p><Button secondary type="button" disabled={!editavel} onClick={() => {
            const { base, momento } = prepararNovoMomento();
            setSelecionada(`momento-${momento.ordem}`);
            foco.current = { tipo: "nome" };
            const novos = base.map((item, indice) => indice === grupo.acoes[0].indice ? { ...item, momento } : item);
            setPaginaEtapas(Math.floor(agrupar(novos).findIndex(g => g.chave === `momento-${momento.ordem}`) / 10) + 1);
            onChange(novos);
          }}>Organizar como etapa</Button>{renderizarCalendario?.(grupo.acoes[0].item, grupo.acoes.map(a => a.indice))}</div>}
          <div className="builder-etapas-titulo"><h3>Procedimentos e produtos</h3><Button secondary type="button" disabled={!editavel || !grupo.momento || itens.length >= 100} onClick={() => {
            if (!grupo.momento) return;
            setPaginasAcoes(ps => ({ ...ps, [grupo.chave]: Math.floor(grupo.acoes.length / 10) + 1 }));
            const indiceInsercao = grupo.acoes[grupo.acoes.length - 1].indice + 1;
            foco.current = { tipo: "acao", indice: indiceInsercao };
            onChange([...itens.slice(0, indiceInsercao), criarAcao({ ...grupo.momento }, grupo.acoes[0].item), ...itens.slice(indiceInsercao)]);
          }}>Adicionar procedimento</Button></div>
          {grupo.acoes.slice((paginaAcoes - 1) * 10, paginaAcoes * 10).map(({ item, indice }, posicao) => <div className="builder-etapas-acao" key={chaveAcao(item, indice)} data-acao-cadastro data-indice-acao={indice}>
            <div className="builder-etapas-acao-cabecalho"><h4>Procedimento {(paginaAcoes - 1) * 10 + posicao + 1}</h4><Button secondary type="button" disabled={!editavel} onClick={() => removerAcao(indice)}>Remover procedimento {(paginaAcoes - 1) * 10 + posicao + 1}</Button></div>
            {renderizarAcao(item, indice)}
          </div>)}
          {grupo.acoes.length > 10 && <Paginacao paginaAtual={paginaAcoes} totalPaginas={Math.ceil(grupo.acoes.length / 10)} totalItens={grupo.acoes.length} itensPorPagina={10} onPaginaChange={p => setPaginasAcoes(ps => ({ ...ps, [grupo.chave]: p }))} rotulo="procedimentos da etapa" idSelect={`${id}-pagina-procedimentos`} />}
          <Button secondary type="button" disabled={!editavel} onClick={removerEtapa}>Remover esta etapa</Button>
        </>}
      </section>
    </div>
  </div>;
}

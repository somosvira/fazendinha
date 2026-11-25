import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { PainelCadastro, classeInput } from "../../../financeiro/PainelCadastro";
import { Paginacao } from "../ui";
import type { MomentoCadastro } from "./CamposMomentoAcao";
import { obterAcoesCadastro, type CadastroProtocoloMeta } from "./cadastros-api";
import "./BuilderEtapasProtocolo.css";
import { EsqueletoLista } from "../../../components/Esqueleto";

export type AcaoBuilderEtapas = { chaveEdicao?: string; ordem?: number; momento?: MomentoCadastro | null };
export type BuilderEtapasProtocoloProps<T extends AcaoBuilderEtapas> = {
  permitirAutomacao?: boolean;
  editorEmModal?: boolean;
  resumoEtapa?: (itens: T[]) => { referencia: string; procedimentos: string };
  quadro?: (item: T) => { procedimento: string; produto: ReactNode; quantidade: string };
  origem: CadastroProtocoloMeta | null;
  itens: T[];
  onChange: (itens: T[]) => void;
  converter: (item: T) => T;
  onCompletoChange: (completo: boolean) => void;
  criarAcao: (momento: MomentoCadastro, referenciaDaEtapa?: T) => T;
  renderizarAcao: (item: T, indiceOriginal: number) => ReactNode;
  renderizarDetalhes?: (item: T, indiceOriginal: number) => ReactNode;
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

export function BuilderEtapasProtocolo<T extends AcaoBuilderEtapas>({ permitirAutomacao = false, editorEmModal = false, resumoEtapa, quadro, origem, itens, onChange, converter, onCompletoChange, criarAcao, renderizarAcao, renderizarDetalhes, renderizarCalendario, indiceErro }: BuilderEtapasProtocoloProps<T>) {
  const id = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLElement>(null);
  const quadroEditorRef = useRef<HTMLDivElement>(null);
  const [edicaoAberta, setEdicaoAberta] = useState(false);
  const [manutencao, setManutencao] = useState(false);
  const [destinoManutencao, setDestinoManutencao] = useState<HTMLElement | null>(null);
  useEffect(() => { if (quadro) setDestinoManutencao(document.getElementById("manutencao-protocolo")); }, [quadro]);
  const [acaoSelecionada, setAcaoSelecionada] = useState<number | null>(null);
  const antesDaEdicao = useRef<T[]>([]);
  const abrirEdicao = () => { antesDaEdicao.current = [...refs.current.itens]; setEdicaoAberta(true); };
  const adicionarEtapa = useRef<HTMLButtonElement>(null);
  const refs = useRef({ itens, onChange, converter });
  refs.current = { itens, onChange, converter };
  const geracao = useRef(0);
  const cargaEmCurso = useRef<number | null>(null);
  const cargaConfirmada = useRef<{ origem: string; paginas: number } | null>(null);
  const origemChave = origem ? `${origem.id}:${origem.atualizadoEm}` : "nova";
  const [carga, setCarga] = useState({ origem: origemChave, paginas: 0 });
  const [carregando, setCarregando] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const paginas = carga.origem === origemChave ? carga.paginas : 0;
  const completo = !origem || paginas >= Math.ceil(origem.totalEtapas / 10);
  const editavel = completo && itens.length <= 100;

  async function carregar(pagina: number, token = geracao.current) {
    if (!origem || cargaEmCurso.current === token) return;
    cargaEmCurso.current = token;
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
      cargaConfirmada.current = { origem: origemChave, paginas: pagina };
      setCarga(cargaConfirmada.current);
    } catch (erro) {
      if (token === geracao.current) setErroCarga(erro instanceof Error ? erro.message : "Não foi possível carregar os procedimentos.");
    } finally {
      if (token === geracao.current) { cargaEmCurso.current = null; setCarregando(false); }
    }
  }
  useEffect(() => {
    const token = ++geracao.current;
    cargaEmCurso.current = null;
    if (cargaConfirmada.current?.origem === origemChave && refs.current.itens.length) { setCarga(cargaConfirmada.current); return; }
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
    if (destino.tipo === "nome") elemento = (editorRef.current ?? raiz.current)?.querySelector("[data-nome-etapa]");
    if (destino.tipo === "adicionar") elemento = adicionarEtapa.current;
    if (destino.tipo === "etapa") elemento = raiz.current?.querySelector(`[data-selecionar-etapa="${destino.indice}"]`);
    if (destino.tipo === "acao") {
      const linha = (quadroEditorRef.current ?? editorRef.current ?? raiz.current)?.querySelector(`[data-indice-acao="${destino.indice}"]`);
      elemento = linha?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? linha?.querySelector<HTMLElement>("input, select, textarea") ?? linha?.querySelector<HTMLElement>("button");
    }
    (elemento ?? raiz.current)?.focus();
    foco.current = null;
  }, [itens, selecionada, paginaEtapasAtual, paginaAcoes, edicaoAberta]);
  useEffect(() => {
    if (indiceErro == null) return;
    const indiceGrupo = grupos.findIndex(g => g.acoes.some(a => a.indice === indiceErro));
    if (indiceGrupo < 0) return;
    const comErro = grupos[indiceGrupo];
    setSelecionada(comErro.chave); setAcaoSelecionada(indiceErro); abrirEdicao();
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
    setEdicaoAberta(false);
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

  function focarErroAoAbrir(evento: Event) {
    if (indiceErro == null || !(evento.target instanceof HTMLElement)) return;
    const procedimento = evento.target.querySelector(`[data-indice-acao="${indiceErro}"]`);
    const invalido = procedimento?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"][tabindex="-1"]');
    if (invalido) { evento.preventDefault(); invalido.focus(); }
  }

  if (quadro && !manutencao) return <div ref={raiz} className="quadro-protocolo" tabIndex={-1}>
    {!completo && <div><p role="status">{itens.length} de {origem?.totalEtapas} procedimentos carregados.</p><Button secondary type="button" disabled={carregando} onClick={() => void carregar(paginas + 1)}>{erroCarga ? "Tentar novamente" : "Carregar próximos procedimentos"}</Button></div>}
    <ErrorBox erro={erroCarga} />{carregando && <EsqueletoLista label="Carregando procedimentos" />}
    <div className="quadro-protocolo-rolagem" role="region" aria-label="Quadro de procedimentos" tabIndex={0}><table><thead><tr><th>Etapa</th><th>Procedimento</th><th>Produto / modelo</th><th>Qtd. por animal</th><th>Ações</th></tr></thead>{grupos.map(g => <tbody key={g.chave}>{g.acoes.map(({item, indice}, posicao) => { const linha = quadro(item); return <tr key={chaveAcao(item, indice)}>{posicao === 0 && <th scope="rowgroup" rowSpan={g.acoes.length}><span className="quadro-referencia">{resumoEtapa?.(g.acoes.map(a => a.item)).referencia}</span><strong>{g.momento?.nome ?? "Ação legada"}</strong></th>}<td>{linha.procedimento}</td><td>{linha.produto}</td><td>{linha.quantidade}</td><td><Button secondary type="button" aria-label={`Editar ${linha.procedimento} · ${g.momento?.nome ?? "ação legada"}`} disabled={!editavel} onClick={() => { setSelecionada(g.chave); setAcaoSelecionada(indice); abrirEdicao(); }}>Editar</Button></td></tr>; })}</tbody>)}</table></div>
    {destinoManutencao && createPortal(<Button secondary className="quadro-manutencao-acao" type="button" onClick={() => setManutencao(true)}>Gerenciar etapas e procedimentos</Button>, destinoManutencao)}
    {edicaoAberta && grupo && <PainelCadastro aberto camada="sobreDetalhe" titulo={`Editar etapa · ${grupo.momento?.nome ?? "Ação legada"}`} largura="sm:max-w-[658px]" className="quadro-etapa-dialogo" onOpenAutoFocus={indiceErro != null ? focarErroAoAbrir : undefined} mostrarFechar={false} rascunhoPersistido onFechar={() => { onChange(antesDaEdicao.current); setEdicaoAberta(false); }} rodape={<><Button secondary type="button" onClick={() => { onChange(antesDaEdicao.current); setEdicaoAberta(false); }}>Cancelar</Button><Button type="button" onClick={() => setEdicaoAberta(false)}>Concluir etapa</Button></>}>
      <div className="quadro-etapa-resumo"><div><span>Etapa</span><strong>{grupo.momento?.nome ?? "Ação legada"}</strong></div><div><span>Intervalo desde o início</span><strong>{resumoEtapa?.(grupo.acoes.map(a => a.item)).referencia}</strong></div><div><span>Unidade do intervalo</span><strong>{(grupo.acoes[0].item as T & {unidade?: string}).unidade === "HORAS" ? "Horas" : "Dias"}</strong></div></div>
      <div className="quadro-etapa-corpo" ref={quadroEditorRef}><fieldset><legend>Procedimentos da etapa</legend><div className="quadro-lista-procedimentos">{grupo.acoes.map(({item, indice}) => <label key={chaveAcao(item, indice)}><input type="radio" name={`${id}-procedimento`} checked={acaoSelecionada === indice} onChange={() => setAcaoSelecionada(indice)} />{quadro(item).procedimento}</label>)}</div></fieldset><section><h3>Detalhes do procedimento</h3>{grupo.acoes.filter(a => a.indice === acaoSelecionada).map(({item, indice}) => <div key={chaveAcao(item, indice)} data-indice-acao={indice}>{(renderizarDetalhes ?? renderizarAcao)(item, indice)}</div>)}</section></div>
    </PainelCadastro>}
  </div>;

  return <div ref={raiz} className={`builder-etapas${editorEmModal ? " builder-etapas-em-lista" : ""}`} tabIndex={-1}>
    {quadro && <Button secondary type="button" onClick={() => setManutencao(false)}>Voltar ao quadro</Button>}
    {!completo && <div className="builder-etapas-carga"><p role="status">{itens.length} de {origem?.totalEtapas} procedimentos carregados. Carregue todos para salvar, adicionar ou remover sem perder ações.</p><Button secondary type="button" disabled={carregando} onClick={() => void carregar(paginas + 1)}>{erroCarga ? "Tentar carregar novamente" : "Carregar próximos 10 procedimentos"}</Button></div>}
    <ErrorBox erro={erroCarga} />
    {carregando && <EsqueletoLista label="Carregando procedimentos" />}
    {(origem?.totalEtapas ?? itens.length) > 100 && <p role="alert">Esta versão excede o limite de 100 procedimentos deste editor.</p>}
    <div className="builder-etapas-layout">
      <section className="builder-etapas-lista" aria-labelledby={`${id}-lista`}>
        <div className="builder-etapas-titulo"><h3 id={`${id}-lista`}>Etapas do modelo</h3><Button ref={adicionarEtapa} secondary type="button" disabled={!editavel || itens.length >= 100} onClick={() => {
          const { base, momento } = prepararNovoMomento();
          setSelecionada(`momento-${momento.ordem}`); abrirEdicao();
          foco.current = { tipo: "nome" };
          const novos = [...base, criarAcao(momento)];
          setPaginaEtapas(Math.floor(agrupar(novos).findIndex(g => g.chave === `momento-${momento.ordem}`) / 10) + 1);
          onChange(novos);
        }}>Adicionar etapa</Button></div>
        <p className="builder-etapas-ajuda">{grupos.length} {grupos.length === 1 ? "etapa" : "etapas"} · {itens.length} de 100 procedimentos</p>
        <div className="builder-etapas-trilha">{grupos.slice((paginaEtapasAtual - 1) * 10, paginaEtapasAtual * 10).map((g, indice) => <button type="button" className="builder-etapas-opcao" key={g.chave} data-selecionar-etapa={(paginaEtapasAtual - 1) * 10 + indice} aria-label={editorEmModal ? `Editar etapa ${g.momento?.nome || `Ação legada ${g.acoes[0].item.ordem ?? g.acoes[0].indice + 1}`}` : undefined} aria-pressed={grupo?.chave === g.chave} aria-controls={`${id}-editor`} onClick={() => { setSelecionada(g.chave); abrirEdicao(); }}>
          {editorEmModal && resumoEtapa && <span className="builder-etapa-referencia">{resumoEtapa(g.acoes.map(a => a.item)).referencia}</span>}<span className="builder-etapa-identificacao"><strong>{g.momento?.nome || (g.momento ? `Etapa ${g.momento.ordem}` : `Ação legada ${g.acoes[0].item.ordem ?? g.acoes[0].indice + 1}`)}</strong>{" "}<span>{g.acoes.length} {g.acoes.length === 1 ? "procedimento" : "procedimentos"} · {g.momento?.politicaExecucao === "AUTOMATICA_EXCECAO" ? "Automática" : "Confirmação obrigatória"}</span>{editorEmModal && resumoEtapa && <span>{resumoEtapa(g.acoes.map(a => a.item)).procedimentos}</span>}</span>{editorEmModal && <span className="builder-etapa-editar">Editar</span>}
        </button>)}</div>
        {grupos.length > 10 && <Paginacao paginaAtual={paginaEtapasAtual} totalPaginas={Math.ceil(grupos.length / 10)} totalItens={grupos.length} itensPorPagina={10} onPaginaChange={setPaginaEtapas} rotulo="etapas" idSelect={`${id}-pagina-etapas`} />}
      </section>
      {(() => { const conteudo = (<section ref={editorRef} id={`${id}-editor`} className="builder-etapas-editor" aria-label="Etapa selecionada">
        {!grupo ? <p className="builder-etapas-vazio">Adicione uma etapa para definir seus procedimentos e a forma de atendimento.</p> : <>
          <h3>{grupo.momento?.nome || "Ação legada sem etapa"}</h3>
          {grupo.momento ? <>
            <label className="builder-etapas-campo">Nome da etapa<input data-nome-etapa className={classeInput} required minLength={1} maxLength={120} value={grupo.momento.nome} onChange={e => mudarMomento({ nome: e.target.value })} /></label>
            {renderizarCalendario?.(grupo.acoes[0].item, grupo.acoes.map(a => a.indice))}
            <label className="builder-etapas-campo">Instruções gerais da etapa (opcional)<textarea className={classeInput} rows={3} maxLength={2000} value={grupo.momento.instrucoesGerais ?? ""} onChange={e => mudarMomento({ instrucoesGerais: e.target.value })} /></label>
            <fieldset className="builder-etapas-modo"><legend>Como esta etapa será executada?</legend><label><input type="radio" name={`${id}-modo`} checked={grupo.momento.politicaExecucao !== "AUTOMATICA_EXCECAO"} onChange={() => mudarMomento({ modoAtendimento: "MANUAL", politicaExecucao: "CONFIRMACAO_OBRIGATORIA" })} /><span><strong>Confirmação obrigatória</strong><small>A equipe informa os dados reais e confirma o atendimento. Obrigatório para exames e tentativas reprodutivas.</small></span></label>{permitirAutomacao && <label><input type="radio" name={`${id}-modo`} checked={grupo.momento.politicaExecucao === "AUTOMATICA_EXCECAO"} onChange={() => mudarMomento({ modoAtendimento: "AUTOMATIZADA", politicaExecucao: "AUTOMATICA_EXCECAO", fusoHorario: "America/Sao_Paulo" })} /><span><strong>Automática com reversão por exceção</strong><small>Aplicações e dispositivos com dados completos são executados no horário programado. A equipe registra as exceções.</small></span></label>}</fieldset>
            {grupo.momento.politicaExecucao === "AUTOMATICA_EXCECAO" && <div className="grid gap-3"><label>Horário padrão<input className={classeInput} type="time" required value={grupo.momento.horarioPadrao ?? ""} onChange={e => mudarMomento({ horarioPadrao: e.target.value })} /></label><p className="text-sm">Horário de Brasília · America/Sao_Paulo. A ativação exige dados completos e revisão das etapas vencidas.</p></div>}
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
      </section>); return editorEmModal ? edicaoAberta && <PainelCadastro aberto camada="sobreDetalhe" titulo={`Editar etapa · ${grupo?.momento?.nome ?? "Ação legada"}`} onFechar={() => { onChange(antesDaEdicao.current); setEdicaoAberta(false); }} rodape={<Button secondary type="button" onClick={() => setEdicaoAberta(false)}>Concluir edição da etapa</Button>}>{conteudo}</PainelCadastro> : conteudo; })()}
    </div>
  </div>;
}

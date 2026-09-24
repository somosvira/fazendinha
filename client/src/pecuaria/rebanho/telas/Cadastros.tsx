// Cadastros do Rebanho — sub-abas locais Categorias · Raças · Motivos de saída, no padrão
// visual de ConfiguracoesFinanceiras.tsx (tabela + AcoesLinha + ConfirmDialog + PainelCadastro
// para o form). Cada aba carrega sua própria lista (services/pecuaria/rebanho/*). Lotes têm tela
// própria (ListaLotes.tsx).
//
// Categorias tem um fluxo à parte: toda mutação (criar/editar/ativar/desativar/reordenar/
// restaurar padrões) primeiro SIMULA o impacto (POST /categorias/simular) contra a lista
// completa de regras como ficaria; se algum animal muda de categoria (ou o total sem categoria
// muda), mostra um ConfirmDialog com a lista de mudanças antes de aplicar de verdade — sem
// mudança, aplica direto. O painel do formulário fica aberto atrás do ConfirmDialog até a
// operação terminar (sucesso fecha os dois; erro fecha só o diálogo, o painel continua para
// o usuário corrigir).

import { useCallback, useEffect, useRef, useState } from "react";
import { Dna, LogOut, Plus, Tags } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Loader } from "@/components/Loading";
import { AcoesLinha, Button, type ColunaTabela, ErrorBox, PageHeader, PaginaFinanceira, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { BarraFiltros, SubAbas } from "../ui";
import { NavRebanho } from "./NavRebanho";
import {
  criarCategoria, editarCategoria, editarMotivoSaida, editarRaca, listarCategorias, listarMotivosSaida, listarRacas,
  reordenarCategorias, restaurarPadroesCategorias, simularCategorias, RebanhoApiError,
} from "../api";
import type { CategoriaDTO, MotivoSaida, Raca, RegraCategoriaProposta, ResultadoSimulacaoCategorias } from "../types";
import { rotuloSexo, rotuloTipoSaida } from "../lib/rotulos";
import { FormMotivoSaida } from "../cadastros/FormMotivoSaida";
import { FormRaca } from "../cadastros/FormRaca";
import { FormCategoria, type DadosFormCategoria } from "../cadastros/FormCategoria";

type Aba = "categorias" | "racas" | "motivos";
type EntidadePainel = "raca" | "motivo";
type Painel = { entidade: EntidadePainel; modo: "novo" } | { entidade: EntidadePainel; modo: "editar"; id: string | number } | null;
type PainelCategoria = { modo: "novo" } | { modo: "editar"; categoria: CategoriaDTO } | null;
type Confirmacao =
  | { tipo: "raca"; item: Raca }
  | { tipo: "motivo"; item: MotivoSaida }
  | null;
/** confirmação de impacto de uma mudança nas categorias — `aplicar` já vem fechada sobre a ação */
type ConfirmacaoCategoria = { resultado: ResultadoSimulacaoCategorias; aplicar: () => Promise<unknown> } | null;

function mensagemErro(e: unknown): string {
  return e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e);
}

function paraProposta(c: CategoriaDTO): RegraCategoriaProposta {
  return { id: c.id, nome: c.nome, sexo: c.sexo, automatica: c.automatica, ativo: c.ativo, ordem: c.ordem, idadeMinMeses: c.idadeMinMeses, idadeMaxMeses: c.idadeMaxMeses, partos: c.partos };
}

const colunasCategorias = (
  exibidas: CategoriaDTO[],
  editar: (c: CategoriaDTO) => void,
  alternar: (c: CategoriaDTO) => void,
  mover: (c: CategoriaDTO, direcao: -1 | 1) => void,
): ColunaTabela<CategoriaDTO>[] => [
  { chave: "nome", titulo: "Nome", larguraMinima: 170, principal: true, celula: (c) => <strong className="break-words">{c.nome}</strong> },
  { chave: "sexo", titulo: "Sexo", larguraMinima: 90, celula: (c) => rotuloSexo(c.sexo) },
  { chave: "regra", titulo: "Regra", larguraMinima: 220, celula: (c) => <span className="break-words text-ink-3">{c.regra}</span> },
  { chave: "animais", titulo: "Animais ativos", alinhamento: "centro", larguraMinima: 120, celula: (c) => c.animaisAtivos },
  { chave: "padrao", titulo: "Padrão", alinhamento: "centro", larguraMinima: 90, celula: (c) => c.padrao ? <Pill tone="blue">Padrão</Pill> : "—" },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (c) => <Pill tone={c.ativo ? "green" : "neutral"}>{c.ativo ? "Ativa" : "Inativa"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 150, acoes: true, celula: (c) => {
    const indice = exibidas.findIndex((x) => x.id === c.id);
    return <AcoesLinha nome={c.nome} ativo={c.ativo} onEditar={() => editar(c)} onAlternar={() => alternar(c)} onSubir={() => mover(c, -1)} onDescer={() => mover(c, 1)} podeSubir={indice > 0} podeDescer={indice >= 0 && indice < exibidas.length - 1} />;
  } },
];

const colunasRacas = (editar: (r: Raca) => void, alternar: (r: Raca) => void): ColunaTabela<Raca>[] => [
  { chave: "raca", titulo: "Raça", larguraMinima: 180, principal: true, celula: (r) => <strong className="break-words">{r.nome}</strong> },
  { chave: "sigla", titulo: "Sigla", alinhamento: "centro", larguraMinima: 90, celula: (r) => <span className="font-mono">{r.sigla}</span> },
  { chave: "tipo", titulo: "Tipo", alinhamento: "centro", larguraMinima: 110, celula: (r) => r.base ? "Base" : "Composta" },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (r) => <Pill tone={r.ativo ? "green" : "neutral"}>{r.ativo ? "Ativa" : "Inativa"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (r) => <AcoesLinha nome={r.nome} ativo={r.ativo} onEditar={() => editar(r)} onAlternar={() => alternar(r)} /> },
];

const colunasMotivos = (editar: (m: MotivoSaida) => void, alternar: (m: MotivoSaida) => void): ColunaTabela<MotivoSaida>[] => [
  { chave: "motivo", titulo: "Motivo", larguraMinima: 210, principal: true, celula: (m) => <strong className="break-words">{m.nome}</strong> },
  { chave: "tipo", titulo: "Tipo", larguraMinima: 140, celula: (m) => rotuloTipoSaida(m.tipo) },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (m) => <Pill tone={m.ativo ? "green" : "neutral"}>{m.ativo ? "Ativo" : "Inativo"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (m) => <AcoesLinha nome={m.nome} ativo={m.ativo} onEditar={() => editar(m)} onAlternar={() => alternar(m)} /> },
];

function mensagemDesativar(confirmacao: NonNullable<Confirmacao>): string {
  if (confirmacao.tipo === "raca") return "A raça deixa de aparecer para novos cadastros e composições raciais. Composições já registradas continuam intactas.";
  return "O motivo deixa de aparecer para novas saídas. Saídas já registradas continuam intactas.";
}

export function Cadastros({ podeLancar = true }: { podeLancar?: boolean }) {
  const [aba, setAba] = useState<Aba>("categorias");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [racas, setRacas] = useState<Raca[] | null>(null);
  const [motivos, setMotivos] = useState<MotivoSaida[] | null>(null);
  const [painel, setPainel] = useState<Painel>(null);
  const [confirmando, setConfirmando] = useState<Confirmacao>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const emCurso = useRef(false);

  // ---------- categorias ----------
  const [categorias, setCategorias] = useState<CategoriaDTO[] | null>(null);
  const [semCategoriaAtual, setSemCategoriaAtual] = useState(0);
  const [painelCategoria, setPainelCategoria] = useState<PainelCategoria>(null);
  const [confirmacaoCategoria, setConfirmacaoCategoria] = useState<ConfirmacaoCategoria>(null);
  const [simulando, setSimulando] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  const carregarRacas = useCallback(() => listarRacas({ incluirInativos: mostrarInativos }).then(setRacas).catch((e) => setErro(e.message)), [mostrarInativos]);
  const carregarMotivos = useCallback(() => listarMotivosSaida({ incluirInativos: mostrarInativos }).then(setMotivos).catch((e) => setErro(e.message)), [mostrarInativos]);
  /** sempre traz ativas e inativas — a simulação precisa da lista completa; "Mostrar inativas" só filtra a tabela. */
  const carregarCategorias = useCallback(() => listarCategorias({ incluirInativos: true }).then((r) => { setCategorias(r.itens); setSemCategoriaAtual(r.semCategoria); }).catch((e) => setErro(mensagemErro(e))), []);

  useEffect(() => {
    if (aba === "racas") carregarRacas();
    else if (aba === "motivos") carregarMotivos();
    else carregarCategorias();
  }, [aba, carregarRacas, carregarMotivos, carregarCategorias]);

  const recarregarAtual = useCallback(async () => {
    if (aba === "racas") await carregarRacas();
    else if (aba === "motivos") await carregarMotivos();
    else await carregarCategorias();
  }, [aba, carregarRacas, carregarMotivos, carregarCategorias]);

  const executar = async (acao: () => Promise<unknown>) => {
    if (emCurso.current) return;
    emCurso.current = true; setProcessando(true); setErro(null);
    try { await acao(); await recarregarAtual(); }
    catch (e) { setConfirmando(null); setErro(mensagemErro(e)); }
    finally { emCurso.current = false; setProcessando(false); }
  };

  const trocarAba = (nova: Aba) => { setAba(nova); setMostrarInativos(false); setPainel(null); setConfirmando(null); setPainelCategoria(null); setConfirmacaoCategoria(null); setErro(null); };
  const abrirNovo = (entidade: EntidadePainel) => { if (!emCurso.current) setPainel({ entidade, modo: "novo" }); };
  const editar = (entidade: EntidadePainel, item: { id: string | number }) => { if (!emCurso.current) setPainel({ entidade, modo: "editar", id: item.id }); };

  const alternarRaca = (r: Raca) => { if (emCurso.current) return; if (r.ativo) { setConfirmando({ tipo: "raca", item: r }); return; } void executar(() => editarRaca(r.id, { ativo: true })); };
  const alternarMotivo = (m: MotivoSaida) => { if (emCurso.current) return; if (m.ativo) { setConfirmando({ tipo: "motivo", item: m }); return; } void executar(() => editarMotivoSaida(m.id, { ativo: true })); };

  const confirmarDesativacao = () => {
    if (!confirmando) return;
    void executar(async () => {
      if (confirmando.tipo === "raca") await editarRaca(confirmando.item.id, { ativo: false });
      else await editarMotivoSaida(confirmando.item.id, { ativo: false });
      setConfirmando(null);
    });
  };

  const aoSalvar = async () => { setPainel(null); await recarregarAtual(); };

  // ---------- categorias: simular → confirmar (se houver mudança) → aplicar ----------

  /** `simular` monta o pedido de simulação (lista completa de regras, ou a chamada dedicada de
   *  restaurar padrões); `aplicar` só roda depois de confirmado (ou direto, se nada muda). */
  const comSimulacao = async (simular: () => Promise<ResultadoSimulacaoCategorias>, aplicar: () => Promise<unknown>) => {
    if (simulando || aplicando) return;
    setSimulando(true); setErro(null);
    try {
      const resultado = await simular();
      if (resultado.afetados > 0 || resultado.semCategoria !== semCategoriaAtual) {
        setConfirmacaoCategoria({ resultado, aplicar });
      } else {
        await aplicar();
        setPainelCategoria(null);
        await carregarCategorias();
      }
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setSimulando(false); }
  };

  const confirmarAplicacaoCategoria = async () => {
    if (!confirmacaoCategoria) return;
    setAplicando(true); setErro(null);
    try {
      await confirmacaoCategoria.aplicar();
      setConfirmacaoCategoria(null);
      setPainelCategoria(null);
      await carregarCategorias();
    } catch (e) {
      setConfirmacaoCategoria(null);
      setErro(mensagemErro(e));
    } finally { setAplicando(false); }
  };

  const categoriasExibidas = (categorias ?? []).filter((c) => mostrarInativos || c.ativo);

  const salvarCategoria = (dados: DadosFormCategoria) => {
    if (!categorias) return;
    const alvo = painelCategoria?.modo === "editar" ? painelCategoria.categoria : null;
    const propostas: RegraCategoriaProposta[] = alvo
      ? categorias.map((c) => (c.id === alvo.id ? { ...paraProposta(c), ...dados } : paraProposta(c)))
      : [...categorias.map(paraProposta), { ...dados, ativo: true, ordem: Math.max(0, ...categorias.map((c) => c.ordem)) + 10 }];
    const aplicar = alvo ? () => editarCategoria(alvo.id, dados) : () => criarCategoria(dados);
    void comSimulacao(() => simularCategorias(propostas), aplicar);
  };

  const alternarCategoria = (c: CategoriaDTO) => {
    if (!categorias || emCurso.current) return;
    const novoAtivo = !c.ativo;
    const propostas = categorias.map((x) => (x.id === c.id ? { ...paraProposta(x), ativo: novoAtivo } : paraProposta(x)));
    void comSimulacao(() => simularCategorias(propostas), () => editarCategoria(c.id, { ativo: novoAtivo }));
  };

  const moverCategoria = (categoria: CategoriaDTO, direcao: -1 | 1) => {
    if (!categorias) return;
    const atual = categoriasExibidas.findIndex((c) => c.id === categoria.id);
    const destino = atual + direcao;
    if (atual < 0 || destino < 0 || destino >= categoriasExibidas.length) return;
    const reordenadas = [...categoriasExibidas];
    [reordenadas[atual], reordenadas[destino]] = [reordenadas[destino], reordenadas[atual]];
    const idsVisiveisNovaOrdem = reordenadas.map((c) => c.id);
    const idsRestantes = categorias.filter((c) => !idsVisiveisNovaOrdem.includes(c.id)).map((c) => c.id);
    const idsFinal = [...idsVisiveisNovaOrdem, ...idsRestantes];
    const propostas = idsFinal.map((id, i) => ({ ...paraProposta(categorias.find((c) => c.id === id)!), ordem: (i + 1) * 10 }));
    void comSimulacao(() => simularCategorias(propostas), () => reordenarCategorias(idsVisiveisNovaOrdem));
  };

  const restaurarPadroes = () => {
    void comSimulacao(() => restaurarPadroesCategorias({ simular: true }), () => restaurarPadroesCategorias({ simular: false }));
  };

  const categoriaSelecionada = painelCategoria?.modo === "editar" ? painelCategoria.categoria : null;

  const racaSelecionada = painel?.entidade === "raca" && painel.modo === "editar" ? (racas ?? []).find((r) => r.id === painel.id) ?? null : null;
  const motivoSelecionado = painel?.entidade === "motivo" && painel.modo === "editar" ? (motivos ?? []).find((m) => m.id === painel.id) ?? null : null;
  /* key força remount do formulário a cada abertura, zerando o estado local */
  const chavePainel = painel ? `${painel.entidade}-${painel.modo === "editar" ? painel.id : "novo"}` : "fechado";
  const chavePainelCategoria = painelCategoria ? (painelCategoria.modo === "editar" ? `editar-${painelCategoria.categoria.id}` : "novo") : "fechado";

  const acao = !podeLancar ? undefined
    : aba === "categorias" ? <div className="flex flex-wrap gap-2"><Button secondary onClick={restaurarPadroes}>Restaurar padrões</Button><Button onClick={() => setPainelCategoria({ modo: "novo" })}><Plus size={16} /> Nova categoria</Button></div>
    : aba === "racas" ? <Button onClick={() => abrirNovo("raca")}><Plus size={16} /> Nova raça</Button>
    : <Button onClick={() => abrirNovo("motivo")}><Plus size={16} /> Novo motivo de saída</Button>;

  const carregando = (aba === "racas" && racas === null) || (aba === "motivos" && motivos === null) || (aba === "categorias" && categorias === null);
  const bloqueado = processando || simulando || aplicando;

  return <PaginaFinanceira>
    <PageHeader eyebrow="Pecuária" titulo="Cadastros" descricao="Categorias, raças e motivos de saída usados pelo rebanho." acao={acao} />
    <NavRebanho ativa="cadastros" />
    <ErrorBox erro={painelCategoria ? null : erro} />
    <SubAbas abas={[
      { valor: "categorias", rotulo: "Categorias", icon: Tags },
      { valor: "racas", rotulo: "Raças", icon: Dna },
      { valor: "motivos", rotulo: "Motivos de saída", icon: LogOut },
    ]} ativa={aba} onSelecionar={trocarAba} />

    <fieldset disabled={bloqueado || !podeLancar} aria-busy={bloqueado} className="min-w-0">
      {carregando
        ? <div className="mt-5"><Loader label={`Carregando ${aba === "categorias" ? "categorias" : aba === "racas" ? "raças" : "motivos de saída"}`} /></div>
        : <>
          {aba === "categorias" && <>
            <p className="mt-5 max-w-3xl text-sm text-ink-3">As categorias são calculadas por estas regras, na ordem da tabela — a primeira que casa vence, dentro de cada sexo. Itens marcados "Padrão" vêm do IDEAGRI. Uma troca manual feita na ficha do animal tem prioridade sobre o cálculo até ser desfeita.</p>
            {semCategoriaAtual > 0 && <div role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{semCategoriaAtual} {semCategoriaAtual === 1 ? "animal ativo" : "animais ativos"} sem categoria — nenhuma regra casou.</div>}
            <Panel className="mt-4 overflow-hidden">
              <BarraFiltros><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />Mostrar inativas</label></BarraFiltros>
              <TabelaFinanceira rotulo="Categorias" itens={categoriasExibidas} colunas={colunasCategorias(categoriasExibidas, (c) => setPainelCategoria({ modo: "editar", categoria: c }), alternarCategoria, moverCategoria)} chaveDe={(c) => c.id} onAbrir={podeLancar ? (c) => setPainelCategoria({ modo: "editar", categoria: c }) : undefined} classeLinha={(c) => !c.ativo ? "opacity-55" : ""} />
            </Panel>
          </>}

          {aba === "racas" && <Panel className="mt-5 overflow-hidden">
            <BarraFiltros><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />Mostrar inativos</label></BarraFiltros>
            <TabelaFinanceira rotulo="Raças" itens={racas ?? []} colunas={colunasRacas((r) => editar("raca", r), alternarRaca)} chaveDe={(r) => r.id} onAbrir={podeLancar ? (r) => editar("raca", r) : undefined} classeLinha={(r) => !r.ativo ? "opacity-55" : ""} />
          </Panel>}

          {aba === "motivos" && <Panel className="mt-5 overflow-hidden">
            <BarraFiltros><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />Mostrar inativos</label></BarraFiltros>
            <TabelaFinanceira rotulo="Motivos de saída" itens={motivos ?? []} colunas={colunasMotivos((m) => editar("motivo", m), alternarMotivo)} chaveDe={(m) => m.id} onAbrir={podeLancar ? (m) => editar("motivo", m) : undefined} classeLinha={(m) => !m.ativo ? "opacity-55" : ""} />
          </Panel>}
        </>}
    </fieldset>

    {painel?.entidade === "raca" && <FormRaca key={chavePainel} raca={racaSelecionada} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
    {painel?.entidade === "motivo" && <FormMotivoSaida key={chavePainel} motivo={motivoSelecionado} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
    {painelCategoria && <FormCategoria key={chavePainelCategoria} categoria={categoriaSelecionada} salvando={simulando || aplicando} erro={erro} onSalvar={salvarCategoria} onFechar={() => { if (!simulando && !aplicando) setPainelCategoria(null); }} />}

    <ConfirmDialog
      open={confirmando !== null}
      title={confirmando ? `Desativar ${confirmando.item.nome}?` : ""}
      message={confirmando ? mensagemDesativar(confirmando) : ""}
      confirmLabel="Desativar"
      cancelLabel="Manter ativo"
      tone="danger"
      processando={processando}
      onConfirm={confirmarDesativacao}
      onCancel={() => setConfirmando(null)}
    />

    <ConfirmDialog
      open={confirmacaoCategoria !== null}
      title="Aplicar esta mudança?"
      message={confirmacaoCategoria && <div className="space-y-1.5">
        {confirmacaoCategoria.resultado.mudancas.map((m, i) => <p key={i}>{m.total} {m.total === 1 ? "animal" : "animais"}: {m.de?.nome ?? "Sem categoria"} → {m.para?.nome ?? "Sem categoria"}</p>)}
        {confirmacaoCategoria.resultado.semCategoria !== semCategoriaAtual && <p>{confirmacaoCategoria.resultado.semCategoria} {confirmacaoCategoria.resultado.semCategoria === 1 ? "animal fica" : "animais ficam"} sem categoria.</p>}
      </div>}
      confirmLabel="Aplicar mudança"
      cancelLabel="Cancelar"
      tone="neutral"
      processando={aplicando}
      onConfirm={() => { void confirmarAplicacaoCategoria(); }}
      onCancel={() => setConfirmacaoCategoria(null)}
    />
  </PaginaFinanceira>;
}

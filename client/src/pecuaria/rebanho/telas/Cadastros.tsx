// Cadastros do Rebanho — sub-abas locais Lotes · Raças · Motivos de saída ·
// Sítios, no padrão visual de ConfiguracoesFinanceiras.tsx (tabela +
// AcoesLinha + ConfirmDialog para desativar + PainelCadastro para o form).
// Cada aba carrega sua própria lista (lotes/raças/motivos vêm de
// services/pecuaria/rebanho/*; sítios reusa client/src/api/propriedades.ts,
// que agora aceita `incluirInativos`).

import { useCallback, useEffect, useRef, useState } from "react";
import { Dna, Layers, LogOut, MapPin, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Loader } from "@/components/Loading";
import { editarPropriedade, usePropriedades, type PropriedadeDTO } from "../../../api/propriedades";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { AcoesLinha, Button, type ColunaTabela, ErrorBox, PageHeader, PaginaFinanceira, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { BarraFiltros, SubAbas } from "../ui";
import { NavRebanho } from "./NavRebanho";
import { editarLote, editarMotivoSaida, editarRaca, listarLotes, listarMotivosSaida, listarRacas } from "../api";
import type { Lote, MotivoSaida, Raca } from "../types";
import { rotuloTipoSaida } from "../lib/rotulos";
import { FormLote } from "../cadastros/FormLote";
import { FormMotivoSaida } from "../cadastros/FormMotivoSaida";
import { FormRaca } from "../cadastros/FormRaca";
import { FormSitio } from "../cadastros/FormSitio";

type Aba = "lotes" | "racas" | "motivos" | "sitios";
type EntidadePainel = "lote" | "raca" | "motivo" | "sitio";
type Painel = { entidade: EntidadePainel; modo: "novo" } | { entidade: EntidadePainel; modo: "editar"; id: string | number } | null;
type Confirmacao =
  | { tipo: "lote"; item: Lote }
  | { tipo: "raca"; item: Raca }
  | { tipo: "motivo"; item: MotivoSaida }
  | { tipo: "sitio"; item: PropriedadeDTO }
  | null;

const colunasLotes = (editar: (l: Lote) => void, alternar: (l: Lote) => void): ColunaTabela<Lote>[] => [
  { chave: "lote", titulo: "Lote", larguraMinima: 200, principal: true, celula: (l) => <strong className="break-words">{l.nome}</strong> },
  { chave: "sitio", titulo: "Sítio", larguraMinima: 160, celula: (l) => <span className="break-words">{l.propriedade.nome}</span> },
  { chave: "animais", titulo: "Animais ativos", alinhamento: "centro", larguraMinima: 130, celula: (l) => l.animaisAtivos },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (l) => <Pill tone={l.ativo ? "green" : "neutral"}>{l.ativo ? "Ativo" : "Inativo"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (l) => <AcoesLinha nome={l.nome} ativo={l.ativo} onEditar={() => editar(l)} onAlternar={() => alternar(l)} /> },
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

const colunasSitios = (editar: (s: PropriedadeDTO) => void, alternar: (s: PropriedadeDTO) => void): ColunaTabela<PropriedadeDTO>[] => [
  { chave: "sitio", titulo: "Sítio", larguraMinima: 200, principal: true, celula: (s) => <strong className="break-words">{s.nome}</strong> },
  { chave: "apelido", titulo: "Apelido", larguraMinima: 140, celula: (s) => <span className="break-words">{s.apelido || "—"}</span> },
  { chave: "principal", titulo: "Principal", alinhamento: "centro", larguraMinima: 100, celula: (s) => s.principal ? <Pill tone="blue">Principal</Pill> : "—" },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (s) => <Pill tone={s.ativo ? "green" : "neutral"}>{s.ativo ? "Ativo" : "Inativo"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (s) => <AcoesLinha nome={s.nome} ativo={s.ativo} onEditar={() => editar(s)} onAlternar={() => alternar(s)} /> },
];

function mensagemDesativar(confirmacao: NonNullable<Confirmacao>): string {
  if (confirmacao.tipo === "lote") {
    const { animaisAtivos } = confirmacao.item;
    return animaisAtivos > 0
      ? `Este lote tem ${animaisAtivos} ${animaisAtivos === 1 ? "animal ativo" : "animais ativos"}. Mova-os para outro lote antes de desativar.`
      : "O lote deixa de aparecer para novos cadastros e movimentações. Você pode reativar quando quiser.";
  }
  if (confirmacao.tipo === "raca") return "A raça deixa de aparecer para novos cadastros e composições raciais. Composições já registradas continuam intactas.";
  if (confirmacao.tipo === "motivo") return "O motivo deixa de aparecer para novas saídas. Saídas já registradas continuam intactas.";
  return "O sítio deixa de aparecer no seletor e em novos cadastros. Lotes, animais e outros registros já vinculados continuam intactos.";
}

export function Cadastros({ podeLancar = true }: { podeLancar?: boolean }) {
  const [aba, setAba] = useState<Aba>("lotes");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [filtroSitioLote, setFiltroSitioLote] = useState("");
  const [lotes, setLotes] = useState<Lote[] | null>(null);
  const [racas, setRacas] = useState<Raca[] | null>(null);
  const [motivos, setMotivos] = useState<MotivoSaida[] | null>(null);
  const sitios = usePropriedades({ incluirInativos: mostrarInativos });
  const [painel, setPainel] = useState<Painel>(null);
  const [confirmando, setConfirmando] = useState<Confirmacao>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const emCurso = useRef(false);

  const carregarLotes = useCallback(() => listarLotes({ incluirInativos: mostrarInativos }).then(setLotes).catch((e) => setErro(e.message)), [mostrarInativos]);
  const carregarRacas = useCallback(() => listarRacas({ incluirInativos: mostrarInativos }).then(setRacas).catch((e) => setErro(e.message)), [mostrarInativos]);
  const carregarMotivos = useCallback(() => listarMotivosSaida({ incluirInativos: mostrarInativos }).then(setMotivos).catch((e) => setErro(e.message)), [mostrarInativos]);

  useEffect(() => {
    if (aba === "lotes") carregarLotes();
    else if (aba === "racas") carregarRacas();
    else if (aba === "motivos") carregarMotivos();
  }, [aba, carregarLotes, carregarRacas, carregarMotivos]);

  const recarregarAtual = useCallback(async () => {
    if (aba === "lotes") await carregarLotes();
    else if (aba === "racas") await carregarRacas();
    else if (aba === "motivos") await carregarMotivos();
    else sitios.recarregar();
  }, [aba, carregarLotes, carregarRacas, carregarMotivos, sitios]);

  const executar = async (acao: () => Promise<unknown>) => {
    if (emCurso.current) return;
    emCurso.current = true; setProcessando(true); setErro(null);
    try { await acao(); await recarregarAtual(); }
    catch (e) { setConfirmando(null); setErro(e instanceof Error ? e.message : String(e)); }
    finally { emCurso.current = false; setProcessando(false); }
  };

  const trocarAba = (nova: Aba) => { setAba(nova); setMostrarInativos(false); setFiltroSitioLote(""); setPainel(null); setConfirmando(null); setErro(null); };
  const abrirNovo = (entidade: EntidadePainel) => { if (!emCurso.current) setPainel({ entidade, modo: "novo" }); };
  const editar = (entidade: EntidadePainel, item: { id: string | number }) => { if (!emCurso.current) setPainel({ entidade, modo: "editar", id: item.id }); };

  const alternarLote = (l: Lote) => { if (emCurso.current) return; if (l.ativo) { setConfirmando({ tipo: "lote", item: l }); return; } void executar(() => editarLote(l.id, { ativo: true })); };
  const alternarRaca = (r: Raca) => { if (emCurso.current) return; if (r.ativo) { setConfirmando({ tipo: "raca", item: r }); return; } void executar(() => editarRaca(r.id, { ativo: true })); };
  const alternarMotivo = (m: MotivoSaida) => { if (emCurso.current) return; if (m.ativo) { setConfirmando({ tipo: "motivo", item: m }); return; } void executar(() => editarMotivoSaida(m.id, { ativo: true })); };
  const alternarSitio = (s: PropriedadeDTO) => { if (emCurso.current) return; if (s.ativo) { setConfirmando({ tipo: "sitio", item: s }); return; } void executar(() => editarPropriedade(s.id, { nome: s.nome, ativo: true })); };

  const confirmarDesativacao = () => {
    if (!confirmando) return;
    void executar(async () => {
      if (confirmando.tipo === "lote") await editarLote(confirmando.item.id, { ativo: false });
      else if (confirmando.tipo === "raca") await editarRaca(confirmando.item.id, { ativo: false });
      else if (confirmando.tipo === "motivo") await editarMotivoSaida(confirmando.item.id, { ativo: false });
      else await editarPropriedade(confirmando.item.id, { nome: confirmando.item.nome, ativo: false });
      setConfirmando(null);
    });
  };

  const aoSalvar = async () => { setPainel(null); await recarregarAtual(); };

  const loteSelecionado = painel?.entidade === "lote" && painel.modo === "editar" ? (lotes ?? []).find((l) => l.id === painel.id) ?? null : null;
  const racaSelecionada = painel?.entidade === "raca" && painel.modo === "editar" ? (racas ?? []).find((r) => r.id === painel.id) ?? null : null;
  const motivoSelecionado = painel?.entidade === "motivo" && painel.modo === "editar" ? (motivos ?? []).find((m) => m.id === painel.id) ?? null : null;
  const sitioSelecionado = painel?.entidade === "sitio" && painel.modo === "editar" ? sitios.data.find((s) => s.id === painel.id) ?? null : null;
  /* key força remount do formulário a cada abertura, zerando o estado local */
  const chavePainel = painel ? `${painel.entidade}-${painel.modo === "editar" ? painel.id : "novo"}` : "fechado";

  const sitiosAtivos = sitios.data.filter((s) => s.ativo);
  const lotesFiltrados = filtroSitioLote ? (lotes ?? []).filter((l) => String(l.propriedadeId) === filtroSitioLote) : lotes ?? [];
  /* pré-seleciona o sítio ativo no seletor global (comPropriedade), quando houver, na criação de lote */
  const propriedadeInicialLote = getPropriedadeAtiva() ?? sitiosAtivos[0]?.id ?? null;

  const acao = !podeLancar ? undefined : aba === "lotes" ? <Button onClick={() => abrirNovo("lote")}><Plus size={16} /> Novo lote</Button>
    : aba === "racas" ? <Button onClick={() => abrirNovo("raca")}><Plus size={16} /> Nova raça</Button>
    : aba === "motivos" ? <Button onClick={() => abrirNovo("motivo")}><Plus size={16} /> Novo motivo de saída</Button>
    : <Button onClick={() => abrirNovo("sitio")}><Plus size={16} /> Novo sítio</Button>;

  const carregando = (aba === "lotes" && lotes === null) || (aba === "racas" && racas === null) || (aba === "motivos" && motivos === null) || (aba === "sitios" && sitios.loading && sitios.data.length === 0);

  return <PaginaFinanceira>
    <PageHeader eyebrow="Pecuária" titulo="Cadastros" descricao="Lotes, raças, motivos de saída e sítios usados pelo rebanho." acao={acao} />
    <NavRebanho ativa="cadastros" />
    <ErrorBox erro={erro} />
    <SubAbas abas={[
      { valor: "lotes", rotulo: "Lotes", icon: Layers },
      { valor: "racas", rotulo: "Raças", icon: Dna },
      { valor: "motivos", rotulo: "Motivos de saída", icon: LogOut },
      { valor: "sitios", rotulo: "Sítios", icon: MapPin },
    ]} ativa={aba} onSelecionar={trocarAba} />

    <fieldset disabled={processando || !podeLancar} aria-busy={processando} className="min-w-0">
      {carregando
        ? <div className="mt-5"><Loader label={`Carregando ${aba === "lotes" ? "lotes" : aba === "racas" ? "raças" : aba === "motivos" ? "motivos de saída" : "sítios"}`} /></div>
        : <>
          {aba === "lotes" && <Panel className="mt-5 overflow-hidden">
            <BarraFiltros>
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />Mostrar inativos</label>
              <label className="flex items-center gap-2 text-sm font-medium">Sítio
                <select aria-label="Filtrar por sítio" value={filtroSitioLote} onChange={(e) => setFiltroSitioLote(e.target.value)} className="rounded-lg border border-border bg-white p-2 text-sm font-normal">
                  <option value="">Todos</option>
                  {sitiosAtivos.map((s) => <option key={s.id} value={s.id}>{s.apelido || s.nome}</option>)}
                </select>
              </label>
            </BarraFiltros>
            <TabelaFinanceira rotulo="Lotes" itens={lotesFiltrados} colunas={colunasLotes((l) => editar("lote", l), alternarLote)} chaveDe={(l) => l.id} onAbrir={podeLancar ? (l) => editar("lote", l) : undefined} classeLinha={(l) => !l.ativo ? "opacity-55" : ""} />
          </Panel>}

          {aba === "racas" && <Panel className="mt-5 overflow-hidden">
            <BarraFiltros><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />Mostrar inativos</label></BarraFiltros>
            <TabelaFinanceira rotulo="Raças" itens={racas ?? []} colunas={colunasRacas((r) => editar("raca", r), alternarRaca)} chaveDe={(r) => r.id} onAbrir={podeLancar ? (r) => editar("raca", r) : undefined} classeLinha={(r) => !r.ativo ? "opacity-55" : ""} />
          </Panel>}

          {aba === "motivos" && <Panel className="mt-5 overflow-hidden">
            <BarraFiltros><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />Mostrar inativos</label></BarraFiltros>
            <TabelaFinanceira rotulo="Motivos de saída" itens={motivos ?? []} colunas={colunasMotivos((m) => editar("motivo", m), alternarMotivo)} chaveDe={(m) => m.id} onAbrir={podeLancar ? (m) => editar("motivo", m) : undefined} classeLinha={(m) => !m.ativo ? "opacity-55" : ""} />
          </Panel>}

          {aba === "sitios" && <Panel className="mt-5 overflow-hidden">
            <BarraFiltros><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />Mostrar inativos</label></BarraFiltros>
            <TabelaFinanceira rotulo="Sítios" itens={sitios.data} colunas={colunasSitios((s) => editar("sitio", s), alternarSitio)} chaveDe={(s) => s.id} onAbrir={podeLancar ? (s) => editar("sitio", s) : undefined} classeLinha={(s) => !s.ativo ? "opacity-55" : ""} />
          </Panel>}
        </>}
    </fieldset>

    {painel?.entidade === "lote" && <FormLote key={chavePainel} lote={loteSelecionado} propriedades={sitiosAtivos} propriedadeInicialId={propriedadeInicialLote} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
    {painel?.entidade === "raca" && <FormRaca key={chavePainel} raca={racaSelecionada} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
    {painel?.entidade === "motivo" && <FormMotivoSaida key={chavePainel} motivo={motivoSelecionado} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
    {painel?.entidade === "sitio" && <FormSitio key={chavePainel} sitio={sitioSelecionado} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}

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
  </PaginaFinanceira>;
}

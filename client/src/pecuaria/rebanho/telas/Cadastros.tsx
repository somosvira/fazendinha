// Cadastros do Rebanho — sub-abas locais Raças · Motivos de saída, no padrão
// visual de ConfiguracoesFinanceiras.tsx (tabela + AcoesLinha + ConfirmDialog
// para desativar + PainelCadastro para o form). Cada aba carrega sua própria
// lista (services/pecuaria/rebanho/*). Lotes têm tela própria (ListaLotes.tsx).

import { useCallback, useEffect, useRef, useState } from "react";
import { Dna, LogOut, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Loader } from "@/components/Loading";
import { AcoesLinha, Button, type ColunaTabela, ErrorBox, PageHeader, PaginaFinanceira, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { BarraFiltros, SubAbas } from "../ui";
import { NavRebanho } from "./NavRebanho";
import { editarMotivoSaida, editarRaca, listarMotivosSaida, listarRacas } from "../api";
import type { MotivoSaida, Raca } from "../types";
import { rotuloTipoSaida } from "../lib/rotulos";
import { FormMotivoSaida } from "../cadastros/FormMotivoSaida";
import { FormRaca } from "../cadastros/FormRaca";

type Aba = "racas" | "motivos";
type EntidadePainel = "raca" | "motivo";
type Painel = { entidade: EntidadePainel; modo: "novo" } | { entidade: EntidadePainel; modo: "editar"; id: string | number } | null;
type Confirmacao =
  | { tipo: "raca"; item: Raca }
  | { tipo: "motivo"; item: MotivoSaida }
  | null;

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
  const [aba, setAba] = useState<Aba>("racas");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [racas, setRacas] = useState<Raca[] | null>(null);
  const [motivos, setMotivos] = useState<MotivoSaida[] | null>(null);
  const [painel, setPainel] = useState<Painel>(null);
  const [confirmando, setConfirmando] = useState<Confirmacao>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const emCurso = useRef(false);

  const carregarRacas = useCallback(() => listarRacas({ incluirInativos: mostrarInativos }).then(setRacas).catch((e) => setErro(e.message)), [mostrarInativos]);
  const carregarMotivos = useCallback(() => listarMotivosSaida({ incluirInativos: mostrarInativos }).then(setMotivos).catch((e) => setErro(e.message)), [mostrarInativos]);

  useEffect(() => {
    if (aba === "racas") carregarRacas();
    else carregarMotivos();
  }, [aba, carregarRacas, carregarMotivos]);

  const recarregarAtual = useCallback(async () => {
    if (aba === "racas") await carregarRacas();
    else await carregarMotivos();
  }, [aba, carregarRacas, carregarMotivos]);

  const executar = async (acao: () => Promise<unknown>) => {
    if (emCurso.current) return;
    emCurso.current = true; setProcessando(true); setErro(null);
    try { await acao(); await recarregarAtual(); }
    catch (e) { setConfirmando(null); setErro(e instanceof Error ? e.message : String(e)); }
    finally { emCurso.current = false; setProcessando(false); }
  };

  const trocarAba = (nova: Aba) => { setAba(nova); setMostrarInativos(false); setPainel(null); setConfirmando(null); setErro(null); };
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

  const racaSelecionada = painel?.entidade === "raca" && painel.modo === "editar" ? (racas ?? []).find((r) => r.id === painel.id) ?? null : null;
  const motivoSelecionado = painel?.entidade === "motivo" && painel.modo === "editar" ? (motivos ?? []).find((m) => m.id === painel.id) ?? null : null;
  /* key força remount do formulário a cada abertura, zerando o estado local */
  const chavePainel = painel ? `${painel.entidade}-${painel.modo === "editar" ? painel.id : "novo"}` : "fechado";

  const acao = !podeLancar ? undefined : aba === "racas" ? <Button onClick={() => abrirNovo("raca")}><Plus size={16} /> Nova raça</Button>
    : <Button onClick={() => abrirNovo("motivo")}><Plus size={16} /> Novo motivo de saída</Button>;

  const carregando = (aba === "racas" && racas === null) || (aba === "motivos" && motivos === null);

  return <PaginaFinanceira>
    <PageHeader eyebrow="Pecuária" titulo="Cadastros" descricao="Raças e motivos de saída usados pelo rebanho." acao={acao} />
    <NavRebanho ativa="cadastros" />
    <ErrorBox erro={erro} />
    <SubAbas abas={[
      { valor: "racas", rotulo: "Raças", icon: Dna },
      { valor: "motivos", rotulo: "Motivos de saída", icon: LogOut },
    ]} ativa={aba} onSelecionar={trocarAba} />

    <fieldset disabled={processando || !podeLancar} aria-busy={processando} className="min-w-0">
      {carregando
        ? <div className="mt-5"><Loader label={`Carregando ${aba === "racas" ? "raças" : "motivos de saída"}`} /></div>
        : <>
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

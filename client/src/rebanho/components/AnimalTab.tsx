import { useState } from "react";
import { useAnimais, useSetores, useFiltrosAnimais, criarFiltroAnimal, excluirFiltroAnimal, type FiltroCriterios } from "../api";
import { HerdDomainView, RB_TOOLBAR } from "./HerdDomainView";
import { RebHeader } from "./RebHeader";
import { DOMAINS } from "../domains";
import { Loader } from "../../components/Loading";
import type { FinalidadeAnimal, ResumoAnimal } from "../types";
import { ToolbarSelect } from "@/components/ToolbarSelect";
import { RebButton } from "@/components/rb/RebButton";
import { RebSelect } from "@/components/rb/RebSelect";
import { RebMain } from "@/components/rb/RebPrimitives";
import { PromptDialog } from "@/components/PromptDialog";
import { AlteracaoColetivaPanel } from "./AlteracaoColetivaPanel";

type StatusFiltro = "ATIVO" | "BAIXADO" | "TODOS";
const OPCOES: { k: StatusFiltro; lab: string }[] = [
  { k: "ATIVO", lab: "Ativos" },
  { k: "BAIXADO", lab: "Baixados" },
  { k: "TODOS", lab: "Todos" },
];

export function AnimalTab({ onAbrirAnimal, onNovo }: { onAbrirAnimal: (id: string) => void; onNovo: () => void }) {
  const [status, setStatus] = useState<StatusFiltro>("ATIVO");
  const [setor, setSetor] = useState<string>("");
  const [grupoId, setGrupoId] = useState<number | undefined>(undefined);
  const [categoria, setCategoria] = useState<string | undefined>(undefined);
  const [finalidade, setFinalidade] = useState<FinalidadeAnimal | undefined>(undefined);
  const [busca, setBusca] = useState<string | undefined>(undefined);
  const [bulkAberto, setBulkAberto] = useState(false);
  const [promptFiltroAberto, setPromptFiltroAberto] = useState(false);
  const { data, loading, erro, recarregar } = useAnimais({ status, setor: setor || undefined, grupoId, categoria, finalidade, q: busca });
  const { data: setores } = useSetores();
  const filtros = useFiltrosAnimais();

  // Aplica um filtro salvo: joga os critérios normalizados nos estados de filtro.
  function aplicarFiltro(c: FiltroCriterios) {
    setStatus(c.status); setSetor(c.setor ?? ""); setGrupoId(c.grupoId); setCategoria(c.categoria); setFinalidade(c.finalidade); setBusca(c.q);
  }
  async function confirmarSalvarFiltro(nome: string) {
    setPromptFiltroAberto(false);
    await criarFiltroAnimal({ nome, status, grupoId: grupoId ?? null, setor: setor || null, categoria: categoria ?? null, finalidade: finalidade ?? null, busca: busca ?? null });
    filtros.recarregar();
  }
  async function removerFiltro(id: number) { await excluirFiltroAnimal(id); filtros.recarregar(); }

  // ResumoAnimal[] que o HerdDomainView consome — cada animal traz seu resumo embutido.
  const resumos: ResumoAnimal[] = data.map((a) => ({
    ...(a.resumo ?? { statusReprodutivo: "VAZIA" }),
    animalId: a.id,
    categoria: a.categoria,
    finalidade: a.finalidade,
    dataNascimento: a.dataNascimento,
    ultimoPesoKg: a.ultimoPesoKg,
    grupoNome: a.grupoNome,
    setor: a.setor,
  }) as ResumoAnimal);
  // Para baixados, anexa data/motivo da baixa ao nome (espelha o Ideagri).
  const nomes = Object.fromEntries(
    data.map((a) => [
      a.id,
      {
        nome: a.ativo
          ? (a.nome ?? "")
          : `${a.nome ?? ""} · baixa ${a.dataBaixa ?? ""}${a.motivoBaixa ? ` (${a.motivoBaixa})` : ""}`.trim(),
        numero: a.numero,
      },
    ]),
  );

  // Controles (filtro de status + setor + novo) — renderizados na toolbar do header
  // (em fluxo normal, sem sobrepor o cabeçalho). Espelha o filtro do Ideagri.
  const controles = (
    <>
      <div className="flex gap-1.5">
        {OPCOES.map((o) => (
          <RebButton key={o.k} aria-pressed={status === o.k} onClick={() => setStatus(o.k)}>
            {o.lab}
          </RebButton>
        ))}
      </div>
      <ToolbarSelect
        value={finalidade ?? ""}
        onChange={(value) => setFinalidade((value || undefined) as FinalidadeAnimal | undefined)}
        ariaLabel="Filtrar por finalidade produtiva"
        options={[
          { value: "", label: "Todas as finalidades" },
          { value: "LEITE", label: "Leite" },
          { value: "CORTE", label: "Corte" },
          { value: "DUPLA_APTIDAO", label: "Dupla aptidão" },
          { value: "NAO_INFORMADA", label: "Não informada" },
        ]}
      />
      <ToolbarSelect
        value={setor}
        onChange={setSetor}
        ariaLabel="Filtrar por localização"
        options={[{ value: "", label: "Todas as localizações" }, ...(setores ?? []).map((s) => ({ value: s, label: s }))]}
      />
      {(filtros.data ?? []).length > 0 && (
        <RebSelect
          aria-label="Aplicar filtro salvo"
          className="w-auto gap-2 rounded-[8px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-[13px] py-[7px] text-sm text-[color:var(--ink)]"
          value=""
          onChange={(v) => { const f = (filtros.data ?? []).find((x) => String(x.id) === v); if (f) aplicarFiltro(f.criterios); }}
        >
          <option value="">Filtros salvos…</option>
          {(filtros.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </RebSelect>
      )}
      <RebButton onClick={() => setPromptFiltroAberto(true)}>Salvar filtro</RebButton>
      <RebButton className="ml-auto" aria-pressed={bulkAberto} onClick={() => setBulkAberto((v) => !v)}>Alteração coletiva</RebButton>
      <RebButton variant="pri" onClick={onNovo}>+ Novo animal</RebButton>
      <PromptDialog
        open={promptFiltroAberto}
        title="Salvar filtro"
        label="Nome do filtro"
        placeholder="Ex.: Animais de corte · retiro Mexicana"
        onConfirm={confirmarSalvarFiltro}
        onCancel={() => setPromptFiltroAberto(false)}
      />
    </>
  );

  if (loading || erro) {
    return (
      <RebMain>
        <RebHeader eyebrow={DOMAINS.animal.eyebrow} title="Animal" />
        <div className={RB_TOOLBAR}>{controles}</div>
        {loading
          ? <Loader size="sm" />
          : <p className="mt-[7px] text-sm text-prejuizo">Erro: {erro}</p>}
      </RebMain>
    );
  }

  return (
    <>
      {bulkAberto && (
        <RebMain>
          <AlteracaoColetivaPanel onFechar={() => setBulkAberto(false)} onAplicado={recarregar} />
        </RebMain>
      )}
      {(filtros.data ?? []).length > 0 && (
        <RebMain>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
            <span className="uppercase tracking-[.06em]">Filtros salvos:</span>
            {(filtros.data ?? []).map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1 rounded-full border border-[color:var(--rule-soft)] px-2 py-0.5">
                <button onClick={() => aplicarFiltro(f.criterios)} className="font-semibold text-[color:var(--cafe)] hover:underline">{f.nome}</button>
                <button onClick={() => removerFiltro(f.id)} className="text-ink-3 hover:text-prejuizo" aria-label={`Excluir filtro ${f.nome}`}>×</button>
              </span>
            ))}
          </div>
        </RebMain>
      )}
      <HerdDomainView config={DOMAINS.animal} resumos={resumos} onAbrirAnimal={onAbrirAnimal} nomes={nomes} controles={controles} />
    </>
  );
}

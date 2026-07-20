import { useState } from "react";
import { useAnimais, useSetores } from "../api";
import { HerdDomainView, RB_TOOLBAR } from "./HerdDomainView";
import { RebHeader } from "./RebHeader";
import { DOMAINS } from "../domains";
import { Loader } from "../../components/Loading";
import type { ResumoAnimal } from "../types";
import { ToolbarSelect } from "@/components/ToolbarSelect";
import { RebButton } from "@/components/rb/RebButton";
import { RebMain } from "@/components/rb/RebPrimitives";
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
  const [bulkAberto, setBulkAberto] = useState(false);
  const { data, loading, erro, recarregar } = useAnimais({ status, setor: setor || undefined });
  const { data: setores } = useSetores();

  // ResumoAnimal[] que o HerdDomainView consome — cada animal traz seu resumo embutido.
  const resumos: ResumoAnimal[] = data.map((a) => ({ ...(a.resumo ?? { statusReprodutivo: "VAZIA" }), animalId: a.id }) as ResumoAnimal);
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
        value={setor}
        onChange={setSetor}
        ariaLabel="Filtrar por setor"
        options={[{ value: "", label: "Todos os setores" }, ...(setores ?? []).map((s) => ({ value: s, label: s }))]}
      />
      <RebButton className="ml-auto" aria-pressed={bulkAberto} onClick={() => setBulkAberto((v) => !v)}>Alteração coletiva</RebButton>
      <RebButton variant="pri" onClick={onNovo}>+ Novo animal</RebButton>
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
      <HerdDomainView config={DOMAINS.animal} resumos={resumos} onAbrirAnimal={onAbrirAnimal} nomes={nomes} controles={controles} />
    </>
  );
}

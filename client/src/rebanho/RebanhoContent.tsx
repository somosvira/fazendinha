import { useEffect, useRef, useState } from "react";
import { AnimalCockpit } from "./components/AnimalCockpit";
import { AnimalTab } from "./components/AnimalTab";
import { ReproducaoTab } from "./components/ReproducaoTab";
import { SanidadeTab } from "./components/SanidadeTab";
import { NutricaoTab } from "./components/NutricaoTab";
import { ProducaoTab } from "./components/ProducaoTab";
import { EstoqueTab } from "./components/EstoqueTab";
import { CustoProducaoTab } from "./components/CustoProducaoTab";
import { AnimalForm } from "./components/AnimalForm";
import { EventoForm } from "./components/EventoForm";
import { DashboardView } from "./components/DashboardView";
import { IaView } from "./components/IaView";
import { PropriedadeSelector } from "./components/PropriedadeSelector";
import { setPropriedadeAtiva } from "./api";
import type { Animal } from "./types";

export type RebSub = "dashboard" | "animal" | "reproducao" | "sanidade" | "nutricao" | "producao" | "estoque" | "custo" | "ia";

export function RebanhoContent({ aba, onNavReb, abrirId, onAbriuEntidade }: { aba: RebSub; onNavReb?: (aba: RebSub) => void; abrirId?: string; onAbriuEntidade?: () => void }) {
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [form, setForm] = useState<{ modo: "novo" | "editar" | "baixa"; animal?: Animal } | null>(null);
  const [registroInline, setRegistroInline] = useState<{ animal: Animal; dominio: "reproducao" | "sanidade" } | null>(null);
  const [flashEventoId, setFlashEventoId] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [recarga, setRecarga] = useState(0);
  // Sítio ativo (multi-propriedade). Trocar seta o header da API e remonta o
  // conteúdo (key abaixo), forçando refetch no escopo novo.
  const [propAtiva, setPropAtiva] = useState<number | null>(null);
  const trocarPropriedade = (id: number | null) => { setPropriedadeAtiva(id); setPropAtiva(id); };

  // Quando ReproducaoTab/SanidadeTab salva e a gente quer pousar na ficha do Animal,
  // a navegação chega via onNavReb("animal"), o que dispara o efeito abaixo. A ref guarda
  // o id que deve ser aberto, para sobreviver à mudança de prop `aba`.
  const proximoAnimalRef = useRef<string | null>(null);

  // Trocar de aba normalmente fecha o cockpit, exceto quando estamos navegando após salvar
  // um evento (nesse caso, abrimos a ficha do animal que acabou de receber o evento).
  useEffect(() => {
    if (proximoAnimalRef.current) {
      setAnimalId(proximoAnimalRef.current);
      proximoAnimalRef.current = null;
    } else {
      setAnimalId(null);
      setFlashEventoId(null);
    }
  }, [aba]);

  // Deep-link do ⌘K: quando `abrirId` muda, abrimos a ficha desse animal usando
  // a mesma ref, para o efeito [aba] acima não limpar o cockpit recém-aberto.
  useEffect(() => {
    if (!abrirId) return;
    proximoAnimalRef.current = abrirId;
    setAnimalId(abrirId);
    onAbriuEntidade?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirId]);

  return (
    <div className="rb">
      <PropriedadeSelector value={propAtiva} onChange={trocarPropriedade} />
      <div key={propAtiva ?? "all"} style={{ display: "contents" }}>
      {animalId
        ? <AnimalCockpit key={recarga} animalId={animalId} onVoltar={() => setAnimalId(null)} onAbrirAnimal={setAnimalId} onEditar={(a) => setForm({ modo: "editar", animal: a })} onBaixa={(a) => setForm({ modo: "baixa", animal: a })} flashEventoId={flashEventoId} flashKey={flashKey} />
        : aba === "animal"
          ? <AnimalTab key={recarga} onAbrirAnimal={setAnimalId} onNovo={() => setForm({ modo: "novo" })} />
          : aba === "reproducao"
            ? <ReproducaoTab onRegistrarEvento={(animal) => setRegistroInline({ animal, dominio: "reproducao" })} />
            : aba === "sanidade"
              ? <SanidadeTab onRegistrarEvento={(animal) => setRegistroInline({ animal, dominio: "sanidade" })} />
              : aba === "nutricao"
                ? <NutricaoTab />
                : aba === "producao"
                  ? <ProducaoTab />
                  : aba === "estoque"
                    ? <EstoqueTab />
                    : aba === "custo"
                      ? <CustoProducaoTab />
                      : aba === "dashboard"
                        ? <DashboardView onNav={(t) => onNavReb?.(t as RebSub)} />
                        : <IaView />}
      {form && <AnimalForm modo={form.modo} animal={form.animal} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); setRecarga((n) => n + 1); }} />}
      {registroInline && (
        <EventoForm
          animalId={registroInline.animal.id}
          animal={registroInline.animal}
          dominioFixo={registroInline.dominio}
          onFechar={() => setRegistroInline(null)}
          onSalvo={(evento) => {
            const idAnimal = registroInline.animal.id;
            setRegistroInline(null);
            setFlashEventoId(evento?.id ?? null);
            setFlashKey((n) => n + 1);
            proximoAnimalRef.current = idAnimal;
            onNavReb?.("animal");
          }}
        />
      )}
      </div>
    </div>
  );
}

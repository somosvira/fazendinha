import { useEffect, useRef, useState } from "react";
import { AnimalCockpit } from "./components/AnimalCockpit";
import { AnimalTab } from "./components/AnimalTab";
import { ReproducaoTab } from "./components/ReproducaoTab";
import { SanidadeTab } from "./components/SanidadeTab";
import { NutricaoTab } from "./components/NutricaoTab";
import { ProducaoTab } from "./components/ProducaoTab";
import { EstoqueTab } from "./components/EstoqueTab";
import { CustoProducaoTab } from "./components/CustoProducaoTab";
import { CarteiraTab } from "./components/CarteiraTab";
import { SugestoesTab } from "./components/SugestoesTab";
import { AnimalForm } from "./components/AnimalForm";
import { EventoForm } from "./components/EventoForm";
import { DashboardView } from "./components/DashboardView";
import type { Animal } from "./types";
import type { ChaveWorklistRebanho, EventoPayload, EventoSanidadePayload, WorklistRebanho } from "./api";
import type { AcaoItemWorklist } from "./components/WorklistCanonica";
import { HOJE } from "./HOJE";

export type RebSub = "dashboard" | "animal" | "reproducao" | "sanidade" | "nutricao" | "producao" | "estoque" | "custo" | "carteira" | "sugestoes";

export function RebanhoContent({ aba, onNavReb, onAbrirWorklist, worklistChave, worklistSnapshot, abrirId, onAbriuEntidade }: { aba: RebSub; onNavReb?: (aba: RebSub) => void; onAbrirWorklist?: (worklist: WorklistRebanho) => void; worklistChave?: ChaveWorklistRebanho; worklistSnapshot?: WorklistRebanho; abrirId?: string; onAbriuEntidade?: () => void }) {
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [form, setForm] = useState<{ modo: "novo" | "editar" | "baixa"; animal?: Animal } | null>(null);
  const [registroInline, setRegistroInline] = useState<{
    animal: Animal | Pick<Animal, "id" | "numero" | "nome" | "categoria">;
    dominio: "reproducao" | "sanidade";
    tipoInicial?: { dominio: "reproducao"; tipo: EventoPayload["tipo"] } | { dominio: "sanidade"; tipo: EventoSanidadePayload["tipo"] };
    dataInicial?: string;
    // Para onde ir após salvar: "lista" mantém a fila (registro vindo de worklist),
    // "cockpit" abre a ficha do animal (registro genérico). Ausente = "cockpit".
    retorno?: "lista" | "cockpit";
  } | null>(null);
  const [flashEventoId, setFlashEventoId] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [recarga, setRecarga] = useState(0);
  // O sítio ativo (multi-propriedade) é governado pelo shell (App): trocar lá
  // remonta este conteúdo inteiro via `key`, então aqui não há estado de escopo.

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

  const registrarDaWorklist = ({ item, worklist }: AcaoItemWorklist) => {
    if (!worklist.acao) return; // worklist de só visualização (ex.: carência) não registra evento
    const animal = { id: String(item.animalId), numero: item.numero, nome: item.nome ?? "", categoria: (item.categoria ?? "VACA") as Animal["categoria"] };
    const tipoInicial = worklist.acao.dominio === "reproducao"
      ? { dominio: "reproducao" as const, tipo: worklist.acao.tipoEvento as EventoPayload["tipo"] }
      : { dominio: "sanidade" as const, tipo: worklist.acao.tipoEvento as EventoSanidadePayload["tipo"] };
    // Secagem já abre com a data de hoje pra a pessoa só confirmar o motivo.
    const dataInicial = worklist.acao.tipoEvento === "SECAGEM" ? HOJE : undefined;
    setRegistroInline({ animal, dominio: worklist.acao.dominio, tipoInicial, dataInicial, retorno: "lista" });
  };

  return (
    <div className="rb">
      {animalId
        ? <AnimalCockpit key={recarga} animalId={animalId} onVoltar={() => setAnimalId(null)} onAbrirAnimal={setAnimalId} onEditar={(a) => setForm({ modo: "editar", animal: a })} onBaixa={(a) => setForm({ modo: "baixa", animal: a })} flashEventoId={flashEventoId} flashKey={flashKey} />
        : aba === "animal"
          ? <AnimalTab key={recarga} onAbrirAnimal={setAnimalId} onNovo={() => setForm({ modo: "novo" })} />
          : aba === "reproducao"
            ? <ReproducaoTab key={recarga} onRegistrarEvento={(animal) => setRegistroInline({ animal, dominio: "reproducao", retorno: "cockpit" })} onRegistrarWorklist={registrarDaWorklist} onAbrirFicha={setAnimalId} worklistChave={worklistChave} worklistSnapshot={worklistSnapshot} />
            : aba === "sanidade"
              ? <SanidadeTab key={recarga} onRegistrarEvento={(animal) => setRegistroInline({ animal, dominio: "sanidade", retorno: "cockpit" })} onRegistrarWorklist={registrarDaWorklist} onAbrirFicha={setAnimalId} worklistChave={worklistChave} worklistSnapshot={worklistSnapshot} />
              : aba === "nutricao"
                ? <NutricaoTab />
                : aba === "producao"
                  ? <ProducaoTab />
                  : aba === "estoque"
                    ? <EstoqueTab />
                    : aba === "custo"
                      ? <CustoProducaoTab />
                      : aba === "carteira"
                        ? <CarteiraTab onAbrirFicha={(id) => setAnimalId(String(id))} />
                        : aba === "sugestoes"
                          ? <SugestoesTab onNav={(t) => onNavReb?.(t as RebSub)} onAbrirFicha={(id) => setAnimalId(String(id))} />
                        : <DashboardView onNav={(t) => onNavReb?.(t as RebSub)} onAbrirWorklist={onAbrirWorklist} />}
      {form && <AnimalForm modo={form.modo} animal={form.animal} onFechar={() => setForm(null)} onSalvo={() => { setForm(null); setRecarga((n) => n + 1); }} />}
      {registroInline && (
        <EventoForm
          animalId={registroInline.animal.id}
          animal={registroInline.animal}
          dominioFixo={registroInline.dominio}
          tipoInicial={registroInline.tipoInicial}
          dataInicial={registroInline.dataInicial}
          onFechar={() => setRegistroInline(null)}
          onSalvo={(evento) => {
            const idAnimal = registroInline.animal.id;
            const retorno = registroInline.retorno ?? "cockpit";
            setRegistroInline(null);
            if (retorno === "lista") {
              // Permanece na fila; remontar a aba (via key=recarga) refaz o fetch da worklist,
              // e o animal recém-tratado sai da lista porque o resumo não satisfaz mais a regra.
              setRecarga((n) => n + 1);
              return;
            }
            setFlashEventoId(evento?.id ?? null);
            setFlashKey((n) => n + 1);
            proximoAnimalRef.current = idAnimal;
            onNavReb?.("animal");
          }}
        />
      )}
    </div>
  );
}

import { DatePicker } from "../../../components/DatePicker";
import { formatBRDateISO } from "../../../lib/hoje";
import { ListaRascunho } from "./ListaRascunho";

export function DatasDiagnosticoIndividual({
  animais,
  valores,
  onChange,
  somenteLeitura = false,
}: {
  animais: Array<{ id: string; brinco: string; nome?: string | null }>;
  valores: Record<string, string>;
  onChange: (id: string, data: string) => void;
  somenteLeitura?: boolean;
}) {
  if (!animais.length) return null;
  const exibidos = somenteLeitura
    ? animais.filter((a) => valores[a.id])
    : animais;
  return (
    <section
      className="grid gap-3 border-t border-border pt-4"
      aria-label="Agendamentos individuais de diagnóstico"
    >
      <h3 className="font-semibold">Agendamento individual de DG</h3>
      <p className="text-sm text-ink-3">
        Uma data informada para o animal prevalece sobre o modelo e a regra
        geral do sítio. Deixe em branco para seguir as regras disponíveis, sem
        criar um prazo presumido.
      </p>
      {exibidos.length ? (
        <ListaRascunho
          itens={exibidos}
          rotulo="agendamentos individuais"
          texto={(a) => `${a.brinco} ${a.nome ?? ""}`}
          renderizar={(a) => (
            <div
              key={a.id}
              className="grid gap-2 border-t border-border py-3 sm:grid-cols-2"
            >
              <span>
                {a.brinco}
                {a.nome ? ` · ${a.nome}` : ""}
              </span>
              {somenteLeitura ? (
                <span>
                  {formatBRDateISO(valores[a.id])} · informado para este animal
                </span>
              ) : (
                <label>
                  Data individual para DG · {a.brinco}
                  <DatePicker
                    value={valores[a.id] ?? ""}
                    onChange={(data) => onChange(a.id, data)}
                  />
                </label>
              )}
            </div>
          )}
        />
      ) : (
        <p>
          Sem agendamento individual. Serão preservadas as regras aplicáveis na
          adesão.
        </p>
      )}
    </section>
  );
}

/* Toggle de 3 estados para filtrar lançamentos por classificação (§6.4 do
 * contrato ?classe= do módulo Cultivo): "custeio" | "investimento" | "tudo".
 * Reusa o padrão visual `chip-group`/`chip` (radio chips) já definido em
 * client/src/styles/forms.css e usado em Lancar.tsx/PlanoContas.tsx — sem CSS
 * novo, cores herdadas via var() dos estilos existentes. */

export type Classe = "custeio" | "investimento" | "tudo";

const OPCOES: { value: Classe; label: string }[] = [
  { value: "custeio", label: "Custeio" },
  { value: "investimento", label: "Investimento" },
  { value: "tudo", label: "Tudo" },
];

export interface ClasseToggleProps {
  value: Classe;
  onChange: (v: Classe) => void;
}

export function ClasseToggle({ value, onChange }: ClasseToggleProps) {
  return (
    <div className="chip-group" role="radiogroup" aria-label="Classificação">
      {OPCOES.map((o) => (
        <button
          key={o.value}
          type="button"
          className="chip"
          role="radio"
          aria-checked={value === o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

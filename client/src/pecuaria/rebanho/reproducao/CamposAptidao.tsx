import type { ReactNode } from "react";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { DatePicker } from "../../../components/DatePicker";
export type ConclusaoAptidao = "APTO" | "NAO_APTO" | "INCONCLUSIVO";
export type DadosAptidaoExame = { resultadoAptidao?: unknown; retornoAptidaoEm?: unknown };
export const rotulosAptidaoExame: Record<ConclusaoAptidao, string> = {
  APTO: "Apta", NAO_APTO: "Não apta", INCONCLUSIVO: "Inconclusiva",
};
export function CamposAptidao({ dados, onChange, emSecao = false, campoResponsavel }: { dados: DadosAptidaoExame; onChange: (d: { resultadoAptidao?: ConclusaoAptidao | null; retornoAptidaoEm?: string | null }) => void; emSecao?: boolean; campoResponsavel?: ReactNode }) {
  const titulo = "Aptidão reprodutiva";
  return <fieldset className={emSecao ? "visita-form-secao" : "col-span-full min-w-0 rounded-lg border border-border p-3"}>
    <legend className={emSecao ? "sr-only" : "px-1 text-base font-semibold"}>{titulo}</legend>
    {emSecao && <h3>{titulo}</h3>}
    <div className="grid items-end gap-3 sm:grid-cols-2">
      <SelectCampo aria-label="Aptidão reprodutiva" className="w-full min-w-0 bg-card"
        value={typeof dados.resultadoAptidao === "string" ? dados.resultadoAptidao : ""}
        onValueChange={v => onChange({ resultadoAptidao: (v || null) as ConclusaoAptidao | null, ...(!v ? { retornoAptidaoEm: null } : {}) })}>
        <option value="">Não avaliada neste exame</option>
        {Object.entries(rotulosAptidaoExame).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
      </SelectCampo>
      {Boolean(dados.resultadoAptidao) && campoResponsavel}
      {Boolean(dados.resultadoAptidao) && <label className="grid gap-1.5 text-sm">Reavaliação (opcional)
        <DatePicker aria-label="Data de reavaliação da aptidão"
          value={typeof dados.retornoAptidaoEm === "string" ? dados.retornoAptidaoEm : ""}
          onChange={v => onChange({ retornoAptidaoEm: v || null })} />
      </label>}
    </div>
  </fieldset>;
}

import { Input } from "../../../components/ui/input";
import type { GrupoCriteriosAptidao } from "./elegibilidade-api";
export const grupoCriteriosVazio = (): GrupoCriteriosAptidao => ({ idadeMinimaMeses: null, percentualPesoAdulto: null, pesoMinimoKg: null, eccMinimo: null, pesoAdultoReferenciaKg: null, validadePesoDias: null, precisaoPesoAceita: ["MEDIDO"], escalaEcc: null, validadeEccDias: null });
export function CriteriosAptidaoFormulario({ titulo, valor, onChange }: { titulo: string; valor: GrupoCriteriosAptidao; onChange: (v: GrupoCriteriosAptidao) => void }) {
  const campo = (id: "idadeMinimaMeses" | "percentualPesoAdulto" | "pesoMinimoKg" | "eccMinimo", rotulo: string, unidade: string, max: number) => <div className="grid items-end gap-3 border-b py-3 sm:grid-cols-2" key={id}>
    <label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={valor[id] !== null} onChange={e => onChange({ ...valor, [id]: e.target.checked ? 0 : null })}/>{rotulo}</label>
    <label>{unidade}<Input aria-label={`${titulo}: ${rotulo}`} required={valor[id] !== null} disabled={valor[id] === null} type="number" min={id === "eccMinimo" ? 0 : 1} max={max} step={id === "idadeMinimaMeses" ? 1 : 0.1} value={valor[id] ?? ""} onChange={e => onChange({ ...valor, [id]: e.target.value === "" ? 0 : Number(e.target.value) })}/></label>
  </div>;
  const usaPeso = valor.pesoMinimoKg !== null || valor.percentualPesoAdulto !== null;
  return <fieldset className="min-w-0"><legend className="text-lg font-semibold">{titulo}</legend>
    {campo("idadeMinimaMeses", "Idade mínima", "Meses", 360)}
    {campo("percentualPesoAdulto", "Percentual do peso adulto", "Percentual", 100)}
    {campo("pesoMinimoKg", "Peso absoluto", "Quilos", 2000)}
    {campo("eccMinimo", "Escore de condição corporal", "Valor mínimo", 100)}
    {(usaPeso || valor.eccMinimo !== null) && <details className="py-3" open><summary className="cursor-pointer font-medium">Referência e validade das evidências</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
      {valor.percentualPesoAdulto !== null && <label>Peso adulto de referência (kg)<Input required type="number" min={1} max={2000} value={valor.pesoAdultoReferenciaKg ?? ""} onChange={e => onChange({ ...valor, pesoAdultoReferenciaKg: Number(e.target.value) })}/></label>}
      {usaPeso && <><label>Validade da pesagem (dias)<Input required type="number" min={0} max={2000} value={valor.validadePesoDias ?? ""} onChange={e => onChange({ ...valor, validadePesoDias: Number(e.target.value) })}/></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={valor.precisaoPesoAceita.includes("ESTIMADO")} onChange={e => onChange({ ...valor, precisaoPesoAceita: e.target.checked ? [...valor.precisaoPesoAceita, "ESTIMADO"] : valor.precisaoPesoAceita.filter(p => p !== "ESTIMADO") })}/>Aceitar peso estimado como evidência</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={valor.precisaoPesoAceita.includes("INFORMADO")} onChange={e => onChange({ ...valor, precisaoPesoAceita: e.target.checked ? [...valor.precisaoPesoAceita, "INFORMADO"] : valor.precisaoPesoAceita.filter(p => p !== "INFORMADO") })}/>Aceitar peso informado como evidência</label></>}
      {valor.eccMinimo !== null && <><label>Escala ECC — mínimo<Input required type="number" min={0} max={100} step={0.1} value={valor.escalaEcc?.minimo ?? ""} onChange={e => onChange({ ...valor, escalaEcc: { minimo: Number(e.target.value), maximo: valor.escalaEcc?.maximo ?? 0 } })}/></label>
        <label>Escala ECC — máximo<Input required type="number" min={0.1} max={100} step={0.1} value={valor.escalaEcc?.maximo ?? ""} onChange={e => onChange({ ...valor, escalaEcc: { minimo: valor.escalaEcc?.minimo ?? 0, maximo: Number(e.target.value) } })}/></label>
        <label>Validade do ECC (dias)<Input required type="number" min={0} max={2000} value={valor.validadeEccDias ?? ""} onChange={e => onChange({ ...valor, validadeEccDias: Number(e.target.value) })}/></label></>}
    </div></details>}
  </fieldset>;
}

export function ResumoCriteriosAptidao({ titulo, valor }: { titulo: string; valor: GrupoCriteriosAptidao }) {
  const linhas = [
    valor.idadeMinimaMeses !== null ? `Idade mínima: ${valor.idadeMinimaMeses} meses` : null,
    valor.percentualPesoAdulto !== null ? `${valor.percentualPesoAdulto}% do peso adulto de referência (${valor.pesoAdultoReferenciaKg} kg)` : null,
    valor.pesoMinimoKg !== null ? `Peso mínimo: ${valor.pesoMinimoKg} kg` : null,
    valor.eccMinimo !== null ? `ECC mínimo: ${valor.eccMinimo}; escala ${valor.escalaEcc?.minimo} a ${valor.escalaEcc?.maximo}; validade ${valor.validadeEccDias} dias` : null,
    valor.percentualPesoAdulto !== null || valor.pesoMinimoKg !== null ? `Pesagem válida por ${valor.validadePesoDias} dias; precisão aceita: ${valor.precisaoPesoAceita.map(p => p === "MEDIDO" ? "medido" : p === "ESTIMADO" ? "estimado" : "informado").join(", ")}` : null,
  ].filter(Boolean);
  return <div><h4 className="font-semibold">{titulo}</h4>{linhas.length ? <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{linhas.map(l => <li key={l}>{l}</li>)}</ul> : <p className="text-sm">Nenhum critério adicional selecionado.</p>}</div>;
}

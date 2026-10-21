import { classeInput } from "../../../financeiro/PainelCadastro";
import { UNIDADES } from "../../../lib/unidades";
export type ReferenciasCustoCadastro = { material?: {valorUnitario:string;unidade:string;origem:string;data:string}; servico?: {valorUnitario:string;unidade:"POR_ATENDIMENTO";origem:string;data:string} };
export function CamposReferenciasCusto({ valor = {}, material, onChange }: {valor?:ReferenciasCustoCadastro;material:boolean;onChange:(v:ReferenciasCustoCadastro|undefined)=>void}) {
  return <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer font-semibold">Referências de custo planejado</summary><p className="my-2 text-sm text-ink-3">Preços para estimativa por animal e ação. Origem e data identificam inclusive uma referência de valor zero. O planejamento não lança despesa nem reserva estoque.</p>
    {([...(material ? ["material" as const] : []), "servico" as const]).map(tipo => { const r = valor[tipo]; return <fieldset key={tipo} className="my-3 grid gap-2 sm:grid-cols-2"><legend>{tipo === "material" ? "Material" : "Serviço por atendimento"}</legend><label className="sm:col-span-2"><input type="checkbox" checked={!!r} onChange={e => onChange({...valor,[tipo]:e.target.checked ? {valorUnitario:"",unidade:tipo === "material" ? "UN" : "POR_ATENDIMENTO",origem:"",data:""} : undefined})} /> Informar referência explícita</label>{r && <>
      <label>Valor unitário (R$)<input className={classeInput} required type="number" min="0" step="0.01" value={r.valorUnitario} onChange={e => onChange({...valor,[tipo]:{...r,valorUnitario:e.target.value}})} /></label>
      {tipo === "material" ? <label>Unidade da referência<select className={classeInput} value={r.unidade} onChange={e => onChange({...valor,[tipo]:{...r,unidade:e.target.value}})}>{Object.entries(UNIDADES).map(([id,u])=><option key={id} value={id}>{u.rotulo}</option>)}</select></label> : <p>Por atendimento de um animal</p>}
      <label>Origem da referência<input className={classeInput} required minLength={2} maxLength={200} value={r.origem} onChange={e => onChange({...valor,[tipo]:{...r,origem:e.target.value}})} /></label>
      <label>Data da referência<input className={classeInput} required type="date" value={r.data} onChange={e => onChange({...valor,[tipo]:{...r,data:e.target.value}})} /></label>
    </>}</fieldset>;})}
  </details>;
}

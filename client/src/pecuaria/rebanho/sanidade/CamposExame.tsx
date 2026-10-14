import { useId } from "react";
import { classeInput } from "../../../financeiro/PainelCadastro";
export type CampoExame = { codigo: string; rotulo?: string; tipo: "TEXTO" | "NUMERO" | "OPCAO" | "BOOLEANO"; unidade?: string | null; obrigatorio?: boolean; opcoes?: string[] };
export type ObservacaoExame = { campo: string; valor: string | number | boolean };
export const nomeCampoExame = (c: Pick<CampoExame, "codigo" | "rotulo">) => c.rotulo || ({ CONCLUSAO_GESTACIONAL: "Conclusão sobre a gestação", SEXO_FETAL: "Sexo fetal" } as Record<string, string>)[c.codigo] || "Informação do exame";
export function CamposResultadoExame({ campos, valores, onChange }: { campos: CampoExame[]; valores: ObservacaoExame[]; onChange: (v: ObservacaoExame[]) => void }) {
  const prefixo = useId();
  function mudar(campo: string, valor: string | boolean) { onChange([...valores.filter(v => v.campo !== campo), ...(valor === "" ? [] : [{ campo, valor }])]); }
  return <fieldset className="grid gap-3"><legend className="font-semibold">Resultados do exame</legend>{campos.map(c => {
    const valor = valores.find(v => v.campo === c.codigo)?.valor;
    return <label key={c.codigo} htmlFor={`${prefixo}-${c.codigo}`}>{nomeCampoExame(c)}{c.unidade ? ` · ${c.unidade}` : ""}{c.obrigatorio ? " (obrigatório ao informar o resultado)" : " (opcional)"}
      {c.tipo === "OPCAO" || c.tipo === "BOOLEANO" ? <select id={`${prefixo}-${c.codigo}`} className={classeInput} value={valor == null ? "" : String(valor)} onChange={e => mudar(c.codigo, c.tipo === "BOOLEANO" && e.target.value !== "" ? e.target.value === "true" : e.target.value)}><option value="">Não informado</option>{c.tipo === "BOOLEANO" ? <><option value="true">Sim</option><option value="false">Não</option></> : c.opcoes?.map(o => <option key={o}>{o}</option>)}</select>
      : <input id={`${prefixo}-${c.codigo}`} className={classeInput} inputMode={c.tipo === "NUMERO" ? "decimal" : undefined} value={valor == null ? "" : String(valor)} onChange={e => mudar(c.codigo, c.tipo === "NUMERO" ? e.target.value.replace(",", ".") : e.target.value)} />}
    </label>;
  })}</fieldset>;
}
export function CamposFormatoExame({ campos, onChange, disabled, protegerClinicos = false }: { protegerClinicos?: boolean; campos: CampoExame[]; onChange: (campos: CampoExame[]) => void; disabled: boolean }) {
  const prefixo = useId();
  const editar = (i: number, mudanca: Partial<CampoExame>) => onChange(campos.map((c, n) => n === i ? { ...c, ...mudanca } : c));
  return <fieldset className="grid gap-3"><legend className="font-semibold">Informações colhidas no exame</legend>{campos.map((c, i) => <div key={c.codigo} className="grid gap-2 rounded-lg border border-border p-3">
    <label htmlFor={`${prefixo}-${i}-nome`}>Nome da informação<input id={`${prefixo}-${i}-nome`} required maxLength={120} disabled={disabled} className={classeInput} value={nomeCampoExame(c) === "Informação do exame" ? c.rotulo ?? "" : nomeCampoExame(c)} onChange={e => editar(i, { rotulo: e.target.value })} /></label>
    <label htmlFor={`${prefixo}-${i}-tipo`}>Como responder<select id={`${prefixo}-${i}-tipo`} disabled={disabled || (protegerClinicos && ["CONCLUSAO_GESTACIONAL", "SEXO_FETAL"].includes(c.codigo))} className={classeInput} value={c.tipo} onChange={e => editar(i, { tipo: e.target.value as CampoExame["tipo"], opcoes: e.target.value === "OPCAO" ? ["Opção 1", "Opção 2"] : undefined })}><option value="TEXTO">Texto</option><option value="NUMERO">Número</option><option value="OPCAO">Escolher uma opção</option><option value="BOOLEANO">Sim ou não</option></select></label>
    {c.tipo === "OPCAO" && <label htmlFor={`${prefixo}-${i}-opcoes`}>Opções, uma por linha<textarea id={`${prefixo}-${i}-opcoes`} required disabled={disabled || (protegerClinicos && ["CONCLUSAO_GESTACIONAL", "SEXO_FETAL"].includes(c.codigo))} className={classeInput} value={c.opcoes?.join("\n") ?? ""} onChange={e => editar(i, { opcoes: e.target.value.split("\n") })} /></label>}
    {c.tipo === "NUMERO" && <label htmlFor={`${prefixo}-${i}-unidade`}>Unidade (opcional)<input id={`${prefixo}-${i}-unidade`} maxLength={30} disabled={disabled} className={classeInput} value={c.unidade ?? ""} onChange={e => editar(i, { unidade: e.target.value || null })} /></label>}
    <label><input type="checkbox" disabled={disabled || (protegerClinicos && ["CONCLUSAO_GESTACIONAL", "SEXO_FETAL"].includes(c.codigo))} checked={c.obrigatorio ?? false} onChange={e => editar(i, { obrigatorio: e.target.checked })} /> Obrigatório ao informar o resultado</label>
    <button type="button" disabled={disabled || (protegerClinicos && ["CONCLUSAO_GESTACIONAL", "SEXO_FETAL"].includes(c.codigo))} onClick={() => onChange(campos.filter((_, n) => n !== i))} aria-label={`Remover informação ${i + 1}`}>Remover informação</button>
  </div>)}<button type="button" disabled={disabled || campos.length >= 40} onClick={() => onChange([...campos, { codigo: `CAMPO_${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`, rotulo: "", tipo: "TEXTO", obrigatorio: false }])}>Adicionar informação ao exame</button></fieldset>;
}

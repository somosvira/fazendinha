import { SelectCampo } from "../../../financeiro/SelectCampo";
import { DatePicker } from "../../../components/DatePicker";
export type ConclusaoAptidao = "APTO" | "NAO_APTO" | "INCONCLUSIVO";
export type DadosAptidaoExame = { resultadoAptidao?: unknown; retornoAptidaoEm?: unknown };
export function CamposAptidao({ dados, onChange }: { dados: DadosAptidaoExame; onChange: (d: { resultadoAptidao?: ConclusaoAptidao | null; retornoAptidaoEm?: string | null }) => void }) {
  return <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 font-semibold">Aptidão reprodutiva</legend>
    <label>Conclusão de aptidão<SelectCampo value={typeof dados.resultadoAptidao === "string" ? dados.resultadoAptidao : ""} onValueChange={v => onChange({ resultadoAptidao: (v || null) as ConclusaoAptidao | null, ...(!v ? { retornoAptidaoEm: null } : {}) })}>
      <option value="">Não avaliada neste exame</option><option value="APTO">Apta</option><option value="NAO_APTO">Não apta</option><option value="INCONCLUSIVO">Inconclusiva — aguardar reavaliação</option>
    </SelectCampo></label>
    {Boolean(dados.resultadoAptidao) && <label>Retorno de aptidão (opcional)<DatePicker value={typeof dados.retornoAptidaoEm === "string" ? dados.retornoAptidaoEm : ""} onChange={v => onChange({ retornoAptidaoEm: v || null })}/></label>}
    <p className="text-sm text-muted-foreground sm:col-span-2">A mesma aptidão vale para protocolo e tentativa. O diagnóstico de gestação tem conclusão independente.</p>
  </fieldset>;
}

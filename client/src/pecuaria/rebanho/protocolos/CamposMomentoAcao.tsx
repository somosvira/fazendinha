import { Button } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";

export type MomentoCadastro = { nome: string; ordem: number };
export type SubtipoAplicacaoCadastro = "APLICACAO" | "INSERCAO_DISPOSITIVO";

/** A ordem identifica o grupo explicitamente escolhido, nunca a data da ação. */
export function CamposMomentoAcao({ momento, momentos, onChange, onRenomear, aplicacao, subtipo, onSubtipoChange }: {
  momento?: MomentoCadastro | null;
  momentos: MomentoCadastro[];
  onChange: (momento: MomentoCadastro) => void;
  onRenomear: (nome: string) => void;
  aplicacao: boolean;
  subtipo?: SubtipoAplicacaoCadastro;
  onSubtipoChange: (subtipo: SubtipoAplicacaoCadastro) => void;
}) {
  const existentes = [...new Map(momentos.map(m => [m.ordem, m])).values()].sort((a, b) => a.ordem - b.ordem);
  return <div className="grid gap-3 sm:grid-cols-2">
    <label>Momento da ação
      <select className={classeInput} value={momento?.ordem ?? ""} onChange={e => {
        const escolhido = existentes.find(m => m.ordem === Number(e.target.value));
        if (escolhido) onChange({ ...escolhido });
      }}>
        {!momento && <option value="">Etapa legada sem momento</option>}
        {existentes.map(m => <option key={m.ordem} value={m.ordem}>{m.nome || `Momento ${m.ordem}`}</option>)}
      </select>
    </label>
    {momento && <label>Nome do momento
      <input className={classeInput} required minLength={1} maxLength={160} value={momento.nome} onChange={e => onRenomear(e.target.value)} />
    </label>}
    <div className="sm:col-span-2"><Button secondary type="button" onClick={() => {
      const ordem = Math.max(0, ...existentes.map(m => m.ordem)) + 1;
      onChange({ nome: `Momento ${ordem}`, ordem });
    }}>Criar outro momento</Button></div>
    <p className="text-sm text-ink-3 sm:col-span-2">Ações do mesmo momento continuam independentes. Duas ações no dia zero só ficam juntas quando você escolhe o mesmo momento.</p>
    {aplicacao && <label className="sm:col-span-2">Procedimento de aplicação
      <select className={classeInput} value={subtipo ?? "APLICACAO"} onChange={e => onSubtipoChange(e.target.value as SubtipoAplicacaoCadastro)}>
        <option value="APLICACAO">Aplicação de produto</option>
        <option value="INSERCAO_DISPOSITIVO">Inserção de dispositivo com produto</option>
      </select>
    </label>}
  </div>;
}

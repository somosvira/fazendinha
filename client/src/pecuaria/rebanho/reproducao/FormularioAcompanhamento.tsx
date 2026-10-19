import { useRef, useState, type FormEvent } from "react";
import { Button } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import type { PoliticaAcompanhamento } from "./ConfiguracaoAcompanhamento";

export type TipoExameAcompanhamento = { id: string; nome: string; contexto?: string; ativo: boolean };
export type RegistroPoliticaAcompanhamento = Pick<PoliticaAcompanhamento, "vigenteDesde" | "parametros"> & { propriedadeId: number; chave: string };
type Props = {
  visivel: boolean;
  propriedadeId: number;
  tipos: TipoExameAcompanhamento[];
  ocupado: boolean;
  aoSalvar: (input: RegistroPoliticaAcompanhamento) => Promise<void>;
  aoErro: (erro: string) => void;
};

export function FormularioAcompanhamento({ visivel, propriedadeId, tipos, ocupado, aoSalvar, aoErro }: Props) {
  const [vigencia, setVigencia] = useState("");
  const [dias, setDias] = useState("");
  const [dg, setDg] = useState(false);
  const [tipo, setTipo] = useState("");
  const [reconfirmacoes, setReconfirmacoes] = useState<Array<{ dias: string; tipo: string }>>([]);
  const chave = useRef<{ payload: string; id: string } | null>(null);

  function salvar(e: FormEvent) {
    e.preventDefault();
    if (!dg && !reconfirmacoes.length) {
      aoErro("Configure ao menos um acompanhamento.");
      return;
    }
    const input: Omit<RegistroPoliticaAcompanhamento, "chave"> = {
      propriedadeId,
      vigenteDesde: vigencia,
      parametros: {
        versao: 1,
        efeito: "ALERTA",
        diagnostico: dg ? { diasAposTentativa: Number(dias), ...(tipo ? { tipoExameId: tipo } : {}) } : null,
        reconfirmacoes: reconfirmacoes.map((r, i) => ({ ocorrencia: i + 1, diasAposPrimeiroPositivo: Number(r.dias), ...(r.tipo ? { tipoExameId: r.tipo } : {}) })),
      },
    };
    const payload = JSON.stringify(input);
    if (chave.current?.payload !== payload) chave.current = { payload, id: crypto.randomUUID() };
    void aoSalvar({ ...input, chave: chave.current.id });
  }

  const exame = (valor: string, mudar: (v: string) => void) => <select className={classeInput} value={valor} onChange={e => mudar(e.target.value)}>
    <option value="">Tipo de exame não especificado</option>{tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
  </select>;

  if (!visivel) return null;
  return <form onSubmit={salvar} className="space-y-3 rounded-xl border border-border bg-card p-4">
    <label>Vigente desde<input className={classeInput} required type="date" value={vigencia} onChange={e => setVigencia(e.target.value)} /></label>
    <label className="flex gap-2"><input type="checkbox" checked={dg} onChange={e => setDg(e.target.checked)} />Configurar diagnóstico após tentativa</label>
    {dg && <div className="grid gap-3 sm:grid-cols-2">
      <label>Dias após a tentativa<input className={classeInput} type="number" required min={0} max={1000} value={dias} onChange={e => setDias(e.target.value)} /></label>
      <label>Exame do diagnóstico{exame(tipo, setTipo)}</label>
    </div>}
    {reconfirmacoes.map((r, i) => <fieldset key={i} className="grid gap-3 rounded border border-border bg-muted p-3 sm:grid-cols-2">
      <legend>Reconfirmação {i + 1}</legend>
      <label>Dias desde o primeiro DG positivo<input className={classeInput} required type="number" min={1} max={1000} value={r.dias} onChange={e => setReconfirmacoes(v => v.map((x, n) => n === i ? { ...x, dias: e.target.value } : x))} /></label>
      <label>Exame{exame(r.tipo, t => setReconfirmacoes(v => v.map((x, n) => n === i ? { ...x, tipo: t } : x)))}</label>
      <Button type="button" secondary onClick={() => setReconfirmacoes(v => v.filter((_, n) => n !== i))}>Remover ocorrência</Button>
    </fieldset>)}
    <div className="flex flex-wrap gap-2">
      <Button type="button" secondary onClick={() => setReconfirmacoes(v => [...v, { dias: "", tipo: "" }])}>Adicionar reconfirmação</Button>
      <Button type="submit" disabled={ocupado}>Registrar nova versão</Button>
    </div>
  </form>;
}

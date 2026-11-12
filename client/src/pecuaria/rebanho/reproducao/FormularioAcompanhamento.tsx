import { DatePicker } from "../../../components/DatePicker";
import { useRef, useState, type FormEvent } from "react";
import { EditorRegrasAcompanhamentoModelo } from "./EditorRegrasAcompanhamentoModelo";
import {
  validarConfiguracaoAcompanhamento,
  type ConfiguracaoAcompanhamentoV2,
  type PoliticaAcompanhamento,
} from "./acompanhamento-api";
export type TipoExameAcompanhamento = {
  id: string;
  nome: string;
  contexto?: string;
  ativo: boolean;
};
export type RegistroPoliticaAcompanhamento = Pick<
  PoliticaAcompanhamento,
  "vigenteDesde" | "parametros"
> & { propriedadeId: number; chave: string };
type Props = {
  visivel: boolean;
  propriedadeId: number;
  tipos: TipoExameAcompanhamento[];
  ocupado: boolean;
  inicial?: ConfiguracaoAcompanhamentoV2 | null;
  aoSalvar: (input: RegistroPoliticaAcompanhamento) => Promise<void>;
  aoAlterar?: () => void;
  aoErro: (erro: string) => void;
};
export function FormularioAcompanhamento({
  visivel,
  propriedadeId,
  ocupado,
  inicial = null,
  aoSalvar,
  aoErro,
  aoAlterar,
}: Props) {
  const [vigencia, setVigencia] = useState("");
  const [valor, setValor] = useState(inicial);
  const chave = useRef<{ payload: string; id: string } | null>(null);
  function salvar(e: FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    const erro = validarConfiguracaoAcompanhamento(valor);
    if (erro) {
      aoErro(erro);
      return;
    }
    const input = { propriedadeId, vigenteDesde: vigencia, parametros: valor! };
    const payload = JSON.stringify(input);
    if (chave.current?.payload !== payload)
      chave.current = { payload, id: crypto.randomUUID() };
    void aoSalvar({ ...input, chave: chave.current.id });
  }
  if (!visivel) return null;
  return (
    <form
      id="nova-politica-acompanhamento"
      onSubmit={salvar}
      className="space-y-4"
    >
      <fieldset disabled={ocupado} className="min-w-0 space-y-4">
        <label>
          Vigente desde
          <DatePicker
            required
            value={vigencia}
            onChange={(v) => {
              setVigencia(v);
              aoAlterar?.();
            }}
          />
        </label>
        <EditorRegrasAcompanhamentoModelo
          propriedadeId={propriedadeId}
          valor={valor}
          onChange={(v) => {
            setValor(v);
            aoAlterar?.();
          }}
          disabled={ocupado}
        />
      </fieldset>
    </form>
  );
}

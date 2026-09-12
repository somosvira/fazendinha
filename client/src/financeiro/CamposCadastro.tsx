import { CampoFormulario, classeInput } from "./PainelCadastro";

export function CamposCadastro<K extends string>({ prefixo, campos, valores, onChange, erros }: {
  prefixo: string;
  campos: readonly (readonly [K, string, number])[];
  valores: Record<K, string>;
  onChange: (campo: K, valor: string) => void;
  erros: Record<string, string>;
}) {
  return <div className="grid gap-4 sm:grid-cols-2">{campos.map(([campo, rotulo, limite]) =>
    <CampoFormulario key={campo} id={`${prefixo}-${campo}`} rotulo={rotulo} erro={erros[campo]}>{(props) =>
      <input {...props} maxLength={limite} value={valores[campo]} onChange={(e) => onChange(campo, e.target.value)} className={classeInput} />
    }</CampoFormulario>)}</div>;
}

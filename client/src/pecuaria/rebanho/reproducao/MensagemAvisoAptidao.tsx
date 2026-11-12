import { descreverErroDisponibilidade } from "./elegibilidade-api";

export function MensagemAvisoAptidao({ mensagem }: { mensagem: string }) {
  return <>{descreverErroDisponibilidade(mensagem)
    .split(/(Condição sanitária: [\s\S]+?)(?=; (?:Condição sanitária|Restrição reprodutiva):|$)/)
    .map((trecho, indice) => indice % 2
      ? <span key={indice} className="text-destructive">{trecho}</span>
      : trecho)}</>;
}

import { Button } from "./ui/button";
import type { RespostaAssistente } from "../api/assistente";
import { formatBRDateISO } from "../lib/hoje";

type Proposta = NonNullable<RespostaAssistente["proposta"]>;
const dataBR = formatBRDateISO;
const kg = (valor: number, casas = 0) => valor.toLocaleString("pt-BR", { maximumFractionDigits: casas });

/** Compara com a pesagem anterior: diferença, intervalo e ganho por dia. */
export function comparacaoPesagem(p: Proposta) {
  if (!p.anterior) return null;
  const dias = Math.round((Date.parse(`${p.data.slice(0, 10)}T12:00:00Z`) - Date.parse(`${p.anterior.data.slice(0, 10)}T12:00:00Z`)) / 864e5);
  const diferenca = p.pesoKg - p.anterior.pesoKg;
  const sinal = diferenca > 0 ? "+" : diferenca < 0 ? "−" : "";
  const ritmo = dias > 0 ? `, ${kg(Math.abs(diferenca) / dias, 2)} kg/dia` : "";
  return `Última pesagem: ${kg(p.anterior.pesoKg, 1)} kg em ${dataBR(p.anterior.data)} (${sinal}${kg(Math.abs(diferenca), 1)} kg em ${dias} ${dias === 1 ? "dia" : "dias"}${ritmo}).`;
}

/** Pesagem preparada pela IA para o usuário conferir: nada é gravado antes de "Gravar pesagem". */
export function ConferenciaPesagem({ proposta: p, escopo, bloqueado, onGravar, onCorrigir }: { proposta: Proposta; escopo: string; bloqueado: boolean; onGravar: () => void; onCorrigir: () => void }) {
  const comparacao = comparacaoPesagem(p);
  return <section className="assistente-conferencia" aria-label="Conferir pesagem">
    <header>
      <span className="assistente-conferencia-selo">Confira antes de gravar</span>
      <h3>Pesagem de {p.animal}</h3>
      <p>{escopo} · nada é gravado até você confirmar.</p>
    </header>
    <dl className="assistente-conferencia-ficha">
      <div><dt>Animal</dt><dd>{p.animal}</dd></div>
      <div><dt>Data</dt><dd>{dataBR(p.data)}</dd></div>
      <div><dt>Peso</dt><dd>{kg(p.pesoKg, 1)} kg</dd></div>
      <div><dt>Origem</dt><dd>{p.origem}</dd></div>
    </dl>
    <p className="assistente-conferencia-leitura">{comparacao ?? "Primeira pesagem registrada deste animal."} {p.tipo} · precisão {p.precisao.toLocaleLowerCase("pt-BR")}.</p>
    <div className="assistente-conferencia-botoes">
      <Button disabled={bloqueado} onClick={onGravar}>Gravar pesagem</Button>
      <Button disabled={bloqueado} variant="outline" onClick={onCorrigir}>Corrigir</Button>
    </div>
  </section>;
}

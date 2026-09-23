// Sheet "Editar composição racial" — PUT /pecuaria/rebanho/animais/:id/composicao
// (substitui a composição inteira). Reusa CampoComposicao de ../ui.tsx.

import { type FormEvent, useRef, useState } from "react";
import { substituirComposicaoAnimal, RebanhoApiError } from "../api";
import { CampoComposicao } from "../ui";
import { composicaoValida } from "../lib/composicao";
import type { AnimalFicha, CatalogoRaca, ComposicaoItemInput } from "../types";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { PainelCadastro } from "../../../financeiro/PainelCadastro";

export function FormComposicao({ animal, racas, onSalvo, onFechar }: {
  animal: AnimalFicha;
  racas: CatalogoRaca[];
  onSalvo: () => Promise<void> | void;
  onFechar: () => void;
}) {
  // AnimalFicha.composicao só traz sigla+fração (ver composicao.calc.ts no
  // servidor) — reconstrói o racaId batendo a sigla contra o catálogo de raças.
  const [itens, setItens] = useState<ComposicaoItemInput[]>(
    animal.composicao.map((c) => ({ racaId: racas.find((raca) => raca.sigla === c.sigla)?.id ?? "", fracao64: c.fracao64 })),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    if (itens.some((item) => !item.racaId)) { setErro("Selecione a raça em todas as linhas."); return; }
    if (!composicaoValida(itens)) { setErro("Confira as frações: cada raça só pode aparecer uma vez e a soma não pode passar de 64."); return; }
    setErro(null);
    emCurso.current = true; setSalvando(true); setErroGeral(null);
    try {
      await substituirComposicaoAnimal(animal.id, { itens });
      await onSalvo();
    } catch (falha) {
      if (falha instanceof RebanhoApiError) setErroGeral(falha.message);
      else setErroGeral(falha instanceof Error ? falha.message : String(falha));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-composicao-animal";
  return <PainelCadastro aberto eyebrow="Animal" titulo={`Composição de ${animal.brinco}`} onFechar={() => { if (!salvando) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : "Salvar composição"}</Button></>}>
    <form id={formId} onSubmit={submeter} noValidate className="grid gap-4">
      <ErrorBox erro={erroGeral} />
      <CampoComposicao racas={racas} itens={itens} onChange={setItens} erro={erro ?? undefined} />
    </form>
  </PainelCadastro>;
}

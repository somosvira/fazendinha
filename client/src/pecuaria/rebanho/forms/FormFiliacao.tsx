// Painel "Definir filiação" — PUT /pecuaria/rebanho/animais/:id/filiacao (substituição
// completa de mãe e pai). O servidor reconcilia a composição na mesma transação;
// mostra os avisos quando uma composição manual antiga precisou ser substituída.

import { type FormEvent, useRef, useState } from "react";
import { definirFiliacaoAnimal, RebanhoApiError } from "../api";
import type { AnimalFicha } from "../types";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { PainelCadastro } from "../../../financeiro/PainelCadastro";
import { CampoGenitor, genitorIncompleto, mensagemGenitorIncompleto, ladoParaValor, valorGenitorParaCampos, type ValorGenitor } from "../components/CampoGenitor";
import { useToast } from "../../../components/Toast";

export function FormFiliacao({ animal, onSalvo, onFechar }: {
  animal: AnimalFicha;
  onSalvo: (atualizado: AnimalFicha) => Promise<void> | void;
  onFechar: () => void;
}) {
  const toast = useToast();
  const [mae, setMae] = useState<ValorGenitor>(() => ladoParaValor(animal.filiacao?.mae ?? null));
  const [pai, setPai] = useState<ValorGenitor>(() => ladoParaValor(animal.filiacao?.pai ?? null));
  const [avisos, setAvisos] = useState<Array<{ campo: string; mensagem: string }>>([]);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const [errosGenitor, setErrosGenitor] = useState<{ mae?: string; pai?: string }>({});

  const concluir = async (resultado: AnimalFicha, avisosResultado: Array<{ mensagem: string }>) => {
    if (avisosResultado.length) toast.warn("Filiação salva com aviso", avisosResultado.map((aviso) => aviso.mensagem).join(" · "));
    await onSalvo(resultado);
  };

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    const incompletos = {
      mae: genitorIncompleto(mae) ? mensagemGenitorIncompleto("Mãe", "F") : undefined,
      pai: genitorIncompleto(pai) ? mensagemGenitorIncompleto("Pai", "M") : undefined,
    };
    setErrosGenitor(incompletos);
    if (incompletos.mae || incompletos.pai) return;
    emCurso.current = true; setSalvando(true); setErroGeral(null);
    try {
      const campos = valorGenitorParaCampos(mae, pai);
      const resultado = await definirFiliacaoAnimal(animal.id, campos);
      setAvisos(resultado.avisos);
      await concluir(resultado, resultado.avisos);
    } catch (falha) {
      setErroGeral(falha instanceof RebanhoApiError ? falha.message : falha instanceof Error ? falha.message : String(falha));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-filiacao-animal";
  return (
    <PainelCadastro aberto titulo={`Filiação de ${animal.brinco}`} onFechar={() => { if (!salvando) onFechar(); }}
      rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : "Salvar filiação"}</Button></>}>
      <form id={formId} onSubmit={submeter} noValidate className="grid gap-5">
        <ErrorBox erro={erroGeral} />
        {avisos.length > 0 && <div role="status" className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {avisos.map((a, i) => <p key={i}>{a.mensagem}</p>)}
        </div>}
        <CampoGenitor rotulo="Mãe" sexo="F" ladoInicial={animal.filiacao.mae} excluirAnimalId={animal.id} valor={mae} onChange={setMae} erro={errosGenitor.mae} />
        <CampoGenitor rotulo="Pai" sexo="M" ladoInicial={animal.filiacao.pai} excluirAnimalId={animal.id} valor={pai} onChange={setPai} erro={errosGenitor.pai} />
      </form>
    </PainelCadastro>
  );
}

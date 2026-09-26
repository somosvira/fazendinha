// Painel "Definir filiação" — PUT /pecuaria/rebanho/animais/:id/filiacao (substituição
// completa de mãe e pai). Mostra os avisos que o servidor devolve (não bloqueiam) e,
// quando a composição atual era INFORMADA e não foi sobrescrita, pergunta se aplica a
// composição calculada pelos novos genitores.

import { type FormEvent, useRef, useState } from "react";
import { definirFiliacaoAnimal, substituirComposicaoAnimal, RebanhoApiError } from "../api";
import type { AnimalFicha, ComposicaoSugerida } from "../types";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { PainelCadastro } from "../../../financeiro/PainelCadastro";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { CampoGenitor, genitorIncompleto, mensagemGenitorIncompleto, ladoParaValor, valorGenitorParaCampos, type ValorGenitor } from "../components/CampoGenitor";

export function FormFiliacao({ animal, onSalvo, onFechar }: {
  animal: AnimalFicha;
  onSalvo: (atualizado: AnimalFicha) => Promise<void> | void;
  onFechar: () => void;
}) {
  const [mae, setMae] = useState<ValorGenitor>(() => ladoParaValor(animal.filiacao?.mae ?? null));
  const [pai, setPai] = useState<ValorGenitor>(() => ladoParaValor(animal.filiacao?.pai ?? null));
  const [avisos, setAvisos] = useState<Array<{ campo: string; mensagem: string }>>([]);
  const [sugestao, setSugestao] = useState<ComposicaoSugerida | null>(null);
  const [resultadoPendente, setResultadoPendente] = useState<AnimalFicha | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aplicandoSugestao, setAplicandoSugestao] = useState(false);
  const emCurso = useRef(false);
  const [errosGenitor, setErrosGenitor] = useState<{ mae?: string; pai?: string }>({});

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
      if (resultado.composicaoSugerida) {
        setSugestao(resultado.composicaoSugerida);
        setResultadoPendente(resultado);
      } else {
        await onSalvo(resultado);
      }
    } catch (falha) {
      setErroGeral(falha instanceof RebanhoApiError ? falha.message : falha instanceof Error ? falha.message : String(falha));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const aplicarSugestao = async () => {
    if (!sugestao || !resultadoPendente) return;
    setAplicandoSugestao(true); setErroGeral(null);
    try {
      await substituirComposicaoAnimal(animal.id, { itens: sugestao.itens.map((i) => ({ racaId: i.racaId, fracao64: i.fracao64 })), origem: "CALCULADA" });
      setSugestao(null);
      await onSalvo(resultadoPendente);
    } catch (falha) {
      setErroGeral(falha instanceof RebanhoApiError ? falha.message : falha instanceof Error ? falha.message : String(falha));
    } finally { setAplicandoSugestao(false); }
  };

  const manterComposicao = async () => {
    if (!resultadoPendente) return;
    setSugestao(null);
    await onSalvo(resultadoPendente);
  };

  const formId = "form-filiacao-animal";
  return <>
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

    <ConfirmDialog
      open={sugestao != null}
      title="Substituir pela composição calculada?"
      message={<>
        <p>A composição atual foi informada manualmente.</p>
        {sugestao && <p className="mt-2">Composição calculada pelos genitores: <strong>{sugestao.rotulo}</strong></p>}
      </>}
      confirmLabel="Substituir pela calculada"
      cancelLabel="Manter a atual"
      tone="neutral"
      processando={aplicandoSugestao}
      onConfirm={() => { void aplicarSugestao(); }}
      onCancel={() => { void manterComposicao(); }}
    />
  </>;
}

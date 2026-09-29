// Sheet "Editar composição racial" — PUT /pecuaria/rebanho/animais/:id/composicao
// (substitui a composição inteira). Reusa CampoComposicao de ../ui.tsx.

import { type FormEvent, useEffect, useRef, useState } from "react";
import { buscarComposicaoSugerida, substituirComposicaoAnimal, RebanhoApiError } from "../api";
import { CampoComposicao } from "../ui";
import { composicaoValida, juntarComposicoes, parcelaInformada, respeitaHerdanca, somaFracoes } from "../lib/composicao";
import type { AnimalFicha, CatalogoRaca, ComposicaoItemInput, ComposicaoSugerida } from "../types";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { PainelCadastro } from "../../../financeiro/PainelCadastro";

export function FormComposicao({ animal, racas, onSalvo, onFechar }: {
  animal: AnimalFicha;
  racas: CatalogoRaca[];
  onSalvo: () => Promise<void> | void;
  onFechar: () => void;
}) {
  const [itens, setItens] = useState<ComposicaoItemInput[]>(
    animal.composicao.map((c) => ({ racaId: c.racaId, fracao64: c.fracao64 })),
  );
  const [herdada, setHerdada] = useState<ComposicaoSugerida | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [excecao, setExcecao] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  useEffect(() => {
    let ativo = true;
    buscarComposicaoSugerida(animal.id).then((resultado) => {
      if (!ativo) return;
      setHerdada(resultado);
      if (resultado) setItens(parcelaInformada(animal.composicao, resultado.itens));
    }).catch((falha) => { if (ativo) setErroGeral(falha instanceof Error ? falha.message : String(falha)); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [animal]);
  // raças já presentes no animal continuam selecionáveis mesmo se foram desativadas no cadastro
  const opcoes: CatalogoRaca[] = [
    ...racas,
    ...animal.composicao
      .filter((c) => !racas.some((r) => r.id === c.racaId))
      .map((c) => ({ id: c.racaId, nome: `${c.nome} (inativa)`, sigla: c.sigla, base: true })),
  ];
  const [erro, setErro] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const fixos = herdada?.itens.map(({ racaId, fracao64 }) => ({ racaId, fracao64 })) ?? [];
  const limite = 64 - somaFracoes(fixos);
  const total = excecao ? itens : juntarComposicoes(fixos, itens);
  const legadoDivergente = herdada && !respeitaHerdanca(animal.composicao, fixos);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    if (carregando) return;
    if (itens.some((item) => !item.racaId)) { setErro("Selecione a raça em todas as linhas."); return; }
    if (!composicaoValida(itens) || (!excecao && somaFracoes(itens) > limite)) { setErro(`Confira as frações: a parcela informada não pode passar de ${excecao ? 64 : limite}/64.`); return; }
    if (excecao && justificativa.trim().length < 10) { setErro("Justifique a exceção com pelo menos 10 caracteres."); return; }
    setErro(null);
    emCurso.current = true; setSalvando(true); setErroGeral(null);
    try {
      await substituirComposicaoAnimal(animal.id, { itens: total, ...(excecao ? { justificativaExcecao: justificativa.trim() } : {}) });
      await onSalvo();
    } catch (falha) {
      if (falha instanceof RebanhoApiError) setErroGeral(falha.message);
      else setErroGeral(falha instanceof Error ? falha.message : String(falha));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-composicao-animal";
  return <PainelCadastro aberto titulo={`Composição de ${animal.brinco}`} onFechar={() => { if (!salvando) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : "Salvar composição"}</Button></>}>
    <form id={formId} onSubmit={submeter} noValidate className="grid gap-4">
      <ErrorBox erro={erroGeral} />
      {carregando ? <p className="text-sm text-ink-3">Calculando a parcela herdada…</p> : <>
        {herdada && <p className="text-sm text-ink-3">Parcela fixa dos genitores: {herdada.rotulo} ({somaFracoes(fixos)}/64). {limite ? `Pode informar até ${limite}/64 da parte desconhecida.` : "Composição completa."}</p>}
        {legadoDivergente && <p role="status" className="text-sm text-amber-900">A composição anterior diverge da filiação. Ao salvar normalmente, a parcela dos genitores será corrigida; para mantê-la, registre uma exceção.</p>}
        {(!herdada || limite > 0 || excecao) && <CampoComposicao racas={opcoes} itens={itens} onChange={setItens} erro={erro ?? undefined} limite64={excecao ? 64 : limite} />}
        {herdada && <button type="button" className="w-fit text-sm font-semibold text-mast hover:underline" onClick={() => { setExcecao(!excecao); setItens(!excecao ? animal.composicao.map(({ racaId, fracao64 }) => ({ racaId, fracao64 })) : parcelaInformada(animal.composicao, fixos)); setErro(null); }}>{excecao ? "Voltar ao cálculo pelos genitores" : "Registrar exceção à composição calculada"}</button>}
        {excecao && <label className="text-sm font-medium">Justificativa da exceção<textarea value={justificativa} maxLength={500} onChange={(e) => setJustificativa(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border p-3" rows={3} placeholder="Explique a fonte ou a correção necessária" /></label>}
        {erro && !itens.length && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      </>}
    </form>
  </PainelCadastro>;
}

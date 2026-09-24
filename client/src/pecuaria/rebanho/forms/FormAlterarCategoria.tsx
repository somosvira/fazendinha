// Sheet "Alterar categoria" — POST /pecuaria/rebanho/animais/:id/categoria. Troca manual: vale
// sobre o cálculo automático até ser removida (ver "Voltar ao automático" em DetalheAnimal).

import { type FormEvent, useRef, useState } from "react";
import { definirCategoriaManual, RebanhoApiError } from "../api";
import type { AnimalFicha, CategoriaDTO } from "../types";
import { rotuloOpcaoCategoria } from "../lib/rotulos";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";

export function FormAlterarCategoria({ animal, categorias, onSalvo, onFechar }: {
  animal: AnimalFicha;
  /** categorias ativas do sexo do animal, excluindo a atual — quem chama já filtra */
  categorias: CategoriaDTO[];
  onSalvo: (atualizado: AnimalFicha) => Promise<void> | void;
  onFechar: () => void;
}) {
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [data, setData] = useState(hoje());
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<{ categoriaId?: string; data?: string; motivo?: string }>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    const novosErros: typeof erros = {};
    if (!categoriaId) novosErros.categoriaId = "Selecione a categoria";
    if (!data) novosErros.data = "Informe a data";
    if (!motivo.trim()) novosErros.motivo = "Informe o motivo";
    setErros(novosErros); setErroGeral(null);
    if (Object.keys(novosErros).length) return;
    emCurso.current = true; setSalvando(true);
    try {
      const atualizado = await definirCategoriaManual(animal.id, { categoriaId, data, motivo: motivo.trim() });
      await onSalvo(atualizado);
    } catch (falha) {
      if (falha instanceof RebanhoApiError && falha.campo && falha.campo in { categoriaId: 0, data: 0, motivo: 0 }) setErros({ [falha.campo]: falha.message });
      else setErroGeral(falha instanceof RebanhoApiError ? falha.message : falha instanceof Error ? falha.message : String(falha));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-alterar-categoria";
  return <PainelCadastro aberto eyebrow="Categoria" titulo={`Alterar categoria de ${animal.brinco}`} onFechar={() => { if (!salvando) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : "Salvar categoria"}</Button></>}>
    <form id={formId} onSubmit={submeter} noValidate className="grid gap-4">
      <ErrorBox erro={erroGeral} />
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Isto muda só a classificação. Não registra parto nem altera a reprodução.</p>
      <CampoFormulario id="categoria-nova" rotulo="Nova categoria" obrigatorio erro={erros.categoriaId}>{(p) => <select {...p} required value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={classeInput}>
        <option value="">Selecione</option>
        {categorias.map((c) => <option key={c.id} value={c.id}>{rotuloOpcaoCategoria(categorias, c)}</option>)}
      </select>}</CampoFormulario>
      <CampoFormulario id="categoria-data" rotulo="Data" obrigatorio erro={erros.data}>{(p) => <input {...p} required type="date" max={hoje()} value={data} onChange={(e) => setData(e.target.value)} className={classeInput} />}</CampoFormulario>
      <CampoFormulario id="categoria-motivo" rotulo="Motivo" obrigatorio erro={erros.motivo}>{(p) => <textarea {...p} required maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={classeInput} />}</CampoFormulario>
    </form>
  </PainelCadastro>;
}

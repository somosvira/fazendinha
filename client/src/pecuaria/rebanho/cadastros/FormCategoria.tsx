// Cadastro de categoria — a validação de campo (nome, sexo, idades) é local; salvar de fato
// (simular impacto, confirmar se há mudança, aplicar) é feito por quem chama (Cadastros.tsx),
// que também controla `salvando`/`erro` — por isso este form não fala com a API diretamente.

import { FormEvent, useState } from "react";
import type { CategoriaDTO, CriterioPartos, Sexo } from "../types";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";

export type DadosFormCategoria = {
  nome: string;
  sexo: Sexo;
  automatica: boolean;
  idadeMinMeses: number | null;
  idadeMaxMeses: number | null;
  partos: CriterioPartos;
};

type Erros = Partial<Record<keyof DadosFormCategoria, string>>;

export function FormCategoria({ categoria, salvando, erro, onSalvar, onFechar }: {
  categoria: CategoriaDTO | null;
  salvando: boolean;
  erro: string | null;
  onSalvar: (dados: DadosFormCategoria) => void;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [sexo, setSexo] = useState<Sexo>(categoria?.sexo ?? "F");
  const [automatica, setAutomatica] = useState(categoria?.automatica ?? true);
  const [idadeMinMeses, setIdadeMinMeses] = useState(categoria?.idadeMinMeses != null ? String(categoria.idadeMinMeses) : "");
  const [idadeMaxMeses, setIdadeMaxMeses] = useState(categoria?.idadeMaxMeses != null ? String(categoria.idadeMaxMeses) : "");
  const [partos, setPartos] = useState<CriterioPartos>(categoria?.partos ?? "QUALQUER");
  const [erros, setErros] = useState<Erros>({});

  const submeter = (e: FormEvent) => {
    e.preventDefault();
    const novosErros: Erros = {};
    if (nome.trim().length < 1) novosErros.nome = "Informe o nome da categoria";
    const min = idadeMinMeses.trim() === "" ? null : Number(idadeMinMeses);
    const max = idadeMaxMeses.trim() === "" ? null : Number(idadeMaxMeses);
    if (automatica) {
      if (min != null && min < 0) novosErros.idadeMinMeses = "Idade mínima não pode ser negativa";
      if (max != null && max <= 0) novosErros.idadeMaxMeses = "Idade máxima deve ser maior que zero";
      if (min != null && max != null && min >= max) novosErros.idadeMaxMeses = "A idade máxima deve ser maior que a mínima";
    }
    setErros(novosErros);
    if (Object.keys(novosErros).length) return;
    onSalvar({ nome: nome.trim(), sexo, automatica, idadeMinMeses: automatica ? min : null, idadeMaxMeses: automatica ? max : null, partos: automatica ? partos : "QUALQUER" });
  };

  const formId = "form-categoria";
  return <PainelCadastro aberto eyebrow="Categoria" titulo={categoria ? `Editar ${categoria.nome}` : "Nova categoria"} onFechar={() => { if (!salvando) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : categoria ? "Salvar categoria" : "Criar categoria"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <ErrorBox erro={erro} />
      <CampoFormulario id="categoria-nome" rotulo="Nome da categoria" obrigatorio erro={erros.nome}>{(p) => <input {...p} required maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Novilha" className={classeInput} />}</CampoFormulario>
      <CampoFormulario id="categoria-sexo" rotulo="Sexo" obrigatorio>{(p) => <select {...p} value={sexo} onChange={(e) => setSexo(e.target.value as Sexo)} className={classeInput}><option value="F">Fêmea</option><option value="M">Macho</option></select>}</CampoFormulario>
      <label className="flex items-start gap-3 text-sm font-medium">
        <input type="checkbox" aria-label="Calculada por regra" checked={automatica} onChange={(e) => setAutomatica(e.target.checked)} className="mt-1" />
        <span>Calculada por regra<span className="block text-xs font-normal text-ink-3">Desmarque para uma categoria só manual (ex.: Reprodutor, Boi carreiro) — sem regra automática, atribuída só pela ficha do animal.</span></span>
      </label>
      {automatica && <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="categoria-idade-min" rotulo="Idade mínima (meses)" erro={erros.idadeMinMeses} ajuda="Em branco = sem mínimo.">{(p) => <input {...p} type="number" min={0} step={1} value={idadeMinMeses} onChange={(e) => setIdadeMinMeses(e.target.value)} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="categoria-idade-max" rotulo="Idade máxima (meses)" erro={erros.idadeMaxMeses} ajuda="Até antes de — em branco = sem máximo.">{(p) => <input {...p} type="number" min={1} step={1} value={idadeMaxMeses} onChange={(e) => setIdadeMaxMeses(e.target.value)} className={classeInput} />}</CampoFormulario>
      </div>}
      {automatica && <CampoFormulario id="categoria-partos" rotulo="Partos" obrigatorio>{(p) => <select {...p} value={partos} onChange={(e) => setPartos(e.target.value as CriterioPartos)} className={classeInput}>
        <option value="QUALQUER">Qualquer</option>
        <option value="SEM">Sem parto</option>
        <option value="COM">Com parto</option>
      </select>}</CampoFormulario>}
    </form>
  </PainelCadastro>;
}

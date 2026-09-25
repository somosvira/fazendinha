// Sheet "Editar dados" do animal — PATCH /pecuaria/rebanho/animais/:id.
// Mesmo padrão de client/src/financeiro/FormConta.tsx: PainelCadastro + campos
// controlados + patch só com os campos alterados + erro por campo via
// RebanhoApiError.campo.

import { type FormEvent, useRef, useState } from "react";
import { editarAnimal, RebanhoApiError } from "../api";
import type { AnimalFicha, EditarAnimalInput, Origem, Sexo } from "../types";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";

type Erros = Partial<Record<keyof EditarAnimalInput, string>>;

export function FormDadosAnimal({ animal, onSalvo, onFechar }: {
  animal: AnimalFicha;
  onSalvo: (atualizado: AnimalFicha) => Promise<void> | void;
  onFechar: () => void;
}) {
  const [brinco, setBrinco] = useState(animal.brinco);
  const [nome, setNome] = useState(animal.nome ?? "");
  const [brincoEletronico, setBrincoEletronico] = useState(animal.brincoEletronico ?? "");
  const [sisbov, setSisbov] = useState(animal.sisbov ?? "");
  const [sexo, setSexo] = useState<Sexo>(animal.sexo);
  const [dataNascimento, setDataNascimento] = useState(animal.dataNascimento.slice(0, 10));
  const [nascimentoEstimado, setNascimentoEstimado] = useState(animal.nascimentoEstimado);
  const [origem, setOrigem] = useState<Origem>(animal.origem);
  const [dataEntrada, setDataEntrada] = useState(animal.dataEntrada.slice(0, 10));
  const [partosAntesDaEntrada, setPartosAntesDaEntrada] = useState(String(animal.partosAntesDaEntrada));
  const [observacao, setObservacao] = useState(animal.observacao ?? "");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  const alterarOrigem = (novaOrigem: Origem) => {
    setOrigem(novaOrigem);
    if (novaOrigem === "NASCIDO") setDataEntrada(dataNascimento);
  };
  const alterarDataNascimento = (valor: string) => {
    setDataNascimento(valor);
    if (origem === "NASCIDO") setDataEntrada(valor);
  };
  // partos antes da entrada só faz sentido para fêmea (R1) — trocar para macho zera o campo
  const alterarSexo = (novoSexo: Sexo) => {
    setSexo(novoSexo);
    if (novoSexo === "M") setPartosAntesDaEntrada("0");
  };

  const validar = (): Erros => {
    const novosErros: Erros = {};
    if (brinco.trim().length < 1) novosErros.brinco = "Informe o brinco";
    if (!dataNascimento) novosErros.dataNascimento = "Informe a data de nascimento";
    if (!dataEntrada) novosErros.dataEntrada = "Informe a data de entrada";
    if (dataNascimento && dataEntrada && dataEntrada < dataNascimento) novosErros.dataEntrada = "Data de entrada não pode ser anterior ao nascimento";
    if (origem === "NASCIDO" && dataNascimento && dataEntrada && dataEntrada !== dataNascimento) novosErros.dataEntrada = "Animal nascido na propriedade deve ter entrada igual ao nascimento";
    return novosErros;
  };

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    const validacao = validar();
    setErros(validacao);
    if (Object.keys(validacao).length) return;
    const texto = (v: string) => (v.trim() === "" ? null : v.trim());
    const patch: EditarAnimalInput = {};
    if (brinco.trim() !== animal.brinco) patch.brinco = brinco.trim();
    if (texto(nome) !== animal.nome) patch.nome = texto(nome);
    if (texto(brincoEletronico) !== animal.brincoEletronico) patch.brincoEletronico = texto(brincoEletronico);
    if (texto(sisbov) !== animal.sisbov) patch.sisbov = texto(sisbov);
    if (sexo !== animal.sexo) patch.sexo = sexo;
    if (dataNascimento !== animal.dataNascimento.slice(0, 10)) patch.dataNascimento = dataNascimento;
    if (nascimentoEstimado !== animal.nascimentoEstimado) patch.nascimentoEstimado = nascimentoEstimado;
    if (origem !== animal.origem) patch.origem = origem;
    if (dataEntrada !== animal.dataEntrada.slice(0, 10)) patch.dataEntrada = dataEntrada;
    if (Number(partosAntesDaEntrada || 0) !== animal.partosAntesDaEntrada) patch.partosAntesDaEntrada = Number(partosAntesDaEntrada || 0);
    if (texto(observacao) !== animal.observacao) patch.observacao = texto(observacao);
    if (!Object.keys(patch).length) { onFechar(); return; }
    emCurso.current = true; setSalvando(true); setErroGeral(null);
    try {
      const atualizado = await editarAnimal(animal.id, patch);
      await onSalvo(atualizado);
    } catch (erro) {
      if (erro instanceof RebanhoApiError && erro.campo) setErros({ [erro.campo]: erro.message } as Erros);
      else setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-dados-animal";
  return <PainelCadastro aberto titulo={`Editar ${animal.brinco}`} onFechar={() => { if (!salvando) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : "Salvar dados"}</Button></>}>
    <form id={formId} onSubmit={submeter} noValidate className="grid gap-4">
      <ErrorBox erro={erroGeral} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="animal-brinco" rotulo="Brinco" obrigatorio erro={erros.brinco}>{(p) => <input {...p} required maxLength={40} value={brinco} onChange={(e) => setBrinco(e.target.value)} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="animal-nome" rotulo="Nome" erro={erros.nome}>{(p) => <input {...p} maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} className={classeInput} />}</CampoFormulario>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="animal-brinco-eletronico" rotulo="Brinco eletrônico" erro={erros.brincoEletronico}>{(p) => <input {...p} maxLength={40} value={brincoEletronico} onChange={(e) => setBrincoEletronico(e.target.value)} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="animal-sisbov" rotulo="SISBOV" erro={erros.sisbov}>{(p) => <input {...p} maxLength={40} value={sisbov} onChange={(e) => setSisbov(e.target.value)} className={classeInput} />}</CampoFormulario>
      </div>
      <CampoFormulario id="animal-sexo" rotulo="Sexo" obrigatorio>{(p) => <select {...p} value={sexo} onChange={(e) => alterarSexo(e.target.value as Sexo)} className={classeInput}><option value="F">Fêmea</option><option value="M">Macho</option></select>}</CampoFormulario>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="animal-data-nascimento" rotulo="Data de nascimento" obrigatorio erro={erros.dataNascimento}>{(p) => <input {...p} required type="date" max={hoje()} value={dataNascimento} onChange={(e) => alterarDataNascimento(e.target.value)} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="animal-nascimento-estimado" rotulo="Nascimento estimado">{(p) => <label className="mt-1.5 flex h-[42px] items-center gap-2"><input id={p.id} type="checkbox" aria-label={p["aria-label"]} checked={nascimentoEstimado} onChange={(e) => setNascimentoEstimado(e.target.checked)} /><span className="text-sm font-normal text-ink-3">A data é uma estimativa</span></label>}</CampoFormulario>
      </div>
      <CampoFormulario id="animal-origem" rotulo="Origem" obrigatorio>{(p) => <select {...p} value={origem} onChange={(e) => alterarOrigem(e.target.value as Origem)} className={classeInput}><option value="NASCIDO">Nascido na propriedade</option><option value="COMPRADO">Comprado</option></select>}</CampoFormulario>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="animal-data-entrada" rotulo="Data de entrada" obrigatorio erro={erros.dataEntrada} ajuda={origem === "NASCIDO" ? "Igual ao nascimento para animais nascidos na propriedade." : undefined}>{(p) => <input {...p} required type="date" max={hoje()} disabled={origem === "NASCIDO"} value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} className={classeInput} />}</CampoFormulario>
        {sexo === "F" && <CampoFormulario id="animal-partos" rotulo="Partos antes da entrada" ajuda="Usado para calcular a categoria (novilha vira vaca a partir de 1 parto).">{(p) => <input {...p} type="number" min={0} step={1} value={partosAntesDaEntrada} onChange={(e) => setPartosAntesDaEntrada(e.target.value)} className={classeInput} />}</CampoFormulario>}
      </div>
      <CampoFormulario id="animal-observacao" rotulo="Observação">{(p) => <textarea {...p} maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} className={classeInput} />}</CampoFormulario>
    </form>
  </PainelCadastro>;
}

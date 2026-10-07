// Cadastro de sítio (propriedade), aberto por Configurações > Sítios. Reusa
// client/src/api/propriedades.ts no padrão visual do Financeiro. PATCH /propriedades
// exige nome sempre; ativo/principal só mudam quando enviados — omitir preserva o
// valor atual no servidor.

import { FormEvent, useRef, useState } from "react";
import { criarPropriedade, editarPropriedade, type PropriedadeDTO } from "../../api/propriedades";
import { Button, ErrorBox } from "../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../financeiro/PainelCadastro";

export function FormSitio({ sitio, onSalvo, onFechar }: { sitio: PropriedadeDTO | null; onSalvo: () => Promise<void> | void; onFechar: () => void }) {
  const [nome, setNome] = useState(sitio?.nome ?? "");
  const [cidade, setCidade] = useState(sitio?.cidade ?? "");
  const [uf, setUf] = useState(sitio?.uf ?? "");
  const [principal, setPrincipal] = useState(sitio?.principal ?? false);
  const [erroNome, setErroNome] = useState<string | undefined>(undefined);
  const [erroUf, setErroUf] = useState<string | undefined>(undefined);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    const ufLimpa = uf.trim().toUpperCase();
    const faltaNome = nome.trim().length < 2;
    const ufInvalida = ufLimpa !== "" && !/^[A-Z]{2}$/.test(ufLimpa);
    setErroNome(faltaNome ? "Informe um nome com pelo menos 2 caracteres" : undefined);
    setErroUf(ufInvalida ? "Use a sigla do estado, com 2 letras" : undefined);
    if (faltaNome || ufInvalida) return;
    setErroGeral(null);
    emCurso.current = true; setSalvando(true);
    const dados = {
      nome: nome.trim(), cidade: cidade.trim() || undefined, uf: ufLimpa || undefined,
      principal, ativo: sitio?.ativo ?? true,
    };
    try {
      if (!sitio) await criarPropriedade(dados);
      else await editarPropriedade(sitio.id, dados);
      await onSalvo();
    } catch (erro) {
      setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-sitio";
  return <PainelCadastro aberto titulo={sitio ? `Editar ${sitio.nome}` : "Novo sítio"} onFechar={() => { if (!emCurso.current) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : sitio ? "Salvar sítio" : "Criar sítio"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <ErrorBox erro={erroGeral} />
      <CampoFormulario id="sitio-nome" rotulo="Nome do sítio" obrigatorio erro={erroNome}>{(p) => <input {...p} required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Fazenda Recria" className={classeInput} />}</CampoFormulario>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_96px]">
        <CampoFormulario id="sitio-cidade" rotulo="Cidade">{(p) => <input {...p} maxLength={80} value={cidade} onChange={(e) => setCidade(e.target.value)} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="sitio-uf" rotulo="UF" erro={erroUf}>{(p) => <input {...p} maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} placeholder="MG" className={classeInput} />}</CampoFormulario>
      </div>
      <label className="flex items-start gap-3 text-sm font-medium">
        <input type="checkbox" aria-label="Principal — sítio padrão quando não há filtro" checked={principal} onChange={(e) => setPrincipal(e.target.checked)} className="mt-1" />
        <span>Principal<span className="block text-xs font-normal text-ink-3">Sítio padrão quando não há filtro selecionado. Só um sítio pode ser principal.</span></span>
      </label>
    </form>
  </PainelCadastro>;
}

import { FormEvent, useRef, useState } from "react";
import {
  ApiError,
  atualizarCategoria,
  atualizarCentroCusto,
  atualizarGrupoCategoria,
  criarCategoria,
  criarCentroCusto,
  criarGrupoCategoria,
  type Categoria,
  type CentroCusto,
  type GrupoCategoria,
} from "./novo-api";
import { Button, ErrorBox } from "./financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "./PainelCadastro";

type Erros = Record<string, string>;

function erroDaApi(erro: unknown, setErros: (erros: Erros) => void, setErroGeral: (erro: string) => void) {
  if (erro instanceof ApiError && erro.campo) setErros({ [erro.campo]: erro.message });
  else setErroGeral(erro instanceof Error ? erro.message : String(erro));
}

export function FormGrupoCategoria({ grupo, ordemInicial, onSalvo, onFechar }: { grupo: GrupoCategoria | null; ordemInicial: number; onSalvo: () => Promise<void> | void; onFechar: () => void }) {
  const [nome, setNome] = useState(grupo?.nome ?? "");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    const nomeLimpo = nome.trim();
    if (nomeLimpo.length < 2) { setErros({ nome: "Informe um nome com pelo menos 2 caracteres" }); return; }
    if (emCurso.current) return;
    emCurso.current = true; setSalvando(true); setErros({}); setErroGeral("");
    try {
      if (!grupo) await criarGrupoCategoria({ nome: nomeLimpo, ordem: ordemInicial });
      else if (nomeLimpo !== grupo.nome) await atualizarGrupoCategoria(grupo.id, { nome: nomeLimpo });
      await onSalvo();
    } catch (erro) { erroDaApi(erro, setErros, setErroGeral); }
    finally { emCurso.current = false; setSalvando(false); }
  };
  const formId = "form-grupo-categoria";
  return <PainelCadastro aberto eyebrow="Grupo de categorias" titulo={grupo ? `Editar ${grupo.nome}` : "Novo grupo"} onFechar={onFechar}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : grupo ? "Salvar grupo" : "Criar grupo"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <ErrorBox erro={erroGeral || null} />
      <CampoFormulario id="grupo-nome" rotulo="Nome do grupo" obrigatorio erro={erros.nome}>{(p) => <input {...p} required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Operacional" className={classeInput} />}</CampoFormulario>
    </form>
  </PainelCadastro>;
}

export function FormCategoria({ categoria, grupos, ordemInicial, onSalvo, onFechar }: { categoria: Categoria | null; grupos: GrupoCategoria[]; ordemInicial: number; onSalvo: () => Promise<void> | void; onFechar: () => void }) {
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [grupoId, setGrupoId] = useState(String(categoria?.grupoCategoriaId ?? grupos.find((g) => g.ativo)?.id ?? ""));
  const [classificacao, setClassificacao] = useState<"" | "CUSTEIO" | "INVESTIMENTO">(categoria?.classificacao ?? "");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    const novosErros: Erros = {};
    if (nome.trim().length < 2) novosErros.nome = "Informe um nome com pelo menos 2 caracteres";
    if (!grupoId) novosErros.grupoCategoriaId = "Selecione um grupo";
    setErros(novosErros); if (Object.keys(novosErros).length || emCurso.current) return;
    emCurso.current = true; setSalvando(true); setErroGeral("");
    const dados = { nome: nome.trim(), grupoCategoriaId: Number(grupoId), classificacao: classificacao || null, ordem: categoria?.ordem ?? ordemInicial };
    try {
      if (!categoria) await criarCategoria(dados);
      else await atualizarCategoria(categoria.id, dados);
      await onSalvo();
    } catch (erro) { erroDaApi(erro, setErros, setErroGeral); }
    finally { emCurso.current = false; setSalvando(false); }
  };
  const formId = "form-categoria";
  return <PainelCadastro aberto eyebrow="Categoria financeira" titulo={categoria ? `Editar ${categoria.nome}` : "Nova categoria"} onFechar={onFechar}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : categoria ? "Salvar categoria" : "Criar categoria"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <ErrorBox erro={erroGeral || null} />
      <CampoFormulario id="categoria-nome" rotulo="Nome da categoria" obrigatorio erro={erros.nome}>{(p) => <input {...p} required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Insumos" className={classeInput} />}</CampoFormulario>
      <CampoFormulario id="categoria-grupo" rotulo="Grupo" obrigatorio erro={erros.grupoCategoriaId}>{(p) => <select {...p} required value={grupoId} onChange={(e) => setGrupoId(e.target.value)} className={classeInput}><option value="">Selecione</option>{grupos.filter((g) => g.ativo || g.id === categoria?.grupoCategoriaId).map((g) => <option key={g.id} value={g.id}>{g.nome}{!g.ativo ? " (inativo)" : ""}</option>)}</select>}</CampoFormulario>
      <CampoFormulario id="categoria-classificacao" rotulo="Classificação" ajuda="A direção financeira continua sendo definida pelo tipo da operação.">{(p) => <select {...p} value={classificacao} onChange={(e) => setClassificacao(e.target.value as typeof classificacao)} className={classeInput}><option value="">Não classificada</option><option value="CUSTEIO">Custeio</option><option value="INVESTIMENTO">Investimento</option></select>}</CampoFormulario>
    </form>
  </PainelCadastro>;
}

export function FormCentroCusto({ centro, ordemInicial, onSalvo, onFechar }: { centro: CentroCusto | null; ordemInicial: number; onSalvo: () => Promise<void> | void; onFechar: () => void }) {
  const [nome, setNome] = useState(centro?.nome ?? "");
  const [ehInvestimento, setEhInvestimento] = useState(centro?.ehInvestimento ?? false);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 2) { setErros({ nome: "Informe um nome com pelo menos 2 caracteres" }); return; }
    if (emCurso.current) return;
    emCurso.current = true; setSalvando(true); setErros({}); setErroGeral("");
    const dados = { nome: nome.trim(), ehInvestimento, ordem: centro?.ordem ?? ordemInicial };
    try {
      if (!centro) await criarCentroCusto(dados);
      else await atualizarCentroCusto(centro.id, dados);
      await onSalvo();
    } catch (erro) { erroDaApi(erro, setErros, setErroGeral); }
    finally { emCurso.current = false; setSalvando(false); }
  };
  const formId = "form-centro-custo";
  return <PainelCadastro aberto eyebrow="Centro de custo" titulo={centro ? `Editar ${centro.nome}` : "Novo centro de custo"} onFechar={onFechar}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : centro ? "Salvar centro" : "Criar centro"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <ErrorBox erro={erroGeral || null} />
      <CampoFormulario id="centro-nome" rotulo="Nome do centro de custo" obrigatorio erro={erros.nome}>{(p) => <input {...p} required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Atividade leiteira" className={classeInput} />}</CampoFormulario>
      <label className="flex items-start gap-3 text-sm font-medium"><input type="checkbox" aria-label="Centro de investimento" checked={ehInvestimento} onChange={(e) => setEhInvestimento(e.target.checked)} className="mt-1" /><span>Centro de investimento<span className="block text-xs font-normal text-ink-3">Se marcado, os lançamentos entram na análise de investimentos.</span></span></label>
    </form>
  </PainelCadastro>;
}

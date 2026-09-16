import { FormEvent, useRef, useState } from "react";
import {
  ApiError,
  atualizarCategoria,
  atualizarCentroCusto,
  criarCategoria,
  criarCentroCusto,
  type Categoria,
  type CentroCusto,
} from "./novo-api";
import { Button, ErrorBox } from "./financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "./PainelCadastro";
import { CampoSelect } from "../components/CampoSelect";
import { EXPLICACAO_CLASSIFICACAO } from "./lib/explicacoes";

const OPCOES_CLASSIFICACAO = [
  { value: "", label: "Não classificada", descricao: EXPLICACAO_CLASSIFICACAO[""] },
  { value: "CUSTEIO", label: "Custeio", descricao: EXPLICACAO_CLASSIFICACAO.CUSTEIO },
  { value: "INVESTIMENTO", label: "Investimento", descricao: EXPLICACAO_CLASSIFICACAO.INVESTIMENTO },
];

type Erros = Record<string, string>;

function erroDaApi(erro: unknown, setErros: (erros: Erros) => void, setErroGeral: (erro: string) => void) {
  if (erro instanceof ApiError && erro.campo) setErros({ [erro.campo]: erro.message });
  else setErroGeral(erro instanceof Error ? erro.message : String(erro));
}

export function FormCategoria({ categoria, ordemInicial, onSalvo, onFechar }: { categoria: Categoria | null; ordemInicial: number; onSalvo: () => Promise<void> | void; onFechar: () => void }) {
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [classificacao, setClassificacao] = useState<"" | "CUSTEIO" | "INVESTIMENTO">(categoria?.classificacao ?? "");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    const novosErros: Erros = {};
    if (nome.trim().length < 2) novosErros.nome = "Informe um nome com pelo menos 2 caracteres";
    setErros(novosErros); if (Object.keys(novosErros).length || emCurso.current) return;
    emCurso.current = true; setSalvando(true); setErroGeral("");
    const dados = { nome: nome.trim(), classificacao: classificacao || null, ordem: categoria?.ordem ?? ordemInicial };
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
      <CampoFormulario id="categoria-classificacao" rotulo="Classificação" ajuda="A direção financeira continua sendo definida pelo tipo da operação.">{(p) => <CampoSelect id={p.id} aria-label={p["aria-label"]} aria-invalid={p["aria-invalid"]} aria-describedby={p["aria-describedby"]}  value={classificacao} onValueChange={(v) => setClassificacao(v as typeof classificacao)} options={OPCOES_CLASSIFICACAO} />}</CampoFormulario>
    </form>
  </PainelCadastro>;
}

export function FormCentroCusto({ centro, ordemInicial, onSalvo, onFechar }: { centro: CentroCusto | null; ordemInicial: number; onSalvo: () => Promise<void> | void; onFechar: () => void }) {
  const [nome, setNome] = useState(centro?.nome ?? "");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 2) { setErros({ nome: "Informe um nome com pelo menos 2 caracteres" }); return; }
    if (emCurso.current) return;
    emCurso.current = true; setSalvando(true); setErros({}); setErroGeral("");
    const dados = { nome: nome.trim(), ordem: centro?.ordem ?? ordemInicial };
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
    </form>
  </PainelCadastro>;
}

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

type Erros = Record<string, string>;

function erroDaApi(erro: unknown, setErros: (erros: Erros) => void, setErroGeral: (erro: string) => void) {
  if (erro instanceof ApiError && erro.campo) setErros({ [erro.campo]: erro.message });
  else setErroGeral(erro instanceof Error ? erro.message : String(erro));
}

export function FormCategoria({ categoria, ordemInicial, onSalvo, onFechar }: { categoria: Categoria | null; ordemInicial: number; onSalvo: () => Promise<void> | void; onFechar: () => void }) {
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [classificacao, setClassificacao] = useState<"" | "CUSTEIO" | "INVESTIMENTO">(categoria?.classificacao ?? "");
  const [usoAgricola, setUsoAgricola] = useState(categoria?.usoAgricola ?? false);
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
    const dados = { nome: nome.trim(), classificacao: classificacao || null, ordem: categoria?.ordem ?? ordemInicial, usoAgricola };
    try {
      if (!categoria) await criarCategoria(dados);
      else await atualizarCategoria(categoria.id, dados);
      await onSalvo();
    } catch (erro) { erroDaApi(erro, setErros, setErroGeral); }
    finally { emCurso.current = false; setSalvando(false); }
  };
  const formId = "form-categoria";
  return <PainelCadastro aberto titulo={categoria ? `Editar ${categoria.nome}` : "Nova categoria"} onFechar={onFechar}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : categoria ? "Salvar categoria" : "Criar categoria"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <ErrorBox erro={erroGeral || null} />
      <CampoFormulario id="categoria-nome" rotulo="Nome da categoria" obrigatorio erro={erros.nome}>{(p) => <input {...p} required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Insumos" className={classeInput} />}</CampoFormulario>
      <CampoFormulario id="categoria-classificacao" rotulo="Classificação" ajuda="A direção financeira continua sendo definida pelo tipo da operação.">{(p) => <select {...p} value={classificacao} onChange={(e) => setClassificacao(e.target.value as typeof classificacao)} className={classeInput}><option value="">Não classificada</option><option value="CUSTEIO">Custeio</option><option value="INVESTIMENTO">Investimento</option></select>}</CampoFormulario>
      <fieldset className="rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium">Uso dos produtos desta categoria</legend>
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={usoAgricola} onChange={(e) => setUsoAgricola(e.target.checked)} />
            <span>Agrícola <span className="text-ink-3">— aplicável em talhão; entra no alerta de estoque do plantio</span></span>
          </label>
        </div>
      </fieldset>
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
  return <PainelCadastro aberto titulo={centro ? `Editar ${centro.nome}` : "Novo centro de custo"} onFechar={onFechar}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : centro ? "Salvar centro" : "Criar centro"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <ErrorBox erro={erroGeral || null} />
      <CampoFormulario id="centro-nome" rotulo="Nome do centro de custo" obrigatorio erro={erros.nome}>{(p) => <input {...p} required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Atividade leiteira" className={classeInput} />}</CampoFormulario>
    </form>
  </PainelCadastro>;
}

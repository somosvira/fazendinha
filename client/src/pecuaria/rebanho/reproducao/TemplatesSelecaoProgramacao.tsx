import { Copy, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { Condicoes, criteriosVazios, enumerados, validarCriterios } from "./EditorSelecaoVisita";
import "./programar-protocolo.css";
import {
  camposNumericos, camposValores, listarSelecoes, salvarSelecao,
  type CondicaoSelecao, type CriteriosSelecao, type OpcoesSelecao, type SelecaoVisita,
} from "./planner-api";

const rotulos = { ...camposNumericos, ...camposValores };

function ResumoCondicoes({ condicoes, opcoes }: { condicoes: CondicaoSelecao[]; opcoes: OpcoesSelecao }) {
  const escolhas = { ...enumerados, LOTE: opcoes.lotes, CATEGORIA: opcoes.categorias, RACA: opcoes.racas, PROTOCOLO: opcoes.protocolos };
  return <dl className="divide-y divide-border rounded-lg border border-border">
    {condicoes.map((condicao, indice) => {
      let valor = "Sem informação";
      if (condicao.tipo === "VALORES") {
        const campo = condicao.campo;
        valor = condicao.valores.map(id => escolhas[campo]?.find(o => o.id === id)?.nome ?? id).join(" ou ");
      }
      if (condicao.tipo === "FAIXA") {
        const { min, max, incluirMin, incluirMax } = condicao;
        valor = [
          min == null ? "" : `${incluirMin ? "A partir de" : "Acima de"} ${min.toLocaleString("pt-BR")}`,
          max == null ? "" : `${incluirMax ? "até" : "abaixo de"} ${max.toLocaleString("pt-BR")}`,
        ].filter(Boolean).join(" · ");
      }
      return <div key={indice} className="grid grid-cols-2 gap-3 px-3 py-2 text-sm">
        <dt className="font-medium">{rotulos[condicao.campo]}</dt>
        <dd className="min-w-0 break-words">{valor}</dd>
      </div>;
    })}
  </dl>;
}

type Props = {
  propriedadeId: number;
  criteriosAtuais: CriteriosSelecao;
  opcoes: OpcoesSelecao;
  onFechar: () => void;
  onAplicar: (criterios: CriteriosSelecao, nome: string) => void;
};

export function TemplatesSelecaoProgramacao({ propriedadeId, criteriosAtuais, opcoes, onFechar, onAplicar }: Props) {
  const [templates, setTemplates] = useState<SelecaoVisita[]>([]);
  const [selecionado, setSelecionado] = useState("");
  const [editor, setEditor] = useState<{ original?: SelecaoVisita; nome: string; criterios: CriteriosSelecao } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vigente = true;
    listarSelecoes(propriedadeId).then(({ selecoes }) => {
      if (!vigente) return;
      setTemplates(selecoes.filter(s => s.ativo && s.versaoAtual));
    }).catch(e => {
      if (vigente) setErro(e instanceof Error ? e.message : String(e));
    }).finally(() => {
      if (vigente) setCarregando(false);
    });
    return () => { vigente = false; };
  }, [propriedadeId, tentativa]);

  const template = templates.find(s => s.id === selecionado);
  const opcoesEditor = { ...enumerados, LOTE: opcoes.lotes, CATEGORIA: opcoes.categorias, RACA: opcoes.racas, PROTOCOLO: opcoes.protocolos };
  const previa = template?.versaoAtual?.criterios;

  function editar(original?: SelecaoVisita) {
    setErro(null);
    setEditor({
      original,
      nome: original?.nome ?? "",
      criterios: structuredClone(original?.versaoAtual?.criterios ?? criteriosVazios()),
    });
  }

  async function salvar() {
    if (!editor || salvando) return;
    const nome = editor.nome.trim();
    const problema = nome.length < 2 ? "Informe um nome com pelo menos dois caracteres." : validarCriterios(editor.criterios);
    if (problema) { setErro(problema); return; }
    setErro(null);
    setSalvando(true);
    try {
      const salvo = await salvarSelecao(propriedadeId, nome, editor.criterios, editor.original);
      setTemplates(lista => [...lista.filter(s => s.id !== salvo.id), salvo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      setSelecionado(salvo.id);
      setEditor(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  function voltar() {
    if (salvando) return;
    if (!editor) { onFechar(); return; }
    setErro(null);
    setEditor(null);
  }

  return <PainelCadastro aberto largura="sm:max-w-2xl" bloqueado={salvando}
    titulo={editor ? editor.original ? "Editar filtro salvo" : "Novo filtro" : "Filtros salvos"}
    onFechar={voltar}
    rodape={<>
      {!editor && template && <Button secondary className="sm:mr-auto" onClick={() => editar(template)}><Pencil size={16} aria-hidden />Editar filtro salvo</Button>}
      <Button secondary disabled={salvando} onClick={voltar}>Cancelar</Button>
      {editor
        ? <Button type="submit" form="template-selecao-programacao" disabled={salvando}>{salvando ? "Salvando…" : "Salvar filtro"}</Button>
        : <Button disabled={!previa} onClick={() => { if (template && previa) onAplicar(structuredClone(previa), template.nome); }}>Aplicar filtro salvo</Button>}
    </>}>
    <ErrorBox erro={erro} />
    {editor ? <form id="template-selecao-programacao" className="grid gap-4" onSubmit={e => { e.preventDefault(); void salvar(); }}>
      <fieldset disabled={salvando} className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1">Nome do filtro
            <input className={classeInput} required minLength={2} maxLength={120} value={editor.nome}
              onChange={e => setEditor({ ...editor, nome: e.target.value })} />
          </label>
          {!editor.original && <Button secondary onClick={() => setEditor({ ...editor, criterios: structuredClone(criteriosAtuais) })}><Copy size={16} aria-hidden />Usar filtros atuais</Button>}
        </div>
        <div className="template-editor">
          <Condicoes compacto valor={editor.criterios.todas} opcoes={opcoesEditor}
            mudar={todas => setEditor({ ...editor, criterios: { ...editor.criterios, todas } })} />
          {editor.criterios.qualquer.map((grupo, indice) => <fieldset key={grupo.id} className="mt-4 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-medium">Alternativa {indice + 1}</legend>
            <Condicoes compacto valor={grupo.todas} opcoes={opcoesEditor}
              mudar={todas => setEditor({ ...editor, criterios: {
                ...editor.criterios, qualquer: editor.criterios.qualquer.map(item => item.id === grupo.id ? { ...item, todas } : item),
              } })} />
            <Button secondary className="mt-2" onClick={() => setEditor({ ...editor, criterios: {
              ...editor.criterios, qualquer: editor.criterios.qualquer.filter(item => item.id !== grupo.id),
            } })}>Remover alternativa</Button>
          </fieldset>)}
          <Button secondary className="mt-3" disabled={editor.criterios.qualquer.length >= 20}
            onClick={() => setEditor({ ...editor, criterios: {
              ...editor.criterios, qualquer: [...editor.criterios.qualquer, { id: crypto.randomUUID(), todas: [] }],
            } })}>Adicionar alternativa</Button>
        </div>
      </fieldset>
    </form> : <div className="template-layout">
      <div className="template-lista">
        {carregando && <p role="status">Carregando filtros salvos…</p>}
        {erro && <Button secondary onClick={() => { setErro(null); setCarregando(true); setTentativa(n => n + 1); }}>Tentar novamente</Button>}
        {!carregando && !erro && !templates.length && <p className="text-sm text-muted-foreground">Nenhum filtro salvo nesta fazenda.</p>}
        {templates.map(s => <Button key={s.id} secondary aria-pressed={s.id === selecionado}
          className="template-item"
          onClick={() => setSelecionado(s.id)}>{s.nome}</Button>)}
        <Button secondary className="mt-2 justify-start" disabled={carregando} onClick={() => editar()}><Plus size={16} aria-hidden />Novo filtro</Button>
      </div>
      <div className="grid content-start gap-3">
        {template && previa ? <>
          <h3 className="font-semibold">{template.nome}</h3>
          <p className="text-sm font-medium">Filtros que serão aplicados</p>
          {!previa.todas.length && !previa.qualquer.length && <p className="text-sm">Nenhuma condição definida.</p>}
          {!!previa.todas.length && <ResumoCondicoes condicoes={previa.todas} opcoes={opcoes} />}
          {!!previa.qualquer.length && <>
            <p className="text-sm">O animal precisa atender a pelo menos um dos grupos abaixo, além dos filtros gerais.</p>
            {previa.qualquer.map((grupo, indice) => <div key={grupo.id}>
              <p className="mb-1 text-sm font-medium">Grupo {indice + 1}</p>
              <ResumoCondicoes condicoes={grupo.todas} opcoes={opcoes} />
            </div>)}
          </>}
          <p className="text-sm text-muted-foreground">
            Dados ausentes em filtros: {previa.politicaDesconhecidos === "INCLUIR" ? "incluir e sinalizar" : "excluir"}.
          </p>
        </> : <p className="text-sm text-muted-foreground">Escolha um filtro salvo para conferir os critérios.</p>}
      </div>
    </div>}
  </PainelCadastro>;
}

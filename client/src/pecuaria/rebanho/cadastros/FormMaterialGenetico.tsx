// Cadastro de material genético (v2 · Genética · Fase 4) — sêmen ou embrião. O
// material entra no estoque via compra (Financeiro › Nova operação); aqui só se
// registra de quem é (touro/doadora) e a categoria financeira usada nas compras.
// Edição só permite trocar tipo de sêmen e observação — o resto define o produto
// do estoque e não muda depois de criado.

import { FormEvent, useEffect, useRef, useState } from "react";
import { criarMaterialGenetico, editarMaterialGenetico, RebanhoApiError } from "../api";
import { listarCategorias, type Categoria } from "../../../estoque/api";
import type { MaterialGeneticoDTO, RefGenitorInput, TipoMaterialGenetico, TipoSemen } from "../types";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { CampoGenitor, genitorIncompleto, type ValorGenitor } from "../components/CampoGenitor";

type Erros = Record<string, string>;

const ROTULO_SEMEN: Record<TipoSemen, string> = {
  CONVENCIONAL: "Convencional",
  SEXADO_FEMEA: "Sexado fêmea",
  SEXADO_MACHO: "Sexado macho",
};

function paraRefGenitor(valor: ValorGenitor): RefGenitorInput | null {
  if (valor.tipo === "ANIMAL" && valor.id) return { tipo: "ANIMAL", id: valor.id };
  if (valor.tipo === "EXTERNO" && valor.id) return { tipo: "EXTERNO", id: valor.id };
  return null;
}

function valorGenitorDe(g: MaterialGeneticoDTO["touro"] | MaterialGeneticoDTO["doadora"]): ValorGenitor {
  if (!g) return { tipo: "EXTERNO", id: "" };
  if (g.tipo === "ANIMAL") return { tipo: "ANIMAL", id: g.id, brinco: g.brinco, nome: g.nome };
  return { tipo: "EXTERNO", id: g.id };
}

export function FormMaterialGenetico({ material, onSalvo, onFechar }: {
  material: MaterialGeneticoDTO | null;
  onSalvo: () => Promise<void> | void;
  onFechar: () => void;
}) {
  const editando = !!material;
  const [tipo, setTipo] = useState<TipoMaterialGenetico>(material?.tipo ?? "SEMEN");
  const [tipoSemen, setTipoSemen] = useState<TipoSemen>(material?.tipoSemen ?? "CONVENCIONAL");
  const [touro, setTouro] = useState<ValorGenitor>(valorGenitorDe(material?.touro ?? null));
  const [doadora, setDoadora] = useState<ValorGenitor>(material?.doadora ? valorGenitorDe(material.doadora) : { tipo: "NENHUM" });
  const [observacao, setObservacao] = useState(material?.observacao ?? "");
  const [nomeProduto, setNomeProduto] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  useEffect(() => {
    if (editando) return;
    listarCategorias(false).then(setCategorias).catch((e) => setErroCarga(e instanceof Error ? e.message : String(e)));
  }, [editando]);

  const categoriasGeneticas = (categorias ?? []).filter((c) => c.ativo);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    if (editando) {
      if (material.tipo === "EMBRIAO" && !material.doadora && genitorIncompleto(doadora)) {
        setErros({ doadora: "Escolha uma doadora ou marque Desconhecida/o" });
        return;
      }
      emCurso.current = true; setSalvando(true); setErroGeral(null);
      try {
        await editarMaterialGenetico(material.id, {
          tipoSemen: material.tipo === "SEMEN" ? tipoSemen : undefined,
          doadora: material.tipo === "EMBRIAO" && !material.doadora ? paraRefGenitor(doadora) ?? undefined : undefined,
          observacao: observacao.trim() || null,
        });
        await onSalvo();
      } catch (erro) {
        if (erro instanceof RebanhoApiError && erro.campo) setErros({ [erro.campo]: erro.message });
        else setErroGeral(erro instanceof Error ? erro.message : String(erro));
      } finally { emCurso.current = false; setSalvando(false); }
      return;
    }

    const novosErros: Erros = {};
    const refTouro = paraRefGenitor(touro);
    if (!refTouro || genitorIncompleto(touro)) novosErros.touro = "Informe o touro";
    const refDoadora = tipo === "EMBRIAO" ? paraRefGenitor(doadora) : null;
    if (tipo === "EMBRIAO" && genitorIncompleto(doadora)) novosErros.doadora = "Escolha uma doadora ou marque Desconhecida/o";
    if (!categoriaId) novosErros.categoriaId = "Selecione a categoria";
    setErros(novosErros);
    if (Object.keys(novosErros).length) return;

    emCurso.current = true; setSalvando(true); setErroGeral(null);
    try {
      await criarMaterialGenetico({
        tipo,
        tipoSemen: tipo === "SEMEN" ? tipoSemen : undefined,
        touro: refTouro!,
        doadora: refDoadora,
        observacao: observacao.trim() || null,
        produto: { nome: nomeProduto.trim() || undefined, categoriaId },
      });
      await onSalvo();
    } catch (erro) {
      if (erro instanceof RebanhoApiError && erro.campo) setErros({ [erro.campo]: erro.message });
      else setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-material-genetico";
  return <PainelCadastro aberto titulo={material ? `Editar ${material.produto.nome}` : "Novo material genético"} onFechar={() => { if (!salvando) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : material ? "Salvar" : "Criar material"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <ErrorBox erro={erroGeral} />

      {!editando && <div className="space-y-2">
        <span className="block text-sm font-medium">Tipo</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de material genético">
          {([{ valor: "SEMEN" as const, rotulo: "Sêmen" }, { valor: "EMBRIAO" as const, rotulo: "Embrião" }]).map((opcao) => <button
            key={opcao.valor} type="button" onClick={() => setTipo(opcao.valor)}
            aria-pressed={tipo === opcao.valor}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${tipo === opcao.valor ? "border-mast bg-mast text-white" : "border-border text-ink-2 hover:bg-surface-2"}`}
          >{opcao.rotulo}</button>)}
        </div>
      </div>}

      {(tipo === "SEMEN" || material?.tipo === "SEMEN") && <CampoFormulario id="material-tipo-semen" rotulo="Tipo de sêmen" obrigatorio>
        {(p) => <select {...p} value={tipoSemen} onChange={(e) => setTipoSemen(e.target.value as TipoSemen)} className={classeInput}>
          {(Object.keys(ROTULO_SEMEN) as TipoSemen[]).map((k) => <option key={k} value={k}>{ROTULO_SEMEN[k]}</option>)}
        </select>}
      </CampoFormulario>}

      {!editando && <>
        <CampoGenitor rotulo="Touro" sexo="M" valor={touro} onChange={setTouro} obrigatorio />
        {erros.touro && <p role="alert" className="-mt-2 text-sm text-red-600">{erros.touro}</p>}

        {tipo === "EMBRIAO" && <>
          <CampoGenitor rotulo="Doadora" sexo="F" valor={doadora} onChange={setDoadora} />
          <p className="text-xs text-ink-3">Se a doadora ainda não for conhecida, marque Desconhecida/o. Ela poderá ser informada depois.</p>
          {erros.doadora && <p role="alert" className="-mt-2 text-sm text-red-600">{erros.doadora}</p>}
        </>}

        {erroCarga && <ErrorBox erro={`Não foi possível carregar as categorias: ${erroCarga}`} />}
        {categorias && categoriasGeneticas.length === 0
          ? <p className="text-sm text-amber-700">Cadastre uma categoria financeira em Financeiro › Configurações.</p>
          : <CampoFormulario id="material-categoria" rotulo="Categoria" obrigatorio ajuda="Categoria financeira usada nas compras deste material." erro={erros.categoriaId}>
              {(p) => <select {...p} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={classeInput}>
                <option value="">Selecione</option>
                {categoriasGeneticas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>}
            </CampoFormulario>}

        <CampoFormulario id="material-nome" rotulo="Nome do produto" ajuda="Opcional — se vazio, é gerado a partir do touro e da doadora, quando conhecida.">
          {(p) => <input {...p} maxLength={80} value={nomeProduto} onChange={(e) => setNomeProduto(e.target.value)} placeholder="Gerado automaticamente" className={classeInput} />}
        </CampoFormulario>
      </>}

      {editando && material.tipo === "EMBRIAO" && !material.doadora && <>
        <CampoGenitor rotulo="Doadora" sexo="F" valor={doadora} onChange={setDoadora} />
        <p className="text-xs text-ink-3">Doadora ainda não informada. Se for identificada, selecione-a para completar o cadastro.</p>
        {erros.doadora && <p role="alert" className="text-sm text-red-600">{erros.doadora}</p>}
      </>}

      <CampoFormulario id="material-observacao" rotulo="Observação">
        {(p) => <textarea {...p} maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} className={classeInput} />}
      </CampoFormulario>
    </form>
  </PainelCadastro>;
}

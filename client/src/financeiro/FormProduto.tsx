import { type FormEvent, useEffect, useRef, useState } from "react";
import { ApiError, criarProduto, editarProduto, listarCategorias, listarCentrosCusto, listarFornecedores, type Categoria, type CentroCusto, type Parceiro, type ProdutoDTO as Produto, type ProdutoInput } from "../estoque/api";
import { Button, ErrorBox } from "./financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "./PainelCadastro";
import { papeisDoParceiro } from "./lib/parceiros";
import { CentrosCustoFieldset } from "@/components/CentrosCustoFieldset";
import { UNIDADES_ORDENADAS, rotuloUnidadeCompleto, type UnidadeMedida } from "../lib/unidades";

// Chips informativos das marcações de uso da categoria escolhida — o
// comportamento (sanitário/nutricional/agrícola) é da categoria, não do produto.
function chipsUso(categoria: Categoria | undefined) {
  if (!categoria) return [];
  const chips: string[] = [];
  if (categoria.usoSanitario) chips.push("Uso sanitário");
  if (categoria.usoNutricional) chips.push("Uso nutricional");
  if (categoria.usoAgricola) chips.push("Uso agrícola");
  return chips;
}

/* `parceiros`/`categorias`/`centros` são opcionais: quando quem abre o painel já
 * tem essas listas em mãos (ex.: `ConfiguracoesFinanceiras`), passa-as direto;
 * caso contrário (cadastro rápido a partir do estoque/rebanho/plantio), o
 * formulário carrega sozinho de `estoque/api.ts` — mesmas rotas liberadas às
 * três áreas (pecuária/agricultura/financeiro). */
export function FormProduto({ produto, parceiros: parceirosProp, categorias: categoriasProp, centros: centrosProp, onSalvo, onFechar }: {
  produto: Produto | null; parceiros?: Parceiro[]; categorias?: Categoria[]; centros?: CentroCusto[];
  onSalvo: (salvo: Produto) => Promise<void> | void; onFechar: () => void;
}) {
  const precisaCarregar = parceirosProp == null || categoriasProp == null || centrosProp == null;
  const [carregando, setCarregando] = useState(precisaCarregar);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [parceirosCarregados, setParceirosCarregados] = useState<Parceiro[]>([]);
  const [categoriasCarregadas, setCategoriasCarregadas] = useState<Categoria[]>([]);
  const [centrosCarregados, setCentrosCarregados] = useState<CentroCusto[]>([]);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (precisaCarregar) {
      setCarregando(true); setErroCarga(null);
      Promise.all([listarFornecedores(), listarCategorias(true), listarCentrosCusto(true)])
        .then(([fornecedores, cats, centrosCusto]) => {
          if (!alive.current) return;
          setParceirosCarregados(fornecedores); setCategoriasCarregadas(cats); setCentrosCarregados(centrosCusto);
        })
        .catch((e) => { if (alive.current) setErroCarga(e instanceof Error ? e.message : String(e)); })
        .finally(() => { if (alive.current) setCarregando(false); });
    }
    return () => { alive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precisaCarregar]);

  const parceiros = parceirosProp ?? parceirosCarregados;
  const categorias = categoriasProp ?? categoriasCarregadas;
  const centros = centrosProp ?? centrosCarregados;

  const [nome, setNome] = useState(produto?.nome ?? "");
  const [unidade, setUnidade] = useState<UnidadeMedida>(produto?.unidade ?? "UN");
  const [minimo, setMinimo] = useState(produto?.minimoEstoque ?? "");
  const [estocavel, setEstocavel] = useState(produto?.estocavel ?? true);
  const [categoriaId, setCategoriaId] = useState(produto?.categoriaId ? String(produto.categoriaId) : "");
  const [centroCustoIds, setCentroCustoIds] = useState(() => new Set(produto?.centroCustoIds ?? []));
  const [fornecedorIds, setFornecedorIds] = useState(() => new Set(produto?.fornecedores?.map((f) => f.id) ?? []));
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const fornecedores = parceiros.filter((p) => papeisDoParceiro(p).includes("FORNECEDOR") && (p.ativo || fornecedorIds.has(p.id)));

  const alternarFornecedor = (id: number) => setFornecedorIds((atuais) => {
    const proximos = new Set(atuais); if (proximos.has(id)) proximos.delete(id); else proximos.add(id); return proximos;
  });
  const alternarCentro = (id: number) => setCentroCustoIds((atuais) => {
    const proximos = new Set(atuais); if (proximos.has(id)) proximos.delete(id); else proximos.add(id); return proximos;
  });

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    const novosErros: Record<string, string> = {};
    if (nome.trim().length < 2) novosErros.nome = "Informe um nome com pelo menos 2 caracteres";
    if (minimo && Number(minimo) < 0) novosErros.minimoEstoque = "O estoque mínimo não pode ser negativo";
    if (estocavel && !categoriaId) novosErros.categoriaId = "Produto estocável precisa de uma categoria";
    setErros(novosErros); if (Object.keys(novosErros).length || emCurso.current) return;
    const dados: ProdutoInput = {
      nome: nome.trim(), unidade,
      estocavel,
      minimoEstoque: minimo === "" ? null : Number(minimo), categoriaId: categoriaId ? Number(categoriaId) : null,
      centroCustoIds: [...centroCustoIds], fornecedorIds: [...fornecedorIds],
    };
    emCurso.current = true; setSalvando(true); setErroGeral("");
    try {
      const salvo = produto ? await editarProduto(produto.id, dados) : await criarProduto(dados);
      await onSalvo(salvo);
    } catch (erro) {
      if (erro instanceof ApiError && erro.campo) setErros({ [erro.campo]: erro.message });
      else setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-produto-financeiro";
  return <PainelCadastro aberto eyebrow="Produto de estoque" titulo={produto ? `Editar ${produto.nome}` : "Novo produto"} onFechar={() => { if (!emCurso.current) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando || carregando}>{salvando ? "Salvando…" : produto ? "Salvar produto" : "Criar produto"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <p className="text-sm text-ink-3">O preço vem das compras (custo médio no estoque) e o uso do produto vem da categoria.</p>
      <ErrorBox erro={erroGeral || null} />
      {erroCarga && <ErrorBox erro={`Não foi possível carregar fornecedores/categorias/centros de custo: ${erroCarga}`} />}
      {carregando && <p className="text-sm text-ink-3">Carregando fornecedores, categorias e centros de custo…</p>}
      <CampoFormulario id="produto-nome" rotulo="Nome do produto" obrigatorio erro={erros.nome}>{(p) => <input {...p} maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ração 22%" className={classeInput} />}</CampoFormulario>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="produto-unidade" rotulo="Unidade" obrigatorio erro={erros.unidade}>{(p) => <select {...p} value={unidade} onChange={(e) => setUnidade(e.target.value as UnidadeMedida)} className={classeInput}>{UNIDADES_ORDENADAS.map((u) => <option key={u} value={u}>{rotuloUnidadeCompleto(u)}</option>)}</select>}</CampoFormulario>
        <CampoFormulario id="produto-minimo" rotulo="Estoque mínimo" erro={erros.minimoEstoque}>{(p) => <input {...p} type="number" min="0" step="0.01" value={minimo} onChange={(e) => setMinimo(e.target.value)} className={classeInput} />}</CampoFormulario>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={estocavel} onChange={(e) => setEstocavel(e.target.checked)} /> Controla estoque</label>
      <CampoFormulario id="produto-categoria" rotulo="Categoria padrão" erro={erros.categoriaId}>{(p) => <select {...p} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={classeInput}><option value="">Sem categoria</option>{categorias.filter((c) => c.ativo || c.id === produto?.categoriaId).map((c) => <option key={c.id} value={c.id}>{c.nome}{c.ativo ? "" : " (inativa)"}</option>)}</select>}</CampoFormulario>
      {(() => {
        const categoriaSelecionada = categorias.find((c) => String(c.id) === categoriaId);
        const chips = chipsUso(categoriaSelecionada);
        if (!categoriaId) return null;
        return (
          <div className="-mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
            {chips.length > 0
              ? chips.map((chip) => <span key={chip} className="rounded-full border border-border px-2 py-0.5">{chip}</span>)
              : <span>Sem uso específico</span>}
          </div>
        );
      })()}
      <CentrosCustoFieldset
        idBase="produto-centros"
        centros={centros}
        selecionados={centroCustoIds}
        onToggle={alternarCentro}
        ajuda="Onde este produto costuma ser usado. Com um só centro, as operações e as baixas de estoque o preenchem sozinhas."
      />
      <fieldset className="rounded-lg border border-border p-3" aria-describedby={erros.fornecedorIds ? "produto-fornecedores-erro" : "produto-fornecedores-ajuda"}>
        <legend className="px-1 text-sm font-medium">Fornecedores do produto</legend>
        <p id="produto-fornecedores-ajuda" className="mb-3 text-xs text-ink-3">Opcional. A compra continua podendo usar outro fornecedor.</p>
        <div className="grid max-h-48 gap-2 overflow-y-auto">
          {fornecedores.length === 0 ? <p className="text-sm text-ink-3">Nenhum parceiro com papel de fornecedor.</p> : fornecedores.map((fornecedor) => <label key={fornecedor.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fornecedorIds.has(fornecedor.id)} disabled={!fornecedor.ativo} onChange={() => alternarFornecedor(fornecedor.id)} /> <span>{fornecedor.nome}{fornecedor.ativo ? "" : " (inativo)"}</span></label>)}
        </div>
        {erros.fornecedorIds && <p id="produto-fornecedores-erro" role="alert" className="mt-2 text-xs text-red-700">{erros.fornecedorIds}</p>}
      </fieldset>
    </form>
  </PainelCadastro>;
}

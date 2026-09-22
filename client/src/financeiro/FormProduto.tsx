import { type FormEvent, useRef, useState } from "react";
import { ApiError, atualizarProduto, criarProduto, type Categoria, type CentroCusto, type Parceiro, type Produto, type ProdutoInput, type TipoInsumoPlantio, type TipoProduto } from "./novo-api";
import { Button, ErrorBox } from "./financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "./PainelCadastro";
import { papeisDoParceiro } from "./lib/parceiros";

const TIPOS: [TipoProduto, string][] = [
  ["INSUMO", "Insumo"], ["MEDICAMENTO", "Medicamento"], ["RACAO", "Ração"],
  ["MINERAL", "Mineral"], ["OUTRO", "Outro"],
];

const SUBTIPOS_PLANTIO: [TipoInsumoPlantio, string][] = [
  ["FERTILIZANTE", "Fertilizante"], ["DEFENSIVO", "Defensivo"], ["HERBICIDA", "Herbicida"],
  ["CORRETIVO", "Corretivo"], ["BIOLOGICO", "Biológico"], ["FOLIAR", "Foliar"],
  ["MUDA", "Muda"], ["OUTRO", "Outro"],
];

export function FormProduto({ produto, parceiros, categorias, centros, onSalvo, onFechar }: {
  produto: Produto | null; parceiros: Parceiro[]; categorias: Categoria[]; centros: CentroCusto[];
  onSalvo: () => Promise<void> | void; onFechar: () => void;
}) {
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [tipo, setTipo] = useState<TipoProduto>(produto?.tipo ?? "INSUMO");
  const [subtipoPlantio, setSubtipoPlantio] = useState<TipoInsumoPlantio | "">(produto?.subtipoPlantio ?? "");
  const [unidade, setUnidade] = useState(produto?.unidade ?? "un");
  const [custo, setCusto] = useState(produto?.custoUnitario ?? "");
  const [minimo, setMinimo] = useState(produto?.minimoEstoque ?? "");
  const [carencia, setCarencia] = useState(produto?.carencia != null ? String(produto.carencia) : "");
  const [percentualMS, setPercentualMS] = useState(produto?.percentualMS ?? "");
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
    if (!unidade.trim()) novosErros.unidade = "Informe a unidade";
    if (custo && Number(custo) < 0) novosErros.custoUnitario = "O custo não pode ser negativo";
    if (minimo && Number(minimo) < 0) novosErros.minimoEstoque = "O estoque mínimo não pode ser negativo";
    if (carencia && Number(carencia) < 0) novosErros.carencia = "A carência não pode ser negativa";
    if (percentualMS && Number(percentualMS) < 0) novosErros.percentualMS = "O percentual não pode ser negativo";
    if (estocavel && !categoriaId) novosErros.categoriaId = "Produto estocável precisa de uma categoria";
    setErros(novosErros); if (Object.keys(novosErros).length || emCurso.current) return;
    const dados: ProdutoInput = {
      nome: nome.trim(), tipo, subtipoPlantio: subtipoPlantio || null, unidade: unidade.trim(),
      custoUnitario: custo === "" ? null : Number(custo), estocavel,
      minimoEstoque: minimo === "" ? null : Number(minimo), categoriaId: categoriaId ? Number(categoriaId) : null,
      carencia: carencia === "" ? null : Number(carencia), percentualMS: percentualMS === "" ? null : Number(percentualMS),
      centroCustoIds: [...centroCustoIds], fornecedorIds: [...fornecedorIds],
    };
    emCurso.current = true; setSalvando(true); setErroGeral("");
    try {
      if (produto) await atualizarProduto(produto.id, dados); else await criarProduto(dados);
      await onSalvo();
    } catch (erro) {
      if (erro instanceof ApiError && erro.campo) setErros({ [erro.campo]: erro.message });
      else setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-produto-financeiro";
  return <PainelCadastro aberto eyebrow="Produto de estoque" titulo={produto ? `Editar ${produto.nome}` : "Novo produto"} onFechar={onFechar}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : produto ? "Salvar produto" : "Criar produto"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <ErrorBox erro={erroGeral || null} />
      <CampoFormulario id="produto-nome" rotulo="Nome do produto" obrigatorio erro={erros.nome}>{(p) => <input {...p} maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ração 22%" className={classeInput} />}</CampoFormulario>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="produto-tipo" rotulo="Tipo">{(p) => <select {...p} value={tipo} onChange={(e) => setTipo(e.target.value as TipoProduto)} className={classeInput}>{TIPOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>}</CampoFormulario>
        <CampoFormulario id="produto-unidade" rotulo="Unidade" obrigatorio erro={erros.unidade}>{(p) => <input {...p} maxLength={12} value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, kg, L…" className={classeInput} />}</CampoFormulario>
      </div>
      <CampoFormulario id="produto-subtipo-plantio" rotulo="Tipo agrícola" ajuda="Opcional. Usado só no módulo de plantio.">{(p) => <select {...p} value={subtipoPlantio} onChange={(e) => setSubtipoPlantio(e.target.value as TipoInsumoPlantio | "")} className={classeInput}><option value="">Não se aplica</option>{SUBTIPOS_PLANTIO.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>}</CampoFormulario>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="produto-custo" rotulo="Custo de referência" erro={erros.custoUnitario} ajuda="Usado para sugerir novas operações; não altera o histórico.">{(p) => <input {...p} type="number" min="0" step="0.01" value={custo} onChange={(e) => setCusto(e.target.value)} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="produto-minimo" rotulo="Estoque mínimo" erro={erros.minimoEstoque}>{(p) => <input {...p} type="number" min="0" step="0.01" value={minimo} onChange={(e) => setMinimo(e.target.value)} className={classeInput} />}</CampoFormulario>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="produto-carencia" rotulo="Carência (dias)" erro={erros.carencia}>{(p) => <input {...p} type="number" min="0" step="1" value={carencia} onChange={(e) => setCarencia(e.target.value)} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="produto-percentual-ms" rotulo="% de matéria seca" erro={erros.percentualMS}>{(p) => <input {...p} type="number" min="0" step="0.01" value={percentualMS} onChange={(e) => setPercentualMS(e.target.value)} className={classeInput} />}</CampoFormulario>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={estocavel} onChange={(e) => setEstocavel(e.target.checked)} /> Controla estoque</label>
      <CampoFormulario id="produto-categoria" rotulo="Categoria padrão" erro={erros.categoriaId}>{(p) => <select {...p} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={classeInput}><option value="">Sem categoria</option>{categorias.filter((c) => c.ativo || c.id === produto?.categoriaId).map((c) => <option key={c.id} value={c.id}>{c.nome}{c.ativo ? "" : " (inativa)"}</option>)}</select>}</CampoFormulario>
      <fieldset className="rounded-lg border border-border p-3" aria-describedby="produto-centros-ajuda">
        <legend className="px-1 text-sm font-medium">Centros de custo</legend>
        <p id="produto-centros-ajuda" className="mb-3 text-xs text-ink-3">Onde este produto costuma ser usado. Com um só centro, as operações e as baixas de estoque o preenchem sozinhas.</p>
        <div className="grid max-h-48 gap-2 overflow-y-auto">
          {centros.length === 0 ? <p className="text-sm text-ink-3">Nenhum centro de custo cadastrado.</p> : centros.filter((c) => c.ativo || centroCustoIds.has(c.id)).map((centro) => <label key={centro.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={centroCustoIds.has(centro.id)} disabled={!centro.ativo} onChange={() => alternarCentro(centro.id)} /> <span>{centro.nome}{centro.ativo ? "" : " (inativo)"}</span></label>)}
        </div>
      </fieldset>
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

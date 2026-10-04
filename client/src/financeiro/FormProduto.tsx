import { type FormEvent, useEffect, useRef, useState } from "react";
import { ApiError, criarProduto, editarProduto, listarCategorias, listarCentrosCusto, listarFornecedores, type Categoria, type CentroCusto, type Parceiro, type ProdutoDTO as Produto, type ProdutoInput } from "../estoque/api";
import { Button, ErrorBox } from "./financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "./PainelCadastro";
import { papeisDoParceiro } from "./lib/parceiros";
import { MultiSelect, type MultiSelectOption } from "@/components/MultiSelect";
import { UNIDADES_ORDENADAS, rotuloUnidadeCompleto, type UnidadeMedida } from "../lib/unidades";
import { PartidasProduto } from "../estoque/PartidasProduto";

const TIPOS = [{ campo: "usoAgricola", nome: "Agrícola" }, { campo: "usoGenetico", nome: "Genético" }, { campo: "usoSanitario", nome: "Sanitário" }, { campo: "usoNutricional", nome: "Nutricional" }] as const;

/* `parceiros`/`categorias`/`centros` são opcionais: quando quem abre o painel já
 * tem essas listas em mãos (ex.: `ConfiguracoesFinanceiras`), passa-as direto;
 * caso contrário (cadastro rápido a partir do estoque/plantio), o formulário
 * carrega sozinho de `estoque/api.ts` — mesmas rotas liberadas às três áreas
 * (pecuária/agricultura/financeiro). */
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
  const [categoriaId, setCategoriaId] = useState(produto?.categoriaId ? produto.categoriaId : "");
  const [leite, setLeite] = useState(produto?.perfilSanitario?.carenciaLeiteHoras?.toString() ?? "");
  const [carne, setCarne] = useState(produto?.perfilSanitario?.carenciaCarneHoras?.toString() ?? "");
  const [via, setVia] = useState(produto?.perfilSanitario?.viaPadrao ?? "");
  const [referencia, setReferencia] = useState(produto?.perfilSanitario?.referenciaTecnica ?? "");
  const [materiaSeca, setMateriaSeca] = useState(produto?.perfilNutricional?.materiaSecaPercentual ?? "");
  const [usos, setUsos] = useState({ usoAgricola: produto?.usoAgricola ?? false, usoGenetico: produto?.usoGenetico ?? false, usoSanitario: produto?.usoSanitario ?? false, usoNutricional: produto?.usoNutricional ?? false });
  const [rastrearPartidas, setRastrearPartidas] = useState(produto?.rastrearPartidas ?? false);
  const [centroCustoIds, setCentroCustoIds] = useState<string[]>(() => produto?.centroCustoIds ?? []);
  const [fornecedorIds, setFornecedorIds] = useState<string[]>(() => produto?.fornecedores?.map((f) => f.id) ?? []);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  // Só ativos entram como opção nova; os já vinculados continuam visíveis (desabilitados
  // e rotulados) para o usuário enxergar e poder remover o vínculo.
  const opcoesFornecedores: MultiSelectOption<string>[] = parceiros
    .filter((p) => papeisDoParceiro(p).includes("FORNECEDOR") && (p.ativo || fornecedorIds.includes(p.id)))
    .map((p) => ({ value: p.id, label: p.ativo ? p.nome : `${p.nome} (inativo)`, disabled: !p.ativo }));
  const opcoesCentros: MultiSelectOption<string>[] = centros
    .filter((c) => c.ativo !== false || centroCustoIds.includes(c.id))
    .map((c) => ({ value: c.id, label: c.ativo === false ? `${c.nome} (inativo)` : c.nome, disabled: c.ativo === false }));

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    const novosErros: Record<string, string> = {};
    if (nome.trim().length < 2) novosErros.nome = "Informe um nome com pelo menos 2 caracteres";
    if (minimo && Number(minimo) < 0) novosErros.minimoEstoque = "O estoque mínimo não pode ser negativo";
    if (!categoriaId) novosErros.categoriaId = "Produto precisa de uma categoria";
    const ms = materiaSeca.trim().replace(",", ".");
    if (usos.usoNutricional && ms && (!/^\d+(\.\d{1,2})?$/.test(ms) || Number(ms) < 0 || Number(ms) > 100)) novosErros.materiaSecaPercentual = "Informe a matéria seca entre 0% e 100%.";
    if (usos.usoSanitario) for (const [campo, valor] of [["carenciaLeiteHoras", leite], ["carenciaCarneHoras", carne]]) {
      if (valor !== "" && (!Number.isInteger(Number(valor)) || Number(valor) < 0)) novosErros[campo] = "Informe um número inteiro de horas, igual ou maior que zero.";
    }
    setErros(novosErros); if (Object.keys(novosErros).length || emCurso.current) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#form-produto-financeiro [aria-invalid="true"]')?.focus()); return;
    }
    const dados: ProdutoInput = {
      nome: nome.trim(), unidade,
      minimoEstoque: minimo === "" ? null : Number(minimo), categoriaId,
      centroCustoIds, fornecedorIds,
      ...usos, ...(!produto ? { rastrearPartidas } : {}),
      ...(usos.usoSanitario ? { perfilSanitario: { carenciaLeiteHoras: leite === "" ? null : Number(leite), carenciaCarneHoras: carne === "" ? null : Number(carne), viaPadrao: via || null, referenciaTecnica: referencia || null } } : {}),
      ...(usos.usoNutricional ? { perfilNutricional: { materiaSecaPercentual: ms === "" ? null : Number(ms) } } : {}),
    };
    emCurso.current = true; setSalvando(true); setErroGeral("");
    try {
      const salvo = produto ? await editarProduto(produto.id, dados) : await criarProduto(dados);
      await onSalvo(salvo);
    } catch (erro) {
      if (erro instanceof ApiError && erro.campo) { setErros({ [erro.campo.split(".").at(-1)!]: erro.message }); requestAnimationFrame(() => document.querySelector<HTMLElement>('#form-produto-financeiro [aria-invalid="true"]')?.focus()); }
      else setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-produto-financeiro";
  return <PainelCadastro aberto titulo={produto ? `Editar ${produto.nome}` : "Novo produto"} onFechar={() => { if (!emCurso.current) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando || carregando}>{salvando ? "Salvando…" : produto ? "Salvar produto" : "Criar produto"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <p className="text-sm text-ink-3">A categoria organiza o financeiro. Escolha os tipos de uso e as propriedades do produto. Compras e outras operações dão entrada no estoque.</p>
      <ErrorBox erro={erroGeral || null} />
      {erroCarga && <ErrorBox erro={`Não foi possível carregar fornecedores/categorias/centros de custo: ${erroCarga}`} />}
      {carregando && <p className="text-sm text-ink-3">Carregando fornecedores, categorias e centros de custo…</p>}
      <CampoFormulario id="produto-nome" rotulo="Nome do produto" obrigatorio erro={erros.nome}>{(p) => <input {...p} maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ração 22%" className={classeInput} />}</CampoFormulario>
      <CampoFormulario id="produto-categoria" rotulo="Categoria" obrigatorio ajuda="Organiza relatórios e classificação financeira." erro={erros.categoriaId}>{(p) => <select {...p} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={classeInput}><option value="">Selecione</option>{categorias.filter((c) => c.ativo || c.id === produto?.categoriaId).map((c) => <option key={c.id} value={c.id}>{c.nome}{c.ativo ? "" : " (inativa)"}</option>)}</select>}</CampoFormulario>
      <fieldset className="grid gap-2 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-semibold">Tipos de uso</legend><p className="text-xs text-ink-3">Escolha um ou mais. Sem seleção, o produto tem uso geral.</p>{TIPOS.map((t) => <div key={t.campo}><label className="flex items-center gap-2 text-sm"><input id={t.campo} aria-invalid={!!erros[t.campo]} aria-describedby={erros[t.campo] ? `${t.campo}-erro` : undefined} type="checkbox" checked={usos[t.campo]} onChange={(e) => setUsos({ ...usos, [t.campo]: e.target.checked })} />{t.nome}</label>{erros[t.campo] && <p id={`${t.campo}-erro`} role="alert" className="text-xs text-red-700">{erros[t.campo]}</p>}</div>)}</fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="produto-unidade" rotulo="Unidade" obrigatorio ajuda="Unidade em que o produto é comprado e baixado. Não pode mudar depois que houver movimento." erro={erros.unidade}>{(p) => <select {...p} value={unidade} onChange={(e) => setUnidade(e.target.value as UnidadeMedida)} className={classeInput}>{UNIDADES_ORDENADAS.map((u) => <option key={u} value={u}>{rotuloUnidadeCompleto(u)}</option>)}</select>}</CampoFormulario>
        <CampoFormulario id="produto-minimo" rotulo="Estoque mínimo" ajuda="Abaixo dessa quantidade o produto aparece com alerta na tela de Estoque." erro={erros.minimoEstoque}>{(p) => <input {...p} type="number" min="0" step="0.01" value={minimo} onChange={(e) => setMinimo(e.target.value)} className={classeInput} />}</CampoFormulario>
      </div>
      {usos.usoSanitario && <fieldset className="grid gap-3 rounded-lg border border-border p-3"><legend>Perfil sanitário — sugestões para revisão</legend><CampoFormulario id="produto-leite" rotulo="Carência sugerida de leite (horas)" erro={erros.carenciaLeiteHoras}>{(p) => <input {...p} type="number" min="0" step="1" value={leite} onChange={(e) => setLeite(e.target.value)} className={classeInput} />}</CampoFormulario><CampoFormulario id="produto-carne" rotulo="Carência sugerida de carne (horas)" erro={erros.carenciaCarneHoras}>{(p) => <input {...p} type="number" min="0" step="1" value={carne} onChange={(e) => setCarne(e.target.value)} className={classeInput} />}</CampoFormulario><CampoFormulario id="produto-via" rotulo="Via de aplicação sugerida" erro={erros.viaPadrao}>{(p) => <input {...p} maxLength={80} value={via} onChange={(e) => setVia(e.target.value)} className={classeInput} />}</CampoFormulario><CampoFormulario id="produto-referencia" rotulo="Referência técnica" erro={erros.referenciaTecnica}>{(p) => <input {...p} maxLength={300} value={referencia} onChange={(e) => setReferencia(e.target.value)} className={classeInput} />}</CampoFormulario></fieldset>}
      {usos.usoNutricional && <CampoFormulario id="produto-ms" rotulo="Matéria seca (%)" erro={erros.materiaSecaPercentual} ajuda="Opcional. Ausência significa cobertura incompleta, não zero.">{(p) => <input {...p} type="text" inputMode="decimal" value={materiaSeca} onChange={(e) => setMateriaSeca(e.target.value)} className={classeInput} />}</CampoFormulario>}
      {produto ? <PartidasProduto configuracao produtoId={produto.id} rastreado={rastrearPartidas} onMudou={() => setRastrearPartidas(true)} /> : <fieldset className="grid gap-2 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-semibold">Lotes e validade</legend><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rastrearPartidas} onChange={(e) => setRastrearPartidas(e.target.checked)} />Controlar lotes por validade</label><p className="text-xs text-ink-3">Opcional. Entradas e saídas passam a identificar o lote do produto. Depois de ativado, o controle não pode ser desligado.</p></fieldset>}
      <MultiSelect
        label="Centros de custo"
        placeholder="Nenhum centro de custo"
        searchPlaceholder="Buscar centro de custo…"
        emptyText="Nenhum centro de custo cadastrado."
        ajuda="Onde este produto costuma ser usado. Com um só centro, as operações e as baixas de estoque o preenchem sozinhas."
        error={erros.centroCustoIds}
        contentClassName="z-[1200]"
        options={opcoesCentros}
        value={centroCustoIds}
        onValueChange={setCentroCustoIds}
      />
      <MultiSelect
        label="Fornecedores do produto"
        placeholder="Nenhum fornecedor"
        searchPlaceholder="Buscar fornecedor…"
        emptyText="Nenhum parceiro com papel de fornecedor."
        ajuda="Opcional. A compra continua podendo usar outro fornecedor."
        error={erros.fornecedorIds}
        contentClassName="z-[1200]"
        options={opcoesFornecedores}
        value={fornecedorIds}
        onValueChange={setFornecedorIds}
      />
    </form>
  </PainelCadastro>;
}

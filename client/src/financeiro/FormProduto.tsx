import { AjudaCampo } from "@/components/Dica";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectCampo } from "./SelectCampo";
import { Input } from "@/components/ui/input";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ApiError, criarProduto, editarProduto, listarCategorias, listarCentrosCusto, listarFornecedores, listarTiposAplicacaoSanitarios, type Categoria, type CentroCusto, type Parceiro, type ProdutoDTO as Produto, type ProdutoInput } from "../estoque/api";
import { Button, ErrorBox } from "./financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "./PainelCadastro";
import { papeisDoParceiro } from "./lib/parceiros";
import { MultiSelect, type MultiSelectOption } from "@/components/MultiSelect";
import { UNIDADES_ORDENADAS, rotuloUnidadeCompleto, type UnidadeMedida } from "../lib/unidades";
import { PartidasProduto } from "../estoque/PartidasProduto";
import { SeletorCatalogoProtocolo } from "../pecuaria/rebanho/protocolos/SeletorCatalogoProtocolo";
import { SeletorCatalogoProduto } from '../estoque/CatalogosProdutos';
import { EditorComposicao, EditorNutricional, HistoricoProduto, prepararComposicao, prepararNutricional, validarComposicao, validarNutricional } from '../estoque/ComposicaoProduto';
import type { ComposicaoInput, NutricionalInput } from '../estoque/catalogos-api';
import { obterProdutoEstoque } from '../estoque/api';
import { LinkInterno } from '../components/LinkInterno';
import { Package } from "lucide-react";

const TIPOS = [{ campo: "usoGenetico", nome: "Genético" }, { campo: "usoSanitario", nome: "Sanitário" }, { campo: "usoNutricional", nome: "Nutricional" }] as const;

type EscolhaCarencia = "" | "SEM" | "COM" | "DESCONHECIDA";
function escolhaInicialCarencia(horas: number | null | undefined, legado: boolean): EscolhaCarencia {
  return horas == null ? (legado ? "DESCONHECIDA" : "") : horas === 0 ? "SEM" : "COM";
}

function CampoCarenciaProduto({ destino, escolha, prazo, permiteDesconhecida, erro, onEscolha, onPrazo }: {
  destino: "leite" | "carne"; escolha: EscolhaCarencia; prazo: string; permiteDesconhecida: boolean; erro?: string;
  onEscolha: (escolha: EscolhaCarencia) => void; onPrazo: (prazo: string) => void;
}) {
  const id = `produto-carencia-${destino}`;
  return <fieldset className="grid min-w-0 gap-2 border-0 p-0">
    <legend className="mb-2 text-sm font-semibold">{destino === "leite" ? "Leite" : "Carne"}{!permiteDesconhecida && <span aria-hidden="true"> *</span>}</legend>
    <div className="grid gap-1">
      {([
        ["SEM", "Sem carência (0 horas)", `Sem carência de ${destino} (0 horas)`],
        ["COM", "Com carência", `Com carência de ${destino}`],
        ...(permiteDesconhecida ? [["DESCONHECIDA", "Não informado (legado)", `Não informado para ${destino} (legado)`]] : []),
      ] as [EscolhaCarencia, string, string][]).map(([valor, texto, acessivel]) => <label key={valor} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
        <input type="radio" name={id} value={valor} checked={escolha === valor} onChange={() => onEscolha(valor)} aria-label={acessivel}
          required={!permiteDesconhecida} aria-invalid={!!erro && escolha !== "COM"} aria-describedby={erro ? `${id}-erro` : undefined}
          className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />{texto}
      </label>)}
    </div>
    {escolha === "COM" ? <CampoFormulario id={id} rotulo={`Prazo de ${destino} (horas)`} obrigatorio erro={erro}>{(p) => <Input {...p} type="number" min="1" step="1" value={prazo} onChange={(e) => onPrazo(e.target.value)} className={classeInput} />}</CampoFormulario>
      : erro && <p id={`${id}-erro`} role="alert" className="text-xs text-destructive">{erro}</p>}
  </fieldset>;
}

/* `parceiros`/`categorias`/`centros` são opcionais: quando quem abre o painel já
 * tem essas listas em mãos (ex.: `ConfiguracoesFinanceiras`), passa-as direto;
 * caso contrário (cadastro rápido a partir do estoque), o formulário
 * carrega sozinho de `estoque/api.ts` — mesmas rotas liberadas às três áreas
 * (pecuária/financeiro). */
export function FormProduto({ produto, parceiros: parceirosProp, categorias: categoriasProp, centros: centrosProp, onSalvo, onFechar, somenteLeitura = false }: {
  produto: Produto | null; parceiros?: Parceiro[]; categorias?: Categoria[]; centros?: CentroCusto[];
  onSalvo: (salvo: Produto) => Promise<void> | void; onFechar: () => void; somenteLeitura?: boolean;
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

  const [codigoReferencia, setCodigoReferencia] = useState(produto?.codigoReferencia ?? '');
  const [apresentacao, setApresentacao] = useState(produto?.apresentacao ?? '');
  const [observacao, setObservacao] = useState(produto?.observacao ?? '');
  const [conservacao, setConservacao] = useState(produto?.conservacao ?? '');
  const [fabricanteId, setFabricanteId] = useState(produto?.fabricanteId ?? produto?.fabricante?.id ?? '');
  const [classificacaoTecnicaId, setClassificacaoTecnicaId] = useState(produto?.classificacaoTecnicaId ?? produto?.classificacaoTecnica?.id ?? '');
  const [revisaoEsperada, setRevisaoEsperada] = useState(produto?.revisaoCadastro ?? 1);
  const [composicao, setComposicao] = useState<ComposicaoInput>({ versaoEsperada: produto?.composicao?.id ?? null, situacao: produto?.composicao?.situacao ?? 'NAO_INFORMADA', referencia: produto?.composicao?.referencia ?? null, itens: produto?.composicao?.itens ?? [] });
  const [nutricional, setNutricional] = useState<NutricionalInput>({ versaoEsperada: produto?.informacoesNutricionais?.id ?? null, situacao: produto?.informacoesNutricionais?.situacao ?? 'NAO_INFORMADA', referencia: produto?.informacoesNutricionais?.referencia ?? null, itens: produto?.informacoesNutricionais?.itens ?? [] });
  const [composicaoAlterada, setComposicaoAlterada] = useState(false), [nutricionalAlterado, setNutricionalAlterado] = useState(false);
  const [catalogoAlterado, setCatalogoAlterado] = useState(false);
  const [conflito, setConflito] = useState(false), [versaoAtual, setVersaoAtual] = useState<Produto | null>(null);
  const [carregandoAtual, setCarregandoAtual] = useState(false);
  const envio = useRef<{ hash: string; chave: string }>();
  async function carregarAtual() {
    if (!produto) return; setCarregandoAtual(true); setErroGeral('');
    try { setVersaoAtual(await obterProdutoEstoque(produto.id)); } catch (e) { setErroGeral(e instanceof Error ? e.message : String(e)); } finally { setCarregandoAtual(false); }
  }
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [unidade, setUnidade] = useState<UnidadeMedida>(produto?.unidade ?? "UN");
  const [minimo, setMinimo] = useState(produto?.minimoEstoque ?? "");
  const [categoriaId, setCategoriaId] = useState(produto?.categoriaId ? produto.categoriaId : "");
  const [leite, setLeite] = useState(produto?.perfilSanitario?.carenciaLeiteHoras?.toString() ?? "");
  const [carne, setCarne] = useState(produto?.perfilSanitario?.carenciaCarneHoras?.toString() ?? "");
  const legadoLeiteDesconhecido = !!produto?.usoSanitario && produto.perfilSanitario?.carenciaLeiteHoras == null;
  const legadoCarneDesconhecido = !!produto?.usoSanitario && produto.perfilSanitario?.carenciaCarneHoras == null;
  const [escolhaLeite, setEscolhaLeite] = useState<EscolhaCarencia>(() => escolhaInicialCarencia(produto?.perfilSanitario?.carenciaLeiteHoras, legadoLeiteDesconhecido));
  const [escolhaCarne, setEscolhaCarne] = useState<EscolhaCarencia>(() => escolhaInicialCarencia(produto?.perfilSanitario?.carenciaCarneHoras, legadoCarneDesconhecido));
  const [via, setVia] = useState(produto?.perfilSanitario?.viaPadrao ?? "");
  const [orientacaoUso, setOrientacaoUso] = useState(produto?.perfilSanitario?.orientacaoUso ?? "");
  const [tipoAplicacaoId, setTipoAplicacaoId] = useState(produto?.perfilSanitario?.tipoAplicacaoId ?? "");
  const [materiaSeca, setMateriaSeca] = useState(produto?.perfilNutricional?.materiaSecaPercentual ?? "");
  const [usos, setUsos] = useState({ usoGenetico: produto?.usoGenetico ?? false, usoSanitario: produto?.usoSanitario ?? false, usoNutricional: produto?.usoNutricional ?? false });
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
    if (somenteLeitura) return;
    const novosErros: Record<string, string> = {};
    if (nome.trim().length < 2) novosErros.nome = "Informe um nome com pelo menos 2 caracteres";
    if (minimo && Number(minimo) < 0) novosErros.minimoEstoque = "O estoque mínimo não pode ser negativo";
    if (!categoriaId) novosErros.categoriaId = "Produto precisa de uma categoria";
    const ms = materiaSeca.trim().replace(",", ".");
    if (usos.usoNutricional && ms && (!/^\d+(\.\d{1,2})?$/.test(ms) || Number(ms) < 0 || Number(ms) > 100)) novosErros.materiaSecaPercentual = "Informe a matéria seca entre 0% e 100%.";
    if (usos.usoSanitario) for (const [campo, destino, escolha, valor, permiteDesconhecida] of [
      ["carenciaLeiteHoras", "leite", escolhaLeite, leite, legadoLeiteDesconhecido],
      ["carenciaCarneHoras", "carne", escolhaCarne, carne, legadoCarneDesconhecido],
    ] as const) {
      if (!escolha || (escolha === "DESCONHECIDA" && !permiteDesconhecida)) novosErros[campo] = `Escolha a carência de ${destino}.`;
      else if (escolha === "COM" && (!valor.trim() || !Number.isInteger(Number(valor)) || Number(valor) <= 0)) novosErros[campo] = `Informe um prazo de ${destino} em horas inteiras, maior que zero.`;
    }
    if (usos.usoSanitario && orientacaoUso.trim().length > 2000) novosErros.orientacaoUso = "Informe uma orientação com até 2.000 caracteres.";
    if (composicaoAlterada) { const erro = validarComposicao(composicao, composicao.versaoEsperada); if (erro) novosErros.composicao = erro; }
    if (nutricionalAlterado && usos.usoNutricional) { const erro = validarNutricional(nutricional, nutricional.versaoEsperada); if (erro) novosErros.informacoesNutricionais = erro; }
    if (conflito) { setErroGeral('Consulte a versão atual e revise antes de reaplicar a edição.'); return; }
    setErros(novosErros); if (Object.keys(novosErros).length || emCurso.current) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#form-produto-financeiro [aria-invalid="true"]')?.focus()); return;
    }
    const dados: ProdutoInput = {
      nome: nome.trim(), unidade,
      ...(produto ? { revisaoEsperada } : {}),
      codigoReferencia: codigoReferencia.trim() || null, apresentacao: apresentacao.trim() || null,
      observacao: observacao.trim() || null, conservacao: conservacao.trim() || null,
      fabricanteId: fabricanteId || null, classificacaoTecnicaId: classificacaoTecnicaId || null,
      ...(composicaoAlterada ? { composicao: prepararComposicao(composicao) } : {}),
      ...(nutricionalAlterado && usos.usoNutricional ? { informacoesNutricionais: prepararNutricional(nutricional) } : {}),
      minimoEstoque: minimo === "" ? null : Number(minimo), categoriaId,
      centroCustoIds, fornecedorIds,
      ...usos, ...(!produto ? { rastrearPartidas } : {}),
      ...(usos.usoSanitario ? { perfilSanitario: { carenciaLeiteHoras: escolhaLeite === "SEM" ? 0 : escolhaLeite === "COM" ? Number(leite) : null, carenciaCarneHoras: escolhaCarne === "SEM" ? 0 : escolhaCarne === "COM" ? Number(carne) : null, viaPadrao: via || null, orientacaoUso: orientacaoUso.trim() || null, tipoAplicacaoId: tipoAplicacaoId || null } } : {}),
      ...(usos.usoNutricional ? { perfilNutricional: { materiaSecaPercentual: ms === "" ? null : Number(ms) } } : {}),
    };
    const hash = JSON.stringify(dados); if (envio.current?.hash !== hash) envio.current = { hash, chave: crypto.randomUUID() };
    dados.chaveReenvio = envio.current.chave;
    emCurso.current = true; setSalvando(true); setErroGeral("");
    try {
      const salvo = produto ? await editarProduto(produto.id, dados) : await criarProduto(dados);
      await onSalvo(salvo);
    } catch (erro) {
      if (erro instanceof ApiError && erro.status === 409 && (!erro.campo || erro.campo.endsWith("versaoEsperada") || erro.campo === "revisaoEsperada")) { setConflito(true); setVersaoAtual(null); setErroGeral(`${erro.message} Seu rascunho foi preservado.`); }
      else if (erro instanceof ApiError && erro.campo) { setErros({ [erro.campo.split(".").at(-1)!]: erro.message }); requestAnimationFrame(() => document.querySelector<HTMLElement>('#form-produto-financeiro [aria-invalid="true"]')?.focus()); }
      else setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-produto-financeiro";
  return <PainelCadastro icon={Package} alteracoesExternas={composicaoAlterada || nutricionalAlterado || catalogoAlterado || JSON.stringify(centroCustoIds) !== JSON.stringify(produto?.centroCustoIds ?? []) || JSON.stringify(fornecedorIds) !== JSON.stringify(produto?.fornecedores?.map(f => f.id) ?? [])} bloqueado={salvando} aberto titulo={produto ? `${somenteLeitura ? "Consultar" : "Editar"} ${produto.nome}` : "Novo produto"} onFechar={() => { if (!emCurso.current) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>{somenteLeitura ? "Fechar" : "Cancelar"}</Button>{!somenteLeitura && <Button type="submit" form={formId} disabled={salvando || carregando} carregando={salvando}>{salvando ? "Salvando…" : produto ? "Salvar produto" : "Criar produto"}</Button>}</>}>
    <form id={formId} onSubmit={submeter} className="grid gap-5" noValidate>
      <fieldset disabled={somenteLeitura} className="cadastro-grid grid min-w-0 gap-3 sm:grid-cols-2">

      <div className="grid gap-2 sm:col-span-2"><ErrorBox erro={erroGeral || null} />
      <div id="produto-detalhes-erros" tabIndex={-1} aria-invalid={!!(erros.composicao || erros.informacoesNutricionais)}><ErrorBox erro={erros.composicao || erros.informacoesNutricionais || null} /></div>
      {conflito && <div className="grid gap-3 rounded-lg border border-border p-3"><p className="text-sm">O cadastro mudou desde sua leitura. Compare os dados atuais com seu rascunho antes de reaplicar.</p><Button secondary type="button" disabled={carregandoAtual} onClick={() => void carregarAtual()}>Carregar versão atual para revisão</Button>{versaoAtual && <><div className="text-sm"><strong>{versaoAtual.nome} · revisão {versaoAtual.revisaoCadastro}</strong><p>Código: {versaoAtual.codigoReferencia ?? 'Não informado'} · Apresentação: {versaoAtual.apresentacao ?? 'Não informada'}</p><p>Fabricante: {versaoAtual.fabricante?.nome ?? 'Não informado'} · Classificação: {versaoAtual.classificacaoTecnica?.nome ?? 'Não informada'}</p><p>Composição: {versaoAtual.composicao?.itens.map(i => `${i.nomePrincipioSnapshot}: ${i.concentracaoValor ?? 'Não informada'} ${i.concentracaoUnidade ?? ''}`).join('; ') || 'Não informada'}</p><p>Referência: {versaoAtual.composicao?.referencia ?? 'Não informada'}</p><p>Nutrição: {versaoAtual.informacoesNutricionais?.itens.map(i => `${i.nomeNutrienteSnapshot}: ${i.valor ?? 'Não informado'}`).join('; ') || 'Não informada'}</p></div><Button secondary type="button" onClick={() => { setRevisaoEsperada(versaoAtual.revisaoCadastro ?? 1); setComposicao(d => ({ ...d, versaoEsperada: versaoAtual.composicao?.id ?? null })); setNutricional(d => ({ ...d, versaoEsperada: versaoAtual.informacoesNutricionais?.id ?? null })); setConflito(false); setErroGeral('Versão atual revisada. Confira o rascunho e salve para reaplicar suas alterações.'); }}>Usar revisão atual e manter meu rascunho</Button></>}</div>}
      </div>
      {erroCarga && <ErrorBox erro={`Não foi possível carregar fornecedores/categorias/centros de custo: ${erroCarga}`} />}
      {carregando && <p className="text-sm text-ink-3">Carregando fornecedores, categorias e centros de custo…</p>}
      <section className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
        <h3 className="text-sm font-semibold text-ink sm:col-span-2">Identificação comercial</h3>
      <CampoFormulario id="produto-nome" rotulo="Nome do produto" obrigatorio erro={erros.nome}>{(p) => <Input {...p} maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ração 22%" className={classeInput} />}</CampoFormulario>
      <CampoFormulario id="produto-categoria" rotulo="Categoria" obrigatorio ajuda="Organiza relatórios e classificação financeira." erro={erros.categoriaId}>{(p) => <SelectCampo {...p} value={categoriaId} onValueChange={(valor) => setCategoriaId(valor)} className={classeInput}><option value="">Selecione</option>{categorias.filter((c) => c.ativo || c.id === produto?.categoriaId).map((c) => <option key={c.id} value={c.id}>{c.nome}{c.ativo ? "" : " (inativa)"}</option>)}</SelectCampo>}</CampoFormulario>
      <CampoFormulario id="produto-codigo" rotulo="Código de referência">{p => <Input {...p} maxLength={80} value={codigoReferencia} onChange={e => setCodigoReferencia(e.target.value)} className={classeInput} />}</CampoFormulario>
      <CampoFormulario id="produto-apresentacao" rotulo="Apresentação">{p => <Input {...p} maxLength={200} value={apresentacao} onChange={e => setApresentacao(e.target.value)} placeholder="Ex.: frasco de 500 mL" className={classeInput} />}</CampoFormulario>
      <SeletorCatalogoProduto tipo="fabricantes" rotulo="Fabricante" valor={fabricanteId} onChange={id => { setFabricanteId(id); setCatalogoAlterado(true); }} somenteLeitura={somenteLeitura} />
      <SeletorCatalogoProduto tipo="classificacoes-tecnicas" rotulo="Classificação técnica" valor={classificacaoTecnicaId} onChange={id => { setClassificacaoTecnicaId(id); setCatalogoAlterado(true); }} somenteLeitura={somenteLeitura} />
      <p className="text-xs text-ink-3 sm:col-span-2">Fabricante identifica quem produz. Fornecedores continuam vinculados às compras. A classificação técnica é independente da categoria financeira.</p>
      <CampoFormulario id="produto-observacao" rotulo="Observações do produto">{p => <textarea {...p} maxLength={2000} value={observacao} onChange={e => setObservacao(e.target.value)} className={classeInput} />}</CampoFormulario>
      </section>
      <EditorComposicao dados={composicao} onChange={d => { setComposicao(d); setComposicaoAlterada(true); }} somenteLeitura={somenteLeitura} />
      <fieldset className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-3"><legend className="px-1 text-sm font-semibold">Tipos de uso<AjudaCampo rotulo="Ajuda: tipos de uso" texto={<>Escolha um ou mais. Sem seleção, o produto tem uso geral.</>} /></legend>{TIPOS.map((t) => <div key={t.campo}><label className="flex items-center gap-2 text-sm"><Checkbox id={t.campo} aria-invalid={!!erros[t.campo]} aria-describedby={erros[t.campo] ? `${t.campo}-erro` : undefined}  checked={usos[t.campo]} onCheckedChange={(checked) => setUsos({ ...usos, [t.campo]: checked === true })} />{t.nome}</label>{erros[t.campo] && <p id={`${t.campo}-erro`} role="alert" className="text-xs text-destructive">{erros[t.campo]}</p>}</div>)}</fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="produto-unidade" rotulo="Unidade" obrigatorio ajuda="Unidade em que o produto é comprado e baixado. Não pode mudar depois que houver movimento." erro={erros.unidade}>{(p) => <SelectCampo {...p} value={unidade} onValueChange={(valor) => setUnidade(valor as UnidadeMedida)} className={classeInput}>{UNIDADES_ORDENADAS.map((u) => <option key={u} value={u}>{rotuloUnidadeCompleto(u)}</option>)}</SelectCampo>}</CampoFormulario>
        <CampoFormulario id="produto-minimo" rotulo="Estoque mínimo" ajuda="Abaixo dessa quantidade o produto aparece com alerta na tela de Estoque." erro={erros.minimoEstoque}>{(p) => <Input {...p} type="number" min="0" step="0.01" value={minimo} onChange={(e) => setMinimo(e.target.value)} className={classeInput} />}</CampoFormulario>
      </div>
      {usos.usoSanitario && <fieldset className="grid gap-4 rounded-lg border border-border p-3 sm:col-span-2">
        <legend className="px-1 text-sm font-semibold">Perfil sanitário — sugestões para revisão<AjudaCampo rotulo="Ajuda: perfil sanitário" texto={<>Sem tipo padrão, o atendimento exige classificação manual. O cadastro do produto não define indicação clínica.</>} /></legend>
        <p className="text-sm text-ink-3">Informe a carência sugerida separadamente para leite e carne. A aplicação conserva a carência confirmada na data do atendimento.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoCarenciaProduto destino="leite" escolha={escolhaLeite} prazo={leite} permiteDesconhecida={legadoLeiteDesconhecido} erro={erros.carenciaLeiteHoras} onEscolha={setEscolhaLeite} onPrazo={setLeite} />
          <CampoCarenciaProduto destino="carne" escolha={escolhaCarne} prazo={carne} permiteDesconhecida={legadoCarneDesconhecido} erro={erros.carenciaCarneHoras} onEscolha={setEscolhaCarne} onPrazo={setCarne} />
        </div>
        {(legadoLeiteDesconhecido || legadoCarneDesconhecido) && <p className="text-sm text-ink-3">Prazos antigos não informados permanecem desconhecidos até serem conferidos.</p>}
        <p className="text-sm text-ink-3">Alterar o produto não modifica as aplicações anteriores.</p>
        <CampoFormulario id="produto-via" rotulo="Via de aplicação sugerida" erro={erros.viaPadrao}>{(p) => <Input {...p} maxLength={80} value={via} onChange={(e) => setVia(e.target.value)} className={classeInput} />}</CampoFormulario>
        <SeletorCatalogoProtocolo opcao="TIPO_APLICACAO" origem="SANITARIO" rotulo="Tipo de aplicação padrão (opcional)" valor={tipoAplicacaoId} onChange={setTipoAplicacaoId} listarOpcoes={listarTiposAplicacaoSanitarios} erroCampo={erros.tipoAplicacaoId} />

        <CampoFormulario id="produto-orientacao" rotulo="Orientação de uso (opcional)" erro={erros.orientacaoUso}>{(p) => <textarea {...p} maxLength={2000} value={orientacaoUso} onChange={e => setOrientacaoUso(e.target.value)} className={classeInput} />}</CampoFormulario>
      </fieldset>}
      {usos.usoNutricional && <CampoFormulario id="produto-ms" rotulo="Matéria seca (%)" erro={erros.materiaSecaPercentual}>{(p) => <Input {...p} type="text" inputMode="decimal" value={materiaSeca} onChange={(e) => setMateriaSeca(e.target.value)} className={classeInput} />}</CampoFormulario>}
      {usos.usoNutricional && <EditorNutricional dados={nutricional} onChange={d => { setNutricional(d); setNutricionalAlterado(true); }} somenteLeitura={somenteLeitura} />}
      {usos.usoGenetico && <div className="text-sm sm:col-span-2"><h3 className="font-semibold">Identidade genética</h3>{produto?.materialGeneticoId ? <LinkInterno href={`/pecuaria/rebanho/cadastros?aba=material-genetico&material=${encodeURIComponent(produto.materialGeneticoId)}`} area="pecuaria">Consultar material genético</LinkInterno> : <p className="text-ink-3">Nenhum material genético vinculado. A identidade permanece no cadastro de materiais genéticos.</p>}</div>}
      <CampoFormulario id="produto-conservacao" rotulo="Conservação e armazenamento">{p => <textarea {...p} maxLength={1000} value={conservacao} onChange={e => setConservacao(e.target.value)} className={classeInput} />}</CampoFormulario>
      {produto ? <PartidasProduto configuracao produtoId={produto.id} rastreado={rastrearPartidas} onMudou={() => setRastrearPartidas(true)} /> : <fieldset className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-3"><legend className="px-1 text-sm font-semibold">Lotes e validade</legend><label className="flex items-center gap-2 text-sm"><Checkbox  checked={rastrearPartidas} onCheckedChange={(checked) => setRastrearPartidas(checked === true)} />Controlar lotes por validade</label><p className="text-xs text-ink-3">Opcional. Entradas e saídas passam a identificar o lote do produto. Depois de ativado, o controle não pode ser desligado.</p></fieldset>}
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
      </fieldset>
      {produto && <><HistoricoProduto produtoId={produto.id} />{usos.usoNutricional && <HistoricoProduto produtoId={produto.id} nutricional />}</>}
    </form>
  </PainelCadastro>;
}

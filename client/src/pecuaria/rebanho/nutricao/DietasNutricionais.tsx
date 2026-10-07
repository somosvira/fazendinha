import { useEffect, useRef, useState } from "react";
import { Button, ErrorBox, Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { MultiSelect } from "../../../components/MultiSelect";
import { alterarEstadoDieta, criarDieta, criarVersaoDieta, editarDieta, excluirDieta, listarDietas, listarProdutosNutricionais, publicarDieta, type Dieta, type ProdutoNutricional } from "./api";

type AcaoDieta = { tipo: "publicar" | "versao" | "estado" | "excluir"; dieta: Dieta };
export function DietasNutricionais({ podeLancar }: { podeLancar: boolean }) {
  const [dietas, setDietas] = useState<Dieta[]>([]);
  const [produtos, setProdutos] = useState<ProdutoNutricional[]>([]);
  const [busca, setBusca] = useState("");
  const [estados, setEstados] = useState<string[]>([]);
  const [formulario, setFormulario] = useState<{ dieta?: Dieta } | null>(null);
  const [acao, setAcao] = useState<AcaoDieta | null>(null);
  const [nome, setNome] = useState("");
  const [itens, setItens] = useState([{ produtoId: "", quantidadeCabecaDia: "" }]);
  const [erro, setErro] = useState<string | null>(null);
  const [erroCampos, setErroCampos] = useState<Record<string, string>>({});
  const [salvo, setSalvo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let vivo = true; setCarregando(true); setErro(null);
    Promise.all([listarDietas(), podeLancar ? listarProdutosNutricionais() : Promise.resolve([])]).then(([ds, ps]) => { if (vivo) { setDietas(ds); setProdutos(ps); } }).catch((e: unknown) => { if (vivo) setErro(`${salvo ? "Dieta salva. A consulta não atualizou. " : ""}${e instanceof Error ? e.message : String(e)}`); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [revisao, podeLancar]);
  useEffect(() => { const campo = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]'); campo?.scrollIntoView?.({ block: "center" }); campo?.focus(); }, [erroCampos]);

  function abrir(dieta?: Dieta) {
    setFormulario({ dieta }); setErro(null); setErroCampos({}); setNome(dieta?.nome ?? "");
    setItens(dieta?.itens.map((i) => ({ produtoId: i.produtoId, quantidadeCabecaDia: i.quantidadeCabecaDia })) ?? [{ produtoId: "", quantidadeCabecaDia: "" }]);
  }
  async function salvar() {
    if (ocupado) return;
    const erros: Record<string, string> = {};
    if (nome.trim().length < 2) erros["dieta-nome"] = "Informe o nome da dieta.";
    const escolhidos = new Set<string>();
    itens.forEach((i, n) => { if (!i.produtoId || escolhidos.has(i.produtoId)) erros[`dieta-ingrediente-${n}`] = "Selecione um ingrediente sem repetir."; escolhidos.add(i.produtoId); if (!Number.isFinite(Number(i.quantidadeCabecaDia.replace(",", "."))) || !(Number(i.quantidadeCabecaDia.replace(",", ".")) > 0)) erros[`dieta-quantidade-${n}`] = "Informe uma quantidade maior que zero."; });
    setErroCampos(erros); if (Object.keys(erros).length) return;
    setOcupado(true); setErro(null);
    try {
      const body = { nome: nome.trim(), itens: itens.map((i) => ({ produtoId: i.produtoId, quantidadeCabecaDia: Number(i.quantidadeCabecaDia.replace(",", ".")) })) };
      if (formulario?.dieta) await editarDieta(formulario.dieta.id, body); else await criarDieta(body);
      setFormulario(null); setSalvo("Rascunho salvo."); setRevisao((v) => v + 1);
    } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  async function confirmarAcao() {
    if (!acao || ocupado) return;
    setOcupado(true); setErro(null);
    try {
      const { dieta, tipo } = acao;
      if (tipo === "publicar") await publicarDieta(dieta.id);
      if (tipo === "estado") await alterarEstadoDieta(dieta.id, dieta.ativo === false);
      if (tipo === "excluir") await excluirDieta(dieta.id);
      if (tipo === "versao") abrir(await criarVersaoDieta(dieta.id));
      setAcao(null); setSalvo(tipo === "versao" ? "Nova versão criada como rascunho." : "Dieta atualizada."); setRevisao((v) => v + 1);
    } catch (e: unknown) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  const situacao = (d: Dieta) => d.ativo === false ? "INATIVA" : d.publicadaEm ? "PUBLICADA" : "RASCUNHO";
  const filtradas = dietas.filter((d) => d.nome.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")) && (!estados.length || estados.includes(situacao(d))));
  return <Panel className="mt-5 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="h2">Dietas</h2>{podeLancar && <Button onClick={() => abrir()}>Nova dieta</Button>}</div>
    {salvo && <p role="status" className="mt-3">{salvo}</p>}
    <ErrorBox erro={erro} />{erro && !formulario && !acao && <Button secondary onClick={() => setRevisao((v) => v + 1)}>Tentar novamente</Button>}
    <div className="my-4 grid gap-3 sm:grid-cols-2"><label>Buscar dieta<input className={classeInput} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome da dieta" /></label><MultiSelect label="Situação" value={estados} onValueChange={setEstados} options={[{ value: "PUBLICADA", label: "Publicada" }, { value: "RASCUNHO", label: "Rascunho" }, { value: "INATIVA", label: "Inativa" }]} /></div>
    {carregando ? <p role="status">Carregando dietas…</p> : <><TabelaFinanceira rotulo="Dietas nutricionais" itens={filtradas} chaveDe={(d) => d.id} colunas={[
      { chave: "nome", titulo: "Dieta", principal: true, celula: (d) => d.nome },
      { chave: "versao", titulo: "Versão", celula: (d) => `v${d.versao}` },
      { chave: "situacao", titulo: "Situação", celula: (d) => d.ativo === false ? "Inativa" : d.publicadaEm ? "Publicada" : "Rascunho" },
      { chave: "ingredientes", titulo: "Ingredientes", celula: (d) => <details><summary className="cursor-pointer">{d.itens.length} ingredientes</summary>{d.itens.map((i) => <p key={i.produtoId} className="mt-2">{i.produto?.nome ?? produtos.find((p) => p.id === i.produtoId)?.nome ?? "Ingrediente histórico"}: {i.quantidadeCabecaDia} {i.unidade}/cabeça/dia · MS {i.materiaSecaPercentualSnapshot == null ? "não informada" : `${i.materiaSecaPercentualSnapshot}%`}</p>)}</details> },
      { chave: "acoes", titulo: "Ações", acoes: true, celula: (d) => podeLancar && <div className="flex flex-wrap gap-2">{!d.publicadaEm && <Button secondary onClick={() => abrir(d)}>Editar rascunho</Button>}{d.ativo !== false && !d.publicadaEm && <Button secondary onClick={() => { setErro(null); setAcao({ tipo: "publicar", dieta: d }); }}>Publicar</Button>}{d.publicadaEm && <Button secondary onClick={() => { setErro(null); setAcao({ tipo: "versao", dieta: d }); }}>Nova versão</Button>}<Button secondary onClick={() => { setErro(null); setAcao({ tipo: "estado", dieta: d }); }}>{d.ativo === false ? "Ativar" : "Inativar"}</Button>{(d.podeExcluir ?? !d._count?.vigencias) && <Button secondary onClick={() => { setErro(null); setAcao({ tipo: "excluir", dieta: d }); }}>Excluir</Button>}</div> },
    ]} />{!filtradas.length && <p className="mt-3">Nenhuma dieta encontrada.{podeLancar && " Crie uma dieta para publicar seus ingredientes."}</p>}</>}
    {formulario && <PainelCadastro aberto titulo={formulario.dieta ? `Editar dieta · v${formulario.dieta.versao}` : "Nova dieta"} largura="sm:max-w-2xl" onFechar={() => { if (!ocupado) setFormulario(null); }} rodape={<><Button secondary disabled={ocupado} onClick={() => setFormulario(null)}>Cancelar</Button><Button form="form-dieta" type="submit" disabled={ocupado}>Salvar rascunho</Button></>}><form ref={formRef} noValidate id="form-dieta" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void salvar(); }}><ErrorBox erro={erro} /><CampoFormulario id="dieta-nome" rotulo="Nome da dieta" erro={erroCampos["dieta-nome"]} obrigatorio>{(p) => <input {...p} maxLength={160} className={classeInput} value={nome} onChange={(e) => setNome(e.target.value)} />}</CampoFormulario><h3 className="h3">Ingredientes por cabeça/dia</h3>{itens.map((item, n) => <div key={n} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2"><CampoFormulario id={`dieta-ingrediente-${n}`} rotulo={`Ingrediente ${n + 1}`} erro={erroCampos[`dieta-ingrediente-${n}`]} obrigatorio>{(p) => <select {...p} className={classeInput} value={item.produtoId} onChange={(e) => setItens((xs) => xs.map((x, j) => j === n ? { ...x, produtoId: e.target.value } : x))}><option value="">Selecione o Produto</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}</select>}</CampoFormulario><CampoFormulario id={`dieta-quantidade-${n}`} rotulo={`Quantidade por cabeça/dia ${n + 1}`} erro={erroCampos[`dieta-quantidade-${n}`]} obrigatorio>{(p) => <input {...p} inputMode="decimal" className={classeInput} value={item.quantidadeCabecaDia} onChange={(e) => setItens((xs) => xs.map((x, j) => j === n ? { ...x, quantidadeCabecaDia: e.target.value } : x))} />}</CampoFormulario><Button secondary disabled={itens.length === 1} onClick={() => setItens((xs) => xs.filter((_, j) => j !== n))}>Remover ingrediente {n + 1}</Button></div>)}<Button secondary onClick={() => setItens((xs) => [...xs, { produtoId: "", quantidadeCabecaDia: "" }])}>Adicionar ingrediente</Button><p className="text-sm text-ink-3">O rascunho pode ser editado. Publicar congela esta versão e seus ingredientes.</p></form></PainelCadastro>}
    {acao && <PainelCadastro aberto titulo={acao.tipo === "publicar" ? "Publicar dieta" : acao.tipo === "versao" ? "Criar nova versão" : acao.tipo === "excluir" ? "Excluir dieta" : acao.dieta.ativo === false ? "Ativar dieta" : "Inativar dieta"} onFechar={() => { if (!ocupado) setAcao(null); }} rodape={<><Button secondary disabled={ocupado} onClick={() => setAcao(null)}>Cancelar</Button><Button disabled={ocupado} onClick={() => void confirmarAcao()}>Confirmar</Button></>}><ErrorBox erro={erro} /><p>{acao.dieta.nome} · v{acao.dieta.versao}</p><p className="mt-3">{acao.tipo === "publicar" ? "Esta versão ficará disponível para atribuição aos lotes. Alterações posteriores exigem uma nova versão." : acao.tipo === "versao" ? "Uma nova versão numerada será criada como rascunho, com os ingredientes desta dieta." : acao.tipo === "excluir" ? "A dieta só será excluída se não tiver uso ou vínculo com lotes. Dietas utilizadas podem ser inativadas, preservando o histórico." : "O histórico e as atribuições existentes serão preservados. Somente dietas ativas e publicadas ficam disponíveis para novas atribuições."}</p></PainelCadastro>}
  </Panel>;
}

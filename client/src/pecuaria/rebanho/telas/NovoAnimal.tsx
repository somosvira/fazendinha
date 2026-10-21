import { SelectCampo } from "@/financeiro/SelectCampo";
// Cadastro de animal — página cheia no layout de FormOperacao.tsx: form em
// card + resumo de revisão à direita. POST /pecuaria/rebanho/animais.

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { cadastrarAnimal, listarCategorias, obterCatalogos, preverComposicaoAnimal, RebanhoApiError } from "../api";
import type { Aptidao, CatalogoLote, Catalogos, CategoriaDTO, ComposicaoItemInput, ComposicaoSugerida, Origem, PapelReprodutivo, Sexo } from "../types";
import { calcularCategoriaCliente } from "../lib/categoria";
import { composicaoValida, juntarComposicoes, somaFracoes } from "../lib/composicao";
import { CampoComposicao, rolarParaCampo } from "../ui";
import { CampoGenitor, genitorIncompleto, mensagemGenitorIncompleto, valorGenitorParaCampos, type ValorGenitor } from "../components/CampoGenitor";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { navegarPara } from "../../../router";
import { linkFichaAnimal, retornoRebanhoDaUrl } from "../lib/navegacao";
import { Button, ErrorBox, hoje, PageHeader, PaginaFinanceira } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { useToast } from "../../../components/Toast";

type Erros = Record<string, string>;

/** Campo do formulário (nome usado na validação local e no `campo` dos erros da API) → id do
 *  elemento na tela, na ordem em que aparecem — o primeiro com erro recebe rolagem e foco. */
const ELEMENTO_DO_CAMPO: [campo: string, elementId: string][] = [
  ["brinco", "novo-animal-brinco"],
  ["nome", "novo-animal-nome"],
  ["brincoEletronico", "novo-animal-brinco-eletronico"],
  ["sisbov", "novo-animal-sisbov"],
  ["dataNascimento", "novo-animal-data-nascimento"],
  ["dataEntrada", "novo-animal-data-entrada"],
  ["partosAntesDaEntrada", "novo-animal-partos"],
  ["mae", "campo-genitor-mae"],
  ["maeId", "campo-genitor-mae"],
  ["maeExternaId", "campo-genitor-mae"],
  ["pai", "campo-genitor-pai"],
  ["paiId", "campo-genitor-pai"],
  ["paiExternoId", "campo-genitor-pai"],
  ["propriedadeId", "novo-animal-propriedade"],
  ["loteId", "novo-animal-lote"],
  ["aptidao", "novo-animal-aptidao"],
  ["papelReprodutivo", "novo-animal-papel"],
  ["composicao", "composicao-raca-0"],
  ["pesoEntradaKg", "novo-animal-peso"],
  ["observacao", "novo-animal-observacao"],
];

/** Rola até o primeiro campo com erro; devolve false se nenhum dos erros tem campo na tela. */
function irParaPrimeiroErro(erros: Erros): boolean {
  const alvo = ELEMENTO_DO_CAMPO.find(([campo]) => erros[campo]);
  if (!alvo) return false;
  rolarParaCampo(alvo[1]);
  return true;
}

export function NovoAnimal({ onVoltar, podeLancar = true }: { onVoltar: () => void; podeLancar?: boolean }) {
  if (!podeLancar) {
    return <PaginaFinanceira>
      <PageHeader eyebrow="" titulo="Novo animal" descricao="O seu perfil pode consultar o rebanho, mas não pode cadastrar animais." />
      <ErrorBox erro="Você não tem permissão para cadastrar animais." />
    </PaginaFinanceira>;
  }
  return <FormNovoAnimal onVoltar={onVoltar} />;
}

function FormNovoAnimal({ onVoltar }: { onVoltar: () => void }) {
  const toast = useToast();
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [categorias, setCategorias] = useState<CategoriaDTO[]>([]);
  const [erroCatalogos, setErroCatalogos] = useState<string | null>(null);

  const [brinco, setBrinco] = useState("");
  const [nome, setNome] = useState("");
  const [brincoEletronico, setBrincoEletronico] = useState("");
  const [sisbov, setSisbov] = useState("");
  const [sexo, setSexo] = useState<Sexo>("F");
  const origem: Origem = "COMPRADO";
  const [dataNascimento, setDataNascimento] = useState(hoje());
  const [nascimentoEstimado, setNascimentoEstimado] = useState(false);
  const [dataEntrada, setDataEntrada] = useState(hoje());
  const [partosAntesDaEntrada, setPartosAntesDaEntrada] = useState("0");
  const [observacao, setObservacao] = useState("");
  const [propriedadeId, setPropriedadeId] = useState<string>(() => { const ativa = getPropriedadeAtiva(); return ativa != null ? String(ativa) : ""; });
  const [loteId, setLoteId] = useState("");
  const [aptidao, setAptidao] = useState<Aptidao>("LEITE");
  const [papelReprodutivo, setPapelReprodutivo] = useState<PapelReprodutivo>("NENHUM");
  const [composicao, setComposicao] = useState<ComposicaoItemInput[]>([]);
  const [herdada, setHerdada] = useState<ComposicaoSugerida | null>(null);
  const [carregandoHerdanca, setCarregandoHerdanca] = useState(false);
  const [erroHerdanca, setErroHerdanca] = useState<string | null>(null);
  const [pesoEntradaKg, setPesoEntradaKg] = useState("");
  const [mae, setMae] = useState<ValorGenitor>({ tipo: "NENHUM" });
  const [pai, setPai] = useState<ValorGenitor>({ tipo: "NENHUM" });

  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { obterCatalogos().then(setCatalogos).catch((e) => setErroCatalogos(e instanceof Error ? e.message : String(e))); }, []);
  useEffect(() => { listarCategorias().then((r) => setCategorias(r.itens)).catch(() => undefined); }, []);

  useEffect(() => {
    if (mae.tipo === "NENHUM" && pai.tipo === "NENHUM") {
      setHerdada(null); setErroHerdanca(null); setCarregandoHerdanca(false); return;
    }
    setComposicao([]);
    if ((mae.tipo !== "NENHUM" && !mae.id) || (pai.tipo !== "NENHUM" && !pai.id) || !dataNascimento) {
      setHerdada(null); setErroHerdanca(null); setCarregandoHerdanca(false); return;
    }
    let ativo = true;
    setCarregandoHerdanca(true); setErroHerdanca(null); setHerdada(null);
    preverComposicaoAnimal({ ...valorGenitorParaCampos(mae, pai), dataNascimento })
      .then((resultado) => { if (ativo) setHerdada(resultado); })
      .catch((falha) => { if (ativo) setErroHerdanca(falha instanceof Error ? falha.message : String(falha)); })
      .finally(() => { if (ativo) setCarregandoHerdanca(false); });
    return () => { ativo = false; };
  }, [mae.tipo, mae.tipo !== "NENHUM" ? mae.id : "", pai.tipo, pai.tipo !== "NENHUM" ? pai.id : "", dataNascimento]);

  const alterarDataNascimento = (valor: string) => { setDataNascimento(valor); };
  const alterarPropriedade = (valor: string) => { setPropriedadeId(valor); setLoteId(""); };
  // papel reprodutivo e partos só fazem sentido para fêmea (R1) — trocar para macho zera os dois
  const alterarSexo = (novoSexo: Sexo) => { setSexo(novoSexo); if (novoSexo === "M") { setPapelReprodutivo("NENHUM"); setPartosAntesDaEntrada("0"); } };

  const lotesDoSitio: CatalogoLote[] = useMemo(() => catalogos?.lotes.filter((lote) => String(lote.propriedadeId) === propriedadeId) ?? [], [catalogos, propriedadeId]);
  const categoriaPrevista = dataNascimento ? calcularCategoriaCliente(categorias, { sexo, dataNascimento, partosAntesDaEntrada: Number(partosAntesDaEntrada || 0), hoje: hoje() }) : null;
  const itensHerdados = herdada?.itens.map(({ racaId, fracao64 }) => ({ racaId, fracao64 })) ?? [];
  const limiteInformavel = 64 - somaFracoes(itensHerdados);
  const composicaoTotal = juntarComposicoes(itensHerdados, composicao);
  const somaComposicao = somaFracoes(composicao);


  const validar = (): Erros => {
    const novosErros: Erros = {};
    if (!brinco.trim()) novosErros.brinco = "Informe o brinco";
    if (!dataNascimento) novosErros.dataNascimento = "Informe a data de nascimento";
    if (!dataEntrada) novosErros.dataEntrada = "Informe a data de entrada";
    else if (dataNascimento && dataEntrada < dataNascimento) novosErros.dataEntrada = "Data de entrada não pode ser anterior ao nascimento";
    if (!propriedadeId) novosErros.propriedadeId = "Selecione o sítio";
    if (composicao.some((item) => !item.racaId)) novosErros.composicao = "Selecione a raça em todas as linhas de composição";
    else if (!composicaoValida(composicao) || somaComposicao > limiteInformavel) novosErros.composicao = `A parcela informada não pode passar de ${limiteInformavel}/64 e cada raça só pode aparecer uma vez`;
    if (carregandoHerdanca || erroHerdanca) novosErros.composicao = erroHerdanca ?? "Aguarde o cálculo da composição pelos genitores";
    if (genitorIncompleto(mae)) novosErros.mae = mensagemGenitorIncompleto("Mãe", "F");
    if (genitorIncompleto(pai)) novosErros.pai = mensagemGenitorIncompleto("Pai", "M");
    return novosErros;
  };

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    const validacao = validar();
    setErros(validacao);
    if (Object.keys(validacao).length) { irParaPrimeiroErro(validacao); return; }
    setSalvando(true); setErroGeral(null);
    try {
      const animal = await cadastrarAnimal({
        brinco: brinco.trim(), nome: nome.trim() || null, brincoEletronico: brincoEletronico.trim() || null, sisbov: sisbov.trim() || null,
        sexo, dataNascimento, nascimentoEstimado, origem, dataEntrada, partosAntesDaEntrada: Number(partosAntesDaEntrada || 0),
        observacao: observacao.trim() || null, propriedadeId: Number(propriedadeId), loteId: loteId || null,
        aptidao, papelReprodutivo, composicao: composicaoTotal,
        pesoEntradaKg: pesoEntradaKg ? Number(pesoEntradaKg) : null,
        ...valorGenitorParaCampos(mae, pai),
      });
      if (animal.avisos?.length) toast.warn("Animal salvo com aviso", animal.avisos.map((aviso) => aviso.mensagem).join(" · "));
      navegarPara(linkFichaAnimal(animal.id, retornoRebanhoDaUrl()));
    } catch (falha) {
      const mensagem = falha instanceof RebanhoApiError ? falha.message : falha instanceof Error ? falha.message : String(falha);
      // erro de um campo que está na tela: mensagem junto dele e o usuário é levado até lá;
      // senão, a caixa de erro no topo do formulário (rolando até ela)
      const doCampo = falha instanceof RebanhoApiError && falha.campo ? { [falha.campo]: mensagem } : {};
      setErros(doCampo);
      if (!irParaPrimeiroErro(doCampo)) { setErroGeral(mensagem); rolarParaCampo("novo-animal-erro"); }
    } finally { setSalvando(false); }
  };


  return <PaginaFinanceira><div className="pb-10">
    <PageHeader titulo="Novo animal" />
    <ErrorBox erro={erroCatalogos} />
    {!catalogos && !erroCatalogos && <div className="rebanho-carregamento" role="status">Carregando cadastro…</div>}
    {catalogos && <form onSubmit={submeter} noValidate className="pec-novo-animal">
      <div className="pec-form-corpo space-y-7 p-5 md:p-7">
        <div className="rebanho-origem-cadastro"><span>Animal comprado</span><Button secondary type="button" onClick={() => navegarPara("/pecuaria/reproducao?acao=parto")}>Registrar nascimento pelo parto</Button></div>
        <div id="novo-animal-erro" tabIndex={-1} className="outline-none"><ErrorBox erro={erroGeral} /></div>
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Identificação</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CampoFormulario id="novo-animal-brinco" rotulo="Brinco" obrigatorio erro={erros.brinco}>{(p) => <input {...p} required maxLength={40} value={brinco} onChange={(e) => setBrinco(e.target.value)} className={classeInput} />}</CampoFormulario>
            <CampoFormulario id="novo-animal-nome" rotulo="Nome">{(p) => <input {...p} maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} className={classeInput} />}</CampoFormulario>
            <CampoFormulario id="novo-animal-sexo" rotulo="Sexo" obrigatorio>{(p) => <SelectCampo {...p} value={sexo} onValueChange={(valorSelecionado) => alterarSexo(valorSelecionado as Sexo)} className={classeInput}><option value="F">Fêmea</option><option value="M">Macho</option></SelectCampo>}</CampoFormulario>
            <CampoFormulario id="novo-animal-brinco-eletronico" rotulo="Brinco eletrônico">{(p) => <input {...p} maxLength={40} value={brincoEletronico} onChange={(e) => setBrincoEletronico(e.target.value)} className={classeInput} />}</CampoFormulario>
            <CampoFormulario id="novo-animal-sisbov" rotulo="SISBOV">{(p) => <input {...p} maxLength={40} value={sisbov} onChange={(e) => setSisbov(e.target.value)} className={classeInput} />}</CampoFormulario>
          </div>
        </section>
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Datas e filiação</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div><CampoFormulario id="novo-animal-data-nascimento" rotulo="Data de nascimento" obrigatorio erro={erros.dataNascimento}>{(p) => <DatePicker {...p} required max={hoje()} value={dataNascimento} onChange={alterarDataNascimento} className="mt-1.5" />}</CampoFormulario>
              <label className="mt-2 flex items-center gap-2 text-sm"><input id="novo-animal-nascimento-estimado" type="checkbox" checked={nascimentoEstimado} onChange={(e) => setNascimentoEstimado(e.target.checked)} />Nascimento estimado</label>
            </div>
            <CampoFormulario id="novo-animal-data-entrada" rotulo="Data de entrada" obrigatorio erro={erros.dataEntrada}>{(p) => <DatePicker {...p} required max={hoje()} value={dataEntrada} onChange={setDataEntrada} className="mt-1.5" />}</CampoFormulario>
            {sexo === "F" && <CampoFormulario id="novo-animal-partos" rotulo="Partos antes da entrada" ajuda="Define a categoria (novilha vira vaca a partir de 1 parto).">{(p) => <input {...p} type="number" min={0} step={1} value={partosAntesDaEntrada} onChange={(e) => setPartosAntesDaEntrada(e.target.value)} className={classeInput} />}</CampoFormulario>}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <CampoGenitor rotulo="Mãe" sexo="F" valor={mae} onChange={setMae} erro={erros.mae} />
            <CampoGenitor rotulo="Pai" sexo="M" valor={pai} onChange={setPai} erro={erros.pai} />
          </div>
        </section>
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Localização e finalidade</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CampoFormulario id="novo-animal-propriedade" rotulo="Sítio" obrigatorio erro={erros.propriedadeId}>{(p) => <SelectCampo {...p} required value={propriedadeId} onValueChange={(valorSelecionado) => alterarPropriedade(valorSelecionado)} className={classeInput}><option value="">Selecione</option>{catalogos.propriedades.map((prop) => <option key={prop.id} value={prop.id}>{prop.nome}</option>)}</SelectCampo>}</CampoFormulario>
            <CampoFormulario id="novo-animal-lote" rotulo="Lote" ajuda={!propriedadeId ? "Selecione o sítio para escolher o lote." : undefined}>{(p) => <SelectCampo {...p} disabled={!propriedadeId} value={loteId} onValueChange={(valorSelecionado) => setLoteId(valorSelecionado)} className={classeInput}><option value="">Sem lote</option>{lotesDoSitio.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}</SelectCampo>}</CampoFormulario>
            <CampoFormulario id="novo-animal-aptidao" rotulo="Finalidade" obrigatorio>{(p) => <SelectCampo {...p} required value={aptidao} onValueChange={(valorSelecionado) => setAptidao(valorSelecionado as Aptidao)} className={classeInput}><option value="LEITE">Leite</option><option value="CORTE">Corte</option><option value="REPRODUCAO">Reprodução</option></SelectCampo>}</CampoFormulario>
            {sexo === "F" && <CampoFormulario id="novo-animal-papel" rotulo="Papel reprodutivo">{(p) => <SelectCampo {...p} value={papelReprodutivo} onValueChange={(valorSelecionado) => setPapelReprodutivo(valorSelecionado as PapelReprodutivo)} className={classeInput}><option value="NENHUM">Nenhum</option><option value="RECEPTORA">Receptora</option><option value="DOADORA">Doadora</option></SelectCampo>}</CampoFormulario>}
          </div>
        </section>
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Composição racial</h3>
          {carregandoHerdanca && <p className="mb-3 text-sm text-ink-3">Calculando a parcela herdada…</p>}
          {erroHerdanca && <p role="alert" className="mb-3 text-sm text-red-700">{erroHerdanca}</p>}
          {herdada && <p className="mb-3 text-sm text-ink-3">Parcela fixa dos genitores: {herdada.rotulo} ({somaFracoes(itensHerdados)}/64). {limiteInformavel ? `Você pode informar até ${limiteInformavel}/64 da parcela ainda desconhecida.` : "Composição completa; não há parcela para informar."}</p>}
          {!carregandoHerdanca && limiteInformavel > 0 && <CampoComposicao racas={catalogos.racas} itens={composicao} onChange={setComposicao} erro={erros.composicao} limite64={limiteInformavel} />}
        </section>
        <section>
          <CampoFormulario id="novo-animal-peso" rotulo="Peso de entrada (kg)" ajuda="Opcional — registra a primeira pesagem do animal.">{(p) => <input {...p} type="number" min="0.01" step="0.01" className={`${classeInput} max-w-xs`} value={pesoEntradaKg} onChange={(e) => setPesoEntradaKg(e.target.value)} />}</CampoFormulario>
        </section>
        <CampoFormulario id="novo-animal-observacao" rotulo="Observação">{(p) => <textarea {...p} maxLength={500} className={classeInput} value={observacao} onChange={(e) => setObservacao(e.target.value)} />}</CampoFormulario>
      </div>
      <footer className="rebanho-form-acoes">
        {categoriaPrevista && <span>Categoria prevista: <strong>{categoriaPrevista.nome}</strong></span>}
        <Button secondary type="button" onClick={onVoltar} disabled={salvando}>Cancelar</Button>
        <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar animal"}</Button>
      </footer>
    </form>}
  </div></PaginaFinanceira>;
}

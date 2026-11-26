import { AjudaCampo } from "../../../components/Dica";
// Cadastro de animal compartilhado: usado pela página "Novo animal" (NovoAnimal.tsx) e pelo modal
// "Adicionar animal" da compra de animais (financeiro/FormOperacao.tsx). Os dois mostram os MESMOS
// campos, com a MESMA validação; a diferença é só quem grava (a API do Rebanho, ou a operação, que
// cadastra o animal ao confirmar) e o que vem pronto da operação (sítio fixo, data de entrada).
// Elementos têm ids com prefixo configurável para não colidir com a tela que os abriga.

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Dna, MapPin, Tag } from "lucide-react";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { listarCategorias, obterCatalogos, preverComposicaoAnimal } from "../api";
import type { Aptidao, CadastrarAnimalInput, CatalogoLote, Catalogos, CategoriaDTO, ComposicaoItemInput, ComposicaoSugerida, PapelReprodutivo, Sexo } from "../types";
import { calcularCategoriaCliente } from "../lib/categoria";
import { composicaoValida, fracaoReduzida, juntarComposicoes, somaFracoes } from "../lib/composicao";
import { CampoComposicao, rolarParaCampo } from "../ui";
import { CampoGenitor, genitorIncompleto, mensagemGenitorIncompleto, valorGenitorParaCampos, type ValorGenitor } from "../components/CampoGenitor";
import { AjudaDestinoBezerreiro, useSugestaoBezerreiro } from "../bezerreiro/useSugestaoBezerreiro";
import { hoje } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";

export type ErrosCadastroAnimal = Record<string, string>;

/** Sítio definido por quem abriu o cadastro (a operação de compra): o campo fica só informativo. */
export type SitioFixo = { id: number; nome: string };

/** Tudo o que o usuário preenche — também o formato guardado no rascunho e reaberto para edição. */
export type FormAnimal = {
  brinco: string; nome: string; brincoEletronico: string; sisbov: string;
  sexo: Sexo; dataNascimento: string; nascimentoEstimado: boolean; dataEntrada: string; partosAntesDaEntrada: string;
  observacao: string;
  loteId: string; destinoManual: boolean; aptidao: Aptidao; papelReprodutivo: PapelReprodutivo;
  /** Só a parcela informada; a herdada dos genitores é calculada pelo servidor. */
  composicao: ComposicaoItemInput[];
  mae: ValorGenitor; pai: ValorGenitor; pesoEntradaKg: string; eccEntrada?: string;
};

/** Corpo do cadastro sem os campos que a operação define (origem e sítio). */
export type AnimalPayload = Omit<CadastrarAnimalInput, "origem" | "propriedadeId">;

export function formAnimalInicial(dataEntrada = hoje()): FormAnimal {
  return {
    brinco: "", nome: "", brincoEletronico: "", sisbov: "",
    sexo: "F", dataNascimento: hoje(), nascimentoEstimado: false, dataEntrada, partosAntesDaEntrada: "0",
    observacao: "", loteId: "", destinoManual: false, aptidao: "LEITE", papelReprodutivo: "NENHUM",
    composicao: [], mae: { tipo: "NENHUM" }, pai: { tipo: "NENHUM" }, pesoEntradaKg: "", eccEntrada: "",
  };
}

export const PREFIXO_PADRAO = "novo-animal";

/** Campo do formulário (nome usado na validação local e no `campo` dos erros da API) → id do
 *  elemento na tela, na ordem em que aparecem — o primeiro com erro recebe rolagem e foco. */
function elementosDosCampos(prefixo: string, personalizado: boolean): [campo: string, elementId: string][] {
  const genitor = (lado: "mae" | "pai") => personalizado ? `${prefixo}-genitor-${lado}` : `campo-genitor-${lado}`;
  return [
    ["brinco", `${prefixo}-brinco`],
    ["nome", `${prefixo}-nome`],
    ["brincoEletronico", `${prefixo}-brinco-eletronico`],
    ["sisbov", `${prefixo}-sisbov`],
    ["dataNascimento", `${prefixo}-data-nascimento`],
    ["dataEntrada", `${prefixo}-data-entrada`],
    ["partosAntesDaEntrada", `${prefixo}-partos`],
    ["mae", genitor("mae")],
    ["maeId", genitor("mae")],
    ["maeExternaId", genitor("mae")],
    ["pai", genitor("pai")],
    ["paiId", genitor("pai")],
    ["paiExternoId", genitor("pai")],
    ["propriedadeId", `${prefixo}-propriedade`],
    ["loteId", `${prefixo}-lote`],
    ["aptidao", `${prefixo}-aptidao`],
    ["papelReprodutivo", `${prefixo}-papel`],
    ["composicao", `${prefixo}-composicao-secao`],
    ["pesoEntradaKg", `${prefixo}-peso`],
    ["eccEntrada", `${prefixo}-ecc`],
    ["observacao", `${prefixo}-observacao`],
  ];
}

export type OpcoesCadastroAnimal = {
  /** Prefixo dos ids dos elementos; sem ele, usa os ids históricos da página Novo animal. */
  prefixo?: string;
  /** Sítio vindo da operação; sem ele o usuário escolhe. */
  sitioFixo?: SitioFixo;
  /** Sítio pré-selecionado quando não há sítio fixo (sítio ativo do app). */
  propriedadeInicial?: string;
  /** Animal já preenchido, para editar um resumo. */
  valorInicial?: FormAnimal | null;
  /** Data de entrada sugerida para um animal novo (ex.: a data da operação). */
  dataEntradaInicial?: string;
  /** Brincos já usados em outra parte da tela (ex.: outros animais da mesma compra). */
  brincosReservados?: string[];
  /** Erros a mostrar já na abertura (ex.: recusa da API ao confirmar a operação). */
  errosIniciais?: ErrosCadastroAnimal;
};

export function useCadastroAnimal(opcoes: OpcoesCadastroAnimal = {}) {
  const { sitioFixo, valorInicial, brincosReservados } = opcoes;
  const personalizado = !!opcoes.prefixo;
  const prefixo = opcoes.prefixo ?? PREFIXO_PADRAO;
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [categorias, setCategorias] = useState<CategoriaDTO[]>([]);
  const [categoriasCarregando, setCategoriasCarregando] = useState(true);
  const [erroCategorias, setErroCategorias] = useState("");
  const [erroCatalogos, setErroCatalogos] = useState<string | null>(null);

  const [form, setForm] = useState<FormAnimal>(() => valorInicial ?? formAnimalInicial(opcoes.dataEntradaInicial));
  const alterar = (patch: Partial<FormAnimal>) => setForm((atual) => ({ ...atual, ...patch }));
  const [propriedadeId, setPropriedadeId] = useState<string>(sitioFixo ? String(sitioFixo.id) : opcoes.propriedadeInicial ?? "");
  // Na edição, o lote que o sistema sugeriu continua "sugerido" (não escolhido pelo usuário).
  const loteSugerido = useRef(valorInicial && !valorInicial.destinoManual ? valorInicial.loteId : "");
  const [herdada, setHerdada] = useState<ComposicaoSugerida | null>(null);
  const [carregandoHerdanca, setCarregandoHerdanca] = useState(false);
  const [erroHerdanca, setErroHerdanca] = useState<string | null>(null);
  const [revisaoHerdanca, setRevisaoHerdanca] = useState(0);

  const [erros, setErros] = useState<ErrosCadastroAnimal>(opcoes.errosIniciais ?? {});
  const { mae, pai, dataNascimento, composicao, destinoManual, loteId, sexo, partosAntesDaEntrada } = form;

  useEffect(() => { obterCatalogos().then(setCatalogos).catch((e) => setErroCatalogos(e instanceof Error ? e.message : String(e))); }, []);
  useEffect(() => { listarCategorias().then((r) => setCategorias(r.itens)).catch(() => setErroCategorias("Não foi possível consultar a categoria para sugerir o Bezerreiro. Escolha o lote manualmente.")).finally(() => setCategoriasCarregando(false)); }, []);

  useEffect(() => {
    if (mae.tipo === "NENHUM" && pai.tipo === "NENHUM") {
      setHerdada(null); setErroHerdanca(null); setCarregandoHerdanca(false); return;
    }
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
  }, [mae.tipo, mae.tipo !== "NENHUM" ? mae.id : "", pai.tipo, pai.tipo !== "NENHUM" ? pai.id : "", dataNascimento, revisaoHerdanca]);

  const alterarPropriedade = (valor: string) => { setPropriedadeId(valor); alterar({ loteId: "", destinoManual: false }); loteSugerido.current = ""; };
  // papel reprodutivo e partos só fazem sentido para fêmea (R1) — trocar para macho zera os dois
  const alterarSexo = (novoSexo: Sexo) => alterar(novoSexo === "M" ? { sexo: novoSexo, papelReprodutivo: "NENHUM", partosAntesDaEntrada: "0" } : { sexo: novoSexo });

  const lotesDoSitio: CatalogoLote[] = useMemo(() => catalogos?.lotes.filter((lote) => String(lote.propriedadeId) === propriedadeId) ?? [], [catalogos, propriedadeId]);
  const sugestaoBezerreiro = useSugestaoBezerreiro(propriedadeId ? Number(propriedadeId) : undefined, true, lotesDoSitio);
  const categoriaPrevista = dataNascimento ? calcularCategoriaCliente(categorias, { sexo, dataNascimento, partosAntesDaEntrada: Number(partosAntesDaEntrada || 0), hoje: hoje() }) : null;
  const sugereBezerreiro = /^(bezerro|bezerra)$/i.test(categoriaPrevista?.nome.trim() ?? "");
  const unicoBezerreiro = sugestaoBezerreiro.perfis.length === 1 ? sugestaoBezerreiro.perfis[0].loteId : "";
  useEffect(() => {
    if (destinoManual || sugestaoBezerreiro.carregando) return;
    const destino = sugereBezerreiro && lotesDoSitio.some(l => l.id === unicoBezerreiro) ? unicoBezerreiro : "";
    if (!loteId || loteId === loteSugerido.current) { loteSugerido.current = destino; alterar({ loteId: destino }); }
  }, [destinoManual, sugereBezerreiro, unicoBezerreiro, sugestaoBezerreiro.carregando, lotesDoSitio, loteId]);
  const itensHerdados = herdada?.itens.map(({ racaId, fracao64 }) => ({ racaId, fracao64 })) ?? [];
  const limiteInformavel = 64 - somaFracoes(itensHerdados);
  const composicaoTotal = juntarComposicoes(itensHerdados, composicao);
  const somaComposicao = somaFracoes(composicao);
  const aguardandoDestino = (categoriasCarregando || sugereBezerreiro && (sugestaoBezerreiro.carregando || sugestaoBezerreiro.perfis.length > 1)) && !destinoManual && !loteId;

  const validar = (): ErrosCadastroAnimal => {
    const novosErros: ErrosCadastroAnimal = {};
    if (!form.brinco.trim()) novosErros.brinco = "Informe o brinco";
    else if (brincosReservados?.some((reservado) => reservado.trim().toLocaleUpperCase("pt-BR") === form.brinco.trim().toLocaleUpperCase("pt-BR"))) novosErros.brinco = `O brinco ${form.brinco.trim()} já está nesta operação`;
    if (!form.dataNascimento) novosErros.dataNascimento = "Informe a data de nascimento";
    if (!form.dataEntrada) novosErros.dataEntrada = "Informe a data de entrada";
    else if (form.dataNascimento && form.dataEntrada < form.dataNascimento) novosErros.dataEntrada = "Data de entrada não pode ser anterior ao nascimento";
    if (!propriedadeId) novosErros.propriedadeId = "Selecione o sítio";
    if (categoriasCarregando && !destinoManual) novosErros.loteId = "Aguarde a categoria ou escolha o lote manualmente.";
    else if (sugereBezerreiro && !destinoManual && sugestaoBezerreiro.carregando) novosErros.loteId = "Aguarde a sugestão ou escolha o lote manualmente.";
    else if (sugereBezerreiro && !destinoManual && sugestaoBezerreiro.perfis.length > 1 && !loteId) novosErros.loteId = "Escolha o lote de destino ou Sem lote.";
    if (composicao.some((item) => !item.racaId)) novosErros.composicao = "Selecione a raça em todas as linhas de composição";
    else if (!composicaoValida(composicao) || composicao.some(item => !Number.isInteger(item.fracao64)) || somaComposicao > limiteInformavel) novosErros.composicao = `A parcela informada não pode passar de ${limiteInformavel}/64 e cada raça só pode aparecer uma vez`;
    if (carregandoHerdanca || erroHerdanca) novosErros.composicao = erroHerdanca ?? "Aguarde o cálculo da composição pelos genitores";
    if (form.eccEntrada?.trim() && (!Number.isFinite(Number(form.eccEntrada.replace(",", "."))) || Number(form.eccEntrada.replace(",", ".")) < 1 || Number(form.eccEntrada.replace(",", ".")) > 5)) novosErros.eccEntrada = "Informe um ECC entre 1 e 5";
    if (genitorIncompleto(mae)) novosErros.mae = mensagemGenitorIncompleto("Mãe", "F");
    if (genitorIncompleto(pai)) novosErros.pai = mensagemGenitorIncompleto("Pai", "M");
    return novosErros;
  };

  /** Corpo do cadastro, sem origem nem sítio. */
  const montarPayload = (): AnimalPayload => ({
    brinco: form.brinco.trim(), nome: form.nome.trim() || null, brincoEletronico: form.brincoEletronico.trim() || null, sisbov: form.sisbov.trim() || null,
    sexo, dataNascimento, nascimentoEstimado: form.nascimentoEstimado, dataEntrada: form.dataEntrada, partosAntesDaEntrada: Number(partosAntesDaEntrada || 0),
    observacao: form.observacao.trim() || null, loteId: loteId || null,
    aptidao: form.aptidao, papelReprodutivo: form.papelReprodutivo, composicao: composicaoTotal,
    pesoEntradaKg: form.pesoEntradaKg ? Number(form.pesoEntradaKg) : null,
    ...(form.eccEntrada?.trim() ? { eccEntrada: Number(form.eccEntrada.replace(",", ".")) } : {}),
    ...valorGenitorParaCampos(mae, pai),
  });

  /** Texto curto da composição racial (parcela dos genitores + parcela informada) para o resumo. */
  const rotuloComposicao = (): string => {
    const siglas = new Map((catalogos?.racas ?? []).map((raca) => [raca.id, raca.sigla]));
    const partes = [
      herdada && somaFracoes(itensHerdados) > 0 ? herdada.rotulo : "",
      ...composicao.filter((item) => item.racaId && item.fracao64 > 0).map((item) => `${fracaoReduzida(item.fracao64)} ${siglas.get(item.racaId) ?? ""}`.trim()),
    ].filter(Boolean);
    return partes.join(" + ");
  };

  const irParaPrimeiroErro = (alvo: ErrosCadastroAnimal): boolean => {
    const encontrado = elementosDosCampos(prefixo, personalizado).find(([campo]) => alvo[campo]);
    if (!encontrado) return false;
    rolarParaCampo(encontrado[1]);
    return true;
  };

  return {
    prefixo, personalizado, sitioFixo, catalogos, erroCatalogos, erroCategorias, categoriasCarregando,
    form, alterar, resetarForm: setForm, alterarSexo, propriedadeId, alterarPropriedade,
    herdada, carregandoHerdanca, erroHerdanca, tentarHerdanca: () => setRevisaoHerdanca(v => v + 1), itensHerdados, limiteInformavel,
    lotesDoSitio, sugestaoBezerreiro, sugereBezerreiro, aguardandoDestino, categoriaPrevista,
    erros, setErros, validar, montarPayload, rotuloComposicao, irParaPrimeiroErro,
  };
}

export type CadastroAnimal = ReturnType<typeof useCadastroAnimal>;

function TituloSecao({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">{icone}{children}</h3>;
}

/** Seções do cadastro: Identificação, Datas e filiação, Localização e finalidade, Composição racial,
 *  Peso de entrada e Observação. Não inclui formulário, erro geral nem botões — são de quem o abriga. */
export function CadastroAnimalCampos({ cadastro }: { cadastro: CadastroAnimal }) {
  const { prefixo, personalizado, sitioFixo, catalogos, erros, form, alterar } = cadastro;
  const [editandoComposicao, setEditandoComposicao] = useState(false);
  if (!catalogos) return null;
  const id = (sufixo: string) => `${prefixo}-${sufixo}`;
  const { sexo } = form;
  const hojeIso = hoje();
  const composicaoInvalida = form.composicao.some(item => !item.racaId) || !composicaoValida(form.composicao) || form.composicao.some(item => !Number.isInteger(item.fracao64)) || somaFracoes(form.composicao) > cadastro.limiteInformavel;

  return <>
    <section>
      <TituloSecao icone={<Tag size={20} className="text-primary" aria-hidden/>}>Identificação</TituloSecao>
      <div className="cadastro-animal-identificacao grid gap-4 md:grid-cols-6">
        <CampoFormulario id={id("brinco")} rotulo="Brinco" obrigatorio erro={erros.brinco}>{(p) => <input {...p} required maxLength={40} value={form.brinco} onChange={(e) => alterar({ brinco: e.target.value })} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id={id("nome")} rotulo="Nome">{(p) => <input {...p} maxLength={120} value={form.nome} onChange={(e) => alterar({ nome: e.target.value })} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id={id("sexo")} rotulo="Sexo" obrigatorio>{(p) => <SelectCampo {...p} value={sexo} onValueChange={(valorSelecionado) => cadastro.alterarSexo(valorSelecionado as Sexo)} className={classeInput}><option value="F">Fêmea</option><option value="M">Macho</option></SelectCampo>}</CampoFormulario>
        <CampoFormulario id={id("brinco-eletronico")} rotulo="Brinco eletrônico">{(p) => <input {...p} maxLength={40} value={form.brincoEletronico} onChange={(e) => alterar({ brincoEletronico: e.target.value })} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id={id("sisbov")} rotulo="SISBOV">{(p) => <input {...p} maxLength={40} value={form.sisbov} onChange={(e) => alterar({ sisbov: e.target.value })} className={classeInput} />}</CampoFormulario>
      </div>
    </section>
    <section>
      <TituloSecao icone={<CalendarDays size={20} className="text-primary" aria-hidden/>}>Datas</TituloSecao>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div><CampoFormulario id={id("data-nascimento")} rotulo="Data de nascimento" obrigatorio erro={erros.dataNascimento}>{(p) => <DatePicker {...p} required max={hojeIso} value={form.dataNascimento} onChange={(valor) => alterar({ dataNascimento: valor })} className="mt-1.5" />}</CampoFormulario>
          <label className="mt-2 flex items-center gap-2 text-sm"><input id={id("nascimento-estimado")} type="checkbox" checked={form.nascimentoEstimado} onChange={(e) => alterar({ nascimentoEstimado: e.target.checked })} />Nascimento estimado <AjudaCampo rotulo="Ajuda: Nascimento estimado" texto="Marque quando a data de nascimento for aproximada." /></label>
        </div>
        <CampoFormulario id={id("data-entrada")} rotulo="Data de entrada" obrigatorio erro={erros.dataEntrada}>{(p) => <DatePicker {...p} required max={hojeIso} value={form.dataEntrada} onChange={(valor) => alterar({ dataEntrada: valor })} className="mt-1.5" />}</CampoFormulario>
        {sexo === "F" && <CampoFormulario id={id("partos")} rotulo="Partos antes da entrada" ajuda="Define a categoria (novilha vira vaca a partir de 1 parto).">{(p) => <input {...p} type="number" min={0} step={1} value={form.partosAntesDaEntrada} onChange={(e) => alterar({ partosAntesDaEntrada: e.target.value })} className={classeInput} />}</CampoFormulario>}
      </div>
    </section>
    <section>
      <TituloSecao icone={<Dna size={20} className="text-primary" aria-hidden/>}>Genética</TituloSecao>
      <div className="grid gap-2">
        <CampoGenitor rotulo="Mãe" sexo="F" valor={form.mae} onChange={(valor) => alterar({ mae: valor })} erro={erros.mae} idBase={personalizado ? id("genitor") : undefined} propriedadeId={cadastro.propriedadeId ? Number(cadastro.propriedadeId) : undefined} compacto />
        <CampoGenitor rotulo="Pai" sexo="M" valor={form.pai} onChange={(valor) => alterar({ pai: valor })} erro={erros.pai} idBase={personalizado ? id("genitor") : undefined} propriedadeId={cadastro.propriedadeId ? Number(cadastro.propriedadeId) : undefined} compacto />
      </div>
    <div id={id("composicao-secao")} tabIndex={-1} className="mt-5 border-t border-border pt-5 outline-none">
      <div className="flex flex-wrap items-center justify-between gap-2"><TituloSecao icone={<Dna size={20} className="text-primary" aria-hidden/>}>Composição racial</TituloSecao>{!cadastro.carregandoHerdanca && !cadastro.erroHerdanca && cadastro.limiteInformavel > 0 && !genitorIncompleto(form.mae) && !genitorIncompleto(form.pai) && !!form.dataNascimento && <button type="button" aria-expanded={editandoComposicao} className="min-h-11 text-sm font-semibold text-mast" onClick={() => setEditandoComposicao(v => !v)}>{editandoComposicao ? "Fechar edição" : "Editar composição"}</button>}</div>
      {cadastro.carregandoHerdanca ? <p role="status">Calculando a parcela herdada…</p> : cadastro.erroHerdanca ? <div role="alert" className="text-destructive">Não foi possível calcular a composição: {cadastro.erroHerdanca} <button type="button" className="font-semibold underline" onClick={cadastro.tentarHerdanca}>Tentar novamente</button></div> : genitorIncompleto(form.mae) || genitorIncompleto(form.pai) || !form.dataNascimento ? <p role="status">Complete os genitores e a data de nascimento para calcular a composição.</p> : composicaoInvalida ? <p role="status">Complete ou corrija as linhas para calcular o resumo da composição.</p> : <>
        <div className="flex flex-wrap justify-between gap-2 text-sm" aria-label="Resumo da composição racial">
          <span>{64 - cadastro.limiteInformavel}/64 calculados pela filiação{cadastro.herdada?.rotulo ? ` · ${cadastro.herdada.rotulo}` : ""}</span>
          <span>{somaFracoes(form.composicao)}/64 informados</span>
          <span>{Math.max(0, cadastro.limiteInformavel - somaFracoes(form.composicao))}/64 sem informação</span>
        </div>
        <div aria-hidden="true" className="my-3 flex h-3 overflow-hidden rounded-full bg-gray-300">
          <span className="bg-teal-700" style={{ width: `${(64 - cadastro.limiteInformavel) / 64 * 100}%` }} />
          <span className="bg-teal-300" style={{ width: `${Math.min(cadastro.limiteInformavel, somaFracoes(form.composicao)) / 64 * 100}%` }} />
        </div>
      </>}
      {editandoComposicao && !cadastro.carregandoHerdanca && !cadastro.erroHerdanca && !genitorIncompleto(form.mae) && !genitorIncompleto(form.pai) && !!form.dataNascimento && cadastro.limiteInformavel > 0 && <CampoComposicao racas={catalogos.racas} itens={form.composicao} onChange={(itens) => alterar({ composicao: itens })} limite64={cadastro.limiteInformavel} idBase={personalizado ? id("composicao") : undefined} />}
      {!cadastro.carregandoHerdanca && !cadastro.erroHerdanca && cadastro.limiteInformavel === 0 && form.composicao.length > 0 && <div className="space-y-2"><p className="text-sm">A filiação calculada ocupa toda a composição. Remova a parcela informada para continuar.</p><button type="button" className="text-sm font-semibold text-mast underline" onClick={() => { alterar({ composicao: [] }); cadastro.setErros(atual => { const restantes = { ...atual }; delete restantes.composicao; return restantes; }); }}>Remover parcela informada</button></div>}
      {erros.composicao && <p role="alert" className="text-sm text-destructive">{erros.composicao}</p>}
    </div>
    </section>
    <section>
      <TituloSecao icone={<MapPin size={20} className="text-primary" aria-hidden/>}>Localização e finalidade</TituloSecao>
      <div className="grid gap-4 md:grid-cols-2">
        {sitioFixo
          ? <CampoFormulario id={id("propriedade")} rotulo="Sítio" obrigatorio>{(p) => <SelectCampo {...p} disabled value={String(sitioFixo.id)} className={classeInput}><option value={String(sitioFixo.id)}>{sitioFixo.nome}</option></SelectCampo>}</CampoFormulario>
          : <CampoFormulario id={id("propriedade")} rotulo="Sítio" obrigatorio erro={erros.propriedadeId}>{(p) => <SelectCampo {...p} required value={cadastro.propriedadeId} onValueChange={(valorSelecionado) => cadastro.alterarPropriedade(valorSelecionado)} className={classeInput}><option value="">Selecione</option>{catalogos.propriedades.map((prop) => <option key={prop.id} value={prop.id}>{prop.nome}</option>)}</SelectCampo>}</CampoFormulario>}
        <CampoFormulario id={id("lote")} rotulo="Lote" erro={erros.loteId} ajuda={!cadastro.propriedadeId ? "Selecione o sítio para escolher o lote." : undefined}>{(p) => <SelectCampo {...p} disabled={!cadastro.propriedadeId} value={cadastro.aguardandoDestino ? "__escolher__" : form.loteId || "__sem_lote__"} onValueChange={(valorSelecionado) => { if (!valorSelecionado) return; alterar({ destinoManual: true, loteId: valorSelecionado === "__sem_lote__" ? "" : valorSelecionado }); }} className={classeInput}>{cadastro.aguardandoDestino && <option value="__escolher__" disabled>Escolha o lote de destino</option>}<option value="__sem_lote__">Sem lote</option>{cadastro.lotesDoSitio.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}</SelectCampo>}</CampoFormulario>
        <CampoFormulario id={id("aptidao")} rotulo="Finalidade" obrigatorio>{(p) => <SelectCampo {...p} required value={form.aptidao} onValueChange={(valorSelecionado) => alterar({ aptidao: valorSelecionado as Aptidao })} className={classeInput}><option value="LEITE">Leite</option><option value="CORTE">Corte</option><option value="REPRODUCAO">Reprodução</option></SelectCampo>}</CampoFormulario>
        {sexo === "F" && <CampoFormulario id={id("papel")} rotulo="Papel reprodutivo" ajuda="Indica se a fêmea atua como doadora ou receptora; é independente da finalidade.">{(p) => <SelectCampo {...p} value={form.papelReprodutivo} onValueChange={(valorSelecionado) => alterar({ papelReprodutivo: valorSelecionado as PapelReprodutivo })} className={classeInput}><option value="NENHUM">Nenhum</option><option value="RECEPTORA">Receptora</option><option value="DOADORA">Doadora</option></SelectCampo>}</CampoFormulario>}
      </div>
      {cadastro.erroCategorias && <p role="alert" className="text-sm text-ink-3">{cadastro.erroCategorias}</p>}
      <AjudaDestinoBezerreiro sugestao={cadastro.sugestaoBezerreiro} loteId={form.loteId} elegivel={cadastro.sugereBezerreiro}/>
    </section>
    <section className="grid gap-4 md:grid-cols-2">
      <CampoFormulario id={id("peso")} rotulo="Peso de entrada (kg)" ajuda="Peso medido na entrada da fazenda; é independente do peso pago na compra.">{(p) => <input {...p} type="number" min="0.01" step="0.01" className={classeInput} value={form.pesoEntradaKg} onChange={(e) => alterar({ pesoEntradaKg: e.target.value })} />}</CampoFormulario>
      <CampoFormulario id={id("ecc")} rotulo="Escore de condição corporal (ECC) opcional" erro={erros.eccEntrada}>{(p) => <input {...p} inputMode="decimal" placeholder="1 a 5" className={classeInput} value={form.eccEntrada ?? ""} onChange={e => alterar({ eccEntrada: e.target.value })} />}</CampoFormulario>
    </section>
    <section>
    <CampoFormulario id={id("observacao")} rotulo="Observação">{(p) => <textarea {...p} maxLength={500} className={classeInput} value={form.observacao} onChange={(e) => alterar({ observacao: e.target.value })} />}</CampoFormulario>
    </section>
  </>;
}

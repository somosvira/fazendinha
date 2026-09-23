// Cadastro de animal — página cheia no layout de FormOperacao.tsx: form em
// card + aside de revisão escuro. POST /pecuaria/rebanho/animais.

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { cadastrarAnimal, obterCatalogos, RebanhoApiError } from "../api";
import type { Aptidao, CatalogoLote, Catalogos, ComposicaoItemInput, Origem, PapelReprodutivo, Sexo } from "../types";
import { calcularCategoriaCliente } from "../lib/categoria";
import { rotuloAptidao, rotuloCategoria, rotuloPapelReprodutivo } from "../lib/rotulos";
import { somaFracoes } from "../lib/composicao";
import { CampoComposicao } from "../ui";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { navegarPara } from "../../../router";
import { Button, ErrorBox, hoje, PaginaCarregando, ReviewLine } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput } from "../../../financeiro/PainelCadastro";
import { NavRebanho } from "./NavRebanho";

type Erros = Record<string, string>;

export function NovoAnimal({ onVoltar }: { onVoltar: () => void }) {
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [erroCatalogos, setErroCatalogos] = useState<string | null>(null);

  const [brinco, setBrinco] = useState("");
  const [nome, setNome] = useState("");
  const [brincoEletronico, setBrincoEletronico] = useState("");
  const [sisbov, setSisbov] = useState("");
  const [sexo, setSexo] = useState<Sexo>("F");
  const [origem, setOrigem] = useState<Origem>("NASCIDO");
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
  const [pesoEntradaKg, setPesoEntradaKg] = useState("");

  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { obterCatalogos().then(setCatalogos).catch((e) => setErroCatalogos(e instanceof Error ? e.message : String(e))); }, []);

  const alterarOrigem = (novaOrigem: Origem) => { setOrigem(novaOrigem); if (novaOrigem === "NASCIDO") setDataEntrada(dataNascimento); };
  const alterarDataNascimento = (valor: string) => { setDataNascimento(valor); if (origem === "NASCIDO") setDataEntrada(valor); };
  const alterarPropriedade = (valor: string) => { setPropriedadeId(valor); setLoteId(""); };

  const lotesDoSitio: CatalogoLote[] = useMemo(() => catalogos?.lotes.filter((lote) => String(lote.propriedadeId) === propriedadeId) ?? [], [catalogos, propriedadeId]);
  const propriedadeNome = catalogos?.propriedades.find((p) => String(p.id) === propriedadeId)?.nome;
  const loteNome = lotesDoSitio.find((l) => l.id === loteId)?.nome;
  const categoriaPrevista = dataNascimento ? calcularCategoriaCliente({ sexo, dataNascimento, partosAntesDaEntrada: Number(partosAntesDaEntrada || 0), hoje: hoje() }) : null;
  const somaComposicao = somaFracoes(composicao);
  const composicaoRotulo = composicao
    .filter((item) => item.racaId)
    .map((item) => `${catalogos?.racas.find((r) => r.id === item.racaId)?.sigla ?? "?"} ${item.fracao64}/64`)
    .join(" · ");

  const validar = (): Erros => {
    const novosErros: Erros = {};
    if (!brinco.trim()) novosErros.brinco = "Informe o brinco";
    if (!dataNascimento) novosErros.dataNascimento = "Informe a data de nascimento";
    if (!dataEntrada) novosErros.dataEntrada = "Informe a data de entrada";
    else if (dataNascimento && dataEntrada < dataNascimento) novosErros.dataEntrada = "Data de entrada não pode ser anterior ao nascimento";
    else if (origem === "NASCIDO" && dataEntrada !== dataNascimento) novosErros.dataEntrada = "Animal nascido na propriedade deve ter entrada igual ao nascimento";
    if (!propriedadeId) novosErros.propriedadeId = "Selecione o sítio";
    if (composicao.some((item) => !item.racaId)) novosErros.composicao = "Selecione a raça em todas as linhas de composição";
    else if (somaComposicao > 64) novosErros.composicao = "A soma das frações não pode passar de 64";
    return novosErros;
  };

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    const validacao = validar();
    setErros(validacao);
    if (Object.keys(validacao).length) return;
    setSalvando(true); setErroGeral(null);
    try {
      const animal = await cadastrarAnimal({
        brinco: brinco.trim(), nome: nome.trim() || null, brincoEletronico: brincoEletronico.trim() || null, sisbov: sisbov.trim() || null,
        sexo, dataNascimento, nascimentoEstimado, origem, dataEntrada, partosAntesDaEntrada: Number(partosAntesDaEntrada || 0),
        observacao: observacao.trim() || null, propriedadeId: Number(propriedadeId), loteId: loteId || null,
        aptidao, papelReprodutivo, composicao: composicao.filter((item) => item.racaId),
        pesoEntradaKg: pesoEntradaKg ? Number(pesoEntradaKg) : null,
      });
      navegarPara(`/pecuaria/rebanho/animais/${animal.id}`);
    } catch (falha) {
      if (falha instanceof RebanhoApiError && falha.campo) setErros({ [falha.campo]: falha.message });
      const mensagem = falha instanceof RebanhoApiError ? falha.message : falha instanceof Error ? falha.message : String(falha);
      setErroGeral(mensagem);
    } finally { setSalvando(false); }
  };

  if (!catalogos && !erroCatalogos) return <PaginaCarregando label="Carregando cadastro" />;

  return <div className="shell-wide pb-10">
    <div className="mb-5 flex min-h-[82px] flex-wrap items-center justify-between gap-4 border-b border-border pb-5 pt-3">
      <div><div className="eyebrow">Pecuária</div><h1 className="mt-1 font-serif text-3xl text-ink md:text-4xl">Novo animal</h1></div>
      <Button secondary onClick={onVoltar} disabled={salvando}>Cancelar</Button>
    </div>
    <NavRebanho ativa="animais" />
    <ErrorBox erro={erroCatalogos} />
    {catalogos && <form onSubmit={submeter} noValidate className="mt-6 grid overflow-hidden rounded-xl border border-border bg-white xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-7 p-5 md:p-7 xl:min-h-0 xl:overflow-y-auto">
        <ErrorBox erro={erroGeral} />
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Identificação</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CampoFormulario id="novo-animal-brinco" rotulo="Brinco" obrigatorio erro={erros.brinco}>{(p) => <input {...p} required maxLength={40} value={brinco} onChange={(e) => setBrinco(e.target.value)} className={classeInput} />}</CampoFormulario>
            <CampoFormulario id="novo-animal-nome" rotulo="Nome">{(p) => <input {...p} maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} className={classeInput} />}</CampoFormulario>
            <CampoFormulario id="novo-animal-sexo" rotulo="Sexo" obrigatorio>{(p) => <select {...p} value={sexo} onChange={(e) => setSexo(e.target.value as Sexo)} className={classeInput}><option value="F">Fêmea</option><option value="M">Macho</option></select>}</CampoFormulario>
            <CampoFormulario id="novo-animal-brinco-eletronico" rotulo="Brinco eletrônico">{(p) => <input {...p} maxLength={40} value={brincoEletronico} onChange={(e) => setBrincoEletronico(e.target.value)} className={classeInput} />}</CampoFormulario>
            <CampoFormulario id="novo-animal-sisbov" rotulo="SISBOV">{(p) => <input {...p} maxLength={40} value={sisbov} onChange={(e) => setSisbov(e.target.value)} className={classeInput} />}</CampoFormulario>
          </div>
        </section>
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Origem e datas</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CampoFormulario id="novo-animal-origem" rotulo="Origem" obrigatorio>{(p) => <select {...p} value={origem} onChange={(e) => alterarOrigem(e.target.value as Origem)} className={classeInput}><option value="NASCIDO">Nascido na propriedade</option><option value="COMPRADO">Comprado</option></select>}</CampoFormulario>
            <CampoFormulario id="novo-animal-data-nascimento" rotulo="Data de nascimento" obrigatorio erro={erros.dataNascimento}>{(p) => <input {...p} required type="date" max={hoje()} value={dataNascimento} onChange={(e) => alterarDataNascimento(e.target.value)} className={classeInput} />}</CampoFormulario>
            <CampoFormulario id="novo-animal-data-entrada" rotulo="Data de entrada" obrigatorio erro={erros.dataEntrada}>{(p) => <input {...p} required type="date" max={hoje()} disabled={origem === "NASCIDO"} value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} className={classeInput} />}</CampoFormulario>
            <CampoFormulario id="novo-animal-nascimento-estimado" rotulo="Nascimento estimado">{(p) => <label className="mt-1.5 flex h-[42px] items-center gap-2"><input id={p.id} type="checkbox" aria-label={p["aria-label"]} checked={nascimentoEstimado} onChange={(e) => setNascimentoEstimado(e.target.checked)} /><span className="text-sm font-normal text-ink-3">A data é uma estimativa</span></label>}</CampoFormulario>
            {sexo === "F" && <CampoFormulario id="novo-animal-partos" rotulo="Partos antes da entrada" ajuda="Define a categoria (novilha vira vaca a partir de 1 parto).">{(p) => <input {...p} type="number" min={0} step={1} value={partosAntesDaEntrada} onChange={(e) => setPartosAntesDaEntrada(e.target.value)} className={classeInput} />}</CampoFormulario>}
          </div>
        </section>
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Localização e destino</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <CampoFormulario id="novo-animal-propriedade" rotulo="Sítio" obrigatorio erro={erros.propriedadeId}>{(p) => <select {...p} required value={propriedadeId} onChange={(e) => alterarPropriedade(e.target.value)} className={classeInput}><option value="">Selecione</option>{catalogos.propriedades.map((prop) => <option key={prop.id} value={prop.id}>{prop.apelido ?? prop.nome}</option>)}</select>}</CampoFormulario>
            <CampoFormulario id="novo-animal-lote" rotulo="Lote" ajuda={!propriedadeId ? "Selecione o sítio para escolher o lote." : undefined}>{(p) => <select {...p} disabled={!propriedadeId} value={loteId} onChange={(e) => setLoteId(e.target.value)} className={classeInput}><option value="">Sem lote</option>{lotesDoSitio.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}</select>}</CampoFormulario>
            <CampoFormulario id="novo-animal-aptidao" rotulo="Aptidão" obrigatorio>{(p) => <select {...p} required value={aptidao} onChange={(e) => setAptidao(e.target.value as Aptidao)} className={classeInput}><option value="LEITE">Leite</option><option value="CORTE">Corte</option></select>}</CampoFormulario>
            {sexo === "F" && <CampoFormulario id="novo-animal-papel" rotulo="Papel reprodutivo">{(p) => <select {...p} value={papelReprodutivo} onChange={(e) => setPapelReprodutivo(e.target.value as PapelReprodutivo)} className={classeInput}><option value="NENHUM">Nenhum</option><option value="RECEPTORA">Receptora</option><option value="DOADORA">Doadora</option></select>}</CampoFormulario>}
          </div>
        </section>
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Composição racial</h3>
          <CampoComposicao racas={catalogos.racas} itens={composicao} onChange={setComposicao} erro={erros.composicao} />
        </section>
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Peso de entrada</h3>
          <CampoFormulario id="novo-animal-peso" rotulo="Peso de entrada (kg)" ajuda="Opcional — registra a primeira pesagem do animal.">{(p) => <input {...p} type="number" min="0.01" step="0.01" className={`${classeInput} max-w-xs`} value={pesoEntradaKg} onChange={(e) => setPesoEntradaKg(e.target.value)} />}</CampoFormulario>
        </section>
        <CampoFormulario id="novo-animal-observacao" rotulo="Observação">{(p) => <textarea {...p} maxLength={500} className={classeInput} value={observacao} onChange={(e) => setObservacao(e.target.value)} />}</CampoFormulario>
      </div>
      <aside className="flex h-full flex-col border-t border-border bg-[#1f2b21] p-6 text-white xl:border-l xl:border-t-0">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#aeb9aa]">Revisão do cadastro</div>
          <div className="mt-3 font-serif text-3xl">{brinco.trim() || "Sem brinco"}</div>
          <div className="mt-5 space-y-3 text-sm leading-5">
            {categoriaPrevista && <ReviewLine>Categoria calculada: {rotuloCategoria(categoriaPrevista)}.</ReviewLine>}
            <ReviewLine tone={propriedadeNome ? "green" : "neutral"}>{propriedadeNome ? <>Entra no sítio {propriedadeNome}{loteNome ? `, lote ${loteNome}` : ""}.</> : "Selecione o sítio de destino."}</ReviewLine>
            <ReviewLine>Destino: {rotuloAptidao(aptidao)}{papelReprodutivo !== "NENHUM" ? ` · ${rotuloPapelReprodutivo(papelReprodutivo)}` : ""}.</ReviewLine>
            <ReviewLine tone={composicaoRotulo ? "brown" : "neutral"}>{composicaoRotulo ? <>Composição: {composicaoRotulo}.</> : "Sem composição racial informada."}</ReviewLine>
            {pesoEntradaKg && <ReviewLine>Peso de entrada: {Number(pesoEntradaKg).toLocaleString("pt-BR")} kg.</ReviewLine>}
          </div>
        </div>
        <div className="mt-auto border-t border-white/10 pt-5">
          <Button type="submit" disabled={salvando} className="w-full !bg-[#e9e3d2] !text-[#1f2b21]">{salvando ? "Salvando…" : "Salvar animal"}</Button>
        </div>
      </aside>
    </form>}
  </div>;
}

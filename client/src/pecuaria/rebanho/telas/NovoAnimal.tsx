import { registrarGuardaNavegacao } from "../../../navegacaoGuardada";
import { ModalCadastroAnimal } from "../forms/ModalCadastroAnimal";
// Cadastro de animal — página cheia no layout de FormOperacao.tsx: form em
// card + resumo de revisão à direita. POST /pecuaria/rebanho/animais.
// Os campos e a validação vêm de forms/CadastroAnimal.tsx, o mesmo cadastro que a compra de animais
// abre em modal: assim os dois nunca divergem.

import { Save } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { cadastrarAnimal, RebanhoApiError } from "../api";
import type { Origem } from "../types";
import { CadastroAnimalCampos, useCadastroAnimal } from "../forms/CadastroAnimal";
import { rolarParaCampo } from "../ui";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { navegarPara } from "../../../router";
import { linkFichaAnimal, retornoRebanhoDaUrl } from "../lib/navegacao";
import { Button, ErrorBox, PageHeader, PaginaFinanceira } from "../../../financeiro/financeiro-ui";
import { useToast } from "../../../components/Toast";
import { EsqueletoFormulario } from "../../../components/Esqueleto";

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
  const origem: Origem = "COMPRADO";
  const cadastro = useCadastroAnimal({ propriedadeInicial: (() => { const ativa = getPropriedadeAtiva(); return ativa != null ? String(ativa) : ""; })() });
  const { catalogos, erroCatalogos, categoriaPrevista, setErros } = cadastro;
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const envio = useRef(false);
  useEffect(() => registrarGuardaNavegacao(async () => !envio.current), []);
  useEffect(() => {
    const url = window.location.href;
    const estado = window.history.state;
    const impedirSaida = (evento: PopStateEvent) => {
      if (!envio.current) return;
      evento.stopImmediatePropagation();
      const visitada = window.location.pathname + window.location.search + window.location.hash;
      const retorno = new URL(url).searchParams.get("retorno");
      window.history.pushState(estado?.cadastroAnimalOrigem === retorno && visitada === retorno ? estado : null, "", url);
    };
    window.addEventListener("popstate", impedirSaida, true);
    return () => window.removeEventListener("popstate", impedirSaida, true);
  }, []);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (envio.current) return;
    const validacao = cadastro.validar();
    setErros(validacao);
    if (Object.keys(validacao).length) { cadastro.irParaPrimeiroErro(validacao); return; }
    envio.current = true; setSalvando(true); setErroGeral(null);
    try {
      const animal = await cadastrarAnimal({ ...cadastro.montarPayload(), origem, propriedadeId: Number(cadastro.propriedadeId) });
      if (animal.avisos?.length) toast.warn("Animal salvo com aviso", animal.avisos.map((aviso) => aviso.mensagem).join(" · "));
      envio.current = false;
      navegarPara(linkFichaAnimal(animal.id, retornoRebanhoDaUrl()));
    } catch (falha) {
      const mensagem = falha instanceof RebanhoApiError ? falha.message : falha instanceof Error ? falha.message : String(falha);
      // erro de um campo que está na tela: mensagem junto dele e o usuário é levado até lá;
      // senão, a caixa de erro no topo do formulário (rolando até ela)
      const doCampo = falha instanceof RebanhoApiError && falha.campo ? { [falha.campo]: mensagem } : {};
      setErros(doCampo);
      if (!cadastro.irParaPrimeiroErro(doCampo)) { setErroGeral(mensagem); rolarParaCampo("novo-animal-erro"); }
    } finally { envio.current = false; setSalvando(false); }
  };

  return <ModalCadastroAnimal titulo="Novo animal" contexto="Rebanho" onFechar={onVoltar} salvando={salvando} rodape={<div className="flex flex-wrap items-center justify-end gap-3">
    {categoriaPrevista && <span className="mr-auto text-sm">Categoria prevista: <strong>{categoriaPrevista.nome}</strong></span>}
    <Button secondary type="button" onClick={onVoltar} disabled={salvando}>Cancelar</Button>
    <Button type="submit" form="form-novo-animal" disabled={salvando || !catalogos}><Save size={18} aria-hidden/>{salvando ? "Salvando…" : "Salvar animal"}</Button>
  </div>}>
    <form id="form-novo-animal" onSubmit={submeter} noValidate className="space-y-7 p-5 sm:p-6 [&>section+section]:border-t [&>section+section]:border-border [&>section+section]:pt-5">
      <ErrorBox erro={erroCatalogos} />
      {!catalogos && !erroCatalogos && <EsqueletoFormulario label="Carregando cadastro" campos={8} />}
      <div id="novo-animal-erro" tabIndex={-1} className="outline-none"><ErrorBox erro={erroGeral} /></div>
      <CadastroAnimalCampos cadastro={cadastro} />
    </form>
  </ModalCadastroAnimal>;
}

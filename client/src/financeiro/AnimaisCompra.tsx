// Seção "Animais" da compra de animais (FormOperacao.tsx). O cadastro de cada animal é o MESMO da
// página Novo animal (pecuaria/rebanho/forms/CadastroAnimal.tsx), aberto em modal: ao confirmar, o
// animal vira uma linha de resumo na operação, com os campos financeiros do item. A operação só
// cadastra o animal no Rebanho quando é confirmada — aqui nada chama a API de cadastro.
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button as UiButton } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EsqueletoFormulario } from "../components/Esqueleto";
import { CadastroAnimalCampos, useCadastroAnimal, type AnimalPayload, type FormAnimal, type SitioFixo } from "../pecuaria/rebanho/forms/CadastroAnimal";
import type { Aptidao, Sexo } from "../pecuaria/rebanho/types";
import { CAMPO, CampoErro, SELECT } from "./CamposOperacao";
import { DialogFinanceiro } from "./DialogFinanceiro";
import { brl, Button, Empty, ErrorBox } from "./financeiro-ui";
import { SelectCampo } from "./SelectCampo";
import type { ConfiguracoesFinanceiras } from "./novo-api";
import { precoMedioDoLote, ROTULO_UNIDADE_PRECO, type UnidadePrecoAnimal, type ValorItemAnimal } from "./lib/compra-animais";

export const PREFIXO_ANIMAL_COMPRA = "animal-compra";

/** Animal já confirmado no modal, com os campos financeiros do item da compra. */
export type AnimalCompraForm = {
  id: number;
  /** Tudo o que foi preenchido no cadastro — reabre o modal para editar. */
  cadastro: FormAnimal;
  /** Corpo do cadastro enviado em `itens[].animal`. */
  payload: AnimalPayload;
  /** A data de entrada acompanha a data da operação enquanto o usuário não a muda no cadastro. */
  entradaSegueOperacao: boolean;
  resumo: { brinco: string; nome: string | null; sexo: Sexo; composicao: string; aptidao: Aptidao; pesoEntradaKg: number | null };
  pesoPago: string;
  preco: string;
  categoriaId: string;
  centroCustoId: string;
  elegivelDesconto?: boolean;
};

export type ErroAnimalApi = { campo: string; mensagem: string };

const ROTULO_SEXO: Record<Sexo, string> = { F: "Fêmea", M: "Macho" };
const ROTULO_APTIDAO: Record<Aptidao, string> = { LEITE: "Leite", CORTE: "Corte", REPRODUCAO: "Reprodução" };
const UNIDADES: UnidadePrecoAnimal[] = ["CABECA", "KG", "ARROBA", "LOTE"];
const UNIDADE_PRECO_CURTA: Record<Exclude<UnidadePrecoAnimal, "LOTE">, string> = { CABECA: "cabeça", KG: "kg", ARROBA: "arroba" };

export const fmtKg = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`;

/** O que falta no preço de um animal (vazio quando está completo). */
export function pendenciaPrecoAnimal(unidade: UnidadePrecoAnimal, animal: Pick<AnimalCompraForm, "pesoPago" | "preco">, valor: ValorItemAnimal | null): string {
  if (unidade === "LOTE") return valor ? valor.centavos > 0 ? "" : "O valor do lote é pequeno demais para dividir entre os animais." : "Informe o valor total do lote.";
  if (unidade !== "CABECA" && !(Number(animal.pesoPago) > 0)) return "Informe o peso pago deste animal.";
  if (!valor || animal.preco.trim() === "") return "Informe o preço deste animal.";
  return valor.centavos > 0 ? "" : "O valor deste animal precisa ser maior que zero.";
}

export function SecaoAnimais({
  animais, valores, unidade, onUnidade, valorLote, onValorLote, sitio, motivoSemSitio, dataOperacao, config, porItem, centroCustoOperacao,
  campoInvalido, limparCampoInvalido, erros, onAdicionar, onSalvar, onAtualizar, onRemover,
}: {
  animais: AnimalCompraForm[];
  valores: (ValorItemAnimal | null)[];
  unidade: UnidadePrecoAnimal;
  onUnidade: (unidade: UnidadePrecoAnimal) => void;
  valorLote: string;
  onValorLote: (valor: string) => void;
  /** Sítio da operação; `null` enquanto não dá para definir (ver `motivoSemSitio`). */
  sitio: SitioFixo | null;
  motivoSemSitio: string;
  dataOperacao: string;
  config: ConfiguracoesFinanceiras;
  porItem: boolean;
  centroCustoOperacao: string;
  campoInvalido: string | null;
  limparCampoInvalido: (campo: string) => void;
  /** Recusas da API por animal (índice do animal na lista). */
  erros: Record<number, ErroAnimalApi>;
  onAdicionar: (animal: Omit<AnimalCompraForm, "id">) => void;
  /** Substitui o cadastro de um animal já resumido, mantendo seus campos financeiros. */
  onSalvar: (id: number, cadastro: Pick<AnimalCompraForm, "cadastro" | "payload" | "entradaSegueOperacao" | "resumo">) => void;
  onAtualizar: (id: number, patch: Partial<AnimalCompraForm>) => void;
  onRemover: (id: number) => void;
}) {
  const [modal, setModal] = useState<{ id: number | null; erro?: ErroAnimalApi } | null>(null);
  const emEdicao = modal?.id != null ? animais.find((animal) => animal.id === modal.id) ?? null : null;
  const total = valores.reduce((soma, valor) => soma + (valor?.centavos ?? 0), 0);
  const lote = unidade === "LOTE";
  const erroSecao = campoInvalido === "animais";
  const erroLote = campoInvalido === "valorLote";
  const ultimo = animais.at(-1);
  const valorLoteNumero = Number(valorLote);
  const precoMedio = lote && animais.length && valorLoteNumero > 0 ? precoMedioDoLote(Math.round(valorLoteNumero * 100), animais.length) : null;

  return <section id="secao-animais" tabIndex={-1} className="outline-none">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="mb-1 flex items-center gap-3 text-sm font-semibold text-ink">Animais</h3>
        <p className="max-w-xl text-xs text-ink-3">Cada animal é cadastrado no Rebanho quando a compra é confirmada. Nada é cadastrado antes disso.</p>
      </div>
      <Button type="button" secondary disabled={!sitio} onClick={() => setModal({ id: null })}><Plus size={15} /> Adicionar animal</Button>
    </div>
    {!sitio && <p role="status" className="mb-4 rounded-lg border border-border bg-muted p-3 text-sm text-[var(--warn)]">{motivoSemSitio}</p>}

    <RadioGroup value={unidade} onValueChange={(valor) => onUnidade(valor as UnidadePrecoAnimal)} aria-label="Unidade de preço dos animais" className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
      <span className="text-ink-3">Preço:</span>
      {UNIDADES.map((opcao) => <label key={opcao} className="flex items-center gap-1.5"><RadioGroupItem value={opcao} /> {ROTULO_UNIDADE_PRECO[opcao]}</label>)}
    </RadioGroup>
    <p className="mb-4 text-xs text-ink-3">{lote ? "O valor do lote é dividido igualmente entre os animais; os centavos que sobram ficam no último." : "Trocar a unidade limpa os preços já digitados."}</p>

    {lote && <div className="mb-4 flex flex-wrap items-end gap-4">
      <label className="block w-full max-w-xs text-sm font-medium">Valor total do lote (R$) *<Input id="campo-valorLote" aria-label="Valor total do lote" aria-invalid={erroLote || undefined} aria-describedby={erroLote ? "erro-valorLote" : undefined} min="0" step="0.01" type="number" className={CAMPO + (erroLote ? " border-destructive ring-2 ring-destructive/20" : "")} value={valorLote} onChange={(e) => { onValorLote(e.target.value); limparCampoInvalido("valorLote"); }} />{erroLote && <CampoErro id="erro-valorLote">Informe o valor total do lote.</CampoErro>}</label>
      <div role="status" aria-label="Preço médio por animal" className="pb-2.5 text-sm"><span className="text-ink-3">Preço médio por animal</span> <strong>{precoMedio === null ? "—" : brl(precoMedio / 100)}</strong></div>
    </div>}

    {animais.length === 0
      ? <div id="lista-animais" className={erroSecao ? "rounded-xl ring-2 ring-destructive/30" : undefined}><Empty>Nenhum animal adicionado. Use Adicionar animal para cadastrar cada animal comprado.</Empty></div>
      : <ul aria-label="Animais da compra" className="space-y-3">{animais.map((animal, indice) => {
        const valor = valores[indice] ?? null;
        const pendencia = pendenciaPrecoAnimal(unidade, animal, valor);
        const erroApi = erros[indice];
        const invalidoLocal = campoInvalido === `animal-${animal.id}` && !!pendencia;
        const destacado = invalidoLocal || !!erroApi;
        const campoCentro = `itens.${indice}.centroCustoId`;
        const centroInvalido = campoInvalido === campoCentro;
        const { resumo } = animal;
        const rotulo = resumo.brinco;
        return <li key={animal.id} id={`animal-${animal.id}`} tabIndex={-1} aria-invalid={destacado || undefined} className={`rounded-xl border p-4 outline-none ${destacado ? "border-destructive bg-[var(--fin-danger-bg)] ring-2 ring-destructive/20" : "border-border bg-muted"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <strong className="break-words text-sm">Animal {resumo.brinco}</strong>{resumo.nome && <span className="text-sm text-ink-3"> · {resumo.nome}</span>}
              <p className="mt-1 break-words text-sm text-ink-3">{ROTULO_SEXO[resumo.sexo]} · {resumo.composicao || "Raça não informada"} · {ROTULO_APTIDAO[resumo.aptidao]} · {resumo.pesoEntradaKg != null ? `${fmtKg(resumo.pesoEntradaKg)} na entrada` : "Sem peso de entrada"}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <UiButton type="button" variant="ghost" aria-label={`Editar animal ${rotulo}`} onClick={() => setModal({ id: animal.id })} className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-card"><Pencil size={16} /></UiButton>
              <UiButton type="button" variant="ghost" aria-label={`Remover animal ${rotulo}`} onClick={() => onRemover(animal.id)} className="min-h-11 min-w-11 rounded-lg p-2 text-destructive hover:bg-[var(--fin-danger-bg)]"><Trash2 size={16} /></UiButton>
            </div>
          </div>
          {erroApi && <div className="mt-3 flex flex-wrap items-center gap-3"><CampoErro className="mt-0">{erroApi.mensagem}</CampoErro>{erroApi.campo.startsWith("animal.") && <Button type="button" secondary onClick={() => setModal({ id: animal.id, erro: erroApi })}>Corrigir no cadastro</Button>}</div>}
          {invalidoLocal && !erroApi && <CampoErro className="mt-3">{pendencia}</CampoErro>}
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {unidade !== "CABECA" && !lote && <label className="w-full text-sm font-medium sm:w-36">Peso pago (kg) *<Input aria-label={`Peso pago do animal ${rotulo}`} min="0.001" step="0.001" type="number" className={CAMPO} value={animal.pesoPago} onChange={(e) => { onAtualizar(animal.id, { pesoPago: e.target.value }); limparCampoInvalido(`animal-${animal.id}`); }} /></label>}
            {!lote && <label className="w-full text-sm font-medium sm:w-40">Preço por {UNIDADE_PRECO_CURTA[unidade as Exclude<UnidadePrecoAnimal, "LOTE">]} (R$) *<Input aria-label={`Preço do animal ${rotulo}`} min="0" step="0.0001" type="number" className={CAMPO} value={animal.preco} onChange={(e) => { onAtualizar(animal.id, { preco: e.target.value }); limparCampoInvalido(`animal-${animal.id}`); }} /></label>}
            <div className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm sm:w-44"><span className="text-ink-3">Valor do item</span><output aria-label={`Valor do animal ${rotulo}`} className="float-right font-semibold">{valor ? brl(valor.centavos / 100) : "—"}</output>{valor && unidade !== "CABECA" && !lote && <span className="mt-1 block text-xs text-ink-3">{valor.quantidade.replace(".", ",")} {valor.unidade}</span>}</div>
            <label className="w-full text-sm font-medium sm:w-52">Categoria<SelectCampo aria-label={`Categoria do animal ${rotulo}`} className={SELECT} value={animal.categoriaId} onValueChange={(valorSelecionado) => onAtualizar(animal.id, { categoriaId: valorSelecionado })}><option value="">Sem categoria</option>{config.categorias.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelectCampo></label>
            {porItem && <label className="w-full text-sm font-medium sm:w-56">Centro de custo<SelectCampo id={`campo-itens-${indice}-centroCustoId`} aria-label={`Centro de custo do animal ${rotulo}`} aria-invalid={centroInvalido || undefined} aria-describedby={centroInvalido ? `erro-${campoCentro}` : undefined} className={SELECT + (centroInvalido ? " border-destructive ring-2 ring-destructive/20" : "")} value={animal.centroCustoId} onValueChange={(valorSelecionado) => { onAtualizar(animal.id, { centroCustoId: valorSelecionado }); limparCampoInvalido(campoCentro); }}><option value="">Padrão da operação{centroCustoOperacao ? ` (${config.centrosCusto.find((c) => String(c.id) === centroCustoOperacao)?.nome ?? ""})` : ""}</option>{config.centrosCusto.filter((centro) => centro.ativo).map((centro) => <option key={centro.id} value={centro.id}>{centro.nome}</option>)}</SelectCampo>{centroInvalido && <CampoErro id={`erro-${campoCentro}`}>Informe o centro de custo deste animal ou um centro padrão para a operação.</CampoErro>}</label>}
          </div>
        </li>;
      })}</ul>}
    {erroSecao && <CampoErro id="erro-animais" className="mt-3">{sitio ? "Adicione ao menos um animal à compra." : motivoSemSitio}</CampoErro>}
    {animais.length > 0 && <p className="mt-3 text-sm text-ink-3">{animais.length} {animais.length === 1 ? "animal" : "animais"} · valor dos animais <strong className="text-ink">{brl(total / 100)}</strong></p>}

    {modal && sitio && <ModalAnimalCompra
      key={modal.id ?? "novo"}
      sitio={sitio}
      dataOperacao={dataOperacao}
      inicial={emEdicao}
      erro={modal.erro}
      brincosReservados={animais.filter((animal) => animal.id !== modal.id).map((animal) => animal.resumo.brinco)}
      onFechar={() => setModal(null)}
      onConfirmar={(resultado) => {
        if (emEdicao) onSalvar(emEdicao.id, resultado);
        else onAdicionar({ ...resultado, pesoPago: "", preco: "", categoriaId: ultimo?.categoriaId ?? "", centroCustoId: porItem ? ultimo?.centroCustoId ?? "" : "" });
        setModal(null);
      }}
    />}
  </section>;
}

/** Modal com o cadastro compartilhado. "Confirmar" valida como o cadastro e só devolve os dados. */
function ModalAnimalCompra({ sitio, dataOperacao, inicial, erro, brincosReservados, onFechar, onConfirmar }: {
  sitio: SitioFixo;
  dataOperacao: string;
  inicial: AnimalCompraForm | null;
  erro?: ErroAnimalApi;
  brincosReservados: string[];
  onFechar: () => void;
  onConfirmar: (resultado: Pick<AnimalCompraForm, "cadastro" | "payload" | "entradaSegueOperacao" | "resumo">) => void;
}) {
  const errosIniciais = erro?.campo.startsWith("animal.") ? { [erro.campo.slice("animal.".length).split(".")[0]]: erro.mensagem } : undefined;
  const cadastro = useCadastroAnimal({
    prefixo: PREFIXO_ANIMAL_COMPRA, sitioFixo: sitio, dataEntradaInicial: dataOperacao, brincosReservados, errosIniciais,
    valorInicial: inicial ? { ...inicial.cadastro, dataEntrada: inicial.entradaSegueOperacao ? dataOperacao : inicial.cadastro.dataEntrada } : null,
  });
  const { catalogos, erroCatalogos, categoriaPrevista } = cadastro;

  // A recusa da API aponta um campo: leva até ele assim que o cadastro carrega.
  useEffect(() => {
    if (catalogos && errosIniciais) cadastro.irParaPrimeiroErro(errosIniciais);
    // só na abertura, quando os campos passam a existir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!catalogos]);

  const confirmar = () => {
    const validacao = cadastro.validar();
    cadastro.setErros(validacao);
    if (Object.keys(validacao).length) { cadastro.irParaPrimeiroErro(validacao); return; }
    const payload = cadastro.montarPayload();
    onConfirmar({
      cadastro: cadastro.form,
      payload,
      entradaSegueOperacao: cadastro.form.dataEntrada === dataOperacao,
      resumo: { brinco: payload.brinco, nome: payload.nome ?? null, sexo: payload.sexo, composicao: cadastro.rotuloComposicao(), aptidao: payload.aptidao, pesoEntradaKg: payload.pesoEntradaKg ?? null },
    });
  };

  return <DialogFinanceiro
    titulo={inicial ? `Editar animal ${inicial.resumo.brinco}` : "Adicionar animal"}
    eyebrow={`Compra de animais · ${sitio.nome}. O animal só é cadastrado no Rebanho quando a compra é confirmada.`}
    onClose={onFechar}
    className="max-w-4xl"
    rodape={<div className="flex flex-wrap items-center justify-end gap-3">
      {categoriaPrevista && <span className="mr-auto text-sm">Categoria prevista: <strong>{categoriaPrevista.nome}</strong></span>}
      <Button type="button" secondary onClick={onFechar}>Cancelar</Button>
      <Button type="button" disabled={!catalogos} onClick={confirmar}>Confirmar animal</Button>
    </div>}
  >
    {/* O modal é um portal React dentro do formulário da operação: o envio daqui não pode subir até lá. */}
    <form noValidate onSubmit={(evento) => { evento.preventDefault(); evento.stopPropagation(); confirmar(); }} className="space-y-7 p-5 sm:p-6 [&>section+section]:border-t [&>section+section]:border-border [&>section+section]:pt-5">
      <ErrorBox erro={erroCatalogos} />
      {!catalogos && !erroCatalogos && <EsqueletoFormulario label="Carregando cadastro" campos={8} />}
      <CadastroAnimalCampos cadastro={cadastro} />
    </form>
  </DialogFinanceiro>;
}

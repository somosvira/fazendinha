// "Devolver cabeças" na ficha de uma compra de animais confirmada: o modal lista os animais da compra,
// e a confirmação cria uma operação DEVOLUCAO ao mesmo fornecedor (um item `cab` por animal, com
// `animalId`). Quem dá a baixa "Compra estornada" nos animais é o servidor, ao confirmar.
import { Info } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DatePicker } from "@/components/DatePicker";
import { Input } from "@/components/ui/input";
import { rotuloTipoBaixa } from "../pecuaria/rebanho/lib/rotulos";
import { codigoOperacao } from "../estoque/navegacao";
import { CAMPO, CampoErro, SELECT } from "./CamposOperacao";
import { DialogFinanceiro } from "./DialogFinanceiro";
import { brl, Button, emDias, ErrorBox, hoje } from "./financeiro-ui";
import { SelectCampo } from "./SelectCampo";
import { ApiError, criarOperacao, obterConfiguracoesFinanceiras, type ConfiguracoesFinanceiras, type ItemOperacao, type Operacao } from "./novo-api";
import { deCentavos, paraCentavos } from "./lib/parcelas";
import { FORMAS_PAGAMENTO } from "./lib/parceiros";

export type SituacaoAnimalCompra =
  | { estado: "ATIVO"; rotulo: string }
  | { estado: "DEVOLVIDO"; rotulo: string; devolucao: { id: string; numero: number } }
  | { estado: "FORA"; rotulo: string };

/** Onde o animal de um item está hoje, a partir da leitura da operação. */
export function situacaoDoAnimal(item: Pick<ItemOperacao, "animal">, operacaoId?: string): SituacaoAnimalCompra | null {
  const situacao = item.animal?.situacao;
  if (!item.animal || !situacao) return null;
  if (situacao.devolucao) return { estado: "DEVOLVIDO", devolucao: situacao.devolucao, rotulo: situacao.devolucao.id === operacaoId ? "Devolvido nesta operação" : `Devolvido na ${codigoOperacao(situacao.devolucao.numero)}` };
  if (situacao.baixa) return { estado: "FORA", rotulo: `Fora do rebanho: ${rotuloTipoBaixa(situacao.baixa.tipo)}` };
  return { estado: "ATIVO", rotulo: "Ativo" };
}

export const itensDeAnimal = (operacao: Pick<Operacao, "itens">) => operacao.itens.filter((item) => item.animalId && item.animal);

type Condicao = "A_RECEBER" | "RECEBIDO";

export function DevolucaoAnimais({ operacao, onFechar, onCriada }: {
  /** Compra de animais confirmada, já com a situação de cada animal. */
  operacao: Operacao;
  onFechar: () => void;
  onCriada: (devolucao: Pick<Operacao, "id">) => void;
}) {
  const itens = useMemo(() => itensDeAnimal(operacao), [operacao]);
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(itens.map((item) => [item.id, item.valorTotal ?? ""])));
  const [data, setData] = useState(hoje());
  const [condicao, setCondicao] = useState<Condicao>("A_RECEBER");
  const [vencimento, setVencimento] = useState(emDias(30));
  const [contaId, setContaId] = useState("");
  const [forma, setForma] = useState("PIX");
  const [descricaoDigitada, setDescricaoDigitada] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null);
  const [erroConfig, setErroConfig] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [errosAnimais, setErrosAnimais] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const identidade = useRef({ assinatura: "", chave: crypto.randomUUID() });

  useEffect(() => {
    let ativo = true;
    obterConfiguracoesFinanceiras().then((c) => { if (ativo) setConfig(c); }).catch((falha) => { if (ativo) setErroConfig(falha instanceof Error ? falha.message : String(falha)); });
    return () => { ativo = false; };
  }, []);
  // A devolução é lançada no sítio da compra, mesmo com a consulta em "Todos os sítios".
  const contas = (config?.contas ?? []).filter((conta) => conta.ativo && (conta.propriedadeId == null || conta.propriedadeId === operacao.propriedadeId));

  const situacoes = new Map(itens.map((item) => [item.id, situacaoDoAnimal(item, operacao.id)]));
  const disponivel = (item: ItemOperacao) => { const s = situacoes.get(item.id); return s?.estado === "ATIVO"; }; // sem situação (perfil sem Pecuária) não é "Ativo"
  const escolhidos = itens.filter((item) => selecionados[item.id] && disponivel(item));
  const totalCentavos = escolhidos.reduce((soma, item) => soma + (paraCentavos(valores[item.id]) ?? 0), 0);
  const descricaoPadrao = `Devolução de ${escolhidos.length || 0} ${escolhidos.length === 1 ? "cabeça" : "cabeças"} da ${codigoOperacao(operacao.numero)}`;
  const descricao = descricaoDigitada ?? descricaoPadrao;

  const payloadSemChave = {
    tipo: "DEVOLUCAO", propriedadeId: operacao.propriedadeId, data, descricao: descricao.trim() || descricaoPadrao, parceiroId: operacao.parceiroId ?? operacao.parceiro?.id ?? undefined,
    centroCustoId: operacao.centroCustoId ?? undefined,
    itens: escolhidos.map((item) => ({
      descricao: `Devolução animal ${item.animal!.brinco}`, quantidade: 1, unidade: "cab", valorTotal: valores[item.id], animalId: item.animalId!,
      categoriaId: item.categoriaId ?? null, centroCustoId: item.centroCustoId ?? null, estocavel: false,
    })),
    financeiro: condicao === "RECEBIDO"
      ? { condicao: "A_VISTA", contaId, formaPagamento: forma }
      : { condicao: "A_PRAZO", parcelas: [{ valor: deCentavos(totalCentavos), dataVencimento: vencimento }] },
  };
  const assinatura = JSON.stringify(payloadSemChave);
  if (identidade.current.assinatura && identidade.current.assinatura !== assinatura) identidade.current.chave = crypto.randomUUID();
  identidade.current.assinatura = assinatura;

  const limparErros = () => { setErro(null); setErrosAnimais({}); };

  /** Primeira pendência local (mensagem por animal ou geral); vazio quando pode enviar. */
  const validar = () => {
    const porAnimal: Record<string, string> = {};
    for (const item of escolhidos) {
      const devolvido = paraCentavos(valores[item.id]) ?? 0;
      const pago = paraCentavos(item.valorTotal);
      if (!(devolvido > 0)) porAnimal[item.id] = "Informe o valor devolvido, maior que zero.";
      else if (pago !== null && devolvido > pago) porAnimal[item.id] = `O valor devolvido não pode passar do valor pago (${brl(item.valorTotal)})`;
      else if (!(item.centroCustoId || operacao.centroCustoId)) porAnimal[item.id] = "A compra não tem centro de custo para este animal.";
    }
    let geral: string | null = null;
    const dataCompra = operacao.data.slice(0, 10);
    if (!escolhidos.length) geral = "Selecione ao menos um animal para devolver.";
    else if (!data) geral = "Informe a data da devolução.";
    else if (data < dataCompra) geral = `A devolução não pode ser anterior à compra (${dataCompra.split("-").reverse().join("/")}).`;
    else if (descricao.trim() && descricao.trim().length < 2) geral = "A descrição precisa de ao menos 2 caracteres.";
    else if (!payloadSemChave.parceiroId) geral = "A compra não tem fornecedor; a devolução precisa do fornecedor da compra.";
    else if (condicao === "RECEBIDO" && !contaId) geral = "Escolha a conta que recebeu o valor.";
    else if (condicao === "A_RECEBER" && !vencimento) geral = "Informe o vencimento do valor a receber.";
    return { porAnimal, geral };
  };

  const confirmar = async () => {
    if (emCurso.current) return;
    limparErros();
    const { porAnimal, geral } = validar();
    if (geral || Object.keys(porAnimal).length) { setErrosAnimais(porAnimal); setErro(geral ?? "Revise os animais destacados."); return; }
    emCurso.current = true; setSalvando(true);
    try {
      const devolucao = await criarOperacao({ ...payloadSemChave, chave: identidade.current.chave });
      onCriada(devolucao);
    } catch (falha) {
      const mensagem = falha instanceof Error ? falha.message : String(falha);
      const campo = falha instanceof ApiError ? falha.campo : undefined;
      const doItem = campo?.match(/^itens\.(\d+)(?:\.|$)/);
      const alvo = doItem ? escolhidos[Number(doItem[1])] : undefined;
      if (alvo) setErrosAnimais({ [alvo.id]: mensagem });
      else setErro(mensagem);
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const nome = (item: ItemOperacao) => `${item.animal!.brinco}${item.animal!.nome ? ` · ${item.animal!.nome}` : ""}`;

  return <DialogFinanceiro
    titulo="Devolver cabeças"
    eyebrow={`${codigoOperacao(operacao.numero)}${operacao.parceiro ? ` · ${operacao.parceiro.nome}` : ""}`}
    onClose={() => { if (!salvando) onFechar(); }}
    className="sm:max-w-3xl"
    rodape={<div className="space-y-3">
      <p className="flex items-start gap-2 text-xs leading-5 text-ink-3"><Info size={14} className="mt-0.5 shrink-0" aria-hidden /><span>Os animais devolvidos recebem a baixa "Compra estornada" e mantêm todos os registros. A devolução não abate parcelas em aberto da compra: ela cria o valor a receber do fornecedor.</span></p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm">{escolhidos.length} {escolhidos.length === 1 ? "animal" : "animais"} · total <strong aria-label="Total da devolução">{brl(deCentavos(totalCentavos))}</strong></span>
        <div className="flex gap-2"><Button type="button" secondary disabled={salvando} onClick={onFechar}>Cancelar</Button><Button type="button" carregando={salvando} disabled={salvando} onClick={() => void confirmar()}>{salvando ? "Confirmando…" : "Confirmar devolução"}</Button></div>
      </div>
    </div>}
  >
    <div className="space-y-5 p-5 sm:p-6">
      <ErrorBox erro={erro} />
      <ErrorBox erro={erroConfig} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Animais da compra</legend>
        <ul aria-label="Animais da compra" className="space-y-2">{itens.map((item) => {
          const situacao = situacoes.get(item.id);
          const livre = disponivel(item);
          const marcado = !!selecionados[item.id] && livre;
          const erroAnimal = errosAnimais[item.id];
          return <li key={item.id} id={`devolucao-animal-${item.id}`} className={`rounded-xl border p-3 ${erroAnimal ? "border-destructive bg-[var(--fin-danger-bg)]" : "border-border bg-muted"} ${livre ? "" : "opacity-70"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-sm font-medium"><input type="checkbox" className="size-4" aria-label={`Devolver animal ${item.animal!.brinco}`} disabled={!livre || salvando} checked={marcado} onChange={(e) => { setSelecionados((atual) => ({ ...atual, [item.id]: e.target.checked })); limparErros(); }} /><span className="min-w-0 break-words">{nome(item)}</span></label>
              {!livre && situacao && <span className="text-xs font-semibold text-[var(--warn)]">{situacao.rotulo}</span>}
              <span className="text-xs text-ink-3">Pago {brl(item.valorTotal)}</span>
              <label className="w-full text-xs font-medium sm:w-40">Valor devolvido (R$)<Input aria-label={`Valor devolvido do animal ${item.animal!.brinco}`} aria-invalid={!!erroAnimal || undefined} aria-describedby={erroAnimal ? `erro-devolucao-${item.id}` : undefined} type="number" min="0.01" step="0.01" disabled={!marcado || salvando} className={CAMPO} value={valores[item.id] ?? ""} onChange={(e) => { setValores((atual) => ({ ...atual, [item.id]: e.target.value })); setErrosAnimais(({ [item.id]: _d, ...resto }) => resto); }} /></label>
            </div>
            {erroAnimal && <CampoErro id={`erro-devolucao-${item.id}`} className="mt-2">{erroAnimal}</CampoErro>}
          </li>;
        })}</ul>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Data da devolução<DatePicker aria-label="Data da devolução" required min={operacao.data.slice(0, 10)} max={hoje()} className="mt-1.5" value={data} onChange={setData} /></label>
        <label className="text-sm font-medium">Condição<SelectCampo aria-label="Condição da devolução" className={SELECT} value={condicao} onValueChange={(valor) => { setCondicao(valor as Condicao); limparErros(); }}><option value="A_RECEBER">A receber</option><option value="RECEBIDO">Recebido em conta</option></SelectCampo></label>
        {condicao === "A_RECEBER"
          ? <label className="text-sm font-medium">Vencimento<DatePicker aria-label="Vencimento do valor a receber" required className="mt-1.5" value={vencimento} onChange={setVencimento} /></label>
          : <>
            <label className="text-sm font-medium">Conta de recebimento *<SelectCampo aria-label="Conta de recebimento" className={SELECT} value={contaId} onValueChange={(valor) => { setContaId(valor); limparErros(); }}><option value="">{config ? "Selecione" : "Carregando contas…"}</option>{contas.map((conta) => <option key={conta.id} value={conta.id}>{conta.nome}</option>)}</SelectCampo></label>
            <label className="text-sm font-medium">Forma de recebimento<SelectCampo aria-label="Forma de recebimento" className={SELECT} value={forma} onValueChange={setForma}>{Object.entries(FORMAS_PAGAMENTO).map(([chave, rotulo]) => <option key={chave} value={chave}>{rotulo}</option>)}</SelectCampo></label>
          </>}
      </div>
      <label className="block text-sm font-medium">Descrição (opcional)<Input aria-label="Descrição da devolução" maxLength={240} className={CAMPO} value={descricao} onChange={(e) => setDescricaoDigitada(e.target.value)} /></label>
    </div>
  </DialogFinanceiro>;
}

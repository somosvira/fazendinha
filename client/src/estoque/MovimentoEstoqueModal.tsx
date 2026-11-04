import { useCallback, useEffect, useState } from "react";
import { Package } from "lucide-react";
import { DialogFinanceiro } from "../financeiro/DialogFinanceiro";
import { brl, dataBR, ErrorBox, Pill } from "../financeiro/financeiro-ui";
import { LinkInterno } from "@/components/LinkInterno";
import { EsqueletoFichaCorpo } from "../components/Esqueleto";
import { listarMovimentos, type MovimentoDTO, type OrigemMovimento } from "./api";

const ORIGEM: Record<OrigemMovimento, string> = {
  COMPRA: "Compra", CONSUMO_DIRETO: "Consumo direto", TRANSFERENCIA: "Transferência entre sítios", PRODUCAO: "Produção", DEVOLUCAO: "Devolução",
  BONIFICACAO: "Bonificação", INVENTARIO_INICIAL: "Inventário inicial", PERDA: "Perda", AJUSTE_INVENTARIO: "Ajuste de inventário", APLICACAO: "Aplicação na lavoura",
  SANIDADE: "Sanidade", NUTRICAO: "Nutrição", IDENTIFICACAO_PARTIDA: "Identificação de lote", REPRODUCAO: "Reprodução", RETIRADA_LEITE: "Retirada de leite",
};
const TIPO = { ENTRADA: "Entrada", SAIDA: "Saída", AJUSTE: "Ajuste" } as const;
/** Código criado pelo sistema (LOTE-<uuid>): não ajuda a identificar o lote, a validade sim. */
const CODIGO_GERADO = /^LOTE-[0-9a-f-]{36}$/i;
const qtd = (n: number | string) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

/** Detalhe de um movimento de estoque sem sair da tela de origem: o que entrou ou saiu, de quais lotes de estoque e por quanto. */
export function MovimentoEstoqueModal({ movimentoId, propriedadeId, unidade, onFechar }: { movimentoId: string; propriedadeId?: number | null; unidade?: string; onFechar: () => void }) {
  const [movimento, setMovimento] = useState<MovimentoDTO | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    const pagina = await listarMovimentos({ movimentoId, propriedadeId: propriedadeId ?? undefined });
    if (!pagina.itens[0]) throw new Error("Movimento não encontrado neste sítio.");
    return pagina.itens[0];
  }, [movimentoId, propriedadeId]);
  useEffect(() => {
    let vivo = true;
    carregar().then(m => { if (vivo) setMovimento(m); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [carregar]);
  const m = movimento;
  const un = unidade ? ` ${unidade}` : "";
  return <DialogFinanceiro titulo={m ? `${TIPO[m.tipo]} #${m.seq} · ${m.produto}` : "Movimento de estoque"} eyebrow={m ? `${dataBR(m.data)} · ${ORIGEM[m.origem] ?? m.origem}` : ""} onClose={onFechar} className="sm:max-w-2xl"
    rodape={<div className="flex flex-wrap justify-end gap-3">{m && <LinkInterno area="estoque" aparencia="botao-secundario" href={`/estoque/produtos/${m.produtoId}`}>Ver produto no estoque</LinkInterno>}</div>}>
    <div className="grid gap-5 p-5">
      <ErrorBox erro={erro} />
      {!m && !erro && <EsqueletoFichaCorpo />}
      {m && <>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div><dt className="text-xs text-ink-3">Quantidade</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{m.tipo === "SAIDA" ? "−" : m.tipo === "AJUSTE" && m.quantidade < 0 ? "" : "+"}{qtd(m.quantidade)}{un}</dd></div>
          <div><dt className="text-xs text-ink-3">Custo unitário</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{brl(m.custoUnitario)}</dd></div>
          <div><dt className="text-xs text-ink-3">Valor total</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{brl(m.valorTotal)}</dd></div>
        </dl>
        <dl className="grid gap-x-6 gap-y-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-3">Situação</dt><dd className="mt-1"><Pill tone={m.status === "CONFIRMADO" ? "green" : "neutral"}>{m.status === "CONFIRMADO" ? "Confirmado" : "Revertido"}</Pill></dd></div>
          <div><dt className="text-ink-3">Origem</dt><dd className="mt-1 font-medium">{ORIGEM[m.origem] ?? m.origem}{m.operacaoNumero != null && ` · operação #${m.operacaoNumero}`}</dd></div>
          {m.fornecedor && <div><dt className="text-ink-3">Fornecedor</dt><dd className="mt-1 font-medium">{m.fornecedor}</dd></div>}
          {m.centrosCusto.length > 0 && <div><dt className="text-ink-3">Centro de custo</dt><dd className="mt-1 font-medium">{m.centrosCusto.map(c => c.nome).join(", ")}</dd></div>}
          {m.observacao && <div className="sm:col-span-2"><dt className="text-ink-3">Observação</dt><dd className="mt-1">{m.observacao}</dd></div>}
        </dl>
        {!!m.partidas?.length && <section className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Lotes de estoque</h3>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border text-sm">{m.partidas.map(p => <li key={p.partidaId} className="flex items-center justify-between gap-3 px-3 py-2">
            <span><strong className="font-medium">{p.validade ? `Validade ${dataBR(p.validade)}` : "Validade não informada"}</strong>{!CODIGO_GERADO.test(p.codigo) && <span className="block text-xs text-ink-3">{p.codigo}</span>}</span>
            <span className="tabular-nums">{qtd(p.quantidade)}{un}</span>
          </li>)}</ul>
        </section>}
        {m.status === "REVERTIDO" && <p className="rounded-lg bg-muted p-3 text-sm">Este movimento foi revertido e não conta mais no saldo.</p>}
      </>}
    </div>
  </DialogFinanceiro>;
}

import { useMemo } from "react";
import { SeletorProdutoCatalogo, escolherProduto, type ProdutoLocal } from "./SeletorProdutoCatalogo";

/** Adapta listas já filtradas pelo fluxo, sem ampliar seus produtos elegíveis. */
export function SeletorProdutoLocal<T extends { id: string; nome: string }>({ rotulo, valor, opcoes, onChange, obrigatorio, disabled, id, descricaoId, invalido, nomeIndisponivel }: {
  rotulo: string; valor: string; opcoes: readonly T[]; onChange: (id: string) => void;
  obrigatorio?: boolean; disabled?: boolean; id?: string; descricaoId?: string; invalido?: boolean; nomeIndisponivel?: string;
}) {
  const produtos = useMemo<ProdutoLocal[]>(() => opcoes.map(p => ({ ...p })), [opcoes]);
  const produto = produtos.find(p => p.id === valor);
  return <SeletorProdutoCatalogo id={id} rotulo={rotulo} somenteMeus produtosPermitidos={produtos} value={valor ? escolherProduto(produto ?? { id: valor, nome: nomeIndisponivel ?? "Produto indisponível" }) : null} onChange={escolha => onChange(escolha?.tipo === "produto" ? escolha.produtoId : "")} obrigatorio={obrigatorio} disabled={disabled} descricaoId={descricaoId} invalido={invalido} />;
}

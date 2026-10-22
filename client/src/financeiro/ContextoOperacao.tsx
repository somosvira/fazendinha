import { useState, type ReactNode } from "react";
import { ArrowUpRight, Building2, Package, Wallet, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Modal, StatusPill, brl, dataBR } from "./financeiro-ui";
import { podeVerValoresFinanceiros } from "./permissoes";
import { podeAcessarArea } from "../estoque/navegacao";
import { PAPEIS_PARCEIRO, papeisDoParceiro } from "./lib/parceiros";
import { formatarDocumento } from "./lib/validacao";
import type { Operacao, Parceiro, ParceiroBase } from "./novo-api";

export function InformacoesParceiro({ parceiro }: { parceiro: ParceiroBase & Partial<Parceiro> }) {
  const endereco = [parceiro.logradouro, parceiro.numero, parceiro.complemento, parceiro.bairro, parceiro.cidade, parceiro.uf].filter(Boolean).join(", ");
  return <dl className="operacoes-contexto-dados">
    <div><dt>Papel</dt><dd>{papeisDoParceiro(parceiro).map(p => PAPEIS_PARCEIRO[p]).join(" · ")}</dd></div>
    <div><dt>Situação</dt><dd>{parceiro.ativo ? "Ativo" : "Inativo"}</dd></div>
    <div><dt>CPF/CNPJ</dt><dd>{formatarDocumento(parceiro.documento) || "Não informado"}</dd></div>
    <div><dt>Telefone</dt><dd>{parceiro.telefone || "Não informado"}</dd></div>
    <div><dt>E-mail</dt><dd>{parceiro.email || "Não informado"}</dd></div>
    {parceiro.pessoaContato && <div><dt>Pessoa de contato</dt><dd>{parceiro.pessoaContato}</dd></div>}
    {endereco && <div><dt>Endereço</dt><dd>{endereco}</dd></div>}
    {parceiro.observacoes && <div><dt>Observações</dt><dd>{parceiro.observacoes}</dd></div>}
  </dl>;
}
export function DetalheParceiroConsulta({ parceiro, onFechar }: { parceiro: Parceiro; onFechar: () => void }) {
  return <Modal titulo={parceiro.nome} eyebrow="Parceiro" onClose={onFechar}><div className="p-5"><InformacoesParceiro parceiro={parceiro} /></div></Modal>;
}
function Contexto({ titulo, icone, acionador, children, classe = "", rotulo }: { titulo: string; icone: ReactNode; acionador: ReactNode; children: ReactNode; classe?: string; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  return <Popover open={aberto} onOpenChange={setAberto}>
    <PopoverTrigger asChild><button type="button" aria-label={rotulo} className={`operacoes-contexto-trigger h-auto ${classe}`} onClick={e => e.stopPropagation()}>{acionador}</button></PopoverTrigger>
    <PopoverContent align="start" sideOffset={9} className="financeiro-colorido operacoes-contexto-popover" aria-label={titulo} onCloseAutoFocus={evento => { if (document.querySelector('.operacoes-contexto-popover[data-state="open"], .operacoes-filtro-popover[data-state="open"]')) evento.preventDefault(); }} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <div className="operacoes-popover-cabecalho"><h2>{icone}{titulo}</h2><Button type="button" size="icon" variant="ghost" aria-label="Fechar informações" onClick={() => setAberto(false)}><X size={16} /></Button></div>
      <div className="operacoes-contexto-corpo">{children}</div>
    </PopoverContent>
  </Popover>;
}
function LinkContexto({ href, children }: { href: string; children: ReactNode }) {
  return <Button asChild variant="outline" className="operacoes-contexto-link"><a href={href}>{children}<ArrowUpRight size={15} aria-hidden /></a></Button>;
}
export function ParceiroOperacao({ parceiro }: { parceiro: ParceiroBase | null }) {
  if (!parceiro) return <span>—</span>;
  return <Contexto titulo={parceiro.nome} icone={<Building2 size={18} aria-hidden />} acionador={parceiro.nome} rotulo={`Informações de ${parceiro.nome}`} classe="operacoes-parceiro-trigger">
    <InformacoesParceiro parceiro={parceiro} />
    <LinkContexto href={`/financeiro/configuracoes?${new URLSearchParams({ aba: "parceiros", parceiro: parceiro.id })}`}>Ver cadastro do parceiro</LinkContexto>
  </Contexto>;
}
export function ImpactosOperacao({ operacao }: { operacao: Operacao }) {
  const verValores = podeVerValoresFinanceiros();
  const transacoes = operacao.transacoes.filter(t => t.tipo !== "REVERSAO");
  const temEstoque = operacao.movimentosEstoque.length > 0;
  const temCompromissos = operacao.compromissos.length > 0;
  return <div className="fin-efeitos-operacao flex flex-wrap gap-1.5">
    {temEstoque && <Contexto titulo="Movimentos de estoque" icone={<Package size={18} aria-hidden />} acionador="estoque" rotulo="Ver impacto no estoque" classe="operacoes-impacto-trigger">
      <p>Esta operação registrou os movimentos abaixo. Entradas acrescentam unidades ao estoque e saídas retiram unidades.</p>
      <ul className="operacoes-contexto-lista">{operacao.movimentosEstoque.map(m => {
        const item = operacao.itens.find(i => i.produtoId === m.produtoId);
        return <li key={m.id}><strong>{m.tipo === "ENTRADA" ? "Entrada" : m.tipo === "SAIDA" ? "Saída" : "Ajuste"} · {item?.descricao ?? "Produto vinculado"}</strong><span>{Number(m.quantidade).toLocaleString("pt-BR")} {item?.unidade ?? "unidades"} · <StatusPill status={m.status} /></span>
          {podeAcessarArea("financeiro") && <a className="operacoes-contexto-destino" href={`/estoque?movimentoId=${encodeURIComponent(m.id)}`}>Ver movimento #{m.seq}<ArrowUpRight size={14} aria-hidden /></a>}
        </li>;
      })}</ul>
    </Contexto>}
    {(["PAGAMENTO", "RECEBIMENTO", "TRANSFERENCIA"] as const).map(tipo => {
      const registros = transacoes.filter(t => t.tipo === tipo);
      if (!registros.length) return null;
      const titulo = tipo === "PAGAMENTO" ? "Pagamentos registrados" : tipo === "RECEBIMENTO" ? "Recebimentos registrados" : "Transferências entre contas";
      return <Contexto key={tipo} titulo={titulo} icone={<Wallet size={18} aria-hidden />} acionador={tipo === "PAGAMENTO" ? "pagamento" : tipo === "RECEBIMENTO" ? "recebimento" : "transferência"} rotulo={`Ver ${titulo.toLocaleLowerCase("pt-BR")}`} classe="operacoes-impacto-trigger">
        <p>{tipo === "PAGAMENTO" ? "Pagamentos vinculados a esta operação. Cada saída foi registrada na conta indicada." : tipo === "RECEBIMENTO" ? "Recebimentos vinculados a esta operação. Cada entrada foi registrada na conta indicada." : "Transferências vinculadas a esta operação, com as contas de saída e entrada."}</p>
        <ul className="operacoes-contexto-lista">{registros.map(t => <li key={t.id}><strong>{dataBR(t.data)}{verValores && t.valorTotal != null ? ` · ${brl(t.valorTotal)}` : ""}</strong><StatusPill status={t.status} />{t.revertidaPor && <span>Estorno registrado neste histórico.</span>}{t.movimentos?.map(m => <a key={m.id} className="operacoes-contexto-destino" href={`/financeiro/contas/${encodeURIComponent(m.contaId)}#movimento-${encodeURIComponent(m.id)}`}>{m.direcao === "ENTRADA" ? "Entrada" : "Saída"} · {m.conta.nome}<ArrowUpRight size={14} aria-hidden /></a>)}</li>)}</ul>
      </Contexto>;
    })}
    {(["PAGAR", "RECEBER"] as const).map(tipo => {
      const parcelas = operacao.compromissos.filter(c => c.tipo === tipo);
      if (!parcelas.length) return null;
      return <Contexto key={tipo} titulo={tipo === "PAGAR" ? "Contas a pagar" : "Contas a receber"} icone={<Wallet size={18} aria-hidden />} acionador={tipo === "PAGAR" ? "a pagar" : "a receber"} rotulo={tipo === "PAGAR" ? "Ver contas a pagar" : "Ver contas a receber"} classe="operacoes-impacto-trigger">
        <p>Esta operação gerou {parcelas.length === 1 ? "o compromisso abaixo" : "os compromissos abaixo"}. O compromisso registra um valor a {tipo === "PAGAR" ? "pagar" : "receber"}; o dinheiro movimentado aparece nos {tipo === "PAGAR" ? "pagamentos" : "recebimentos"}.</p>
        <ul className="operacoes-contexto-lista">{parcelas.map(c => <li key={c.id}><strong>{c.numeroParcela ? `Parcela ${c.numeroParcela}${c.totalParcelas ? ` de ${c.totalParcelas}` : ""}` : "Compromisso"}{verValores && c.valorOriginal != null ? ` · ${brl(c.valorOriginal)}` : ""}</strong><span>Vencimento {dataBR(c.dataVencimento)}</span><StatusPill status={c.status} /><LinkContexto href={`/financeiro/compromissos?${new URLSearchParams({ situacao: tipo === "PAGAR" ? "pagar" : "receber", compromisso: c.id })}`}>Ver compromisso</LinkContexto></li>)}</ul>
      </Contexto>;
    })}
    {!temEstoque && !transacoes.length && !temCompromissos && <Contexto titulo="Sem impactos gerados" icone={<Wallet size={18} aria-hidden />} acionador="sem impactos" rotulo="Entender operação sem impactos" classe="operacoes-impacto-trigger"><p>Não há movimentos de estoque, pagamentos, recebimentos ou compromissos vinculados a esta operação.</p></Contexto>}
  </div>;
}

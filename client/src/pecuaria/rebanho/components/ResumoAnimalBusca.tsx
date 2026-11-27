import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Destaques } from "@/financeiro/financeiro-ui";
import { buscarFichaAnimal } from "../api";
import { ROTULO_SITUACAO } from "../lib/rotulos";
import { rotuloLactacao } from "../lib/lactacao";
import { periodoProducao, useHistoricoProdutivo } from "../leite/consulta-producao-animal";
import { resumirAfericoesIndividuais } from "../leite/producao-individual.calc";
import type { AnimalFicha, AnimalResumo } from "../types";
import { formatarDataBR } from "../lib/rotulos";
import { rotuloTipoPesoSecagem as rotuloTipoPesagem } from "../reproducao/peso-secagem";

const REPRODUCAO: Record<string, string> = { GESTANTE: "Gestante", VAZIA: "Vazia", APTA: "Apta", AGUARDANDO_DIAGNOSTICO: "Aguardando diagnóstico" };
const litros = (v: number | null | undefined) => v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L`;
const periodo = periodoProducao(30);

/** Resumo do animal escolhido na busca: números principais e histórico recente; a ficha completa fica a um clique. */
export function ResumoAnimalBusca({ animal, onVoltar, onVerMais }: { animal: AnimalResumo; onVoltar: () => void; onVerMais: () => void }) {
  const sitioId = animal.propriedade?.id ?? null;
  const [ficha, setFicha] = useState<AnimalFicha | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let vivo = true;
    setFicha(null); setErro(false);
    buscarFichaAnimal(animal.id, undefined, sitioId ?? undefined).then(f => { if (vivo) setFicha(f); }).catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [animal.id, sitioId]);
  const femea = animal.sexo !== "M";
  const leite = useHistoricoProdutivo(animal.id, femea ? sitioId : null, periodo, 0, false);
  const producao = resumirAfericoesIndividuais(leite.dados?.seriePeriodo ?? []);
  const prod = ficha?.contextoProdutivo ?? animal.contextoCartao?.produtivo ?? null;
  const reproducao = femea ? REPRODUCAO[animal.contextoCartao?.situacaoReprodutiva ?? ""] ?? "Não informada" : "Não se aplica";
  const destaques = [
    ...(femea ? [
      { chave: "media", valor: leite.carregando ? "…" : litros(producao.media), rotulo: "média por dia medido (30 dias)" },
      { chave: "del", valor: prod?.del ?? "—", rotulo: "dias em lactação (DEL)" },
      { chave: "ultima", valor: litros(producao.ultima?.litros), rotulo: producao.ultima ? `última aferição · ${formatarDataBR(producao.ultima.data)}` : "última aferição" },
      { chave: "partos", valor: prod?.partosRealizados ?? "—", rotulo: "partos" },
    ] : []),
    { chave: "peso", valor: ficha?.peso?.ultimo ? `${ficha.peso.ultimo.kg.toLocaleString("pt-BR")} kg` : "—", rotulo: ficha?.peso?.ultimo ? `último peso · ${formatarDataBR(ficha.peso.ultimo.data)}` : "último peso" },
    { chave: "idade", valor: `${animal.idadeMeses} m`, rotulo: "idade" },
  ];
  const localizacoes = (ficha?.historicoLocalizacoes ?? []).slice(0, 4);
  const pesagens = (ficha?.historicoPesagens ?? []).slice(0, 4);
  return <section className="busca-animal-resumo" aria-label={`Resumo de ${animal.brinco}`}>
    <header>
      <Button variant="ghost" onClick={onVoltar}><ArrowLeft size={16} aria-hidden />Voltar à busca</Button>
      <div className="busca-animal-identidade">
        <h3>{animal.brinco}{animal.nome ? ` · ${animal.nome}` : ""}</h3>
        <p><span className={`busca-animais-situacao ${animal.situacao === "ATIVO" ? "ativa" : ""}`}>{ROTULO_SITUACAO[animal.situacao]}</span> {animal.categoria?.nome ?? "Categoria não informada"} · {animal.lote?.nome ?? "Sem lote"}{animal.propriedade ? ` · ${animal.propriedade.nome}` : ""}</p>
      </div>
      <Button onClick={onVerMais}>Ver ficha completa<ArrowUpRight size={15} aria-hidden /></Button>
    </header>
    <Destaques itens={destaques} />
    <dl className="busca-animal-fatos">
      <div><dt>Reprodução</dt><dd>{reproducao}</dd></div>
      <div><dt>Produção</dt><dd>{femea ? rotuloLactacao(prod?.situacaoProdutiva) : "Não se aplica"}</dd></div>
      {femea && prod?.idadeGestacionalDias != null && <div><dt>Gestação</dt><dd>{prod.idadeGestacionalDias} dias</dd></div>}
    </dl>
    {erro ? <p role="alert" className="busca-animais-aviso">Não foi possível carregar o histórico deste animal. A ficha completa continua disponível.</p> : !ficha ? <p role="status" className="busca-animais-estado">Carregando histórico…</p> : <div className="busca-animal-historico">
      <section aria-label="Movimentações recentes"><h4>Movimentações recentes</h4>{localizacoes.length ? <ul>{localizacoes.map(l => <li key={l.id}><strong>{l.lote?.nome ?? "Sem lote"}</strong><span>{l.propriedade?.nome ?? ""}</span><time>{formatarDataBR(l.desde)}{l.ate ? ` a ${formatarDataBR(l.ate)}` : " · atual"}</time></li>)}</ul> : <p>Nenhuma movimentação registrada.</p>}</section>
      <section aria-label="Pesagens recentes"><h4>Pesagens recentes</h4>{pesagens.length ? <ul>{pesagens.map(p => <li key={p.id}><strong>{p.pesoKg.toLocaleString("pt-BR")} kg</strong><span>{rotuloTipoPesagem(p.tipo)}</span><time>{formatarDataBR(p.data)}</time></li>)}</ul> : <p>Nenhuma pesagem registrada.</p>}</section>
    </div>}
  </section>;
}

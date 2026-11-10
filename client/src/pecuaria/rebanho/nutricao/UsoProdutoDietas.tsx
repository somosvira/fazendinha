import { ConsultaOperacional } from "@/components/ConsultaOperacional";
import { useCallback } from "react";
import { Leaf } from "lucide-react";
import { EsqueletoTabela } from "../../../components/Esqueleto";
import { consultarVisaoNutricional, listarDietas } from "./api";
import { useConsulta } from "./consulta";
import { LinkNutricional, rotaNutricao } from "./componentes";
import { quantidadeNutricional } from "./quantidades";
import { DIAS_ATENCAO, textoCobertura } from "./coberturaEstoque";

const qtd = (n: number) => quantidadeNutricional(String(Math.round(n * 1000) / 1000));
type Uso = { loteId: string; lote: string; sitio: string; propriedadeId: number; receita: string; versao: number; porCabeca: number; animais: number; porDia: number; unidade: string };

/** Lotes de animais cujas dietas vigentes usam o produto, o consumo diário somado e para quantos dias o saldo exibido dá. */
export function UsoProdutoDietas({ produtoId, propriedadeId, saldo, unidade }: { produtoId: string; propriedadeId?: number; saldo: number; unidade: string }) {
  const consulta = useConsulta(useCallback(async () => {
    const [visao, dietas] = await Promise.all([consultarVisaoNutricional(), listarDietas()]);
    const porDieta = new Map(dietas.map(d => [d.id, d]));
    return visao.lotes.flatMap((r): Uso[] => {
      if (!r.vigente || (propriedadeId != null && r.lote.propriedadeId !== propriedadeId)) return [];
      const item = porDieta.get(r.vigente.dieta.id)?.itens.find(i => i.produtoId === produtoId);
      if (!item) return [];
      const porCabeca = Number(item.quantidadeCabecaDia);
      return [{ loteId: r.lote.id, lote: r.lote.nome, sitio: r.lote.propriedade.nome, propriedadeId: r.lote.propriedadeId, receita: r.vigente.dieta.nome, versao: r.vigente.dieta.versao, porCabeca, animais: r.lote.animaisAtivos, porDia: porCabeca * r.lote.animaisAtivos, unidade: item.unidade }];
    });
  }, [produtoId, propriedadeId]));
  const usos = consulta.dados ?? [];
  if (!consulta.carregando && !consulta.erro && !usos.length) return null;
  const porDia = usos.reduce((s, u) => s + u.porDia, 0);
  const dias = porDia > 0 ? Math.floor(Math.max(0, saldo) / porDia) : null;
  const variosSitios = new Set(usos.map(u => u.propriedadeId)).size > 1;
  return <section className="produto-ficha-dietas">
    <header><h3><Leaf size={16} aria-hidden />Uso nas dietas</h3>
      {usos.length > 0 && <p>As dietas vigentes consomem <strong>{qtd(porDia)} {unidade}/dia</strong>{dias != null && <>; o saldo exibido dá para <strong className={dias < DIAS_ATENCAO ? "text-destructive" : undefined}>{textoCobertura(dias)}</strong></>}.</p>}
    </header>
    {consulta.carregando ? <EsqueletoTabela label="Carregando uso nas dietas" colunas={4} linhas={2} /> : consulta.erro ? <p role="alert" className="text-sm">Não foi possível consultar as dietas agora.</p> :
      <ConsultaOperacional rotulo="Lotes de animais que usam o produto" itens={usos} chaveDe={u => u.loteId} colunas={[
        { chave: "lote", titulo: "Lote de animais", principal: true, celula: (u: Uso) => <><LinkNutricional className="font-medium text-primary underline-offset-4 hover:underline" href={rotaNutricao({ loteId: u.loteId })}>{u.lote}</LinkNutricional>{variosSitios && <p className="text-xs text-ink-3">{u.sitio}</p>}</> },
        { chave: "receita", titulo: "Receita", celula: (u: Uso) => `${u.receita} · v${u.versao}` },
        { chave: "cabeca", titulo: "Por cabeça/dia", alinhamento: "direita", celula: (u: Uso) => `${qtd(u.porCabeca)} ${unidade}` },
        { chave: "animais", titulo: "Animais", alinhamento: "direita", celula: (u: Uso) => u.animais },
        { chave: "dia", titulo: "Consumo por dia", alinhamento: "direita", celula: (u: Uso) => `${qtd(u.porDia)} ${unidade}` },
      ]} />}
  </section>;
}

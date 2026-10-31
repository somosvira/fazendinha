import { useEffect, useState } from "react";
import { MapPin, Scale, Target, Syringe, FlaskConical, Scissors } from "lucide-react";
import { AuditoriaAnimal, type FatoHistoricoAnimal } from "../components/AuditoriaAnimal";
import { anteriorContiguo, resumoTransicao } from "../lib/historicoAnimal";
import { getPropriedadeAtiva } from "@/propriedadeScope";
import { Button, ErrorBox } from "@/financeiro/financeiro-ui";
import type { AnimalFicha, TransicaoFatoAnimal } from "../types";
import { formatarDataBR, rotuloAptidao, rotuloPapelReprodutivo } from "../lib/rotulos";
import { listarAplicacoes, reqSanidade, type AplicacaoSanitaria } from "../sanidade/api";
import type { ExameResultado } from "../sanidade/ResultadoExame";
import { resultadoExameSanitario, dataAplicacaoSanitaria, unidadeSanitaria } from "../sanidade/rotulos";
import { reqManejo } from "../manejo/ManejoAnimal";
import { navegarPara } from "@/router";

type ManejoHistorico = { id: string; data: string; tipo: "DESMAMA" | "CASTRACAO"; status: "VALIDO" | "ANULADO"; pesagem: { pesoKg: string } | null };
type Exame = ExameResultado & { data: string; status: string };
export function HistoricoAnimalVisual({ animal, ativo, revisao, modo = "visual" }: { animal: AnimalFicha; ativo: boolean; revisao: number; modo?: "visual" | "tabela" }) {
  const [resposta, setDados] = useState<{ animalId: string; propriedadeId: number | null; aplicacoes: AplicacaoSanitaria[]; exames: Exame[]; manejos: ManejoHistorico[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const propriedadeId = getPropriedadeAtiva();
  const dados = resposta?.animalId === animal.id && resposta.propriedadeId === propriedadeId ? resposta : null;
  useEffect(() => {
    if (!ativo) return;
    let vigente = true;
    setDados(null); setErro(null);
    Promise.allSettled([listarAplicacoes(animal.id), reqSanidade<Exame[]>(`/exames?animalId=${encodeURIComponent(animal.id)}&pagina=1&porPagina=50`), reqManejo<ManejoHistorico[]>(`/eventos?animalId=${encodeURIComponent(animal.id)}`)])
      .then(([aplicacoes, exames, manejos]) => {
        if (!vigente) return;
        setDados({ animalId: animal.id, propriedadeId, aplicacoes: aplicacoes.status === "fulfilled" ? aplicacoes.value : [], exames: exames.status === "fulfilled" ? exames.value : [], manejos: manejos.status === "fulfilled" ? manejos.value : [] });
        const falhas = [aplicacoes.status === "rejected" && "Aplicações", exames.status === "rejected" && "Exames", manejos.status === "rejected" && "Manejos"].filter(Boolean);
        setErro(falhas.length ? `${falhas.join(", ")}: consulta indisponível.` : null);
      });
    return () => { vigente = false; };
  }, [animal.id, propriedadeId, ativo, revisao, tentativa]);
  const nomeLocalSnapshot = (valor: TransicaoFatoAnimal["antes"]) => {
    if (!valor) return null;
    const propriedade = animal.historicoLocalizacoes.find(l => l.propriedade?.id === valor.propriedadeId)?.propriedade?.nome;
    const lote = animal.historicoLocalizacoes.find(l => l.lote?.id === valor.loteId)?.lote?.nome;
    return `${propriedade ?? (valor.propriedadeId == null ? "Sítio não informado" : `Sítio ${valor.propriedadeId}`)} / ${lote ?? (!("loteId" in valor) ? "Lote não informado" : valor.loteId == null ? "Sem lote" : `Lote ${valor.loteId}`)}`;
  };
  const eventos: FatoHistoricoAnimal[] = [
    ...animal.historicoLocalizacoes.map(l => {
      const anterior = anteriorContiguo(animal.historicoLocalizacoes, l);
      const nome = (loc: typeof l) => `${loc.propriedade?.nome ?? "Sítio não informado"} / ${loc.lote?.nome ?? "Sem lote"}`;
      const resumo = resumoTransicao(anterior ? nome(anterior) : null, nome(l), l.desde.slice(0, 10) === animal.dataEntrada.slice(0, 10));
      return { id: `local-${l.id}`, entidade: "LocalizacaoAnimal", entidadeId: l.id, eixo: "REBANHO" as const, data: l.desde, titulo: "Localização", textoBusca: `${resumo} ${l.motivo ?? ""}`, projetarTransicao: (t: TransicaoFatoAnimal) => {
        const atual = nomeLocalSnapshot(t.depois) ?? nome(l);
        const texto = resumoTransicao(nomeLocalSnapshot(t.antes), atual, t.antes === null && t.depois !== null);
        return { textoBusca: `${texto} ${l.motivo ?? ""}`, detalhe: <>{texto}{l.ate && <span className="block text-ink-3">Até {formatarDataBR(l.ate)}</span>}{l.motivo && <span className="block">{l.motivo}</span>}</> };
      }, detalhe: <>{resumo}{l.ate && <span className="block text-ink-3">Até {formatarDataBR(l.ate)}</span>}{l.motivo && <span className="block">{l.motivo}</span>}</>, Icone: MapPin };
    }),
    ...animal.historicoDestinos.map(d => {
      const anterior = anteriorContiguo(animal.historicoDestinos, d);
      const resumo = resumoTransicao(anterior ? rotuloAptidao(anterior.aptidao) : null, rotuloAptidao(d.aptidao), d.desde.slice(0, 10) === animal.dataEntrada.slice(0, 10));
      return { id: `finalidade-${d.id}`, entidade: "FinalidadeAnimal", entidadeId: d.id, eixo: "REBANHO" as const, data: d.desde, titulo: "Finalidade", textoBusca: resumo, projetarTransicao: (t: TransicaoFatoAnimal) => {
        const rotulo = (snapshot: TransicaoFatoAnimal["antes"]) => snapshot && typeof snapshot.aptidao === "string" ? rotuloAptidao(snapshot.aptidao as AnimalFicha["aptidao"]) : null;
        const texto = resumoTransicao(rotulo(t.antes), rotulo(t.depois) ?? rotuloAptidao(d.aptidao), t.antes === null && t.depois !== null);
        return { textoBusca: texto, detalhe: <>{texto}{d.ate && <span className="block text-ink-3">Até {formatarDataBR(d.ate)}</span>}</> };
      }, detalhe: <>{resumo}{d.ate && <span className="block text-ink-3">Até {formatarDataBR(d.ate)}</span>}</>, Icone: Target };
    }),
    ...(animal.historicoPapeisReprodutivos ?? []).map(p => ({ id: `papel-${p.id}`, entidade: "PeriodoReprodutivoAnimal", entidadeId: p.id, eixo: "REPRODUCAO" as const, textoBusca: p.tipo, data: p.inicio, titulo: p.revogado ? "Papel reprodutivo · registro desfeito" : "Papel reprodutivo", detalhe: <>{p.tipo === "NENHUM" ? "Nenhum papel atribuído" : rotuloPapelReprodutivo(p.tipo as AnimalFicha["papelReprodutivo"])}{p.fim && <small className="block text-muted-foreground">Até {formatarDataBR(p.fim)}</small>}</>, Icone: Target })),
    ...animal.historicoPesagens.map(p => ({ id: `peso-${p.id}`, entidade: "Pesagem", entidadeId: p.id, eixo: "REBANHO" as const, textoBusca: `${p.pesoKg} kg ${p.tipo} ${p.origem} ${p.observacao ?? ""}`, data: p.data, titulo: "Pesagem", detalhe: <strong>{p.pesoKg.toLocaleString("pt-BR")} kg</strong>, Icone: Scale })),
    ...(dados?.manejos ?? []).map(m => ({ id: `manejo-${m.id}`, entidade: "ManejoAnimal", entidadeId: m.id, eixo: "REBANHO" as const, textoBusca: `${m.tipo === "DESMAMA" ? "Desmama" : "Castração"} ${m.status}`, data: m.data, titulo: m.tipo === "DESMAMA" ? "Desmama" : "Castração", detalhe: <>{m.status === "ANULADO" ? "Anulado" : "Registrado"}{m.pesagem && ` · ${Number(m.pesagem.pesoKg).toLocaleString("pt-BR")} kg`}</>, Icone: Scissors })),
    ...(dados?.aplicacoes ?? []).map(a => ({ id: `aplicacao-${a.id}`, entidade: "AplicacaoProduto", entidadeId: a.id, eixo: "SANIDADE" as const, textoBusca: a.nomeProdutoAplicado, data: a.data, titulo: a.status === "ANULADO" ? "Aplicação sanitária · anulada" : "Aplicação sanitária", detalhe: <>{a.nomeProdutoAplicado} · {a.dose} {unidadeSanitaria(a.unidadeDose)}<small className="block text-muted-foreground">{dataAplicacaoSanitaria(a)}</small></>, Icone: Syringe, abrir: () => navegarPara(`/pecuaria/sanidade?aba=aplicacoes&animalId=${animal.id}&aplicacaoId=${a.id}`) })),
    ...(dados?.exames ?? []).map(e => ({ id: `exame-${e.id}`, entidade: "ExameAnimal", entidadeId: e.id, eixo: "SANIDADE" as const, textoBusca: `${e.tipoExame?.nome ?? "Exame"} ${resultadoExameSanitario(e)}`, data: e.data, titulo: e.status === "ANULADO" ? "Exame · anulado" : "Coleta / exame", detalhe: <>{e.tipoExame?.nome ?? "Exame"}<small className="block text-muted-foreground">{resultadoExameSanitario(e)}</small></>, Icone: FlaskConical, abrir: () => navegarPara(`/pecuaria/sanidade?aba=exames&animalId=${animal.id}&detalheTipo=exame&detalheId=${e.id}`) })),
  ];
  eventos.sort((a, b) => b.data.slice(0, 10).localeCompare(a.data.slice(0, 10)) || a.id.localeCompare(b.id));
  return <div className="ficha-historico-visual"><ErrorBox erro={erro} />{erro && <div className="py-3"><p className="mb-2 text-sm">Os demais fatos disponíveis permanecem visíveis.</p><Button secondary onClick={() => setTentativa(v => v + 1)}>Tentar novamente</Button></div>}{!dados && !erro && ativo && <p role="status" className="py-3 text-sm">Consultando registros sanitários e manejos…</p>}<AuditoriaAnimal id={animal.id} ativo={ativo} recarregarToken={revisao} fatos={eventos} modo={modo} />{dados && <p className="py-3 text-sm text-ink-3">Aplicações e exames: até 50 registros de cada consulta. Os filtros desta lista abrangem os fatos carregados; consulte os demais em Sanidade. Manejos: até 100 registros.</p>}</div>;
}

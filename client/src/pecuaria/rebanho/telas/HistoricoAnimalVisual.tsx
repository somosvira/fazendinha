import { useEffect, useState, type ReactNode } from "react";
import { MapPin, Scale, Target, Syringe, FlaskConical, type LucideIcon } from "lucide-react";
import { LinhaTempoConsulta, CartaoConsulta } from "@/components/ConsultaVisual";
import { Button, ErrorBox } from "@/financeiro/financeiro-ui";
import type { AnimalFicha } from "../types";
import { formatarDataBR, rotuloAptidao, rotuloPapelReprodutivo } from "../lib/rotulos";
import { listarAplicacoes, reqSanidade, type AplicacaoSanitaria } from "../sanidade/api";
import type { ExameResultado } from "../sanidade/ResultadoExame";
import { resultadoExameSanitario, dataAplicacaoSanitaria, unidadeSanitaria } from "../sanidade/rotulos";
import { navegarPara } from "@/router";

type Exame = ExameResultado & { data: string; status: string };
type Evento = { id: string; data: string; titulo: string; detalhe: ReactNode; Icone: LucideIcon; abrir?: () => void };
export function HistoricoAnimalVisual({ animal, ativo, revisao }: { animal: AnimalFicha; ativo: boolean; revisao: number }) {
  const [dados, setDados] = useState<{ aplicacoes: AplicacaoSanitaria[]; exames: Exame[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    let vigente = true;
    setDados(null); setErro(null);
    Promise.all([listarAplicacoes(animal.id), reqSanidade<Exame[]>(`/exames?animalId=${encodeURIComponent(animal.id)}&pagina=1&porPagina=50`)])
      .then(([aplicacoes, exames]) => { if (vigente) setDados({ aplicacoes, exames }); })
      .catch((e: unknown) => { if (vigente) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { vigente = false; };
  }, [animal.id, ativo, revisao, tentativa]);
  const eventos: Evento[] = [
    ...animal.historicoLocalizacoes.map(l => ({ id: `local-${l.id}`, data: l.desde, titulo: "Localização registrada", detalhe: <>{l.propriedade?.nome ?? "Sem sítio"} / {l.lote?.nome ?? "Sem lote"}{l.ate && <small className="block text-muted-foreground">Até {formatarDataBR(l.ate)}</small>}{l.motivo && <p>{l.motivo}</p>}</>, Icone: MapPin })),
    ...animal.historicoDestinos.map(d => ({ id: `finalidade-${d.id}`, data: d.desde, titulo: "Finalidade registrada", detalhe: <>{rotuloAptidao(d.aptidao)}{d.ate && <small className="block text-muted-foreground">Até {formatarDataBR(d.ate)}</small>}</>, Icone: Target })),
    ...(animal.historicoPapeisReprodutivos ?? []).map(p => ({ id: `papel-${p.id}`, data: p.inicio, titulo: p.revogado ? "Papel reprodutivo · registro desfeito" : "Papel reprodutivo", detalhe: <>{p.tipo === "NENHUM" ? "Nenhum papel atribuído" : rotuloPapelReprodutivo(p.tipo as AnimalFicha["papelReprodutivo"])}{p.fim && <small className="block text-muted-foreground">Até {formatarDataBR(p.fim)}</small>}</>, Icone: Target })),
    ...animal.historicoPesagens.map(p => ({ id: `peso-${p.id}`, data: p.data, titulo: "Pesagem", detalhe: <strong>{p.pesoKg.toLocaleString("pt-BR")} kg</strong>, Icone: Scale })),
    ...(dados?.aplicacoes ?? []).map(a => ({ id: `aplicacao-${a.id}`, data: a.data, titulo: a.status === "ANULADO" ? "Aplicação sanitária · anulada" : "Aplicação sanitária", detalhe: <>{a.nomeProdutoAplicado} · {a.dose} {unidadeSanitaria(a.unidadeDose)}<small className="block text-muted-foreground">{dataAplicacaoSanitaria(a)}</small></>, Icone: Syringe, abrir: () => navegarPara(`/pecuaria/sanidade?aba=aplicacoes&animalId=${animal.id}&aplicacaoId=${a.id}`) })),
    ...(dados?.exames ?? []).map(e => ({ id: `exame-${e.id}`, data: e.data, titulo: e.status === "ANULADO" ? "Exame · anulado" : "Coleta / exame", detalhe: <>{e.tipoExame?.nome ?? "Exame"}<small className="block text-muted-foreground">{resultadoExameSanitario(e)}</small></>, Icone: FlaskConical, abrir: () => navegarPara(`/pecuaria/sanidade?aba=exames&animalId=${animal.id}&detalheTipo=exame&detalheId=${e.id}`) })),
  ];
  eventos.sort((a, b) => b.data.slice(0, 10).localeCompare(a.data.slice(0, 10)) || a.id.localeCompare(b.id));
  return <section className="ficha-historico-visual rounded-xl border border-border bg-card mt-4" aria-label="Linha do tempo do animal"><div className="p-4 border-b border-border text-sm"><strong>Histórico do animal</strong><span className="ml-3 text-muted-foreground">Datas dos fatos · auditoria separada abaixo</span></div><ErrorBox erro={erro} />{erro && <div className="p-4"><p className="mb-2 text-sm">Registros sanitários indisponíveis; os demais fatos permanecem visíveis.</p><Button secondary onClick={() => setTentativa(v => v + 1)}>Tentar novamente</Button></div>}{!dados && !erro && ativo && <p role="status" className="px-4 pt-4 text-sm">Consultando registros sanitários…</p>}{eventos.length ? <LinhaTempoConsulta rotulo="Fatos do animal por data" itens={eventos} dataDe={e => e.data} chaveDe={e => e.id} render={e => <CartaoConsulta icon={e.Icone} titulo={e.titulo} onAbrir={e.abrir}><div className="text-sm">{e.detalhe}</div></CartaoConsulta>} /> : <p className="p-5 text-sm">Nenhum fato encontrado.</p>}{dados && (dados.exames.length >= 50 || dados.aplicacoes.length >= 50) && <p className="p-4 text-sm text-muted-foreground">Até 50 registros de cada consulta sanitária. Consulte os demais pela aba Sanidade.</p>}</section>;
}

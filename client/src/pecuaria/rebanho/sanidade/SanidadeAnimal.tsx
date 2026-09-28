import { useEffect, useState } from "react";
import { Syringe } from "lucide-react";
import { CardFicha } from "../ui";
import { formatarDataBR } from "../lib/rotulos";
import { consultarCarencia, listarAplicacoes, type AplicacaoSanitaria, type CarenciaAnimal } from "./api";
import { FormAplicacaoServico } from "./FormAplicacaoServico";

function resumo(estado: CarenciaAnimal["leite"]): string {
  if (estado.estado === "NENHUMA") return "Sem aplicação ativa";
  if (estado.estado === "NAO_INFORMADO") return "Carência não informada";
  return `Até ${new Date(estado.ate).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}${estado.precisaoAproximada ? " (aproximado)" : ""}`;
}

export function SanidadeAnimal({ animalId, propriedadeId, podeLancar, recarregarToken }: {
  animalId: string; propriedadeId: number | null; podeLancar: boolean; recarregarToken: number;
}) {
  const [aplicacoes, setAplicacoes] = useState<AplicacaoSanitaria[]>([]);
  const [carencia, setCarencia] = useState<CarenciaAnimal | null>(null);
  const [aberto, setAberto] = useState(false);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    Promise.all([listarAplicacoes(animalId), consultarCarencia(animalId)])
      .then(([lista, prazos]) => { if (vivo) { setAplicacoes(lista); setCarencia(prazos); setErro(null); } })
      .catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [animalId, recarregarToken, versao]);

  return <CardFicha icon={Syringe} titulo="Sanidade" className="lg:col-span-2"
    acao={podeLancar && propriedadeId != null ? <button type="button" className="text-xs font-semibold text-green-800" onClick={() => setAberto(true)}>Registrar aplicação do Serviço</button> : undefined}>
    {erro && <p className="text-sm text-red-700">{erro}</p>}
    <div className="grid gap-2 text-sm sm:grid-cols-2"><p><strong>Leite:</strong> {carencia ? resumo(carencia.leite) : "Carregando…"}</p><p><strong>Carne:</strong> {carencia ? resumo(carencia.carne) : "Carregando…"}</p></div>
    <div className="mt-4 space-y-2">{aplicacoes.length ? aplicacoes.map((a) => <div key={a.id} className="rounded-lg border border-border p-3 text-sm">
      <div className="font-semibold text-ink">{a.nomeProdutoAplicado} · {a.dose} {a.unidadeDose ?? ""}</div>
      <p className="text-ink-3">{formatarDataBR(a.data)} · {a.finalidade === "VACINA" ? "Vacina" : a.finalidade === "VERMIFUGO" ? "Vermífugo" : "Tratamento"} · {a.origemInsumo === "INCLUSO_SERVICO" ? "Dose inclusa em Serviço" : a.origemInsumo === "BAIXA_ESTOQUE" ? "Estoque" : a.origemInsumo === "COMPRA_CONSUMO_DIRETO" ? "Compra direta" : "Origem justificada"}{a.status === "ANULADO" ? " · Anulada" : ""}</p>
    </div>) : <p className="text-sm text-ink-3">Nenhuma aplicação registrada.</p>}</div>
    {aberto && propriedadeId != null && <FormAplicacaoServico animalId={animalId} propriedadeId={propriedadeId} onFechar={() => setAberto(false)} onSalvo={() => { setAberto(false); setVersao((v) => v + 1); }} />}
  </CardFicha>;
}

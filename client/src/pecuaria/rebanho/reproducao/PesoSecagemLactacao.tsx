import { Button } from "../../../financeiro/financeiro-ui";
import { formatarDataBR } from "../lib/rotulos";
import { formatarKg, rotuloContextoPeso, rotuloOrigemPesagem, rotuloPrecisaoPeso } from "../lib/peso";
import type { LactacaoReprodutiva, VinculoPesagemSecagem } from "./api";
import { vinculoSecagemAtivo } from "./peso-secagem";

function pesoPreservado(vinculo: VinculoPesagemSecagem) {
  const snapshot = vinculo.evidenciaSnapshot;
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot) || !("pesagem" in snapshot)) return null;
  const pesagem = snapshot.pesagem;
  if (typeof pesagem !== "object" || pesagem === null || Array.isArray(pesagem)) return null;
  const dados = pesagem as Record<string, unknown>;
  if (dados.id !== vinculo.pesagemId || typeof dados.data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) return null;
  const data = new Date(`${dados.data}T00:00:00Z`);
  if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== dados.data) return null;
  if (typeof dados.pesoKg !== "number" && (typeof dados.pesoKg !== "string" || !/^\d+(?:\.\d+)?$/.test(dados.pesoKg))) return null;
  const pesoKg = Number(dados.pesoKg);
  if (!Number.isFinite(pesoKg) || pesoKg <= 0 || pesoKg > 9999.99) return null;
  return { data: dados.data, pesoKg, precisao: typeof dados.precisao === "string" ? dados.precisao : undefined };
}

export function PesoSecagemLactacao({ lactacao, podeLancar, onGerenciar }: { lactacao: LactacaoReprodutiva; podeLancar: boolean; onGerenciar: () => void }) {
  const ativo = vinculoSecagemAtivo(lactacao), vinculos = lactacao.vinculosPesagemSecagem ?? [];
  if (!lactacao.encerradaEm && !vinculos.length) return null;
  return <section className="w-full min-w-0 space-y-3" aria-label="Peso no encerramento da lactação"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h4 className="font-semibold">Peso da matriz no encerramento</h4>{ativo ? <><p className="mt-1 text-lg font-semibold">{formatarKg(Number(ativo.pesagem.pesoKg))}</p><p className="text-sm text-ink-3">{formatarDataBR(ativo.pesagem.data)} · {rotuloPrecisaoPeso(ativo.pesagem.precisao)} · {rotuloOrigemPesagem(ativo.pesagem.origem)} · {rotuloContextoPeso(ativo.pesagem.contextoHistorico)}</p><p className="mt-1 break-all text-xs text-ink-3">Registro: {ativo.pesagemId}</p></> : <p className="mt-1 text-sm text-ink-3">Nenhum peso vinculado ao encerramento.</p>}</div>{podeLancar && lactacao.encerradaEm && <Button secondary onClick={onGerenciar}>{ativo ? "Manter vínculo de peso" : "Adicionar peso"}</Button>}</div>
    {vinculos.length > 0 && <details className="text-sm"><summary className="cursor-pointer py-2 font-semibold">Histórico dos vínculos do peso</summary><div className="overflow-x-auto"><table className="w-full text-left text-sm consulta-tabela"><thead><tr><th className="p-2">Pesagem</th><th className="p-2">Vínculo</th><th className="p-2">Autoria</th><th className="p-2">Revogação e motivo</th></tr></thead><tbody>{vinculos.map(v => { const preservado = v.revogadoEm ? pesoPreservado(v) : null; const pesoExibido = preservado ?? v.pesagem; return <tr key={v.id}><td className="p-2"><p>{formatarDataBR(pesoExibido.data)} · {formatarKg(Number(pesoExibido.pesoKg))} · {rotuloPrecisaoPeso(pesoExibido.precisao)}</p>{v.revogadoEm && !preservado && <p className="text-xs text-ink-3">Valor atual; snapshot indisponível</p>}<p className="break-all text-xs text-ink-3">{v.pesagemId}</p></td><td className="p-2">{v.revogadoEm ? "Revogado" : "Ativo"}</td><td className="p-2">Usuário {v.criadoPorId ?? "não informado"} · {formatarDataBR(v.criadoEm)}</td><td className="p-2">{v.revogadoEm ? <><p>Usuário {v.revogadoPorId ?? "não informado"} · {formatarDataBR(v.revogadoEm)}</p><p className="break-words">{v.motivoRevogacao ?? "Motivo não informado"}</p></> : "—"}</td></tr>; })}</tbody></table></div></details>}
  </section>;
}

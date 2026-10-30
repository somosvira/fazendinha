import { useEffect, useState } from "react";
import { CampoFormulario, classeInput } from "../../../financeiro/PainelCadastro";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { DatePicker } from "../../../components/DatePicker";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { formatarDataBR } from "../lib/rotulos";
import { formatarKg, rotuloContextoPeso, rotuloOrigemPesagem, rotuloPrecisaoPeso } from "../lib/peso";
import { reqV4, type PesagemSecagem, type PrecisaoPesoSecagem } from "./api";
import { incompatibilidadePesoSecagem, rotuloTipoPesoSecagem, type DadosPesoSecagem } from "./peso-secagem";

export function PesoSecagemCampos({ animalId, propriedadeId, dataEncerramento, valor, onChange, erros = {}, permitirAusente = true, escolhaFixa = false }: {
  animalId: string; propriedadeId?: number; dataEncerramento: string; valor: DadosPesoSecagem;
  onChange: (dados: DadosPesoSecagem) => void; erros?: Record<string, string>; permitirAusente?: boolean; escolhaFixa?: boolean;
}) {
  const [pesagens, setPesagens] = useState<PesagemSecagem[]>([]);
  const [carregando, setCarregando] = useState(false), [erro, setErro] = useState<string | null>(null), [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (valor.acao !== "VINCULAR") return;
    let vivo = true; setCarregando(true); setErro(null); setPesagens([]);
    reqV4<{ historicoPesagens: PesagemSecagem[] }>(`/animais/${encodeURIComponent(animalId)}`, undefined, "GET", propriedadeId)
      .then(ficha => { if (vivo) setPesagens(ficha.historicoPesagens); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [animalId, propriedadeId, valor.acao, tentativa]);
  return <section className="grid gap-4" aria-label="Peso da matriz no encerramento">
    {!escolhaFixa && <CampoFormulario id="peso-secagem-acao" rotulo="Como deseja informar o peso?" erro={erros.acao}>{p => <SelectCampo {...p} className={classeInput} value={valor.acao} onValueChange={acao => onChange({ ...valor, acao: acao as DadosPesoSecagem["acao"], pesagemId: "", selecionada: undefined })}>{permitirAusente && <option value="NAO_INFORMAR">Não informar peso</option>}{!permitirAusente && <option value="NAO_INFORMAR">Selecione uma opção</option>}<option value="REGISTRAR">Registrar pesagem</option><option value="VINCULAR">Reutilizar pesagem existente</option></SelectCampo>}</CampoFormulario>}
    {valor.acao === "NAO_INFORMAR" && permitirAusente && <p className="text-sm text-ink-3">Você pode encerrar sem peso e acrescentar o vínculo depois.</p>}
    {valor.acao === "REGISTRAR" && <><div className="grid gap-4 sm:grid-cols-2">
      <CampoFormulario id="peso-secagem-data" rotulo="Data real da pesagem" obrigatorio erro={erros.data}>{p => <DatePicker {...p} required max={hoje()} value={valor.data} onChange={data => onChange({ ...valor, data })} className="mt-1.5" />}</CampoFormulario>
      <CampoFormulario id="peso-secagem-pesoKg" rotulo="Peso da matriz (kg)" obrigatorio erro={erros.pesoKg}>{p => <input {...p} className={classeInput} type="number" min="0.01" max="9999.99" step="0.01" required value={valor.pesoKg} onChange={e => onChange({ ...valor, pesoKg: e.target.value })} />}</CampoFormulario>
      <CampoFormulario id="peso-secagem-origem" rotulo="Origem" erro={erros.origem}>{p => <SelectCampo {...p} className={classeInput} value={valor.origem} onValueChange={origem => onChange({ ...valor, origem: origem as DadosPesoSecagem["origem"], precisao: origem === "BALANCA" && ["ESTIMADO", "INFORMADO"].includes(valor.precisao) ? "NAO_INFORMADO" : valor.precisao })}><option value="MANUAL">Manual</option><option value="BALANCA">Balança</option></SelectCampo>}</CampoFormulario>
      <CampoFormulario id="peso-secagem-precisao" rotulo="Precisão" erro={erros.precisao}>{p => <SelectCampo {...p} className={classeInput} value={valor.precisao} onValueChange={precisao => onChange({ ...valor, precisao: precisao as PrecisaoPesoSecagem })}>{(["NAO_INFORMADO", "MEDIDO", "ESTIMADO", "INFORMADO"] as const).map(precisao => <option key={precisao} value={precisao} disabled={valor.origem === "BALANCA" && ["ESTIMADO", "INFORMADO"].includes(precisao)}>{rotuloPrecisaoPeso(precisao)}</option>)}</SelectCampo>}</CampoFormulario>
    </div><CampoFormulario id="peso-secagem-observacao" rotulo="Observação da pesagem" erro={erros.observacao}>{p => <textarea {...p} className={classeInput} maxLength={500} rows={2} value={valor.observacao} onChange={e => onChange({ ...valor, observacao: e.target.value })} />}</CampoFormulario><p className="text-xs text-ink-3">A data precisa ser igual ao encerramento. O servidor confere animal, localização histórica e vínculos ativos.</p></>}
    {valor.acao === "VINCULAR" && <><ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setTentativa(v => v + 1)}>Tentar novamente</Button>}<CampoFormulario id="peso-secagem-pesagemId" rotulo="Pesagem existente" obrigatorio erro={erros.pesagemId}>{p => <SelectCampo {...p} className={classeInput} disabled={carregando || !!erro} value={valor.pesagemId} onValueChange={pesagemId => onChange({ ...valor, pesagemId, selecionada: pesagens.find(pesagem => pesagem.id === pesagemId) })}><option value="">{carregando ? "Carregando pesagens…" : "Selecione a pesagem"}</option>{pesagens.map(pesagem => { const incompatibilidade = incompatibilidadePesoSecagem(pesagem, dataEncerramento, propriedadeId); return <option key={pesagem.id} value={pesagem.id} disabled={!!incompatibilidade}>{formatarDataBR(pesagem.data)} — {formatarKg(Number(pesagem.pesoKg))} · {rotuloPrecisaoPeso(pesagem.precisao)} · {rotuloOrigemPesagem(pesagem.origem)}{incompatibilidade ? ` — ${incompatibilidade}` : ""}</option>; })}</SelectCampo>}</CampoFormulario>{!carregando && !erro && !pesagens.length && <p className="text-sm">Nenhuma pesagem registrada para esta matriz.</p>}{valor.selecionada && <dl className="grid gap-2 text-sm"><div><dt className="text-ink-3">Registro original</dt><dd className="break-all">{valor.selecionada.id}</dd></div><div><dt className="text-ink-3">Tipo do registro original</dt><dd>{rotuloTipoPesoSecagem(valor.selecionada.tipo)}</dd></div><div><dt className="text-ink-3">Precisão e contexto</dt><dd>{rotuloPrecisaoPeso(valor.selecionada.precisao)} · {rotuloContextoPeso(valor.selecionada.contextoHistorico)}</dd></div></dl>}<p className="text-xs text-ink-3">Reutilizar conserva o ID, tipo, origem e precisão. Dados desconhecidos permanecem desconhecidos; o sítio será comprovado pelo histórico, sem usar a localização de hoje.</p></>}
  </section>;
}

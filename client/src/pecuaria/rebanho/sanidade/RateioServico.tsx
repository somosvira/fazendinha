import { SelectCampo } from "@/financeiro/SelectCampo";
import { useState } from "react";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { type ServicoSanitario } from "./api";
import { GerenciarProcedimentosServico } from "./GerenciarProcedimentosServico";
import { Button } from "../../../financeiro/financeiro-ui";
export function RateioServico({ propriedadeId, servicos, onFechar, onSalvo }: { propriedadeId: number | null; servicos: ServicoSanitario[]; onFechar: () => void; onSalvo?: () => Promise<void> | void }) {
  const [servicoId, setServicoId] = useState("");
  const selecionado = servicos.find((s) => s.id === servicoId);
  const sitioServico = selecionado?.propriedadeId ?? propriedadeId;
  if (selecionado && sitioServico != null) return <GerenciarProcedimentosServico servicoId={servicoId} propriedadeId={sitioServico} onFechar={onFechar} onSalvo={onSalvo} />;
  return <PainelCadastro compacto aberto titulo="Gerenciar procedimentos" onFechar={onFechar} rodape={<Button onClick={onFechar}>Fechar</Button>}><p className="mb-4 text-sm text-ink-3">Escolha um Serviço confirmado para consultar os procedimentos vinculados ou adicionar procedimentos já realizados. Nenhum fato sanitário será criado nesta seleção.</p><label className="text-sm">Serviço confirmado<SelectCampo className={classeInput} value={servicoId} onValueChange={(valorSelecionado) => setServicoId(valorSelecionado)}><option value="">Selecione</option>{servicos.map((s) => <option key={s.id} value={s.id}>#{s.numero} · {s.descricao ?? "Serviço"} · {s.propriedade?.nome ?? "Sítio não informado"} · {s.parceiro?.nome ?? "Prestador não informado"}</option>)}</SelectCampo></label>{!servicos.length && <p className="mt-3 text-sm">Nenhum Serviço confirmado neste sítio. Lance o atendimento no Financeiro para associar procedimentos.</p>}</PainelCadastro>;
}

import { useState } from "react";
import { DialogFinanceiro } from "./DialogFinanceiro";
import { Button, hoje } from "./financeiro-ui";
import type { AnimalCompraForm } from "./AnimaisCompra";
import { formAnimalInicial } from "../pecuaria/rebanho/forms/CadastroAnimal";

export function animalArremateSimulado(): AnimalCompraForm {
  const dataEntrada = hoje();
  const nome = "Matriz Nelore · simulação";
  const brinco = "SIM-ERURAL-40";
  const dataNascimento = "2016-07-29";
  const observacao = "Piloto simulado eRural · Univida, lote 40 · registro declarado GSC-5144.";
  return {
    id: 1,
    cadastro: { ...formAnimalInicial(dataEntrada), nome, brinco, dataNascimento, observacao, aptidao: "CORTE" },
    payload: {
      nome, brinco, dataNascimento, dataEntrada, observacao, aptidao: "CORTE", sexo: "F",
      brincoEletronico: null, sisbov: null, nascimentoEstimado: false, partosAntesDaEntrada: 0,
      loteId: null, papelReprodutivo: "NENHUM", composicao: [], pesoEntradaKg: null,
      maeId: null, maeExternaId: null, paiId: null, paiExternoId: null,
    },
    entradaSegueOperacao: true,
    resumo: { nome, brinco, sexo: "F", aptidao: "CORTE" },
    pesoPago: "", preco: "", categoriaId: "", centroCustoId: "",
  };
}

export function ArremateSimulado({ onFechar, onRevisar }: { onFechar: () => void; onRevisar: () => void }) {
  const [conferiu, setConferiu] = useState(false);
  return <DialogFinanceiro titulo="Conferir compra de leilão" eyebrow="Confirmação simulada · eRural" onClose={onFechar}
    rodape={<div className="flex justify-end gap-2"><Button secondary onClick={onFechar}>Fechar</Button><Button disabled={!conferiu} onClick={onRevisar}>Revisar compra</Button></div>}>
    <div className="space-y-4 p-5">
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div><dt>Animal</dt><dd className="font-semibold">Matriz Nelore</dd></div>
        <div><dt>Registro informado</dt><dd className="font-semibold">GSC-5144</dd></div>
        <div><dt>Evento e lote</dt><dd className="font-semibold">Univida · lote 40</dd></div>
        <div><dt>Preço confirmado</dt><dd className="font-semibold">Informe um valor de teste</dd></div>
      </dl>
      <a className="text-primary underline" href="https://www.erural.net/evento/1-leilao-univida-969a/lotes/lote-40-4157" target="_blank" rel="noreferrer">Abrir catálogo do lote</a>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={conferiu} onChange={e => setConferiu(e.target.checked)} />Estou testando no sítio selecionado.</label>
    </div>
  </DialogFinanceiro>;
}

import { expect, it } from "vitest";
import { dadosAvaliacaoVisita } from "./visitas.js";
const id="a0000000-0000-4000-8000-000000000001",tipo="a0000000-0000-4000-8000-000000000002";
it("a visita usa o mesmo rascunho e a origem congelada na prévia e confirmação",()=>{
 const rascunho={ tipoExameId:tipo, formatoExameHash:"a".repeat(64),resultado:"NAO_AVALIADO",realizadoSemDG:true,resultadoAptidao:"INCONCLUSIVO",avaliacaoContextual:{catalogoId:id,itens:[{codigo:"APTIDAO",estado:"INCONCLUSIVO"}],condutas:[]} };
 const snapshot={acompanhamento:{id,finalidade:"DIAGNOSTICO",tentativaId:id,gestacaoId:null,regraSnapshot:{tipoExameId:tipo}}};
 const primeira=dadosAvaliacaoVisita(rascunho,rascunho,snapshot,id,7,"2026-11-01",id);
 expect(primeira).toMatchObject({animalId:id,propriedadeId:7,data:"2026-11-01",demandaAcompanhamentoId:id,tentativaId:id,resultado:"NAO_AVALIADO",realizadoSemDG:true,formatoExameHash:"a".repeat(64)});
 expect(()=>dadosAvaliacaoVisita({...rascunho,animalId:tipo},rascunho,snapshot,id,7,"2026-11-01",id)).toThrow(/participante/);
});

import { useEffect, useState } from "react";
import type { EtapaIatf } from "../reproducao/Iatf";
import { obterAcoesCadastro, obterCadastroProtocolo } from "./cadastros-api";
export type AcaoInicioProtocolo = EtapaIatf & { id: string };
/** A preparação precisa de todas as ações da mesma revisão, inclusive depois da página 1. */
export function useAcoesInicioProtocolo(protocoloId: string, propriedadeId: number | undefined) {
  const chave = `${propriedadeId}:${protocoloId}`;
  const [tentativa, setTentativa] = useState(0);
  const [estado, setEstado] = useState<{chave:string;etapas:AcaoInicioProtocolo[]|null;erro:string|null}>({chave:"",etapas:null,erro:null});
  useEffect(()=>{
    let vivo=true;
    setEstado({chave,etapas:null,erro:null});
    if(!protocoloId)return ()=>{vivo=false;};
    void (async()=>{
      try {
        const modelo=await obterCadastroProtocolo(protocoloId);
        if(!modelo.publicado||!modelo.ativo)throw new Error("Escolha uma versão publicada e ativa.");
        const etapas:AcaoInicioProtocolo[]=[];
        let pagina=1,total=1;
        while(etapas.length<total){
          const dados=await obterAcoesCadastro<AcaoInicioProtocolo>(modelo,pagina);
          if(!vivo)return;
          if(dados.pagina!==pagina)throw new Error("A versão mudou durante a consulta. Atualize as etapas.");
          etapas.push(...dados.itens);total=dados.total;pagina++;
          if(!dados.itens.length&&etapas.length<total)throw new Error("Não foi possível carregar todas as etapas. Atualize a consulta.");
        }
        if(vivo)setEstado({chave,etapas,erro:null});
      }catch(e){if(vivo)setEstado({chave,etapas:null,erro:e instanceof Error?e.message:String(e)});}
    })();
    return ()=>{vivo=false;};
  },[chave,protocoloId,tentativa]);
  return {etapas:estado.chave===chave?estado.etapas:null,erro:estado.chave===chave?estado.erro:null,recarregar:()=>setTentativa(v=>v+1)};
}

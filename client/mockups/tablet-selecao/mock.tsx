import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { SubTabs } from "../../src/components/SubTabs";
import { Button } from "../../src/components/ui/button";
import { Plus, X } from "lucide-react";
import "../../src/styles/theme.css";
import "../../src/styles/base.css";
import "../../src/styles/forms.css";
import "../../src/pecuaria/rebanho/sanidade/aplicacoes-tablet.css";
import "../../src/styles/cooperativa-theme.css";
import "../../src/styles/operacional-aprovado.css";
import "../../src/styles/campo.css";
import "../../src/styles/abas.css";
import "./preview.css";
function Preview() {
 const [aba, setAba] = useState("registro");
 const [animais, setAnimais] = useState([{ id: "1", brinco: "1023", nome: "Vaca de teste 1023" }, { id: "2", brinco: "DEV-001", nome: "Lactantes 1" }]);
 return <main className="preview-tablet app-main pecuaria-content" data-design-operacional><p className="preview-identificador">Prévia de organização</p><section className="tablet-aplicacao">
  <SubTabs ariaLabel="Aplicações do tablet" tabs={[{ id: "registro", label: "Tablet" }, { id: "aprovacao", label: "Aprovação" }, { id: "templates", label: "Templates" }]} active={aba} onSelect={setAba}/>
  <header><h1>Registrar aplicações</h1><p className="tablet-secundario">Sítio principal · Fellipe</p></header>
  <ol className="tablet-etapas"><li aria-current="step">1 <strong>Vacas</strong></li><li>2 <strong>Medicamentos</strong></li><li>3 <strong>Revisão</strong></li></ol>
  <section className="tablet-painel"><div className="tablet-linha"><h2>Escolher a vaca</h2><div className="tablet-seletor"><Button variant="ghost" aria-pressed>Número</Button><Button variant="ghost">Nome</Button></div></div>
  <input className="tablet-aplicacao-input" placeholder="Digite o número da vaca" readOnly/>
  <div className="preview-selecionadas"><h3>Vacas selecionadas <span>{animais.length}</span></h3><ul>{animais.map(a=><li key={a.id}><div><strong>{a.brinco}</strong><p>{a.nome}</p></div><Button type="button" variant="outline" className="preview-remover" aria-label={`Remover ${a.brinco}`} onClick={()=>setAnimais(atual=>atual.filter(v=>v.id!==a.id))}><X size={20} className="!size-5" aria-hidden/></Button></li>)}</ul><Button variant="outline"><Plus size={18} aria-hidden/>Adicionar mais vacas</Button></div>
  <div className="tablet-acoes"><Button>Próximo</Button></div></section>
 </section></main>;
}
createRoot(document.getElementById("root")!).render(<Preview/>);

/* Rio Novo — raiz */

import { useState } from "react";
import { Masthead, type Tab } from "./components/Shell";
import { Dashboard } from "./components/Dashboard";
import { Gastos } from "./components/Gastos";
import { Lancar } from "./components/Lancar";
import { PlanoContas } from "./components/PlanoContas";
import { IA } from "./components/IA";
import { Relatorio } from "./components/Relatorio";

export function App() {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <>
      <Masthead current={tab} onNav={setTab} />
      {tab === "dashboard" && <Dashboard onNav={setTab} />}
      {tab === "gastos" && <Gastos onNav={setTab} />}
      {tab === "lancar" && <Lancar onNav={setTab} />}
      {tab === "plano" && <PlanoContas onNav={setTab} />}
      {tab === "ia" && <IA />}
      {tab === "relatorio" && <Relatorio onNav={setTab} />}
    </>
  );
}

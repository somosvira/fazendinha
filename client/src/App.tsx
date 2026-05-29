import { useEffect, useState } from "react";
import { apiGet } from "./api";

type HealthState =
  | { status: "loading" }
  | { status: "up" }
  | { status: "down"; reason: string };

export function App() {
  const [api, setApi] = useState<HealthState>({ status: "loading" });
  const [db, setDb] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    apiGet<{ ok: boolean }>("/health")
      .then((r) => setApi(r.ok ? { status: "up" } : { status: "down", reason: "resposta inválida" }))
      .catch((e: Error) => setApi({ status: "down", reason: e.message }));

    apiGet<{ ok: boolean; db?: string; error?: string }>("/health/db")
      .then((r) =>
        setDb(r.ok ? { status: "up" } : { status: "down", reason: r.error ?? "db indisponível" })
      )
      .catch((e: Error) => setDb({ status: "down", reason: e.message }));
  }, []);

  return (
    <div className="app">
      <header>
        <h1>Fazenda Rio Novo</h1>
        <small>setup pronto — aguardando design</small>
      </header>
      <main>
        <section className="card">
          <h2>Status</h2>
          <ul>
            <li>
              API: <StatusBadge state={api} />
            </li>
            <li>
              Banco (Neon): <StatusBadge state={db} />
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function StatusBadge({ state }: { state: HealthState }) {
  if (state.status === "loading") return <span className="badge loading">verificando…</span>;
  if (state.status === "up") return <span className="badge up">up</span>;
  return (
    <span className="badge down" title={state.reason}>
      down ({state.reason})
    </span>
  );
}

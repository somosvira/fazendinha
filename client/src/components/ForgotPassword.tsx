import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { solicitarRecuperacao } from "../api/auth";
import { TerranoSymbol } from "./TerranoLogo";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const submeter = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await solicitarRecuperacao(email.trim().toLowerCase());
      setConcluido(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível enviar a solicitação.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 font-[family-name:var(--sans)]">
      <section className="w-full max-w-[420px] rounded-[14px] border border-border bg-card px-7 py-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
        <div className="mb-7 flex items-center gap-2.5">
          <TerranoSymbol size={28} tone="light" strokeWidth={4.4} />
          <span className="font-[family-name:var(--serif)] text-[22px] font-medium text-foreground">Terrano</span>
        </div>
        <h1 className="font-[family-name:var(--serif)] text-[30px] font-medium tracking-[-0.02em] text-foreground">
          Recuperar senha
        </h1>

        {concluido ? (
          <div aria-live="polite">
            <p className="mt-3 text-[14px] leading-6 text-ink-3">
              Se existir uma conta com esse e-mail, você receberá um link para redefinir a senha. Verifique também a caixa de spam.
            </p>
            <a className="mt-6 inline-block text-[14px] font-semibold text-[color:var(--cafe)] hover:underline" href="/signin">
              Voltar para entrar
            </a>
          </div>
        ) : (
          <form onSubmit={submeter} className="mt-3">
            <p className="mb-6 text-[14px] leading-6 text-ink-3">
              Informe seu e-mail de acesso. Se a conta existir, enviaremos um link de uso único.
            </p>
            <label htmlFor="recuperacao-email" className="mb-2 block text-[12.5px] font-medium text-ink-2">
              E-mail
            </label>
            <Input
              id="recuperacao-email"
              type="email"
              autoFocus
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              disabled={enviando}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-[9px] bg-background text-[15px]"
            />
            {erro && <p className="mt-3 text-[13px] text-destructive">{erro}</p>}
            <Button type="submit" disabled={!email || enviando} className="mt-5 w-full rounded-[9px]">
              {enviando ? "Enviando…" : "Enviar link de recuperação"}
            </Button>
            <a className="mt-5 block text-center text-[14px] font-medium text-[color:var(--cafe)] hover:underline" href="/signin">
              Voltar para entrar
            </a>
          </form>
        )}
      </section>
    </main>
  );
}

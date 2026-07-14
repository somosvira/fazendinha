/* Tela de login — e-mail + senha (usuários reais do backend).
 *
 * `onEntrar` recebe o token de sessão e o usuário validados pelo backend.
 * Quem chama (App) persiste a sessão e transiciona pro app EM ESTADO — sem
 * window.location.reload(). O reload mataria a "sticky activation" do documento
 * e a música da abertura Terrano, ancorada neste clique, voltaria a ser
 * bloqueada.
 *
 * Design: layout centrado, cream premium (cantos arredondados são exceção
 * proposital ao visual reto do app), botão gray-out enquanto valida. */

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "../api/auth";
import type { UsuarioSessao } from "../lib/auth";

export function Login({ onEntrar }: { onEntrar: (token: string, usuario: UsuarioSessao) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !senha || validando) return;
    setValidando(true);
    setErro(null);
    try {
      const { token, usuario } = await login(email.trim().toLowerCase(), senha);
      onEntrar(token, usuario);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha de rede.");
      setValidando(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <form
        onSubmit={submeter}
        className="flex w-full max-w-[380px] flex-col gap-2.5 rounded-[14px] border border-border bg-card px-[26px] py-7 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
      >
        <div className="font-serif text-[15px] tracking-[0.02em] text-ink-3">Fazenda Rio Novo</div>
        <div className="mb-1 font-serif text-[26px] leading-[1.1] text-foreground">Entrar</div>
        <Label
          htmlFor="login-email"
          className="mt-1 text-xs font-normal uppercase tracking-[0.05em] text-ink-3"
        >
          E-mail
        </Label>
        <Input
          id="login-email"
          type="email"
          autoFocus
          autoComplete="username"
          value={email}
          disabled={validando}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-[8px] bg-background text-[15px] focus-visible:ring-atencao focus-visible:ring-offset-0"
        />
        <Label
          htmlFor="login-senha"
          className="mt-1 text-xs font-normal uppercase tracking-[0.05em] text-ink-3"
        >
          Senha
        </Label>
        <Input
          id="login-senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          disabled={validando}
          onChange={(e) => setSenha(e.target.value)}
          className="rounded-[8px] bg-background text-[15px] focus-visible:ring-atencao focus-visible:ring-offset-0"
        />
        {erro && <div className="text-[13px] text-destructive">{erro}</div>}
        <Button
          type="submit"
          disabled={!email || !senha || validando}
          className="mt-2 rounded-[8px] bg-foreground text-background hover:bg-foreground/90"
        >
          {validando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}

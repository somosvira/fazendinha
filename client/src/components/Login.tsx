/* Tela de login mínima do piloto (fase de teste com o dono).
 *
 * Entrada única: senha compartilhada (matches `env.SHARED_ACCESS_TOKEN` do server).
 * Não é sistema de usuários — quando escalar, trocar por Firebase/Auth0/Supabase
 * (o único ponto do cliente a mudar é `lib/auth.ts`).
 *
 * Design: layout centrado, cream premium (cantos arredondados são exceção
 * proposital ao visual reto do app), botão gray-out enquanto valida. */

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// `onEntrar` recebe a senha validada. Quem chama (App) persiste o token e
// transiciona pro app EM ESTADO — sem window.location.reload(). O reload
// mataria a "sticky activation" do documento e a música da abertura Terrano,
// que é ancorada justamente neste clique, voltaria a ser bloqueada.
export function Login({ onEntrar }: { onEntrar: (senha: string) => void }) {
  const [senha, setSenha] = useState("");
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!senha || validando) return;
    setValidando(true);
    setErro(null);
    try {
      // Ping numa rota qualquer com o token — se voltar 200/204, o token vale.
      // /api/propriedades é leve, existe desde a Fatia 0 e passa pelo middleware.
      const res = await fetch("/api/propriedades", {
        headers: { authorization: `Bearer ${senha}` },
      });
      if (res.status === 401) {
        setErro("Senha inválida.");
        setValidando(false);
        return;
      }
      if (!res.ok) {
        setErro(`Erro ao validar (${res.status}). Tenta de novo.`);
        setValidando(false);
        return;
      }
      // Sem reload: entrega a senha ao App, que grava o token e troca de tela
      // em estado. Assim o gesto deste clique continua valendo no mesmo
      // documento e a música da intro toca junto com a logo.
      onEntrar(senha);
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
        <div className="mb-3 text-[13px] text-ink-3">
          Fase de teste — acesso por senha compartilhada.
        </div>
        <Label
          htmlFor="login-senha"
          className="mt-1 text-xs font-normal uppercase tracking-[0.05em] text-ink-3"
        >
          Senha
        </Label>
        <Input
          id="login-senha"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={senha}
          disabled={validando}
          onChange={(e) => setSenha(e.target.value)}
          className="rounded-[8px] bg-background text-[15px] focus-visible:ring-atencao focus-visible:ring-offset-0"
        />
        {erro && <div className="text-[13px] text-destructive">{erro}</div>}
        <Button
          type="submit"
          disabled={!senha || validando}
          className="mt-2 rounded-[8px] bg-foreground text-background hover:bg-foreground/90"
        >
          {validando ? "Validando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}

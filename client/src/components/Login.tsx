/* Tela de login mínima do piloto (fase de teste com o dono).
 *
 * Entrada única: senha compartilhada (matches `env.SHARED_ACCESS_TOKEN` do server).
 * Não é sistema de usuários — quando escalar, trocar por Firebase/Auth0/Supabase
 * (o único ponto do cliente a mudar é `lib/auth.ts`).
 *
 * Design: layout centrado, cream premium, sem logo/imagem. O botão gray-out
 * enquanto valida; erro inline em vermelho abaixo do input.
 */

import { FormEvent, useState } from "react";
import { setToken } from "../lib/auth";

export function Login() {
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
      setToken(senha);
      // Reload traz a app renderizando com o token gravado — evita gerenciar
      // um bus global de "acabei de logar" atravessando módulos.
      window.location.reload();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha de rede.");
      setValidando(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submeter}>
        <div className="login-brand">Fazenda Rio Novo</div>
        <div className="login-title">Entrar</div>
        <div className="login-caption">Fase de teste — acesso por senha compartilhada.</div>
        <label className="login-label" htmlFor="login-senha">
          Senha
        </label>
        <input
          id="login-senha"
          type="password"
          className="login-input"
          autoFocus
          autoComplete="current-password"
          value={senha}
          disabled={validando}
          onChange={(e) => setSenha(e.target.value)}
        />
        {erro && <div className="login-erro">{erro}</div>}
        <button className="login-btn" type="submit" disabled={!senha || validando}>
          {validando ? "Validando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

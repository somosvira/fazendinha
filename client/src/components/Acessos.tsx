/* Rio Novo — Acessos (controle de permissões, admin).
 * Port de src/components/Acessos.jsx. Lê PAPEIS/ABAS/FLAGS de data/acessos.
 */

import { useState } from "react";
import { ReportHeader } from "./Shell";
import { ABAS, FLAGS, PAPEIS, UPDATED_AT, type User } from "../data/acessos";
import { useToast } from "./Toast";
import { ConfirmDialog } from "./ConfirmDialog";

/* validação simples de email (suficiente p/ feedback antes do envio real) */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function StatusBadge({ status }: { status: User["status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    ativo: { label: "Ativo", cls: "ativo" },
    pendente: { label: "Convite pendente", cls: "pendente" },
    inativo: { label: "Inativo", cls: "inativo" },
  };
  const s = map[status] || map.ativo;
  return <span className={"status-badge " + s.cls}>{s.label}</span>;
}

function InviteModal({
  onClose,
  onInvite,
  existingEmails,
}: {
  onClose: () => void;
  onInvite: (v: { nome: string; email: string; papel: string }) => void;
  existingEmails: string[];
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("gestor");
  const [touched, setTouched] = useState(false);

  const emailNorm = email.trim().toLowerCase();
  const emailJaExiste = !!emailNorm && existingEmails.includes(emailNorm);
  const emailInvalido = !!emailNorm && !EMAIL_RE.test(emailNorm);
  const emailErr = touched
    ? emailInvalido
      ? "E-mail inválido."
      : emailJaExiste
        ? "Já existe um acesso com esse e-mail."
        : null
    : null;
  const podeEnviar = !!nome.trim() && !!emailNorm && !emailInvalido && !emailJaExiste;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="invite-ttl">
        <div className="modal-head">
          <span className="ttl" id="invite-ttl">Convidar pessoa</span>
          <button className="close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label" htmlFor="inv-nome">Nome</label>
            <input
              id="inv-nome" className="field-input" value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Sandra Oliveira"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="inv-email">E-mail</label>
            <input
              id="inv-email"
              className={"field-input" + (emailErr ? " is-error" : "")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="pessoa@email.com"
              aria-invalid={!!emailErr}
              aria-describedby={emailErr ? "inv-email-err" : undefined}
            />
            {emailErr && <span id="inv-email-err" className="field-error">{emailErr}</span>}
          </div>
          <div className="field">
            <label className="field-label">Papel inicial</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(PAPEIS)
                .filter(([k]) => k !== "proprietario")
                .map(([k, p]) => (
                  <button key={k} type="button" className={"papel-opt " + (papel === k ? "active" : "")} onClick={() => setPapel(k)}>
                    <span className="papel-radio">{papel === k ? "●" : "○"}</span>
                    <span className="papel-txt">
                      <strong>{p.nome}</strong>
                      <small>{p.desc}</small>
                    </span>
                  </button>
                ))}
            </div>
          </div>
          <div className="caption" style={{ fontStyle: "italic" }}>
            A pessoa recebe um e-mail com link de acesso. Você pode ajustar exatamente o que ela vê depois de convidar.
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={!podeEnviar}
            onClick={() => { setTouched(true); if (podeEnviar) onInvite({ nome: nome.trim(), email: emailNorm, papel }); }}
          >
            Enviar convite →
          </button>
        </div>
      </div>
    </div>
  );
}

function PermissionEditor({
  user,
  onChange,
  onViewAs,
  onResendInvite,
  onRevoke,
}: {
  user: User;
  onChange: (u: User) => void;
  onViewAs: (id: string) => void;
  onResendInvite: (u: User) => void;
  onRevoke: (u: User) => void;
}) {
  const applyPreset = (papelId: string) => {
    const preset = PAPEIS[papelId];
    onChange({ ...user, papel: papelId, abas: [...preset.abas], flags: [...preset.flags] });
  };
  const toggleAba = (id: string) => {
    const has = user.abas.includes(id);
    onChange({ ...user, abas: has ? user.abas.filter((a) => a !== id) : [...user.abas, id], papel: "personalizado" });
  };
  const toggleFlag = (id: string) => {
    const has = user.flags.includes(id);
    onChange({ ...user, flags: has ? user.flags.filter((f) => f !== id) : [...user.flags, id], papel: "personalizado" });
  };

  const papelNome = user.papel === "personalizado" ? "Personalizado" : PAPEIS[user.papel]?.nome || "—";

  return (
    <div className="perm-editor">
      <div className="perm-editor-head">
        <div className="perm-user">
          <div className="perm-avatar">{user.inicial}</div>
          <div>
            <div className="perm-user-nome">
              {user.nome}
              {user.dono && <span className="dono-tag">dono</span>}
            </div>
            <div className="perm-user-email">{user.email}</div>
          </div>
        </div>
        <StatusBadge status={user.status} />
      </div>

      {user.dono ? (
        <div className="perm-dono-note">
          <span className="serif" style={{ fontSize: 17 }}>
            Acesso total e irrevogável.
          </span>
          <p>Como proprietário, Marco vê tudo e é o único que gerencia acessos. Esse papel não pode ser reduzido.</p>
        </div>
      ) : (
        <>
          <div className="perm-block">
            <div className="perm-block-head">
              <span className="perm-block-title">Papel</span>
              <span className="perm-papel-atual">{papelNome}</span>
            </div>
            <div className="papel-chips">
              {Object.entries(PAPEIS)
                .filter(([k]) => k !== "proprietario")
                .map(([k, p]) => (
                  <button key={k} className={"papel-chip " + (user.papel === k ? "active" : "")} onClick={() => applyPreset(k)} title={p.desc}>
                    {p.nome}
                  </button>
                ))}
            </div>
          </div>

          <div className="perm-block">
            <div className="perm-block-head">
              <span className="perm-block-title">Abas que pode ver</span>
              <span className="perm-count">
                {user.abas.length} de {ABAS.length}
              </span>
            </div>
            <div className="perm-grid">
              {ABAS.map((aba) => {
                const on = user.abas.includes(aba.id);
                return (
                  <button key={aba.id} className={"perm-row " + (on ? "on" : "")} onClick={() => toggleAba(aba.id)}>
                    <span className="perm-check" data-on={on}>
                      {on && <span className="tick">✓</span>}
                    </span>
                    <span className="perm-row-txt">
                      <strong>{aba.label}</strong>
                      <small>{aba.desc}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="perm-block">
            <div className="perm-block-head">
              <span className="perm-block-title">Permissões sensíveis</span>
            </div>
            <div className="perm-grid">
              {FLAGS.map((flag) => {
                const on = user.flags.includes(flag.id);
                const isAdmin = flag.id === "gerenciarAcessos";
                return (
                  <button key={flag.id} className={"perm-row " + (on ? "on" : "") + (isAdmin ? " admin" : "")} onClick={() => toggleFlag(flag.id)}>
                    <span className="perm-check" data-on={on}>
                      {on && <span className="tick">✓</span>}
                    </span>
                    <span className="perm-row-txt">
                      <strong>
                        {flag.label}
                        {isAdmin && <span className="admin-tag">admin</span>}
                      </strong>
                      <small>{flag.desc}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="perm-actions">
            <button className="btn-secondary" onClick={() => onViewAs(user.id)}>
              Ver o sistema como {user.nome.split(" ")[0]} →
            </button>
            <div className="perm-actions-r">
              {user.status === "pendente" && (
                <button className="btn-ghost" onClick={() => onResendInvite(user)}>
                  Reenviar convite
                </button>
              )}
              <button className="btn-ghost danger" onClick={() => onRevoke(user)}>
                Revogar acesso
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Acessos({
  users,
  setUsers,
  onViewAs,
}: {
  users: User[];
  setUsers: (u: User[]) => void;
  onViewAs: (id: string) => void;
}) {
  const toast = useToast();
  const [selId, setSelId] = useState(users[0].id);
  const [showInvite, setShowInvite] = useState(false);
  const [revoking, setRevoking] = useState<User | null>(null);

  const sel = users.find((u) => u.id === selId) || users[0];
  const ativos = users.filter((u) => u.status === "ativo").length;
  const pendentes = users.filter((u) => u.status === "pendente").length;

  const updateUser = (next: User) => setUsers(users.map((u) => (u.id === next.id ? next : u)));
  const invite = ({ nome, email, papel }: { nome: string; email: string; papel: string }) => {
    const preset = PAPEIS[papel];
    const id = "u" + users.length + "-" + nome.trim().toLowerCase().replace(/\s+/g, "");
    const novo: User = {
      id,
      nome,
      email,
      inicial: nome.trim()[0]?.toUpperCase() || "?",
      papel,
      status: "pendente",
      ultimoAcesso: "convite enviado agora",
      abas: [...preset.abas],
      flags: [...preset.flags],
    };
    setUsers([...users, novo]);
    setSelId(id);
    setShowInvite(false);
    toast.success("Convite enviado", `${nome.split(" ")[0]} recebeu o link em ${email}.`);
  };

  const resendInvite = (u: User) => {
    setUsers(users.map((x) => (x.id === u.id ? { ...x, ultimoAcesso: "convite reenviado agora" } : x)));
    toast.info("Convite reenviado", `Novo link foi enviado para ${u.email}.`);
  };

  const confirmRevoke = (u: User) => {
    if (u.dono) {
      toast.error("Não é possível revogar", "O acesso do proprietário é irrevogável.");
      return;
    }
    setRevoking(u);
  };

  const doRevoke = () => {
    if (!revoking) return;
    const u = revoking;
    const sobra = users.filter((x) => x.id !== u.id);
    setUsers(sobra);
    if (selId === u.id) setSelId(sobra[0]?.id || "");
    setRevoking(null);
    toast.success("Acesso revogado", `${u.nome.split(" ")[0]} não tem mais acesso à fazenda.`, {
      action: {
        label: "Desfazer",
        onClick: () => setUsers([...sobra, u]),
      },
    });
  };

  const existingEmails = users.map((u) => u.email.trim().toLowerCase()).filter(Boolean);

  return (
    <div className="shell-wide">
      <ReportHeader subtitle="Acessos & Permissões" updatedAt={UPDATED_AT} />

      <div className="acessos-summary">
        <div className="ac-sum">
          <span className="l">Pessoas com acesso</span>
          <span className="v mono-nums">{ativos}</span>
        </div>
        <div className="ac-sum">
          <span className="l">Convites pendentes</span>
          <span className="v mono-nums">{pendentes}</span>
        </div>
        <div className="ac-sum">
          <span className="l">Papéis disponíveis</span>
          <span className="v mono-nums">{Object.keys(PAPEIS).length}</span>
        </div>
        <div className="ac-sum ac-sum-action">
          <button className="btn-primary" onClick={() => setShowInvite(true)}>
            + Convidar pessoa
          </button>
        </div>
      </div>

      <div className="acessos-grid">
        <div className="acessos-list">
          <div className="acessos-list-head">Equipe & convidados</div>
          {users.map((u) => (
            <button key={u.id} className={"acessos-row " + (selId === u.id ? "active" : "")} onClick={() => setSelId(u.id)}>
              <div className="ar-avatar">{u.inicial}</div>
              <div className="ar-info">
                <div className="ar-nome">
                  {u.nome}
                  {u.dono && <span className="dono-tag">dono</span>}
                </div>
                <div className="ar-papel">
                  {u.papel === "personalizado" ? "Personalizado" : PAPEIS[u.papel]?.nome} · {u.abas.length} abas
                </div>
              </div>
              <div className="ar-meta">
                <StatusBadge status={u.status} />
                <span className="ar-acesso">{u.ultimoAcesso}</span>
              </div>
            </button>
          ))}
        </div>

        <PermissionEditor
          user={sel}
          onChange={updateUser}
          onViewAs={onViewAs}
          onResendInvite={resendInvite}
          onRevoke={confirmRevoke}
        />
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvite={invite}
          existingEmails={existingEmails}
        />
      )}
      <ConfirmDialog
        open={!!revoking}
        title="Revogar acesso?"
        message={
          revoking ? (
            <>
              <strong>{revoking.nome}</strong> perderá imediatamente o acesso à fazenda.
              Você pode convidar a pessoa novamente a qualquer momento.
            </>
          ) : null
        }
        confirmLabel="Revogar acesso"
        cancelLabel="Cancelar"
        tone="danger"
        onConfirm={doRevoke}
        onCancel={() => setRevoking(null)}
      />
    </div>
  );
}

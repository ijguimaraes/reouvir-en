import { useCallback, useState } from "react";
import type { AdminUserDto } from "@reouvir/shared";
import { api } from "../api";
import { Badge, errMsg, Status, STATUS_LABEL, TableWrap, useConfirm, useLoad } from "../ui";

export function UsersPage() {
  const load = useCallback(() => api.request<AdminUserDto[]>("GET", "/admin/users"), []);
  const { data, error, reload } = useLoad(load);
  const [actionError, setActionError] = useState("");
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  async function act(fn: () => Promise<unknown>) {
    setActionError("");
    try {
      await fn();
      reload();
    } catch (err) {
      setActionError(errMsg(err));
    }
  }

  return (
    <>
      <h2>Usuários</h2>
      <p className="muted">Os alunos se cadastram sozinhos. Aqui você bloqueia, desbloqueia e redefine senhas (senha temporária, exibida uma vez).</p>
      {temp && (
        <div className="card note" role="status">
          Senha temporária de <b>{temp.email}</b>: <code className="temp-password">{temp.password}</code>
          <p className="muted">Repasse ao aluno agora: ela não será exibida de novo. Ele terá que trocá-la no próximo login.</p>
          <div className="row">
            <button type="button" className="primary" onClick={() => {
              navigator.clipboard?.writeText(temp.password).then(() => setCopied(true)).catch(() => setCopied(false));
            }}>{copied ? "Copiada" : "Copiar senha"}</button>
            <button type="button" onClick={() => { setTemp(null); setCopied(false); }}>Fechar</button>
          </div>
        </div>
      )}
      {actionError && <p className="error" role="alert">{actionError}</p>}
      <Status error={error} loading={!data} onRetry={reload} />
      {data && (
        <TableWrap>
          <thead><tr><th>E-mail</th><th>Nome</th><th>Papel</th><th>Status</th><th>Cadastro</th><th>Último acesso</th><th /></tr></thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name}</td>
                <td>{u.role}</td>
                <td><Badge kind={u.status}>{STATUS_LABEL[u.status]}</Badge></td>
                <td>{new Date(u.createdAt).toLocaleDateString("pt-BR")}</td>
                <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("pt-BR") : "—"}</td>
                <td>
                  <div className="row">
                    {u.status === "active"
                      ? <button type="button" className="danger" onClick={async () => {
                          const ok = await confirm({
                            title: `Bloquear ${u.email}?`,
                            body: "O usuário perde o acesso ao app até ser desbloqueado.",
                            confirmLabel: "Bloquear", danger: true,
                          });
                          if (ok) void act(() => api.request("POST", `/admin/users/${u.id}/block`));
                        }}>Bloquear</button>
                      : <button type="button" onClick={() => act(() => api.request("POST", `/admin/users/${u.id}/unblock`))}>Desbloquear</button>}
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Redefinir a senha de ${u.email}?`,
                          body: "A senha atual deixa de valer. Uma senha temporária será exibida uma única vez.",
                          confirmLabel: "Redefinir senha",
                        });
                        if (!ok) return;
                        void act(async () => {
                          const r = await api.request<{ temporaryPassword: string }>("POST", `/admin/users/${u.id}/reset-password`);
                          setTemp({ email: u.email, password: r.temporaryPassword });
                          setCopied(false);
                        });
                      }}
                    >Redefinir senha</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      {confirmDialog}
    </>
  );
}

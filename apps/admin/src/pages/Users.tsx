import { useCallback, useState } from "react";
import type { AdminUserDto } from "@reouvir/shared";
import { api } from "../api";
import { Badge, errMsg, Status, STATUS_LABEL, useLoad } from "../ui";

export function UsersPage() {
  const load = useCallback(() => api.request<AdminUserDto[]>("GET", "/admin/users"), []);
  const { data, error, reload } = useLoad(load);
  const [actionError, setActionError] = useState("");
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);

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
        <div className="card">
          Senha temporária de <b>{temp.email}</b>: <code style={{ fontSize: 18 }}>{temp.password}</code>
          <p className="muted">Repasse ao aluno agora: ela não será exibida de novo. Ele terá que trocá-la no próximo login.</p>
          <button onClick={() => setTemp(null)}>Fechar</button>
        </div>
      )}
      {actionError && <p className="error">{actionError}</p>}
      <Status error={error} loading={!data} />
      {data && (
        <table>
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
                <td className="row">
                  {u.status === "active"
                    ? <button className="danger" onClick={() => act(() => api.request("POST", `/admin/users/${u.id}/block`))}>Bloquear</button>
                    : <button onClick={() => act(() => api.request("POST", `/admin/users/${u.id}/unblock`))}>Desbloquear</button>}
                  <button
                    onClick={() => window.confirm(`Redefinir a senha de ${u.email}?`) && act(async () => {
                      const r = await api.request<{ temporaryPassword: string }>("POST", `/admin/users/${u.id}/reset-password`);
                      setTemp({ email: u.email, password: r.temporaryPassword });
                    })}
                  >Redefinir senha</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

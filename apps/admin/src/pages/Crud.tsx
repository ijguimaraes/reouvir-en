import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { api } from "../api";
import { errMsg, Status, useLoad } from "../ui";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "checkbox" | "select" | "textarea";
  options?: { value: string; label: string }[];
  /** Mostra o valor na tabela (padrão: sim). */
  hidden?: boolean;
  format?: (value: unknown, row: Record<string, unknown>) => string;
}

interface Props {
  title: string;
  path: string;
  fields: FieldDef[];
  defaults: Record<string, unknown>;
  hint?: string;
  /** Sem formulário nem botões de editar/excluir (catálogo fixo). */
  readOnly?: boolean;
  rowActions?: (row: Record<string, unknown>) => ReactNode;
}

/** CRUD genérico: lista, formulário de criar/editar e exclusão. */
export function Crud({ title, path, fields, defaults, hint, readOnly, rowActions }: Props) {
  const load = useCallback(() => api.request<Record<string, unknown>[]>("GET", path), [path]);
  const { data, error, reload } = useLoad(load);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(defaults);
  const [formError, setFormError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    try {
      const body = Object.fromEntries(fields.map((f) => [f.key, f.type === "number" ? Number(form[f.key]) : form[f.key]]));
      if (editing) await api.request("PUT", `${path}/${editing}`, body);
      else await api.request("POST", path, body);
      setEditing(null);
      setForm(defaults);
      reload();
    } catch (err) {
      setFormError(errMsg(err));
    }
  }

  async function remove(row: Record<string, unknown>) {
    if (!window.confirm("Excluir este item?")) return;
    try {
      await api.request("DELETE", `${path}/${row.id}`);
      reload();
    } catch (err) {
      setFormError(errMsg(err));
    }
  }

  return (
    <>
      <h2>{title}</h2>
      {hint && <p className="muted">{hint}</p>}
      {!readOnly && (
      <form className="form" onSubmit={submit}>
        {fields.map((f) =>
          f.type === "checkbox" ? (
            <label className="inline" key={f.key}>
              <input type="checkbox" checked={Boolean(form[f.key])} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} />
              {f.label}
            </label>
          ) : f.type === "select" ? (
            <label key={f.key}>
              {f.label}
              <select required value={String(form[f.key] ?? "")} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                <option value="" disabled>—</option>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ) : f.type === "textarea" ? (
            <label key={f.key} style={{ flexBasis: "100%" }}>
              {f.label}
              <textarea
                rows={6}
                value={String(form[f.key] ?? "")}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            </label>
          ) : (
            <label key={f.key}>
              {f.label}
              <input
                type={f.type}
                required={f.key !== "description" && f.key !== "details"}
                value={String(form[f.key] ?? "")}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            </label>
          ),
        )}
        <button className="primary" type="submit">{editing ? "Salvar" : "Adicionar"}</button>
        {editing && <button type="button" onClick={() => { setEditing(null); setForm(defaults); }}>Cancelar</button>}
      </form>
      )}
      {formError && <p className="error">{formError}</p>}
      <Status error={error} loading={!data} />
      {data && (
        <table>
          <thead>
            <tr>{fields.filter((f) => !f.hidden).map((f) => <th key={f.key}>{f.label}</th>)}<th /></tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={String(row.id)}>
                {fields.filter((f) => !f.hidden).map((f) => (
                  <td key={f.key}>
                    {f.format ? f.format(row[f.key], row) : f.type === "checkbox" ? (row[f.key] ? "sim" : "não") : String(row[f.key] ?? "")}
                  </td>
                ))}
                <td className="row">
                  {rowActions?.(row)}
                  {!readOnly && <button type="button" onClick={() => { setEditing(String(row.id)); setForm(row); }}>Editar</button>}
                  {!readOnly && <button type="button" className="danger" onClick={() => remove(row)}>Excluir</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

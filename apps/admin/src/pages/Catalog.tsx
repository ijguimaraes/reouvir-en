import { useCallback } from "react";
import { Link } from "react-router-dom";
import type { LevelDto } from "@reouvir/shared";
import { api } from "../api";
import { Status, useLoad } from "../ui";
import { Crud } from "./Crud";

export function LevelsPage() {
  return (
    <Crud
      title="Níveis"
      path="/admin/levels"
      readOnly
      hint="Os níveis são fixos (vêm do seed) e não podem ser alterados aqui."
      defaults={{ code: "", name: "", sortOrder: 1, active: true }}
      fields={[
        { key: "code", label: "Código", type: "text" },
        { key: "name", label: "Nome", type: "text" },
        { key: "sortOrder", label: "Ordem", type: "number" },
        { key: "active", label: "Ativo", type: "checkbox" },
      ]}
    />
  );
}

export function TopicsPage() {
  const load = useCallback(() => api.request<LevelDto[]>("GET", "/admin/levels"), []);
  const { data: levels, error, reload } = useLoad(load);
  if (!levels) return <Status error={error} loading onRetry={reload} />;
  const levelName = (id: unknown) => levels.find((l) => l.id === id)?.code ?? "?";
  return (
    <Crud
      title="Tópicos gramaticais"
      path="/admin/topics"
      readOnly
      hint="Os tópicos são fixos (vêm do seed). A ordem do currículo é (ordem do nível, ordem do tópico)."
      defaults={{ levelId: levels[0]?.id ?? "", slug: "", name: "", sortOrder: 1, active: true }}
      fields={[
        { key: "levelId", label: "Nível", type: "select", options: levels.map((l) => ({ value: l.id, label: l.code })), format: levelName },
        { key: "slug", label: "Slug", type: "text" },
        { key: "name", label: "Nome", type: "text" },
        { key: "sortOrder", label: "Ordem", type: "number" },
        { key: "active", label: "Ativo", type: "checkbox" },
      ]}
    />
  );
}

export function ContextsPage() {
  return (
    <Crud
      title="Contextos"
      path="/admin/contexts"
      hint="Ao criar um contexto, uma playlist vazia é gerada para cada tópico. A descrição é curta; o detalhamento é livre (cenário, situações, objetivos) e serve de guia para montar o contexto."
      rowActions={(row) => <Link className="btn primary" to={`/contexts/${row.id}`}>Tópicos</Link>}
      defaults={{ slug: "", name: "", description: "", category: "", details: "", active: true }}
      fields={[
        { key: "slug", label: "Slug", type: "text" },
        { key: "name", label: "Nome", type: "text" },
        { key: "category", label: "Categoria", type: "text" },
        { key: "description", label: "Descrição", type: "text" },
        { key: "details", label: "Detalhamento", type: "textarea", hidden: true },
        { key: "active", label: "Ativo", type: "checkbox" },
      ]}
    />
  );
}

import { Link } from "react-router-dom";
import { Crud } from "./Crud";

export function ContextsPage() {
  return (
    <Crud
      title="Contextos"
      path="/admin/contexts"
      hint="Um contexto agrupa playlists (ex.: uma entrevista de emprego). Ele nasce sem playlists: crie e organize as dele em “Playlists”. A descrição é curta e aparece para o aluno; o detalhamento é livre (cenário, situações, objetivos) e serve de guia para montar as frases."
      rowActions={(row) => <Link className="btn primary" to={`/contexts/${row.id}`}>Playlists</Link>}
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

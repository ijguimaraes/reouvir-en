import type { ContextDto, ContextInput } from "@reouvir/shared";
import type { Queryable } from "../../db/pool";

interface ContextRow { id: string; slug: string; name: string; description: string; category: string; details: string; active: boolean }

const context = (r: ContextRow): ContextDto => ({ id: r.id, slug: r.slug, name: r.name, description: r.description, category: r.category, details: r.details, active: r.active });

export class CatalogRepository {
  constructor(private db: Queryable) {}

  // ---- contextos ----
  async listContexts(): Promise<ContextDto[]> {
    const { rows } = await this.db.query<ContextRow>("SELECT * FROM contexts ORDER BY category, name");
    return rows.map(context);
  }
  async createContext(i: ContextInput): Promise<ContextDto> {
    const { rows } = await this.db.query<ContextRow>(
      "INSERT INTO contexts (slug, name, description, category, details, active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [i.slug, i.name, i.description, i.category, i.details, i.active],
    );
    return context(rows[0]!);
  }
  async updateContext(id: string, i: ContextInput): Promise<ContextDto | null> {
    const { rows } = await this.db.query<ContextRow>(
      "UPDATE contexts SET slug=$2, name=$3, description=$4, category=$5, details=$6, active=$7 WHERE id=$1 RETURNING *",
      [id, i.slug, i.name, i.description, i.category, i.details, i.active],
    );
    return rows[0] ? context(rows[0]) : null;
  }
  /**
   * Exclui o contexto e as playlists dele, desde que todas estejam vazias.
   * Use dentro de uma transação.
   */
  async deleteContext(id: string): Promise<"deleted" | "not_found" | "has_sentences"> {
    const exists = await this.db.query("SELECT 1 FROM contexts WHERE id = $1 FOR UPDATE", [id]);
    if (exists.rowCount === 0) return "not_found";
    const used = await this.db.query(
      "SELECT 1 FROM sentences s JOIN playlists p ON p.id = s.playlist_id WHERE p.context_id = $1 LIMIT 1",
      [id],
    );
    if ((used.rowCount ?? 0) > 0) return "has_sentences";
    await this.db.query("DELETE FROM playlists WHERE context_id = $1", [id]);
    await this.db.query("DELETE FROM contexts WHERE id = $1", [id]);
    return "deleted";
  }
}

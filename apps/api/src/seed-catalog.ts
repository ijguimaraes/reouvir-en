import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { loadConfig } from "./config";
import { createPool, withTransaction } from "./db/pool";

// Fonte dos níveis e tópicos: os mesmos currículos que a pipeline usa (docs/pipeline/curriculum-*.yaml).
const LEVELS = ["a1", "a2", "b1", "b2"];
const DOCS = fileURLToPath(new URL("../../../docs/pipeline/", import.meta.url));

interface Curriculum {
  level: { code: string; name: string; order: number };
  topics: { slug: string; name: string; order: number }[];
}

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);

let created = 0;
let updated = 0;

await withTransaction(pool, async (db) => {
  for (const lv of LEVELS) {
    const file = `${DOCS}curriculum-${lv}.yaml`;
    const { level, topics } = parse(await readFile(file, "utf8")) as Curriculum;

    const { rows: lvRows } = await db.query<{ id: string; name: string; sort_order: number }>(
      "SELECT id, name, sort_order FROM levels WHERE code = $1",
      [level.code],
    );
    let levelId = lvRows[0]?.id;
    if (!levelId) {
      const r = await db.query<{ id: string }>(
        "INSERT INTO levels (code, name, sort_order) VALUES ($1,$2,$3) RETURNING id",
        [level.code, level.name, level.order],
      );
      levelId = r.rows[0]!.id;
      created++;
    } else if (lvRows[0]!.name !== level.name || lvRows[0]!.sort_order !== level.order) {
      await db.query("UPDATE levels SET name = $2, sort_order = $3 WHERE id = $1", [
        levelId,
        level.name,
        level.order,
      ]);
      updated++;
    }

    for (const t of topics) {
      const { rows } = await db.query<{ id: string; level_id: string; name: string; sort_order: number }>(
        "SELECT id, level_id, name, sort_order FROM grammar_topics WHERE slug = $1",
        [t.slug],
      );
      const found = rows[0];
      if (!found) {
        // O trigger do banco cria a playlist vazia do tópico em cada contexto existente.
        await db.query(
          "INSERT INTO grammar_topics (level_id, slug, name, sort_order) VALUES ($1,$2,$3,$4)",
          [levelId, t.slug, t.name, t.order],
        );
        created++;
      } else if (found.level_id !== levelId) {
        throw new Error(`O tópico ${t.slug} já existe em outro nível; o slug é único no catálogo.`);
      } else if (found.name !== t.name || found.sort_order !== t.order) {
        await db.query("UPDATE grammar_topics SET name = $2, sort_order = $3 WHERE id = $1", [
          found.id,
          t.name,
          t.order,
        ]);
        updated++;
      }
    }
  }
});

console.log(`Catálogo: ${created} criado(s), ${updated} atualizado(s).`);
await pool.end();

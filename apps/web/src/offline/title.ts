import type { OfflineManifestDto } from "@reouvir/shared";

/**
 * Título de uma playlist baixada. Manifestos baixados antes das playlists livres não têm `title`:
 * guardam o nome do tópico (`topicName`) e o nível, que não existem mais.
 */
export function manifestTitle(m: OfflineManifestDto): string {
  const legacy = m as OfflineManifestDto & { topicName?: string };
  return m.title ?? legacy.topicName ?? "Playlist";
}

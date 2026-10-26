import { access, mkdir, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Interface do storage de MP3. Hoje só o driver `local`; um driver `s3` entra sem mexer no resto. */
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** URL pública (relativa à origem) do arquivo. */
  url(key: string): string;
  remove(key: string): Promise<void>;
  list(): Promise<string[]>;
}

export class LocalStorage implements Storage {
  constructor(private dir: string) {}

  private file(key: string): string {
    return path.join(this.dir, `${key}.mp3`);
  }

  async put(key: string, data: Buffer): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    // grava num temporário e renomeia: o Caddy nunca serve um arquivo pela metade
    const tmp = this.file(key) + `.${process.pid}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, this.file(key));
  }

  async exists(key: string): Promise<boolean> {
    return access(this.file(key)).then(() => true, () => false);
  }

  url(key: string): string {
    return `/audio/${key}.mp3`;
  }

  async remove(key: string): Promise<void> {
    await unlink(this.file(key)).catch(() => undefined);
  }

  async list(): Promise<string[]> {
    const names = await readdir(this.dir).catch(() => [] as string[]);
    return names.filter((n) => n.endsWith(".mp3")).map((n) => n.slice(0, -4));
  }
}

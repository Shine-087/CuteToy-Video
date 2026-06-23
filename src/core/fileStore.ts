import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

export async function loadJson<T>(path: string): Promise<T> {
  const content = await readFile(path, "utf8");
  return JSON.parse(content) as T;
}

export async function saveJson(path: string, data: unknown) {
  await ensureDir(dirname(path));
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function pathExists(path: string) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

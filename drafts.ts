import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export interface Draft {
  name: string;
  author: string;
  text: string;
}

const AUTHOR_LINE = /^Author:\s*(.+)$/;

export function parseDraft(name: string, content: string): Draft {
  const [firstLine = "", ...rest] = content.split(/\r?\n/);
  const match = AUTHOR_LINE.exec(firstLine.trim());
  if (!match) throw new Error(`${name}: expected first line "Author: <name>"`);
  return { name, author: match[1].trim(), text: rest.join("\n").trim() };
}

export async function loadDraft(path: string): Promise<Draft> {
  return parseDraft(basename(path), await readFile(path, "utf8"));
}

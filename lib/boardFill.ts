import { emptyClue, newId } from "./board";
import type { Board, FinalJeopardy } from "./types";

export type FillItem = { category: string; value?: number; question: string; answer: string; hint?: string };

/**
 * Lays questions out as a board. When every question has a value, rows are the distinct values and each question goes
 * in its value's row (or the next free one). Otherwise questions fill rows in order, worth 200, 400, 600…
 */
export function buildBoard(items: FillItem[]): Pick<Board, "categories" | "rowValues"> {
  const order: string[] = [];
  const byCategory = new Map<string, FillItem[]>();
  for (const item of items) {
    const title = item.category.trim() || "Category";
    if (!byCategory.has(title)) {
      byCategory.set(title, []);
      order.push(title);
    }
    byCategory.get(title)!.push(item);
  }
  const valued = items.every((i) => i.value && i.value > 0);
  const longest = Math.max(0, ...[...byCategory.values()].map((list) => list.length));
  const rowValues = valued
    ? [...new Set(items.map((i) => i.value!))].sort((a, b) => a - b)
    : Array.from({ length: longest }, (_, i) => (i + 1) * 200);

  const categories = order.map((title) => {
    const clues = rowValues.map(() => emptyClue());
    const filled = new Set<number>();
    for (const item of byCategory.get(title)!) {
      const wanted = valued ? rowValues.indexOf(item.value!) : filled.size;
      let row = wanted;
      while (filled.has(row) && row < rowValues.length) row++;
      if (row >= rowValues.length) row = rowValues.findIndex((_, i) => !filled.has(i));
      if (row === -1) continue;
      filled.add(row);
      clues[row] = { ...clues[row], question: item.question, answer: item.answer, ...(item.hint ? { hint: item.hint } : {}) };
    }
    return { id: newId("cat_"), title, clues };
  });
  return { categories, rowValues };
}

/** Splits CSV or tab-separated text into rows of cells, honouring quoted cells. */
function parseRows(text: string): string[][] {
  const delimiter = text.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

const money = (cell: string) => {
  const n = Number(cell.replace(/[$,\s]/g, ""));
  return cell && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
};

/**
 * Reads pasted spreadsheet rows: Category, Value, Question, Answer, Hint (Value and Hint optional). A header row is
 * used to find the columns when present. A row whose category starts with "Final" becomes the Final Kashpot! clue.
 */
export function parseSpreadsheet(text: string): { items: FillItem[]; final?: FinalJeopardy } {
  const rows = parseRows(text);
  const header = rows[0]?.map((c) => c.toLowerCase());
  const named = header?.some((c) => /^(category|question|clue|answer|response)$/.test(c));
  const col = (names: RegExp) => (named ? header!.findIndex((c) => names.test(c)) : -1);
  const columns = named
    ? {
        category: col(/^category/),
        value: col(/^(value|points|amount|\$)/),
        question: col(/^(question|clue)/),
        answer: col(/^(answer|response)/),
        hint: col(/^hint/),
      }
    : undefined;

  const items: FillItem[] = [];
  let final: FinalJeopardy | undefined;
  for (const cells of named ? rows.slice(1) : rows) {
    const get = (i: number | undefined) => (i !== undefined && i >= 0 ? (cells[i] ?? "") : "");
    let item: FillItem;
    if (columns) {
      item = {
        category: get(columns.category),
        value: money(get(columns.value)),
        question: get(columns.question),
        answer: get(columns.answer),
        hint: get(columns.hint) || undefined,
      };
    } else if (money(cells[1] ?? "")) {
      item = { category: get(0), value: money(get(1)), question: get(2), answer: get(3), hint: get(4) || undefined };
    } else {
      item = { category: get(0), question: get(1), answer: get(2), hint: get(3) || undefined };
    }
    if (!item.question && !item.answer) continue;
    const finalMatch = /^final\b(?:\s*(?:kashpot!?|jeopardy!?))?\s*[:\-–]?\s*(.*)$/i.exec(item.category);
    if (finalMatch) {
      final = { category: finalMatch[1].trim(), question: item.question, answer: item.answer };
      continue;
    }
    items.push(item);
  }
  return { items, final };
}

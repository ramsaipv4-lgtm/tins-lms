// Board page model: our own notion of "pages" on top of Excalidraw scenes (one scene per page).
// Pure functions, no DOM: the web screen and the unit tests share them.

export interface BoardPage {
  id: string;
  title: string;
  /** Excalidraw elements of this page (deleted ones are dropped before saving). */
  elements: any[];
  order: number;
  dayIndex?: number;
}

export function newPageId(): string {
  const bytes = new Uint8Array(6);
  (globalThis.crypto ?? ({ getRandomValues: (a: Uint8Array) => a } as any)).getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function makePage(title: string, order: number, id: string = newPageId()): BoardPage {
  return { id, title, elements: [], order };
}

export function addPage(pages: BoardPage[], title: string, id?: string): { pages: BoardPage[]; page: BoardPage } {
  const order = pages.reduce((m, p) => Math.max(m, p.order), -1) + 1;
  const page = makePage(title, order, id);
  return { pages: [...pages, page], page };
}

export function sortPages(pages: BoardPage[]): BoardPage[] {
  return [...pages].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function liveElements(elements: readonly any[]): any[] {
  return elements.filter((e) => !e.isDeleted);
}

export function withElements(pages: BoardPage[], id: string, elements: readonly any[]): BoardPage[] {
  return pages.map((p) => (p.id === id ? { ...p, elements: liveElements(elements) } : p));
}

/** A dropped or chosen file is a Mermaid diagram when its name says so (.mmd / .mermaid) or its type is plain text with such a name. */
export function isMermaidFile(file: { name?: string; type?: string }): boolean {
  return /\.(mmd|mermaid)$/i.test(file.name ?? '');
}

/** Strip a Markdown fence if the file was saved as ```mermaid ... ```. */
export function mermaidSource(text: string): string {
  const m = /^\s*```(?:mermaid)?\s*\n([\s\S]*?)\n```\s*$/.exec(text);
  return (m ? m[1] : text).trim();
}

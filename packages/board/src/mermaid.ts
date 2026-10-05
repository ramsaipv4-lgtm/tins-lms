// Mermaid drop (D-7): the converter is a dynamic import so it is fetched only when a diagram is actually dropped.
import { mermaidSource } from './model.ts';

export async function mermaidToElements(text: string): Promise<{ elements: any[]; files: any }> {
  const [{ parseMermaidToExcalidraw }, { convertToExcalidrawElements }] = await Promise.all([
    import('@excalidraw/mermaid-to-excalidraw'),
    import('@excalidraw/excalidraw'),
  ]);
  const parsed = await parseMermaidToExcalidraw(mermaidSource(text), { themeVariables: { fontSize: '20px' } } as any);
  return { elements: convertToExcalidrawElements(parsed.elements as any, { regenerateIds: true }) as any[], files: parsed.files ?? {} };
}

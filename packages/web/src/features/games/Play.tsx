// /learn/games/<gameId>/<packId>/<levelId>: open the game on that level (deep link).
import Stage from './Stage.tsx';

export default function Play({ params }: { params: Record<string, string> }) {
  return <Stage kind="game" gameId={params.gameId} packId={params.packId} levelId={params.levelId} />;
}

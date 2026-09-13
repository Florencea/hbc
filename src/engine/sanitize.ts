import type { GameState, MaskedGameState, MaskedPiece } from "./types.ts";

export function sanitizeForViewer(
  state: GameState,
  viewerPlayerId: number,
): MaskedGameState {
  const viewer = state.players.find((p) => p.id === viewerPlayerId);
  const viewerTeamId = viewer?.teamId ?? -1;

  const maskedBoard: (MaskedPiece | null)[][] = state.board.map((row) =>
    row.map((piece) => {
      if (!piece) return null;

      // Revealed pieces can always be seen by anyone
      if (piece.isRevealed) {
        return { ...piece };
      }

      // Teammates can see unrevealed skill types
      if (piece.teamId === viewerTeamId) {
        return { ...piece };
      }

      // Opponents see unrevealed pieces as normal pieces (skillType: NONE)
      return {
        ...piece,
        skillType: "NONE",
      };
    }),
  );

  return {
    ...state,
    board: maskedBoard,
  };
}

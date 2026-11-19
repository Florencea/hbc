import type {
  GameState,
  MaskedGameState,
  MaskedPiece,
  Player,
} from "./types.ts";

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

  const maskedPlayers: Player[] = state.players.map((player) => {
    // Teammates and the viewer can see full telemetry
    if (player.teamId === viewerTeamId) {
      return {
        ...player,
        hand: { ...player.hand },
        charge: { ...player.charge },
      };
    }

    // Opponents: sanitize hand, charge, and isForcedSpecial (mask numbers to 0 and flag to false)
    return {
      ...player,
      hand: {
        NONE: 0,
        WALL: 0,
        PIERCE: 0,
        BOMB: 0,
        PURIFY: 0,
        COUNTER: 0,
      },
      charge: {
        NONE: 0,
        WALL: 0,
        PIERCE: 0,
        BOMB: 0,
        PURIFY: 0,
        COUNTER: 0,
      },
      isForcedSpecial: false,
    };
  });

  return {
    ...state,
    board: maskedBoard,
    players: maskedPlayers,
  };
}

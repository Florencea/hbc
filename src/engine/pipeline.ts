import { collectAllRaycasts, DIRECTIONS, isValidCoord } from "./raycast.ts";
import type {
  Action,
  Board,
  Coord,
  GameEvent,
  GameState,
  Piece,
  SkillType,
} from "./types.ts";

interface BombQueueItem {
  coord: Coord;
  teamId: number;
}

export function createInitialState(
  size = 16,
  players = [
    { id: 1, teamId: 1, name: "Player 1" },
    { id: 2, teamId: 2, name: "Player 2" },
  ],
): GameState {
  const board: Board = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );

  const mid = Math.floor(size / 2);
  // Standard center 4 pieces
  board[mid - 1][mid - 1] = {
    teamId: 1,
    playerId: players[0]?.id ?? 1,
    skillType: "NONE",
    isRevealed: true,
  };
  board[mid - 1][mid] = {
    teamId: 2,
    playerId: players[1]?.id ?? 2,
    skillType: "NONE",
    isRevealed: true,
  };
  board[mid][mid - 1] = {
    teamId: 2,
    playerId: players[1]?.id ?? 2,
    skillType: "NONE",
    isRevealed: true,
  };
  board[mid][mid] = {
    teamId: 1,
    playerId: players[0]?.id ?? 1,
    skillType: "NONE",
    isRevealed: true,
  };

  return {
    board,
    size,
    currentTurn: 1,
    activePlayerId: players[0]?.id ?? 1,
    players,
    isGameOver: false,
    winnerTeamId: null,
  };
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

export function dispatch(
  state: GameState,
  action: Action,
): { nextState: GameState; events: GameEvent[] } {
  if (state.isGameOver) {
    throw new Error("Game is already over");
  }

  const events: GameEvent[] = [];
  const newBoard = cloneBoard(state.board);

  if (action.type === "PASS_TURN") {
    if (action.playerId !== state.activePlayerId) {
      throw new Error("Not active player's turn to pass");
    }

    // Apply Purify pulses at turn end
    applyPurifyPulses(newBoard, state.size, events);

    // Advance turn
    const activeIdx = state.players.findIndex((p) => p.id === action.playerId);
    const nextPlayer = state.players[(activeIdx + 1) % state.players.length];

    events.push({
      type: "TURN_CHANGED",
      previousPlayerId: action.playerId,
      nextPlayerId: nextPlayer.id,
      turn: state.currentTurn + 1,
    });

    const nextState: GameState = {
      ...state,
      board: newBoard,
      currentTurn: state.currentTurn + 1,
      activePlayerId: nextPlayer.id,
    };

    return { nextState, events };
  }

  // Handle PLACE_PIECE
  if (action.playerId !== state.activePlayerId) {
    throw new Error("Not active player's turn");
  }

  if (!isValidCoord(state.size, action.coord)) {
    throw new Error("Target coordinate is out of bounds");
  }

  if (newBoard[action.coord.y]?.[action.coord.x] !== null) {
    throw new Error("Target coordinate is already occupied");
  }

  const attacker = state.players.find((p) => p.id === action.playerId);
  if (!attacker) {
    throw new Error("Player not found in state");
  }

  const attackerSkill: SkillType = action.skillType ?? "NONE";
  const isPurify = attackerSkill === "PURIFY";

  // 1. Place piece
  const newPiece: Piece = {
    teamId: attacker.teamId,
    playerId: attacker.id,
    skillType: attackerSkill,
    isRevealed: isPurify || attackerSkill === "NONE",
    duration: isPurify ? 3 : undefined,
  };
  newBoard[action.coord.y][action.coord.x] = newPiece;

  events.push({
    type: "PIECE_PLACED",
    coord: action.coord,
    piece: { ...newPiece },
  });

  if (isPurify) {
    events.push({
      type: "PIECE_REVEALED",
      coord: action.coord,
      skillType: "PURIFY",
      reason: "AURA",
    });
  }

  // 2. Trace raycasts
  const raycasts = collectAllRaycasts(
    state.board,
    state.size,
    action.coord,
    attacker.teamId,
    attackerSkill,
  );

  for (const ray of raycasts) {
    if (ray.isBlockedByWall && ray.blockedCoord) {
      const wallPiece = newBoard[ray.blockedCoord.y]?.[ray.blockedCoord.x];
      if (wallPiece) {
        if (!wallPiece.isRevealed) {
          wallPiece.isRevealed = true;
          events.push({
            type: "PIECE_REVEALED",
            coord: ray.blockedCoord,
            skillType: "WALL",
            reason: "BLOCK",
          });
        }
        events.push({
          type: "RAYCAST_BLOCKED",
          coord: ray.blockedCoord,
          blockerPiece: { ...wallPiece },
          direction: ray.direction,
        });
      }
    }

    if (ray.penetratedWallCoords.length > 0 && !newPiece.isRevealed) {
      newPiece.isRevealed = true;
      events.push({
        type: "PIECE_REVEALED",
        coord: action.coord,
        skillType: "PIERCE",
        reason: "PENETRATE",
      });
    }
  }

  // Collect all unique captured coordinates
  const capturedMap = new Map<string, Coord>();
  for (const ray of raycasts) {
    for (const c of ray.capturedCoords) {
      capturedMap.set(`${c.x.toString()},${c.y.toString()}`, c);
    }
  }
  const capturedCoords: Coord[] = [...capturedMap.values()];

  if (capturedCoords.length === 0) {
    throw new Error("Illegal move: must capture at least one piece");
  }

  // 3. Check for COUNTER trap in captured pieces
  const counterCoord = capturedCoords.find((c) => {
    const piece = state.board[c.y]?.[c.x];
    return piece?.skillType === "COUNTER" && piece.teamId !== attacker.teamId;
  });

  const bombQueue: BombQueueItem[] = [];
  const processedBombs = new Set<string>();

  if (counterCoord && attackerSkill !== "PIERCE") {
    // Counter trap activates!
    const counterPiece = newBoard[counterCoord.y]?.[counterCoord.x];
    if (counterPiece) {
      const defenderTeamId = counterPiece.teamId;
      const defenderPlayerId = counterPiece.playerId;

      // Counter is consumed and reverts to normal piece
      counterPiece.skillType = "NONE";
      counterPiece.isRevealed = true;

      // Entire active flip batch + placed piece converted to defender faction
      const reversedCoords: Coord[] = [action.coord, ...capturedCoords];
      for (const c of reversedCoords) {
        const p = newBoard[c.y]?.[c.x];
        if (p) {
          p.teamId = defenderTeamId;
          p.playerId = defenderPlayerId;
        }
      }

      events.push({
        type: "COUNTER_TRIGGERED",
        coord: counterCoord,
        defenderTeamId,
        reversedCoords,
      });

      // Chains into adjacent unexploded BOMBs
      for (const c of reversedCoords) {
        for (const dir of DIRECTIONS) {
          const nx = c.x + dir.x;
          const ny = c.y + dir.y;
          if (isValidCoord(state.size, { x: nx, y: ny })) {
            const adjPiece = newBoard[ny]?.[nx];
            const key = `${nx.toString()},${ny.toString()}`;
            if (adjPiece?.skillType === "BOMB" && !processedBombs.has(key)) {
              bombQueue.push({
                coord: { x: nx, y: ny },
                teamId: adjPiece.teamId,
              });
              processedBombs.add(key);
            }
          }
        }
      }
    }
  } else {
    // Normal flip or PIERCE bypassing COUNTER
    if (counterCoord && attackerSkill === "PIERCE" && !newPiece.isRevealed) {
      newPiece.isRevealed = true;
      events.push({
        type: "PIECE_REVEALED",
        coord: action.coord,
        skillType: "PIERCE",
        reason: "TRIGGER",
      });
    }

    const fromTeamIds: number[] = [
      ...new Set(
        capturedCoords.map((c) => state.board[c.y]?.[c.x]?.teamId ?? 0),
      ),
    ];

    for (const c of capturedCoords) {
      const originalPiece = state.board[c.y]?.[c.x];
      const currentPiece = newBoard[c.y]?.[c.x];

      if (originalPiece && currentPiece) {
        currentPiece.teamId = attacker.teamId;
        currentPiece.playerId = attacker.id;

        // If flipped piece was a BOMB, trigger explosion
        if (originalPiece.skillType === "BOMB") {
          const key = `${c.x.toString()},${c.y.toString()}`;
          if (!processedBombs.has(key)) {
            bombQueue.push({ coord: c, teamId: originalPiece.teamId });
            processedBombs.add(key);
          }
        }
      }
    }

    events.push({
      type: "FLIP_BATCH",
      coords: capturedCoords,
      fromTeamIds,
      toTeamId: attacker.teamId,
    });
  }

  // 4. Process Bomb Chain Reactions via BFS queue
  while (bombQueue.length > 0) {
    const bombItem: BombQueueItem | undefined = bombQueue.shift();
    if (!bombItem) break;
    const bombPiece = newBoard[bombItem.coord.y]?.[bombItem.coord.x];
    if (!bombPiece) continue;

    bombPiece.skillType = "NONE";
    bombPiece.isRevealed = true;

    const blastCoords: Coord[] = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx: number = bombItem.coord.x + dx;
        const ny: number = bombItem.coord.y + dy;
        if (!isValidCoord(state.size, { x: nx, y: ny })) continue;

        const targetPiece = newBoard[ny]?.[nx];
        if (!targetPiece) continue;

        // PIERCE piece is immune to Bomb explosion
        if (targetPiece.skillType === "PIERCE") continue;

        blastCoords.push({ x: nx, y: ny });

        const prevSkill = targetPiece.skillType;
        const prevTeam = targetPiece.teamId;

        // Convert to Bomb's faction
        targetPiece.teamId = bombItem.teamId;

        // Check if bomb blast triggers another BOMB
        const key = `${nx.toString()},${ny.toString()}`;
        if (prevSkill === "BOMB" && !processedBombs.has(key)) {
          processedBombs.add(key);
          bombQueue.push({ coord: { x: nx, y: ny }, teamId: prevTeam });
        }

        // Check if bomb blast hits a COUNTER: chains into adjacent BOMBs
        if (prevSkill === "COUNTER") {
          targetPiece.skillType = "NONE";
          targetPiece.isRevealed = true;
          for (const dir of DIRECTIONS) {
            const cnx = nx + dir.x;
            const cny = ny + dir.y;
            if (isValidCoord(state.size, { x: cnx, y: cny })) {
              const adjBomb = newBoard[cny]?.[cnx];
              const bKey = `${cnx.toString()},${cny.toString()}`;
              if (adjBomb?.skillType === "BOMB" && !processedBombs.has(bKey)) {
                processedBombs.add(bKey);
                bombQueue.push({
                  coord: { x: cnx, y: cny },
                  teamId: adjBomb.teamId,
                });
              }
            }
          }
        }
      }
    }

    events.push({
      type: "BOMB_TRIGGERED",
      coord: bombItem.coord,
      teamId: bombItem.teamId,
      blastCoords,
    });
  }

  // 5. Apply turn-end PURIFY pulses
  applyPurifyPulses(newBoard, state.size, events);

  // 6. Advance turn and check game over
  const activeIdx = state.players.findIndex((p) => p.id === action.playerId);
  const nextPlayer = state.players[(activeIdx + 1) % state.players.length];

  events.push({
    type: "TURN_CHANGED",
    previousPlayerId: action.playerId,
    nextPlayerId: nextPlayer.id,
    turn: state.currentTurn + 1,
  });

  // Calculate winner if game is complete
  const isGameOver = checkGameOver(newBoard, state.size);
  let winnerTeamId: number | null = null;
  if (isGameOver) {
    winnerTeamId = calculateWinnerTeam(newBoard, state.size);
    events.push({
      type: "GAME_OVER",
      winnerTeamId,
    });
  }

  const nextState: GameState = {
    board: newBoard,
    size: state.size,
    currentTurn: state.currentTurn + 1,
    activePlayerId: nextPlayer.id,
    players: state.players,
    isGameOver,
    winnerTeamId,
  };

  return { nextState, events };
}

function applyPurifyPulses(
  board: Board,
  size: number,
  events: GameEvent[],
): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const piece = board[y]?.[x];
      if (piece?.skillType === "PURIFY") {
        const affectedCoords: Coord[] = [];

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (!isValidCoord(size, { x: nx, y: ny })) continue;

            const target = board[ny]?.[nx];
            if (!target) continue;

            // PIERCE piece is immune to Purify
            if (target.skillType === "PIERCE") continue;

            if (target.teamId !== piece.teamId) {
              target.teamId = piece.teamId;
              // Silently dissolves BOMB/COUNTER without triggering
              if (
                target.skillType === "BOMB" ||
                target.skillType === "COUNTER"
              ) {
                target.skillType = "NONE";
                target.isRevealed = true;
              }
              affectedCoords.push({ x: nx, y: ny });
            }
          }
        }

        piece.duration = (piece.duration ?? 3) - 1;
        if (piece.duration <= 0) {
          piece.skillType = "NONE";
        }

        events.push({
          type: "PURIFY_PULSE",
          coord: { x, y },
          teamId: piece.teamId,
          affectedCoords,
          remainingDuration: Math.max(0, piece.duration ?? 0),
        });
      }
    }
  }
}

function checkGameOver(board: Board, size: number): boolean {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y]?.[x] === null) {
        return false;
      }
    }
  }
  return true;
}

function calculateWinnerTeam(board: Board, size: number): number | null {
  const counts = new Map<number, number>();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const piece = board[y]?.[x];
      if (piece) {
        counts.set(piece.teamId, (counts.get(piece.teamId) ?? 0) + 1);
      }
    }
  }

  let maxCount = -1;
  let winner: number | null = null;
  let isTie = false;

  for (const [teamId, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      winner = teamId;
      isTie = false;
    } else if (count === maxCount) {
      isTie = true;
    }
  }

  return isTie ? null : winner;
}

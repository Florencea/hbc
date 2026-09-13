import { generateMap, IllegalMoveError, isWithinDropZone } from "./map.ts";
import { collectAllRaycasts, DIRECTIONS, isValidCoord } from "./raycast.ts";
import {
  SKILL_SPECS,
  type Action,
  type Board,
  type Coord,
  type DropZone,
  type GameEvent,
  type GameState,
  type MapPreset,
  type Piece,
  type Player,
  type ResolutionResult,
  type SkillType,
} from "./types.ts";

interface BombQueueItem {
  coord: Coord;
  teamId: number;
}

function createDefaultPlayer(id: number, teamId: number, name: string): Player {
  return {
    id,
    teamId,
    name,
    hand: {
      NONE: Infinity,
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
}

export interface CreateInitialStateOptions {
  boardSize?: number;
  players?: (Partial<Player> & Pick<Player, "id" | "teamId" | "name">)[];
  mapPreset?: MapPreset;
}

export function createInitialState(
  optionsOrSize?: number | MapPreset | CreateInitialStateOptions,
  players?: (Partial<Player> & Pick<Player, "id" | "teamId" | "name">)[],
  mapPreset?: MapPreset,
): GameState {
  let size = 16;
  let preset: MapPreset = "CROSSROADS";
  let rawPlayers:
    (Partial<Player> & Pick<Player, "id" | "teamId" | "name">)[] | undefined =
    players;

  if (typeof optionsOrSize === "number") {
    size = optionsOrSize;
    if (mapPreset) {
      preset = mapPreset;
    }
  } else if (typeof optionsOrSize === "string") {
    preset = optionsOrSize;
  } else if (typeof optionsOrSize === "object") {
    size = optionsOrSize.boardSize ?? 16;
    preset = optionsOrSize.mapPreset ?? "CROSSROADS";
    rawPlayers = optionsOrSize.players ?? players;
  }

  const initializedPlayers: Player[] = rawPlayers
    ? rawPlayers.map((p) => ({
        id: p.id,
        teamId: p.teamId,
        name: p.name,
        hand: p.hand
          ? { ...p.hand }
          : {
              NONE: Infinity,
              WALL: 0,
              PIERCE: 0,
              BOMB: 0,
              PURIFY: 0,
              COUNTER: 0,
            },
        charge: p.charge
          ? { ...p.charge }
          : {
              NONE: 0,
              WALL: 0,
              PIERCE: 0,
              BOMB: 0,
              PURIFY: 0,
              COUNTER: 0,
            },
        isForcedSpecial: p.isForcedSpecial ?? false,
        dropZone: p.dropZone ? { ...p.dropZone } : undefined,
      }))
    : [
        createDefaultPlayer(1, 1, "Player 1"),
        createDefaultPlayer(2, 2, "Player 2"),
      ];

  const { board, dropZones } = generateMap(preset, size, initializedPlayers);

  for (const player of initializedPlayers) {
    player.dropZone ??= dropZones.get(player.id);
  }

  return {
    board,
    size,
    currentTurn: 1,
    activePlayerId: initializedPlayers[0]?.id ?? 1,
    players: initializedPlayers,
    isGameOver: false,
    winnerTeamId: null,
    mapPreset: preset,
    isDropPhase: true,
    dropTurnsRemaining: initializedPlayers.length * 2,
  };
}

export function createInitialGame(
  optionsOrSize?: number | MapPreset | CreateInitialStateOptions,
  players?: (Partial<Player> & Pick<Player, "id" | "teamId" | "name">)[],
  mapPreset?: MapPreset,
): { state: GameState; events: GameEvent[] } {
  const state = createInitialState(optionsOrSize, players, mapPreset);
  const events: GameEvent[] = [
    {
      type: "DROP_PHASE_STARTED",
      mapPreset: state.mapPreset,
      players: state.players
        .filter(
          (p): p is Player & { dropZone: DropZone } => p.dropZone !== undefined,
        )
        .map((p) => ({ playerId: p.id, dropZone: p.dropZone })),
    },
  ];
  return { state, events };
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function clonePlayers(players: Player[]): Player[] {
  return players.map((p) => ({
    ...p,
    hand: { ...p.hand },
    charge: { ...p.charge },
    dropZone: p.dropZone
      ? {
          center: { ...p.dropZone.center },
          radius: p.dropZone.radius,
        }
      : undefined,
  }));
}

function applyTurnEndUpkeep(player: Player, events: GameEvent[]): void {
  const skillKeys = Object.keys(SKILL_SPECS) as (keyof typeof SKILL_SPECS)[];
  for (const skill of skillKeys) {
    player.charge[skill] += 1;
    if (player.charge[skill] >= SKILL_SPECS[skill].cd) {
      if (player.hand[skill] < SKILL_SPECS[skill].maxHand) {
        player.hand[skill] += 1;
        player.charge[skill] = 0;
        events.push({
          type: "SKILL_ACQUIRED",
          playerId: player.id,
          skillType: skill,
          currentHandCount: player.hand[skill],
        });
      } else if (player.hand[skill] === SKILL_SPECS[skill].maxHand) {
        player.isForcedSpecial = true;
        player.charge[skill] = SKILL_SPECS[skill].cd;
        events.push({
          type: "FORCED_SPECIAL_TRIGGERED",
          playerId: player.id,
        });
      }
    }
  }
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
  const newPlayers = clonePlayers(state.players);

  const attacker = newPlayers.find((p) => p.id === action.playerId);
  if (!attacker) {
    throw new Error("Player not found in state");
  }

  if (action.type === "PASS_TURN") {
    if (action.playerId !== state.activePlayerId) {
      throw new Error("Not active player's turn to pass");
    }

    // Apply Purify pulses at turn end
    applyPurifyPulses(newBoard, state.size, events);

    // Apply Turn-End Upkeep
    applyTurnEndUpkeep(attacker, events);

    // Advance turn
    const activeIdx = newPlayers.findIndex((p) => p.id === action.playerId);
    const nextPlayer = newPlayers[(activeIdx + 1) % newPlayers.length];

    // Advance drop phase if active
    let isDropPhase = state.isDropPhase;
    let dropTurnsRemaining = state.dropTurnsRemaining;
    if (isDropPhase) {
      dropTurnsRemaining -= 1;
      if (dropTurnsRemaining <= 0) {
        isDropPhase = false;
        dropTurnsRemaining = 0;
        events.push({
          type: "DROP_PHASE_ENDED",
        });
      }
    }

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
      players: newPlayers,
      mapPreset: state.mapPreset,
      isDropPhase,
      dropTurnsRemaining,
    };

    return { nextState, events };
  }

  // Handle PLACE_PIECE
  if (action.playerId !== state.activePlayerId) {
    throw new Error("Not active player's turn");
  }

  if (
    state.isDropPhase &&
    attacker.dropZone &&
    !isWithinDropZone(action.coord, attacker.dropZone)
  ) {
    throw new IllegalMoveError(
      "Placement outside assigned drop zone during Drop Phase",
    );
  }

  if (!isValidCoord(state.size, action.coord)) {
    throw new Error("Target coordinate is out of bounds");
  }

  if (newBoard[action.coord.y]?.[action.coord.x] !== null) {
    throw new Error("Target coordinate is already occupied");
  }

  const attackerSkill: SkillType = action.skillType ?? "NONE";

  // Move Validation for skill economy:
  if (action.skillType && action.skillType !== "NONE") {
    if (attacker.hand[action.skillType] <= 0) {
      throw new Error("Player does not have this skill in hand");
    }
    attacker.hand[action.skillType] -= 1;
    attacker.isForcedSpecial = false;
  }

  if (attacker.isForcedSpecial && attackerSkill === "NONE") {
    throw new Error("Forced special move required: hand cap reached");
  }

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
            pos: ray.blockedCoord,
            skillType: "WALL",
            reason: "BLOCK",
          });
        }
        events.push({
          type: "RAYCAST_BLOCKED",
          coord: ray.blockedCoord,
          pos: action.coord,
          wallPos: ray.blockedCoord,
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
        pos: action.coord,
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

  // 3. Phase 2: Black Counter Check
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

      // Backlash reverses the batch. If the backlash path encounters a WALL, it stops at the wall.
      let wallBlockedBacklash = false;
      for (const ray of raycasts) {
        if (
          ray.capturedCoords.some(
            (c) => c.x === counterCoord.x && c.y === counterCoord.y,
          )
        ) {
          const dx = ray.direction.x;
          const dy = ray.direction.y;
          let cx = counterCoord.x - dx;
          let cy = counterCoord.y - dy;
          while (cx !== action.coord.x || cy !== action.coord.y) {
            const p = newBoard[cy]?.[cx];
            if (p?.skillType === "WALL") {
              wallBlockedBacklash = true;
              break;
            }
            cx -= dx;
            cy -= dy;
          }
        }
      }

      // Entire active flip batch + placed piece converted to defender faction
      const rawReversed: Coord[] = [action.coord, ...capturedCoords];
      const reversedCoords: Coord[] = [];
      for (const c of rawReversed) {
        if (
          wallBlockedBacklash &&
          c.x === action.coord.x &&
          c.y === action.coord.y
        ) {
          continue;
        }
        const p = newBoard[c.y]?.[c.x];
        if (p) {
          p.teamId = defenderTeamId;
          p.playerId = defenderPlayerId;
          reversedCoords.push(c);
        }
      }

      events.push({
        type: "COUNTER_TRIGGERED",
        coord: counterCoord,
        source: counterCoord,
        defenderTeamId,
        factionId: defenderTeamId,
        reversedCoords,
        hijackedBatch: reversedCoords,
      });

      // If backlash engulfs a BOMB in reversedCoords, enqueue it
      for (const c of reversedCoords) {
        const orig =
          state.board[c.y]?.[c.x] ??
          (c.x === action.coord.x && c.y === action.coord.y ? newPiece : null);
        const key = `${c.x.toString()},${c.y.toString()}`;
        if (orig?.skillType === "BOMB" && !processedBombs.has(key)) {
          bombQueue.push({
            coord: c,
            teamId: defenderTeamId,
          });
          processedBombs.add(key);
        }
      }

      // Also chains into adjacent unexploded BOMBs
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
                teamId: defenderTeamId,
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
        pos: action.coord,
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

        // If flipped piece was a BOMB, trigger explosion with its own faction
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

  // 4. Phase 3: Process Bomb Chain Reactions via BFS queue
  while (bombQueue.length > 0) {
    const bombItem: BombQueueItem | undefined = bombQueue.shift();
    if (!bombItem) break;
    const bombPiece = newBoard[bombItem.coord.y]?.[bombItem.coord.x];
    if (!bombPiece) continue;

    bombPiece.skillType = "NONE";
    bombPiece.isRevealed = true;
    bombPiece.teamId = bombItem.teamId;

    const blastCoords: Coord[] = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx: number = bombItem.coord.x + dx;
        const ny: number = bombItem.coord.y + dy;
        if (!isValidCoord(state.size, { x: nx, y: ny })) continue;

        const targetPiece = newBoard[ny]?.[nx];
        if (!targetPiece) continue;

        // PIERCE piece is immune to Bomb explosion
        if (targetPiece.skillType === "PIERCE") {
          if (!targetPiece.isRevealed) {
            targetPiece.isRevealed = true;
            events.push({
              type: "PIECE_REVEALED",
              coord: { x: nx, y: ny },
              pos: { x: nx, y: ny },
              skillType: "PIERCE",
              reason: "TRIGGER",
            });
          }
          continue;
        }

        blastCoords.push({ x: nx, y: ny });

        const prevSkill = targetPiece.skillType;

        // Check if bomb blast triggers another BOMB (chain reaction)
        const key = `${nx.toString()},${ny.toString()}`;
        if (prevSkill === "BOMB" && !processedBombs.has(key)) {
          processedBombs.add(key);
          bombQueue.push({ coord: { x: nx, y: ny }, teamId: bombItem.teamId });
        }

        // Check if bomb blast hits an unrevealed COUNTER (crossfire backlash)
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
                  teamId: bombItem.teamId,
                });
              }
            }
          }
        }

        // Convert to Bomb's triggering faction and normal piece
        targetPiece.teamId = bombItem.teamId;
        if (targetPiece.skillType !== "BOMB") {
          targetPiece.skillType = "NONE";
          targetPiece.isRevealed = true;
        }
      }
    }

    events.push({
      type: "BOMB_TRIGGERED",
      coord: bombItem.coord,
      center: bombItem.coord,
      teamId: bombItem.teamId,
      factionId: bombItem.teamId,
      blastCoords,
      affected: blastCoords,
    });
  }

  // 5. Apply turn-end PURIFY pulses
  applyPurifyPulses(newBoard, state.size, events);

  // Turn-end upkeep: charges and skill acquisition for action.playerId
  applyTurnEndUpkeep(attacker, events);

  // Advance drop phase if active
  let isDropPhase = state.isDropPhase;
  let dropTurnsRemaining = state.dropTurnsRemaining;
  if (isDropPhase) {
    dropTurnsRemaining -= 1;
    if (dropTurnsRemaining <= 0) {
      isDropPhase = false;
      dropTurnsRemaining = 0;
      events.push({
        type: "DROP_PHASE_ENDED",
      });
    }
  }

  // 6. Advance turn and check game over
  const activeIdx = newPlayers.findIndex((p) => p.id === action.playerId);
  const nextPlayer = newPlayers[(activeIdx + 1) % newPlayers.length];

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
    players: newPlayers,
    isGameOver,
    winnerTeamId,
    mapPreset: state.mapPreset,
    isDropPhase,
    dropTurnsRemaining,
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
            if (target.skillType === "PIERCE") {
              if (!target.isRevealed) {
                target.isRevealed = true;
                events.push({
                  type: "PIECE_REVEALED",
                  coord: { x: nx, y: ny },
                  pos: { x: nx, y: ny },
                  skillType: "PIERCE",
                  reason: "AURA",
                });
              }
              continue;
            }

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
          center: { x, y },
          teamId: piece.teamId,
          factionId: piece.teamId,
          affectedCoords,
          affected: affectedCoords,
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

export function resolveAction(
  state: GameState,
  action: Action,
): ResolutionResult {
  return dispatch(state, action);
}

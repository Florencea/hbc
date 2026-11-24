import {
  generateMap,
  IllegalMoveError,
  isWithinDropZone,
  setPiece,
} from "./map.js";
import {
  collectAllRaycasts,
  DIRECTIONS,
  getLegalMoves,
  getPioneerMoves,
  isValidCoord,
} from "./raycast.js";
import { sanitizeForViewer } from "./sanitize.js";
import { SKILL_SPECS, SPECIAL_SKILL_TYPES } from "./constants.js";

function createDefaultPlayer(id, teamId, name) {
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

export function createInitialState(optionsOrSize, players, mapPreset) {
  let size = 16;
  let preset = "CROSSROADS";
  let rawPlayers = players;

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

  const initializedPlayers = rawPlayers
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
    consecutivePasses: 0,
  };
}

export function createInitialGame(optionsOrSize, players, mapPreset) {
  const state = createInitialState(optionsOrSize, players, mapPreset);
  const events = [
    {
      type: "DROP_PHASE_STARTED",
      mapPreset: state.mapPreset,
      players: state.players
        .filter((p) => p.dropZone !== undefined)
        .map((p) => ({ playerId: p.id, dropZone: p.dropZone })),
    },
  ];
  return { state, events };
}

function cloneBoard(board) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function clonePlayers(players) {
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

function applyTurnEndUpkeep(player, events) {
  for (const skill of SPECIAL_SKILL_TYPES) {
    if (player.hand[skill] >= SKILL_SPECS[skill].maxHand) {
      player.charge[skill] = 0;
      continue;
    }

    player.charge[skill] += 1;
    if (player.charge[skill] >= SKILL_SPECS[skill].cd) {
      player.hand[skill] += 1;
      player.charge[skill] = 0;
      events.push({
        type: "SKILL_ACQUIRED",
        playerId: player.id,
        skillType: skill,
        currentHandCount: player.hand[skill],
      });
    }
  }

  const isHandSaturated = SPECIAL_SKILL_TYPES.every(
    (skill) => player.hand[skill] >= SKILL_SPECS[skill].maxHand,
  );
  if (isHandSaturated && !player.isForcedSpecial) {
    player.isForcedSpecial = true;
    events.push({
      type: "FORCED_SPECIAL_TRIGGERED",
      playerId: player.id,
    });
  }
}

export function dispatch(state, action) {
  if (state.isGameOver) {
    throw new Error("Game is already over");
  }

  const events = [];
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
    applyPurifyPulses(newBoard, state.size, events, attacker.teamId);

    // Apply Turn-End Upkeep
    applyTurnEndUpkeep(attacker, events);

    // Advance turn
    const activeIdx = newPlayers.findIndex((p) => p.id === action.playerId);
    const nextPlayer =
      newPlayers[(activeIdx + 1) % newPlayers.length] ?? attacker;

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

    const consecutivePasses = state.isDropPhase
      ? 0
      : (state.consecutivePasses ?? 0) + 1;
    const isGameOver = checkGameOver(
      newBoard,
      state.size,
      consecutivePasses,
      newPlayers.length,
      isDropPhase,
    );
    let winnerTeamId = null;
    if (isGameOver) {
      winnerTeamId = calculateWinnerTeam(newBoard, state.size);
      events.push({
        type: "GAME_OVER",
        winnerTeamId,
      });
    }

    const nextState = {
      ...state,
      board: newBoard,
      currentTurn: state.currentTurn + 1,
      activePlayerId: nextPlayer.id,
      players: newPlayers,
      isGameOver,
      winnerTeamId,
      mapPreset: state.mapPreset,
      isDropPhase,
      dropTurnsRemaining,
      consecutivePasses,
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

  const attackerSkill = action.skillType ?? "NONE";

  // Move Validation for skill economy:
  if (action.skillType && action.skillType !== "NONE") {
    if (attacker.hand[action.skillType] <= 0) {
      throw new Error("Player does not have this skill in hand");
    }
  }

  if (attacker.isForcedSpecial && attackerSkill === "NONE") {
    throw new Error("Forced special move required: hand cap reached");
  }

  const isPurify = attackerSkill === "PURIFY";

  // Trace raycasts to check captures
  const raycasts = collectAllRaycasts(
    state.board,
    state.size,
    action.coord,
    attacker.teamId,
    attackerSkill,
  );

  // Collect all unique captured coordinates
  const capturedMap = new Map();
  for (const ray of raycasts) {
    for (const c of ray.capturedCoords) {
      capturedMap.set(`${c.x.toString()},${c.y.toString()}`, c);
    }
  }
  const capturedCoords = [...capturedMap.values()];

  if (capturedCoords.length === 0) {
    // Check if this move was an optimistic standard move blocked by hidden WALL(s)
    const optimisticState = sanitizeForViewer(state, action.playerId);
    const optimisticMoves = getLegalMoves(
      optimisticState,
      action.playerId,
      attackerSkill,
    );
    const isOptimisticStandardMove = optimisticMoves.some(
      (c) => c.x === action.coord.x && c.y === action.coord.y,
    );

    if (!isOptimisticStandardMove) {
      const standardMoves = getLegalMoves(
        state,
        action.playerId,
        attackerSkill,
      );
      if (standardMoves.length > 0) {
        throw new IllegalMoveError(
          "Illegal move: must capture at least one piece",
        );
      }

      const pioneerMoves = getPioneerMoves(state, action.playerId);
      const isValidPioneer = pioneerMoves.some(
        (c) => c.x === action.coord.x && c.y === action.coord.y,
      );

      if (!isValidPioneer) {
        throw new IllegalMoveError(
          "Illegal pioneer move: target must be within 2 tiles of friendly territory",
        );
      }

      // Deduct skill if special piece
      if (action.skillType && action.skillType !== "NONE") {
        attacker.hand[action.skillType] -= 1;
        attacker.isForcedSpecial = false;
      }

      // Place pioneer piece
      const newPiece = {
        teamId: attacker.teamId,
        playerId: attacker.id,
        skillType: attackerSkill,
        isRevealed: isPurify || attackerSkill === "NONE",
        duration: isPurify ? 3 : undefined,
      };
      setPiece(newBoard, action.coord.x, action.coord.y, newPiece);

      events.push({
        type: "PIECE_PLACED",
        coord: action.coord,
        piece: { ...newPiece },
      });

      events.push({
        type: "PIONEER_PLACED",
        coord: action.coord,
        playerId: action.playerId,
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

      return finalizePlacementTurn(
        state,
        newBoard,
        newPlayers,
        attacker,
        action.playerId,
        events,
      );
    }
  }

  // Deduct skill for standard move
  if (action.skillType && action.skillType !== "NONE") {
    attacker.hand[action.skillType] -= 1;
    attacker.isForcedSpecial = false;
  }

  // 1. Place piece for standard move
  const newPiece = {
    teamId: attacker.teamId,
    playerId: attacker.id,
    skillType: attackerSkill,
    isRevealed: isPurify || attackerSkill === "NONE",
    duration: isPurify ? 3 : undefined,
  };
  setPiece(newBoard, action.coord.x, action.coord.y, newPiece);

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

  // 2. Trace raycast blockage / penetration events
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

  // 3. Phase 2: Black Counter Check
  const counterCoord = capturedCoords.find((c) => {
    const piece = state.board[c.y]?.[c.x];
    return piece?.skillType === "COUNTER" && piece.teamId !== attacker.teamId;
  });

  const bombQueue = [];
  const processedBombs = new Set();

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
      const rawReversed = [action.coord, ...capturedCoords];
      const reversedCoords = [];
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
          // PIERCE is immune to backlash stream: position and faction remain unchanged; reveals PIERCE.
          if (p.skillType === "PIERCE") {
            if (!p.isRevealed) {
              p.isRevealed = true;
              events.push({
                type: "PIECE_REVEALED",
                coord: c,
                pos: c,
                skillType: "PIERCE",
                reason: "TRIGGER",
              });
            }
            continue;
          }

          p.teamId = defenderTeamId;
          p.playerId = defenderPlayerId;
          if (p.skillType !== "BOMB") {
            p.skillType = "NONE";
            p.duration = undefined;
            p.isRevealed = true;
          }
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

    const fromTeamIds = [
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
        } else {
          // When captured/eaten by sandwiching, special skill is consumed and reverts to standard piece 'NONE'
          currentPiece.skillType = "NONE";
          currentPiece.duration = undefined;
          currentPiece.isRevealed = true;
        }
      }
    }

    if (capturedCoords.length > 0) {
      events.push({
        type: "FLIP_BATCH",
        coords: capturedCoords,
        fromTeamIds,
        toTeamId: attacker.teamId,
      });
    }
  }

  // 4. Phase 3: Process Bomb Chain Reactions via BFS queue
  while (bombQueue.length > 0) {
    const bombItem = bombQueue.shift();
    if (!bombItem) break;
    const bombPiece = newBoard[bombItem.coord.y]?.[bombItem.coord.x];
    if (!bombPiece) continue;

    bombPiece.skillType = "NONE";
    bombPiece.isRevealed = true;
    bombPiece.teamId = bombItem.teamId;

    const blastCoords = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = bombItem.coord.x + dx;
        const ny = bombItem.coord.y + dy;
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

  return finalizePlacementTurn(
    state,
    newBoard,
    newPlayers,
    attacker,
    action.playerId,
    events,
  );
}

function finalizePlacementTurn(
  state,
  newBoard,
  newPlayers,
  attacker,
  actionPlayerId,
  events,
) {
  // Apply turn-end PURIFY pulses
  applyPurifyPulses(newBoard, state.size, events, attacker.teamId);

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

  // Advance turn and check game over
  const activeIdx = newPlayers.findIndex((p) => p.id === actionPlayerId);
  const nextPlayer =
    newPlayers[(activeIdx + 1) % newPlayers.length] ?? attacker;

  events.push({
    type: "TURN_CHANGED",
    previousPlayerId: actionPlayerId,
    nextPlayerId: nextPlayer.id,
    turn: state.currentTurn + 1,
  });

  // Calculate winner if game is complete
  const consecutivePasses = 0;
  const isGameOver = checkGameOver(
    newBoard,
    state.size,
    consecutivePasses,
    newPlayers.length,
    isDropPhase,
  );
  let winnerTeamId = null;
  if (isGameOver) {
    winnerTeamId = calculateWinnerTeam(newBoard, state.size);
    events.push({
      type: "GAME_OVER",
      winnerTeamId,
    });
  }

  const nextState = {
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
    consecutivePasses,
  };

  return { nextState, events };
}

function applyPurifyPulses(board, size, events, activeTeamId) {
  const purifyPieces = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const piece = board[y]?.[x];
      if (piece?.skillType === "PURIFY") {
        purifyPieces.push({ coord: { x, y }, piece });
      }
    }
  }

  // Active faction's PURIFY pulses take precedence (matrix: "Replaced/assimilated by active Purify faction")
  if (activeTeamId !== undefined) {
    purifyPieces.sort((a, b) => {
      const aActive = a.piece.teamId === activeTeamId ? 1 : 0;
      const bActive = b.piece.teamId === activeTeamId ? 1 : 0;
      return bActive - aActive;
    });
  }

  for (const { coord, piece } of purifyPieces) {
    if (piece.skillType !== "PURIFY") continue;

    const affectedCoords = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = coord.x + dx;
        const ny = coord.y + dy;
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
          if (target.skillType === "BOMB" || target.skillType === "COUNTER") {
            target.skillType = "NONE";
            target.isRevealed = true;
          } else if (
            target.skillType === "WALL" ||
            target.skillType === "PURIFY"
          ) {
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
      coord: coord,
      center: coord,
      teamId: piece.teamId,
      factionId: piece.teamId,
      affectedCoords,
      affected: affectedCoords,
      remainingDuration: Math.max(0, piece.duration ?? 0),
    });
  }
}

function checkGameOver(
  board,
  size,
  consecutivePasses,
  playerCount,
  isDropPhase,
) {
  // 1. Consecutive passes reached or exceeded player count outside drop phase (nobody can move)
  if (!isDropPhase && consecutivePasses >= playerCount) {
    return true;
  }

  // 2. Full board (no empty cells left)
  let hasEmptyCell = false;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y]?.[x] === null) {
        hasEmptyCell = true;
        break;
      }
    }
    if (hasEmptyCell) break;
  }
  if (!hasEmptyCell) {
    return true;
  }

  return false;
}

function calculateWinnerTeam(board, size) {
  const counts = new Map();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const piece = board[y]?.[x];
      if (piece && piece.teamId !== 0) {
        counts.set(piece.teamId, (counts.get(piece.teamId) ?? 0) + 1);
      }
    }
  }

  let maxCount = -1;
  let winner = null;
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

export function resolveAction(state, action) {
  return dispatch(state, action);
}

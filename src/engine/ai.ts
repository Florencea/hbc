import { isWithinDropZone } from "./map.ts";
import { dispatch } from "./pipeline.ts";
import {
  collectAllRaycasts,
  getAvailableMoves,
  getLegalMoves,
} from "./raycast.ts";
import { sanitizeForViewer } from "./sanitize.ts";
import type {
  Action,
  AIDifficulty,
  AIMoveDecision,
  Board,
  Coord,
  GameState,
  SkillType,
} from "./types.ts";

const ALL_SPECIAL_SKILLS: readonly Exclude<SkillType, "NONE">[] = [
  "WALL",
  "PIERCE",
  "BOMB",
  "PURIFY",
  "COUNTER",
];

/**
 * Calculates the positional weight of a coordinate on an N x N board.
 * - Corners: +100
 * - Stable Edges: +20
 * - C-squares and X-squares adjacent to empty corners: -30
 * - Interior squares: 0
 */
export function getPositionalWeight(
  coord: Coord,
  board: Board,
  size: number,
): number {
  const { x, y } = coord;
  const last = size - 1;

  const isCorner =
    (x === 0 && y === 0) ||
    (x === last && y === 0) ||
    (x === 0 && y === last) ||
    (x === last && y === last);

  if (isCorner) {
    return 100;
  }

  // Top-Left (0, 0)
  if (board[0]?.[0] === null) {
    if ((x === 1 && y === 0) || (x === 0 && y === 1) || (x === 1 && y === 1)) {
      return -30;
    }
  }

  // Top-Right (last, 0)
  if (board[0]?.[last] === null) {
    if (
      (x === last - 1 && y === 0) ||
      (x === last && y === 1) ||
      (x === last - 1 && y === 1)
    ) {
      return -30;
    }
  }

  // Bottom-Left (0, last)
  if (board[last]?.[0] === null) {
    if (
      (x === 0 && y === last - 1) ||
      (x === 1 && y === last) ||
      (x === 1 && y === last - 1)
    ) {
      return -30;
    }
  }

  // Bottom-Right (last, last)
  if (board[last]?.[last] === null) {
    if (
      (x === last - 1 && y === last) ||
      (x === last && y === last - 1) ||
      (x === last - 1 && y === last - 1)
    ) {
      return -30;
    }
  }

  // Stable Edges (not adjacent to empty corner)
  if (x === 0 || x === last || y === 0 || y === last) {
    return 20;
  }

  return 0;
}

function isEdgeCoord(size: number, coord: Coord): boolean {
  return (
    coord.x === 0 ||
    coord.x === size - 1 ||
    coord.y === 0 ||
    coord.y === size - 1
  );
}

function isChokePoint(board: Board, size: number, coord: Coord): boolean {
  let emptyCount = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = coord.x + dx;
      const ny = coord.y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        if (board[ny]?.[nx] === null) {
          emptyCount++;
        }
      }
    }
  }
  return emptyCount <= 2;
}

function countEnemyOrNeutralIn3x3(
  board: Board,
  size: number,
  coord: Coord,
  friendlyTeamId: number,
): number {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = coord.x + dx;
      const ny = coord.y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        const piece = board[ny]?.[nx];
        if (piece && piece.teamId !== friendlyTeamId) {
          count++;
        }
      }
    }
  }
  return count;
}

/**
 * Pure deterministic heuristic evaluation that selects the best move for a given player.
 * Operates strictly on a sanitized state perspective to prevent information leaks.
 */
export function selectBestMove(
  state: GameState,
  playerId: number,
  difficulty: AIDifficulty = "MEDIUM",
): Action {
  if (state.isGameOver) {
    return { type: "PASS_TURN", playerId };
  }

  const sanitized = sanitizeForViewer(state, playerId);
  const player = sanitized.players.find((p) => p.id === playerId);
  if (!player) {
    return { type: "PASS_TURN", playerId };
  }

  // 1. Determine candidate skills to evaluate
  let candidateSkills: SkillType[];
  if (player.isForcedSpecial) {
    // Strictly filter choices to skills with hand[skill] > 0
    candidateSkills = ALL_SPECIAL_SKILLS.filter((sk) => player.hand[sk] > 0);
    if (candidateSkills.length === 0) {
      // Fallback if somehow hand is empty during forced special
      candidateSkills = ["WALL"];
    }
  } else {
    // Default to NONE when hand should be preserved
    candidateSkills = ["NONE"];
    if (difficulty !== "EASY") {
      if (player.hand.WALL > 0) candidateSkills.push("WALL");
      if (player.hand.PIERCE > 0) candidateSkills.push("PIERCE");
      if (player.hand.BOMB > 0) candidateSkills.push("BOMB");
      if (player.hand.PURIFY > 0) candidateSkills.push("PURIFY");
      if (player.hand.COUNTER > 0) candidateSkills.push("COUNTER");
    }
  }

  // 2. Evaluate all legal standard moves
  const candidateDecisions: AIMoveDecision[] = [];

  for (const skill of candidateSkills) {
    const legalMoves = getLegalMoves(sanitized, playerId, skill);

    for (const coord of legalMoves) {
      const raycasts = collectAllRaycasts(
        sanitized.board,
        sanitized.size,
        coord,
        player.teamId,
        skill,
      );
      const captureCount = raycasts.reduce(
        (acc, r) => acc + r.capturedCoords.length,
        0,
      );
      const posWeight = getPositionalWeight(
        coord,
        sanitized.board,
        sanitized.size,
      );

      let score = captureCount * 10;

      if (difficulty === "EASY") {
        score += posWeight * 0.2;
      } else if (difficulty === "MEDIUM") {
        score += posWeight;
      } else {
        // HARD
        score += posWeight * 1.5;
      }

      // Skill-specific preference heuristics
      if (skill === "WALL") {
        if (posWeight >= 100) {
          // Impregnable corner wall
          score += 45;
        } else if (isEdgeCoord(sanitized.size, coord)) {
          score += 25;
        }
        if (isChokePoint(sanitized.board, sanitized.size, coord)) {
          score += 25;
        }
      } else if (skill === "PIERCE") {
        const penetratesWall = raycasts.some(
          (r) => r.penetratedWallCoords.length > 0,
        );
        if (penetratesWall) {
          score += 45;
        } else if (captureCount >= 5) {
          score += 25;
        } else if (player.isForcedSpecial) {
          score += 15;
        }
      } else if (skill === "BOMB") {
        const clusterCount = countEnemyOrNeutralIn3x3(
          sanitized.board,
          sanitized.size,
          coord,
          player.teamId,
        );
        // BOMB is a dangerous double-edged trap; only prioritize when deeply surrounded
        if (clusterCount >= 6) {
          score += 20;
        } else if (clusterCount >= 5 && player.isForcedSpecial) {
          score += 18;
        } else if (player.isForcedSpecial) {
          score += 10;
        }
      } else if (skill === "COUNTER") {
        if (posWeight < 0) {
          // Bait trap on C-squares / X-squares to punish opponent capture
          score += 40;
        } else if (captureCount >= 3) {
          score += 25;
        } else if (player.isForcedSpecial) {
          score += 15;
        }
      } else if (skill === "PURIFY") {
        const clusterCount = countEnemyOrNeutralIn3x3(
          sanitized.board,
          sanitized.size,
          coord,
          player.teamId,
        );
        if (clusterCount >= 4) {
          score += 30;
        } else if (clusterCount >= 2 && player.isForcedSpecial) {
          score += 20;
        } else if (player.isForcedSpecial) {
          score += 15;
        }
      }

      // Hand preservation penalty if not forced special
      if (!player.isForcedSpecial && skill !== "NONE") {
        score -= 35;
      }

      // HARD: evaluate opponent mobility lookahead
      if (difficulty === "HARD") {
        try {
          const { nextState } = dispatch(sanitized, {
            type: "PLACE_PIECE",
            playerId,
            coord,
            skillType: skill,
          });
          if (
            nextState.isGameOver &&
            nextState.winnerTeamId === player.teamId
          ) {
            score += 1000;
          } else {
            const oppLegalCount = getLegalMoves(
              nextState,
              nextState.activePlayerId,
              "NONE",
            ).length;
            score -= oppLegalCount * 3;
          }
        } catch {
          // Ignore simulation error if any
        }
      }

      const action: Action = {
        type: "PLACE_PIECE",
        playerId,
        coord,
        skillType: skill,
      };

      candidateDecisions.push({ action, score });
    }
  }

  // Sort candidate moves by score descending with deterministic tie-breaking
  candidateDecisions.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 1e-6) {
      return b.score - a.score;
    }
    const aCoord = (a.action as { coord: Coord }).coord;
    const bCoord = (b.action as { coord: Coord }).coord;
    if (aCoord.y !== bCoord.y) return aCoord.y - bCoord.y;
    return aCoord.x - bCoord.x;
  });

  // Pick the highest scoring move that is legally executable on real state
  for (const decision of candidateDecisions) {
    try {
      dispatch(state, decision.action);
      return decision.action;
    } catch {
      // If blocked by hidden enemy WALL or invalid on real board, try next best candidate
      continue;
    }
  }

  // 3. Pioneer Strategy: Check pioneer moves when standard moves are empty
  const available = getAvailableMoves(
    sanitized,
    playerId,
    candidateSkills[0] ?? "NONE",
  );

  if (available.pioneerMoves.length > 0) {
    // Find all enemy pieces and neutral anchors on board
    const targets: Coord[] = [];
    for (let y = 0; y < sanitized.size; y++) {
      for (let x = 0; x < sanitized.size; x++) {
        const piece = sanitized.board[y]?.[x];
        if (piece && piece.teamId !== player.teamId) {
          targets.push({ x, y });
        }
      }
    }

    const pioneerCandidates: { coord: Coord; score: number }[] = [];

    for (const pCoord of available.pioneerMoves) {
      if (
        sanitized.isDropPhase &&
        player.dropZone &&
        !isWithinDropZone(pCoord, player.dropZone)
      ) {
        continue;
      }

      let d = Infinity;
      if (targets.length > 0) {
        for (const target of targets) {
          const dist = Math.hypot(pCoord.x - target.x, pCoord.y - target.y);
          if (dist < d) {
            d = dist;
          }
        }
      } else {
        // If no targets, minimize distance to center
        const center = (sanitized.size - 1) / 2;
        d = Math.hypot(pCoord.x - center, pCoord.y - center);
      }

      // Tie-break with positional weight and coordinate order
      const posWeight = getPositionalWeight(
        pCoord,
        sanitized.board,
        sanitized.size,
      );
      const compositeScore = -d * 10 + posWeight * 0.1;
      pioneerCandidates.push({ coord: pCoord, score: compositeScore });
    }

    // Sort pioneer candidates by score descending
    pioneerCandidates.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 1e-6) {
        return b.score - a.score;
      }
      if (a.coord.y !== b.coord.y) return a.coord.y - b.coord.y;
      return a.coord.x - b.coord.x;
    });

    const chosenSkill: SkillType = player.isForcedSpecial
      ? (candidateSkills[0] ?? "WALL")
      : "NONE";

    for (const candidate of pioneerCandidates) {
      const pioneerAction: Action = {
        type: "PLACE_PIECE",
        playerId,
        coord: candidate.coord,
        skillType: chosenSkill,
      };
      try {
        dispatch(state, pioneerAction);
        return pioneerAction;
      } catch {
        continue;
      }
    }
  }

  // 4. Fallback: Pass turn when no standard or pioneer moves are available
  return {
    type: "PASS_TURN",
    playerId,
  };
}

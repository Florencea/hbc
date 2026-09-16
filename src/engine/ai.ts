import { isWithinDropZone } from "./map.ts";
import { dispatch } from "./pipeline.ts";
import {
  collectAllRaycasts,
  getAvailableMoves,
  getLegalMoves,
} from "./raycast.ts";
import { sanitizeForViewer } from "./sanitize.ts";
import {
  SKILL_SPECS,
  type Action,
  type AIDifficulty,
  type AIMoveDecision,
  type Board,
  type Coord,
  type GameState,
  type MaskedGameState,
  type SkillType,
} from "./types.ts";

const ALL_SPECIAL_SKILLS: readonly Exclude<SkillType, "NONE">[] = [
  "WALL",
  "PIERCE",
  "BOMB",
  "PURIFY",
  "COUNTER",
];

/**
 * Checks if a coordinate is a C-square or X-square adjacent to a board corner.
 */
function isCXSquare(
  coord: Coord,
  size: number,
): { isCX: boolean; corner: Coord } | null {
  const { x, y } = coord;
  const last = size - 1;

  // Top-Left (0, 0)
  if ((x === 1 && y === 0) || (x === 0 && y === 1) || (x === 1 && y === 1)) {
    return { isCX: true, corner: { x: 0, y: 0 } };
  }
  // Top-Right (last, 0)
  if (
    (x === last - 1 && y === 0) ||
    (x === last && y === 1) ||
    (x === last - 1 && y === 1)
  ) {
    return { isCX: true, corner: { x: last, y: 0 } };
  }
  // Bottom-Left (0, last)
  if (
    (x === 0 && y === last - 1) ||
    (x === 1 && y === last) ||
    (x === 1 && y === last - 1)
  ) {
    return { isCX: true, corner: { x: 0, y: last } };
  }
  // Bottom-Right (last, last)
  if (
    (x === last - 1 && y === last) ||
    (x === last && y === last - 1) ||
    (x === last - 1 && y === last - 1)
  ) {
    return { isCX: true, corner: { x: last, y: last } };
  }

  return null;
}

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

  const cx = isCXSquare(coord, size);
  if (cx) {
    if (board[cx.corner.y]?.[cx.corner.x] === null) {
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
 * Checks whether an opponent player has their COUNTER skill charged or ready to deploy.
 * Works under both raw and sanitized game states:
 * - Direct check: opponent has hand.COUNTER > 0 or charge.COUNTER >= cd
 * - Turn-based Fog-of-War inference: currentTurn >= COUNTER cooldown (7 turns)
 */
export function isOpponentCounterReady(
  state: GameState | MaskedGameState,
  friendlyTeamId: number,
): boolean {
  for (const player of state.players) {
    if (player.teamId !== friendlyTeamId) {
      if (
        player.hand.COUNTER > 0 ||
        player.charge.COUNTER >= SKILL_SPECS.COUNTER.cd
      ) {
        return true;
      }
    }
  }
  return state.currentTurn >= SKILL_SPECS.COUNTER.cd;
}

/**
 * Evaluates trap risk and corner security blunder penalties for a candidate move.
 */
export function calculateRiskScore(
  board: Board,
  size: number,
  coord: Coord,
  friendlyTeamId: number,
  skill: SkillType,
  isCounterReady: boolean,
): number {
  let riskPenalty = 0;

  // 1. Fog-of-War Counter Trap Risk:
  // If opponent COUNTER is ready and a raycast captures >2 pieces containing unrevealed enemy pieces,
  // apply a severe risk penalty unless the attacking piece is PIERCE (which is completely immune).
  if (isCounterReady && skill !== "PIERCE") {
    const raycasts = collectAllRaycasts(
      board,
      size,
      coord,
      friendlyTeamId,
      skill,
    );
    for (const r of raycasts) {
      if (r.capturedCoords.length > 2) {
        const hasUnrevealedEnemy = r.capturedCoords.some((c) => {
          const piece = board[c.y]?.[c.x];
          return piece && piece.teamId !== friendlyTeamId && !piece.isRevealed;
        });
        if (hasUnrevealedEnemy) {
          riskPenalty += 70 + r.capturedCoords.length * 10;
        }
      }
    }
  }

  // 2. Corner security: penalize placing on C/X squares unless the corresponding corner is claimed
  const cx = isCXSquare(coord, size);
  if (cx) {
    const cornerPiece = board[cx.corner.y]?.[cx.corner.x];
    if (cornerPiece === null) {
      riskPenalty += 45;
    }
  }

  return riskPenalty;
}

/**
 * Checks whether placing a pioneer piece immediately gifts the opponent an advantageous sandwich capture line.
 */
export function isSuicidePioneerMove(
  state: MaskedGameState,
  playerId: number,
  pCoord: Coord,
  skill: SkillType = "NONE",
): boolean {
  try {
    const { nextState } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId,
      coord: pCoord,
      skillType: skill,
    });

    const friendly = state.players.find((p) => p.id === playerId);
    const friendlyTeamId = friendly?.teamId ?? -1;

    // Check if next active player (or any enemy) can capture pCoord immediately
    const oppPlayerId = nextState.activePlayerId;
    const oppPlayer = nextState.players.find((p) => p.id === oppPlayerId);
    if (oppPlayer && oppPlayer.teamId !== friendlyTeamId) {
      const oppLegalMoves = getLegalMoves(nextState, oppPlayerId, "NONE");
      for (const oppCoord of oppLegalMoves) {
        const raycasts = collectAllRaycasts(
          nextState.board,
          nextState.size,
          oppCoord,
          oppPlayer.teamId,
          "NONE",
        );
        for (const r of raycasts) {
          if (
            r.capturedCoords.some((c) => c.x === pCoord.x && c.y === pCoord.y)
          ) {
            return true;
          }
        }
      }
    }
  } catch {
    return true;
  }
  return false;
}

/**
 * Static board evaluation function for Minimax leaf states.
 * Combines:
 * - Corner stability projection (+120 / -120)
 * - Positional weight sum
 * - Piece differential ((AI - Opponent) * 2)
 * - Mobility differential ((aiMobility - oppMobility) * 6)
 * - Special skill inventory valuation
 */
export function evaluateBoardState(
  state: GameState | MaskedGameState,
  aiPlayerId: number,
  aiTeamId: number,
): number {
  if (state.isGameOver) {
    if (state.winnerTeamId === aiTeamId) return 10000;
    if (state.winnerTeamId === null) return 0;
    return -10000;
  }

  const board = state.board;
  const size = state.size;
  const last = size - 1;

  let score = 0;
  let aiPieceCount = 0;
  let oppPieceCount = 0;

  // 1. Corner Stability
  const corners: Coord[] = [
    { x: 0, y: 0 },
    { x: last, y: 0 },
    { x: 0, y: last },
    { x: last, y: last },
  ];

  for (const corner of corners) {
    const p = board[corner.y]?.[corner.x];
    if (p) {
      if (p.teamId === aiTeamId) {
        score += 120;
      } else if (p.teamId !== 0) {
        score -= 120;
      }
    }
  }

  // 2. Positional Matrix & Piece Count
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const piece = board[y]?.[x];
      if (!piece) continue;

      if (piece.teamId === aiTeamId) {
        aiPieceCount++;
        score += getPositionalWeight({ x, y }, board, size);
      } else if (piece.teamId !== 0) {
        oppPieceCount++;
        score -= getPositionalWeight({ x, y }, board, size);
      }
    }
  }

  // 3. Piece count differential
  score += (aiPieceCount - oppPieceCount) * 2;

  // 4. Mobility differential
  const aiMobility = getLegalMoves(state, aiPlayerId, "NONE").length;
  const oppPlayer = state.players.find((p) => p.teamId !== aiTeamId);
  const oppMobility = oppPlayer
    ? getLegalMoves(state, oppPlayer.id, "NONE").length
    : 0;
  score += (aiMobility - oppMobility) * 6;

  // 5. Special Skill Inventory
  const aiPlayer = state.players.find((p) => p.id === aiPlayerId);
  if (aiPlayer) {
    const getCount = (sk: Exclude<SkillType, "NONE">) => {
      const val = aiPlayer.hand[sk];
      return Number.isFinite(val) ? val : SKILL_SPECS[sk].maxHand;
    };
    const specialsCount =
      getCount("WALL") +
      getCount("PIERCE") +
      getCount("BOMB") +
      getCount("PURIFY") +
      getCount("COUNTER");
    score += specialsCount * 8;
  }

  return score;
}

/**
 * Minimax recursive depth search with Alpha-Beta pruning.
 */
function minimaxSearch(
  state: MaskedGameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiPlayerId: number,
  aiTeamId: number,
): number {
  if (depth <= 0 || state.isGameOver) {
    return evaluateBoardState(state, aiPlayerId, aiTeamId);
  }

  const activePlayerId = state.activePlayerId;
  const activePlayer = state.players.find((p) => p.id === activePlayerId);
  if (!activePlayer) {
    return evaluateBoardState(state, aiPlayerId, aiTeamId);
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    const candidateSkills: SkillType[] = activePlayer.isForcedSpecial
      ? ALL_SPECIAL_SKILLS.filter((sk) => activePlayer.hand[sk] > 0)
      : ["NONE"];
    if (candidateSkills.length === 0) candidateSkills.push("NONE");

    const moves: Action[] = [];
    for (const sk of candidateSkills) {
      const coords = getLegalMoves(state, activePlayerId, sk);
      for (const coord of coords) {
        moves.push({
          type: "PLACE_PIECE",
          playerId: activePlayerId,
          coord,
          skillType: sk,
        });
      }
    }

    if (moves.length === 0) {
      try {
        const { nextState } = dispatch(state, {
          type: "PASS_TURN",
          playerId: activePlayerId,
        });
        return minimaxSearch(
          nextState,
          depth - 1,
          alpha,
          beta,
          false,
          aiPlayerId,
          aiTeamId,
        );
      } catch {
        return evaluateBoardState(state, aiPlayerId, aiTeamId);
      }
    }

    // Limit moves to top 8 candidate moves
    const evaluatedMoves = moves.slice(0, 8);
    let curAlpha = alpha;
    for (const move of evaluatedMoves) {
      try {
        const { nextState } = dispatch(state, move);
        const nextIsMax = nextState.activePlayerId === aiPlayerId;
        const ev = minimaxSearch(
          nextState,
          depth - 1,
          curAlpha,
          beta,
          nextIsMax,
          aiPlayerId,
          aiTeamId,
        );
        maxEval = Math.max(maxEval, ev);
        curAlpha = Math.max(curAlpha, ev);
        if (beta <= curAlpha) {
          break; // Beta cut-off
        }
      } catch {
        continue;
      }
    }
    return maxEval === -Infinity
      ? evaluateBoardState(state, aiPlayerId, aiTeamId)
      : maxEval;
  } else {
    // Minimizing node (Opponent's turn)
    let minEval = Infinity;
    const legalCoords = getLegalMoves(state, activePlayerId, "NONE");

    // Order opponent moves by 1-ply heuristic (corners and edges first)
    legalCoords.sort((a, b) => {
      const pwA = getPositionalWeight(a, state.board, state.size);
      const pwB = getPositionalWeight(b, state.board, state.size);
      return pwB - pwA;
    });

    const oppMoves: Action[] = legalCoords.map((coord) => ({
      type: "PLACE_PIECE",
      playerId: activePlayerId,
      coord,
      skillType: "NONE",
    }));

    if (oppMoves.length === 0) {
      try {
        const { nextState } = dispatch(state, {
          type: "PASS_TURN",
          playerId: activePlayerId,
        });
        return minimaxSearch(
          nextState,
          depth - 1,
          alpha,
          beta,
          true,
          aiPlayerId,
          aiTeamId,
        );
      } catch {
        return evaluateBoardState(state, aiPlayerId, aiTeamId);
      }
    }

    // Restrict opponent branch expansion to top 8 moves
    const evaluatedOppMoves = oppMoves.slice(0, 8);
    let curBeta = beta;
    for (const move of evaluatedOppMoves) {
      try {
        const { nextState } = dispatch(state, move);
        const nextIsMax = nextState.activePlayerId === aiPlayerId;
        const ev = minimaxSearch(
          nextState,
          depth - 1,
          alpha,
          curBeta,
          nextIsMax,
          aiPlayerId,
          aiTeamId,
        );
        minEval = Math.min(minEval, ev);
        curBeta = Math.min(curBeta, ev);
        if (curBeta <= alpha) {
          break; // Alpha cut-off
        }
      } catch {
        continue;
      }
    }
    return minEval === Infinity
      ? evaluateBoardState(state, aiPlayerId, aiTeamId)
      : minEval;
  }
}

/**
 * 2-ply Minimax depth search with Alpha-Beta pruning and trap risk modeling.
 * Evaluates candidate moves under sanitized perspective within <350ms performance budget.
 */
export function selectBestMoveMinimax(
  state: GameState,
  playerId: number,
  depth = 2,
): Action {
  if (state.isGameOver) {
    return { type: "PASS_TURN", playerId };
  }

  const sanitized = sanitizeForViewer(state, playerId);
  const player = sanitized.players.find((p) => p.id === playerId);
  if (!player) {
    return { type: "PASS_TURN", playerId };
  }

  const aiTeamId = player.teamId;
  const isCounterReady = isOpponentCounterReady(state, aiTeamId);

  // 1. Determine candidate skills to evaluate
  let candidateSkills: SkillType[];
  if (player.isForcedSpecial) {
    candidateSkills = ALL_SPECIAL_SKILLS.filter((sk) => player.hand[sk] > 0);
    if (candidateSkills.length === 0) candidateSkills = ["WALL"];
  } else {
    candidateSkills = ["NONE"];
    // Restrict branch expansion to top candidate skills
    for (const sk of ALL_SPECIAL_SKILLS) {
      if (player.hand[sk] > 0) {
        candidateSkills.push(sk);
      }
    }
  }

  // 2. Generate standard moves and pre-evaluate with 1-ply heuristic
  interface ScoredCandidate {
    action: Action;
    heuristic1Ply: number;
    riskPenalty: number;
  }
  const scoredCandidates: ScoredCandidate[] = [];

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

      let hScore = captureCount * 10 + posWeight * 1.5;

      // Skill bonuses
      if (skill !== "NONE") {
        const spec = SKILL_SPECS[skill];
        const handCount = player.hand[skill];
        const isSaturated = handCount >= spec.maxHand;
        const isAboutToCharge = player.charge[skill] >= spec.cd - 1;

        if (isSaturated) hScore += 15;
        else if (isAboutToCharge) hScore += 8;
        hScore += 12;

        if (skill === "WALL") {
          if (posWeight >= 100) hScore += 50;
          else if (isEdgeCoord(sanitized.size, coord)) hScore += 35;
          if (isChokePoint(sanitized.board, sanitized.size, coord))
            hScore += 30;
          if (captureCount >= 2) hScore += 15;
        } else if (skill === "PIERCE") {
          const penetratesWall = raycasts.some(
            (r) => r.penetratedWallCoords.length > 0,
          );
          if (penetratesWall) hScore += 65;
          if (captureCount >= 4) hScore += 35;
          else if (captureCount >= 2) hScore += 20;
          else if (captureCount >= 1) hScore += 10;
        } else if (skill === "BOMB") {
          const cluster = countEnemyOrNeutralIn3x3(
            sanitized.board,
            sanitized.size,
            coord,
            player.teamId,
          );
          if (cluster >= 4) hScore += 45;
          else if (cluster >= 2) hScore += 30;
          else if (cluster >= 1) hScore += 20;
          if (posWeight < 0) hScore += 45;
        } else if (skill === "COUNTER") {
          if (posWeight < 0) hScore += 55;
          else if (isEdgeCoord(sanitized.size, coord)) hScore += 35;
          if (captureCount >= 2) hScore += 20;
        } else {
          // PURIFY
          const cluster = countEnemyOrNeutralIn3x3(
            sanitized.board,
            sanitized.size,
            coord,
            player.teamId,
          );
          if (cluster >= 4) hScore += 50;
          else if (cluster >= 2) hScore += 35;
          else if (cluster >= 1) hScore += 25;
        }

        if (!player.isForcedSpecial && !isSaturated && handCount <= 1) {
          hScore -= 14;
        }
      }

      const risk = calculateRiskScore(
        sanitized.board,
        sanitized.size,
        coord,
        player.teamId,
        skill,
        isCounterReady,
      );

      scoredCandidates.push({
        action: {
          type: "PLACE_PIECE",
          playerId,
          coord,
          skillType: skill,
        },
        heuristic1Ply: hScore - risk,
        riskPenalty: risk,
      });
    }
  }

  // 3. Minimax 2-ply search over top candidate standard moves
  if (scoredCandidates.length > 0) {
    // Sort descending by 1-ply heuristic for optimal Alpha-Beta cutoffs
    scoredCandidates.sort((a, b) => b.heuristic1Ply - a.heuristic1Ply);

    // Bounded beam search: top 16 moves strictly enforces latency <350ms
    const candidatesToSearch = scoredCandidates.slice(0, 16);
    const minimaxDecisions: AIMoveDecision[] = [];

    let alpha = -Infinity;
    const beta = Infinity;

    for (const candidate of candidatesToSearch) {
      try {
        const { nextState } = dispatch(sanitized, candidate.action);
        let score: number;

        if (nextState.isGameOver) {
          score =
            nextState.winnerTeamId === aiTeamId
              ? 10000
              : nextState.winnerTeamId === null
                ? 0
                : -10000;
        } else {
          const nextIsMax = nextState.activePlayerId === playerId;
          score = minimaxSearch(
            nextState,
            depth - 1,
            alpha,
            beta,
            nextIsMax,
            playerId,
            aiTeamId,
          );
        }

        // Incorporate 1-ply risk penalty into final score
        score -= candidate.riskPenalty;
        alpha = Math.max(alpha, score);
        minimaxDecisions.push({ action: candidate.action, score });
      } catch {
        continue;
      }
    }

    minimaxDecisions.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 1e-6) {
        return b.score - a.score;
      }
      const aCoord = (a.action as { coord: Coord }).coord;
      const bCoord = (b.action as { coord: Coord }).coord;
      if (aCoord.y !== bCoord.y) return aCoord.y - bCoord.y;
      return aCoord.x - bCoord.x;
    });

    for (const decision of minimaxDecisions) {
      try {
        dispatch(state, decision.action);
        return decision.action;
      } catch {
        continue;
      }
    }
  }

  // 4. Pioneer Strategy: Evaluate pioneer moves if no standard moves succeed
  const available = getAvailableMoves(
    sanitized,
    playerId,
    candidateSkills[0] ?? "NONE",
  );

  if (available.pioneerMoves.length > 0) {
    const targets: Coord[] = [];
    for (let y = 0; y < sanitized.size; y++) {
      for (let x = 0; x < sanitized.size; x++) {
        const piece = sanitized.board[y]?.[x];
        if (piece && piece.teamId !== player.teamId) {
          targets.push({ x, y });
        }
      }
    }

    const pioneerDecisions: { action: Action; score: number }[] = [];

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
          if (dist < d) d = dist;
        }
      } else {
        const center = (sanitized.size - 1) / 2;
        d = Math.hypot(pCoord.x - center, pCoord.y - center);
      }

      const posWeight = getPositionalWeight(
        pCoord,
        sanitized.board,
        sanitized.size,
      );
      const baseScore = -d * 50 + posWeight * 0.1;

      // Pioneer safety: check if placement creates an immediate sandwich line for opponent
      const isSuicide = isSuicidePioneerMove(
        sanitized,
        playerId,
        pCoord,
        "NONE",
      );

      for (const skill of candidateSkills) {
        let skillScore = baseScore;
        if (isSuicide) {
          skillScore -= 200; // Penalize suicide bridge
        }

        if (skill !== "NONE") {
          const spec = SKILL_SPECS[skill];
          const handCount = player.hand[skill];
          const isSaturated = handCount >= spec.maxHand;
          const clusterCount = countEnemyOrNeutralIn3x3(
            sanitized.board,
            sanitized.size,
            pCoord,
            player.teamId,
          );

          if (isSaturated) skillScore += 15;
          if (skill === "WALL") {
            if (isEdgeCoord(sanitized.size, pCoord)) skillScore += 30;
            if (isChokePoint(sanitized.board, sanitized.size, pCoord))
              skillScore += 25;
            skillScore += 10;
          } else if (skill === "BOMB") {
            if (clusterCount >= 1) skillScore += 35;
            if (d <= 3) skillScore += 20;
            skillScore += 10;
          } else if (skill === "PURIFY") {
            if (clusterCount >= 1) skillScore += 40;
            skillScore += 10;
          } else if (skill === "COUNTER") {
            if (d <= 3) skillScore += 30;
            if (isEdgeCoord(sanitized.size, pCoord)) skillScore += 20;
            skillScore += 10;
          } else {
            // PIERCE
            skillScore += 10;
          }

          if (!player.isForcedSpecial && !isSaturated && handCount <= 1) {
            skillScore -= 12;
          }
        }

        pioneerDecisions.push({
          action: {
            type: "PLACE_PIECE",
            playerId,
            coord: pCoord,
            skillType: skill,
          },
          score: skillScore,
        });
      }
    }

    pioneerDecisions.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 1e-6) {
        return b.score - a.score;
      }
      const aCoord = (a.action as { coord: Coord }).coord;
      const bCoord = (b.action as { coord: Coord }).coord;
      if (aCoord.y !== bCoord.y) return aCoord.y - bCoord.y;
      return aCoord.x - bCoord.x;
    });

    for (const decision of pioneerDecisions) {
      try {
        dispatch(state, decision.action);
        return decision.action;
      } catch {
        continue;
      }
    }
  }

  // 5. Fallback: Pass turn
  return {
    type: "PASS_TURN",
    playerId,
  };
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
  if (difficulty === "HARD") {
    return selectBestMoveMinimax(state, playerId, 2);
  }

  if (state.isGameOver) {
    return { type: "PASS_TURN", playerId };
  }

  const sanitized = sanitizeForViewer(state, playerId);
  const player = sanitized.players.find((p) => p.id === playerId);
  if (!player) {
    return { type: "PASS_TURN", playerId };
  }

  const isCounterReady = isOpponentCounterReady(state, player.teamId);

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
    // Default to NONE, plus any available skills currently in hand
    candidateSkills = ["NONE"];
    if (player.hand.WALL > 0) candidateSkills.push("WALL");
    if (player.hand.PIERCE > 0) candidateSkills.push("PIERCE");
    if (player.hand.BOMB > 0) candidateSkills.push("BOMB");
    if (player.hand.PURIFY > 0) candidateSkills.push("PURIFY");
    if (player.hand.COUNTER > 0) candidateSkills.push("COUNTER");
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
        score += posWeight * 0.2 + (Math.random() - 0.5) * 4;
      } else {
        // MEDIUM
        score += posWeight;
      }

      // Skill-specific preference heuristics
      if (skill !== "NONE") {
        const spec = SKILL_SPECS[skill];
        const handCount = player.hand[skill];
        const isSaturated = handCount >= spec.maxHand;
        const isAboutToCharge = player.charge[skill] >= spec.cd - 1;

        // Stock burn incentive: when saturated, cooldown generation is completely paused.
        // Deploying the skill frees up the pipeline for continuous charge generation.
        if (isSaturated) {
          score += 15;
        } else if (isAboutToCharge) {
          score += 8;
        }

        // Baseline superpower bonus: special pieces provide tactical advantages over vanilla pieces.
        score += 12;

        if (skill === "WALL") {
          if (posWeight >= 100) {
            // Impregnable corner wall: permanent anchor that cannot be flipped
            score += 50;
          } else if (isEdgeCoord(sanitized.size, coord)) {
            // Cuts off entire flank raycast lines
            score += 35;
          }
          if (isChokePoint(sanitized.board, sanitized.size, coord)) {
            score += 30;
          }
          if (captureCount >= 2) {
            // Protects the captured line from immediate reverse capture
            score += 15;
          }
        } else if (skill === "PIERCE") {
          const penetratesWall = raycasts.some(
            (r) => r.penetratedWallCoords.length > 0,
          );
          if (penetratesWall) {
            // Shatters enemy defensive wall!
            score += 65;
          }
          if (captureCount >= 4) {
            score += 35;
          } else if (captureCount >= 2) {
            score += 20;
          } else if (captureCount >= 1) {
            score += 10;
          }
          const enemyInCluster = countEnemyOrNeutralIn3x3(
            sanitized.board,
            sanitized.size,
            coord,
            player.teamId,
          );
          if (enemyInCluster >= 2) {
            score += 15;
          }
          if (player.isForcedSpecial) {
            score += 15;
          }
        } else if (skill === "BOMB") {
          const clusterCount = countEnemyOrNeutralIn3x3(
            sanitized.board,
            sanitized.size,
            coord,
            player.teamId,
          );
          // 3x3 blast upon opponent recapture: converts surrounding enemy pieces
          if (clusterCount >= 4) {
            score += 45;
          } else if (clusterCount >= 2) {
            score += 30;
          } else if (clusterCount >= 1) {
            score += 20;
          }

          // Bait square trap: enemies love capturing C/X squares or edges
          if (posWeight < 0) {
            score += 45;
          } else if (isEdgeCoord(sanitized.size, coord)) {
            score += 25;
          }

          if (player.isForcedSpecial) {
            score += 15;
          }
        } else if (skill === "COUNTER") {
          // Reversal backlash trap: hijacks entire enemy capture line
          if (posWeight < 0) {
            score += 55;
          } else if (isEdgeCoord(sanitized.size, coord)) {
            score += 35;
          }
          if (captureCount >= 2) {
            score += 20;
          }
          if (player.isForcedSpecial) {
            score += 15;
          }
        } else {
          // PURIFY
          const clusterCount = countEnemyOrNeutralIn3x3(
            sanitized.board,
            sanitized.size,
            coord,
            player.teamId,
          );
          // Immediate 3x3 aura pulse: converts enemy pieces and silently neutralizes traps
          if (clusterCount >= 4) {
            score += 50;
          } else if (clusterCount >= 2) {
            score += 35;
          } else if (clusterCount >= 1) {
            score += 25;
          }

          if (player.isForcedSpecial) {
            score += 15;
          }
        }

        // Soft hand preservation threshold: prevents wasteful skill deployment on empty, non-tactical squares
        // when hand stock is low (1) and cooldown is not yet ready to refill.
        if (!player.isForcedSpecial && !isSaturated && handCount <= 1) {
          score -= 14;
        }
      }

      // Trap Risk & Blunder Avoidance
      if (difficulty !== "EASY") {
        const riskPenalty = calculateRiskScore(
          sanitized.board,
          sanitized.size,
          coord,
          player.teamId,
          skill,
          isCounterReady,
        );
        score -= riskPenalty;
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

    const pioneerDecisions: { action: Action; score: number }[] = [];

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
      const baseScore = -d * 50 + posWeight * 0.1;

      // Pioneer safety: check if placement creates an immediate sandwich line for opponent
      const isSuicide = isSuicidePioneerMove(
        sanitized,
        playerId,
        pCoord,
        "NONE",
      );

      for (const skill of candidateSkills) {
        let skillScore = baseScore;

        if (isSuicide && difficulty !== "EASY") {
          skillScore -= 200; // Penalize suicide bridge
        }

        if (skill !== "NONE") {
          const spec = SKILL_SPECS[skill];
          const handCount = player.hand[skill];
          const isSaturated = handCount >= spec.maxHand;
          const clusterCount = countEnemyOrNeutralIn3x3(
            sanitized.board,
            sanitized.size,
            pCoord,
            player.teamId,
          );

          if (isSaturated) {
            skillScore += 15;
          }

          if (skill === "WALL") {
            if (isEdgeCoord(sanitized.size, pCoord)) skillScore += 30;
            if (isChokePoint(sanitized.board, sanitized.size, pCoord)) {
              skillScore += 25;
            }
            skillScore += 10;
          } else if (skill === "BOMB") {
            if (clusterCount >= 1) skillScore += 35;
            if (d <= 3) skillScore += 20;
            skillScore += 10;
          } else if (skill === "PURIFY") {
            if (clusterCount >= 1) skillScore += 40;
            skillScore += 10;
          } else if (skill === "COUNTER") {
            if (d <= 3) skillScore += 30;
            if (isEdgeCoord(sanitized.size, pCoord)) skillScore += 20;
            skillScore += 10;
          } else {
            // PIERCE
            skillScore += 10;
          }

          if (!player.isForcedSpecial && !isSaturated && handCount <= 1) {
            skillScore -= 12;
          }
        }

        pioneerDecisions.push({
          action: {
            type: "PLACE_PIECE",
            playerId,
            coord: pCoord,
            skillType: skill,
          },
          score: skillScore,
        });
      }
    }

    // Sort pioneer decisions by score descending
    pioneerDecisions.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 1e-6) {
        return b.score - a.score;
      }
      const aCoord = (a.action as { coord: Coord }).coord;
      const bCoord = (b.action as { coord: Coord }).coord;
      if (aCoord.y !== bCoord.y) return aCoord.y - bCoord.y;
      return aCoord.x - bCoord.x;
    });

    for (const decision of pioneerDecisions) {
      try {
        dispatch(state, decision.action);
        return decision.action;
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

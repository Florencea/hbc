import { describe, expect, it } from "vitest";
import {
  calculateRiskScore,
  evaluateBoardState,
  isOpponentCounterReady,
  isSuicidePioneerMove,
  selectBestMove,
  selectBestMoveMinimax,
} from "../ai.ts";
import { createInitialGame, dispatch } from "../pipeline.ts";
import {
  createEmptyBoard,
  makePiece,
  makeTestState,
  setCell,
} from "./helpers.ts";

describe("AI Search & Trap Risk Modeling (src/engine/ai.ts)", () => {
  it("minimax_blocks_opponent_corner_capture: HARD AI looks ahead 2 plies and avoids moves that hand the opponent an immediate corner capture", () => {
    const board = createEmptyBoard(16);

    // Setup near top-left corner (0, 0):
    // (0, 0) is empty corner
    // (1, 0) is empty C-square [Move A]
    // (2, 0) is Team 2 piece
    // (3, 0) is Team 1 piece
    // (4, 0) is Team 2 piece
    // If Team 1 plays at (1, 0):
    // (2, 0) flips to Team 1.
    // Resulting row: (0, 0) empty, (1, 0) Team 1, (2, 0) Team 1, (3, 0) Team 1, (4, 0) Team 2.
    // Next ply: Team 2 can play at (0, 0) and capture (1, 0), (2, 0), (3, 0) into the corner!
    setCell(board, 0, 2, makePiece(2, 2, "NONE"));
    setCell(board, 0, 3, makePiece(1, 1, "NONE"));
    setCell(board, 0, 4, makePiece(2, 2, "NONE"));
    setCell(board, 0, 5, makePiece(1, 1, "NONE"));

    // Setup safe alternative move in interior:
    // (8, 8) is empty [Move B]
    // (7, 8) is Team 2 piece
    // (6, 8) is Team 1 piece
    // Playing at (8, 8) flips (7, 8) and does not compromise any corner.
    setCell(board, 8, 7, makePiece(2, 2, "NONE"));
    setCell(board, 8, 6, makePiece(1, 1, "NONE"));

    const state = makeTestState(board, 1);

    // 2-ply Minimax search
    const action = selectBestMove(state, 1, "HARD");

    expect(action.type).toBe("PLACE_PIECE");
    if (action.type === "PLACE_PIECE") {
      // AI must avoid (1, 0) which hands opponent corner (0, 0)
      expect(action.coord).not.toEqual({ x: 1, y: 0 });
      // AI chooses the safe interior move at (8, 8)
      expect(action.coord).toEqual({ x: 8, y: 8 });
    }
  });

  it("ai_prefers_pierce_when_counter_trap_suspected: when opponent COUNTER is active/likely, HARD AI favors PIERCE on high-value lines", () => {
    const board = createEmptyBoard(16);

    // Setup long capture line of 3 unrevealed enemy pieces:
    // (1, 5) is empty target
    // (2, 5), (3, 5), (4, 5) are unrevealed Team 2 pieces
    // (5, 5) is Team 1 piece
    setCell(board, 5, 2, makePiece(2, 2, "NONE", false));
    setCell(board, 5, 3, makePiece(2, 2, "NONE", false));
    setCell(board, 5, 4, makePiece(2, 2, "NONE", false));
    setCell(board, 5, 5, makePiece(1, 1, "NONE", true));

    const state = makeTestState(board, 1);
    const p1 = state.players.find((p) => p.id === 1);
    const p2 = state.players.find((p) => p.id === 2);
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    if (!p1 || !p2) return;

    // Opponent has COUNTER cooldown charged
    p2.charge.COUNTER = 7;
    // P1 has 1 PIERCE in hand
    p1.hand = {
      NONE: Infinity,
      WALL: 0,
      PIERCE: 1,
      BOMB: 0,
      PURIFY: 0,
      COUNTER: 0,
    };

    // Verify risk score logic directly
    const counterReady = isOpponentCounterReady(state, 1);
    expect(counterReady).toBe(true);

    const riskNone = calculateRiskScore(
      state.board,
      state.size,
      { x: 1, y: 5 },
      1,
      "NONE",
      true,
    );
    const riskPierce = calculateRiskScore(
      state.board,
      state.size,
      { x: 1, y: 5 },
      1,
      "PIERCE",
      true,
    );
    expect(riskNone).toBeGreaterThan(0);
    expect(riskPierce).toBe(0);

    // HARD AI selection
    const action = selectBestMove(state, 1, "HARD");

    expect(action.type).toBe("PLACE_PIECE");
    if (action.type === "PLACE_PIECE") {
      expect(action.coord).toEqual({ x: 1, y: 5 });
      // AI chooses PIERCE to safely bypass potential COUNTER backlash trap
      expect(action.skillType).toBe("PIERCE");
    }
  });

  it("pioneer_avoids_immediate_suicide_bridges: AI avoids pioneer tiles that immediately offer the opponent an advantageous sandwich", () => {
    const board = createEmptyBoard(16);

    // Pioneer scenario: no standard moves for Player 1 anywhere
    // Player 1 piece at (4, 4)
    setCell(board, 4, 4, makePiece(1, 1, "NONE"));

    // Opponent pieces situated so that placing at (6, 6) is within Chebyshev <= 2 of (4, 4),
    // and creates an immediate sandwich line for opponent at (6, 7):
    // (6, 5) is Team 2
    // If Player 1 places pioneer at (6, 6):
    // (6, 5) [Team 2], (6, 6) [Team 1], (6, 7) [empty], (6, 8) [Team 2]
    // Opponent can place at (6, 7) and capture (6, 6)!
    setCell(board, 5, 6, makePiece(2, 2, "NONE"));
    setCell(board, 8, 6, makePiece(2, 2, "NONE"));

    const state = makeTestState(board, 1);

    const suicideCoord = { x: 6, y: 6 };
    const safeCoord = { x: 2, y: 4 };

    const isSuicide = isSuicidePioneerMove(state, 1, suicideCoord, "NONE");
    expect(isSuicide).toBe(true);

    const isSafe = isSuicidePioneerMove(state, 1, safeCoord, "NONE");
    expect(isSafe).toBe(false);

    // Run AI move selection
    const action = selectBestMove(state, 1, "HARD");

    expect(action.type).toBe("PLACE_PIECE");
    if (action.type === "PLACE_PIECE") {
      // AI must avoid the suicide pioneer tile at (6, 6)
      expect(action.coord).not.toEqual(suicideCoord);
      // Verify dispatching does not throw
      expect(() => dispatch(state, action)).not.toThrow();
    }
  });

  it("performance_within_budget: verify a 2-ply Minimax search evaluates 16x16 boards within reasonable time constraints (< 500ms)", () => {
    const { state } = createInitialGame({
      mapPreset: "CROSSROADS",
      boardSize: 16,
    });

    const start = performance.now();
    const action = selectBestMove(state, state.activePlayerId, "HARD");
    const duration = performance.now() - start;

    expect(action.type).toBe("PLACE_PIECE");
    // Must complete within budget (< 500ms, targeting < 350ms)
    expect(duration).toBeLessThan(500);

    // Also verify direct call to selectBestMoveMinimax
    const minimaxAction = selectBestMoveMinimax(state, state.activePlayerId, 2);
    expect(minimaxAction.type).toBe("PLACE_PIECE");
  });

  it("evaluates board state accurately for leaf evaluation", () => {
    const board = createEmptyBoard(16);
    // Corners for Team 1
    setCell(board, 0, 0, makePiece(1, 1, "NONE"));
    // Team 2 piece
    setCell(board, 5, 5, makePiece(2, 2, "NONE"));

    const state = makeTestState(board, 1);
    const scoreP1 = evaluateBoardState(state, 1, 1);
    const scoreP2 = evaluateBoardState(state, 2, 2);

    expect(scoreP1).toBeGreaterThan(scoreP2);
  });
});

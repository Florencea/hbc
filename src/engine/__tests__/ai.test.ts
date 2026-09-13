import { describe, expect, it } from "vitest";
import { getPositionalWeight, selectBestMove } from "../ai.ts";
import { createInitialGame, dispatch } from "../pipeline.ts";
import { sanitizeForViewer } from "../sanitize.ts";
import type { MapPreset } from "../types.ts";
import { createEmptyBoard, makePiece, makeTestState } from "./helpers.ts";

describe("Heuristic AI Engine (src/engine/ai.ts)", () => {
  describe("Positional Weight Matrix", () => {
    it("evaluates corners, stable edges, and C/X squares correctly", () => {
      const board = createEmptyBoard(16);
      const size = 16;

      // Corners: +100
      expect(getPositionalWeight({ x: 0, y: 0 }, board, size)).toBe(100);
      expect(getPositionalWeight({ x: 15, y: 0 }, board, size)).toBe(100);
      expect(getPositionalWeight({ x: 0, y: 15 }, board, size)).toBe(100);
      expect(getPositionalWeight({ x: 15, y: 15 }, board, size)).toBe(100);

      // C-squares and X-squares when corner (0, 0) is empty: -30
      expect(getPositionalWeight({ x: 1, y: 0 }, board, size)).toBe(-30);
      expect(getPositionalWeight({ x: 0, y: 1 }, board, size)).toBe(-30);
      expect(getPositionalWeight({ x: 1, y: 1 }, board, size)).toBe(-30);

      // Stable Edge (far from empty corners): +20
      expect(getPositionalWeight({ x: 5, y: 0 }, board, size)).toBe(20);
      expect(getPositionalWeight({ x: 0, y: 5 }, board, size)).toBe(20);

      // Interior squares: 0
      expect(getPositionalWeight({ x: 5, y: 5 }, board, size)).toBe(0);

      // When corner (0, 0) is occupied, adjacent edge square (1, 0) becomes a stable edge (+20)
      board[0][0] = makePiece(1, 1, "NONE");
      expect(getPositionalWeight({ x: 1, y: 0 }, board, size)).toBe(20);
    });
  });

  describe("Required Specification Tests", () => {
    it("ai_selects_valid_legal_move: AI returns a valid legal move on Crossroads, Archipelago, and Trenches presets", () => {
      const presets: MapPreset[] = ["CROSSROADS", "ARCHIPELAGO", "TRENCHES"];

      for (const mapPreset of presets) {
        const { state } = createInitialGame({ mapPreset, boardSize: 16 });
        const activePlayerId = state.activePlayerId;

        // Test MEDIUM difficulty
        const actionMedium = selectBestMove(state, activePlayerId, "MEDIUM");
        expect(actionMedium.type).toBe("PLACE_PIECE");
        expect(() => dispatch(state, actionMedium)).not.toThrow();

        // Test EASY difficulty
        const actionEasy = selectBestMove(state, activePlayerId, "EASY");
        expect(actionEasy.type).toBe("PLACE_PIECE");
        expect(() => dispatch(state, actionEasy)).not.toThrow();

        // Test HARD difficulty
        const actionHard = selectBestMove(state, activePlayerId, "HARD");
        expect(actionHard.type).toBe("PLACE_PIECE");
        expect(() => dispatch(state, actionHard)).not.toThrow();
      }
    });

    it("ai_handles_forced_special_legally: when isForcedSpecial: true, AI chooses a valid special piece from hand and never outputs NONE", () => {
      const { state } = createInitialGame({
        mapPreset: "CROSSROADS",
        boardSize: 16,
      });
      const activePlayer = state.players.find(
        (p) => p.id === state.activePlayerId,
      );
      expect(activePlayer).toBeDefined();
      if (!activePlayer) return;

      activePlayer.isForcedSpecial = true;
      activePlayer.hand = {
        NONE: Infinity,
        WALL: 1,
        PIERCE: 0,
        BOMB: 0,
        PURIFY: 0,
        COUNTER: 0,
      };

      const action = selectBestMove(state, activePlayer.id, "MEDIUM");

      expect(action.type).toBe("PLACE_PIECE");
      if (action.type === "PLACE_PIECE") {
        expect(action.skillType).not.toBe("NONE");
        expect(action.skillType).toBe("WALL");
        expect(activePlayer.hand[action.skillType ?? "NONE"]).toBeGreaterThan(
          0,
        );
      }

      // Must be a valid dispatch without throwing IllegalMoveError
      const res = dispatch(state, action);
      expect(res.nextState).toBeDefined();
    });

    it("ai_selects_pioneer_bridge_when_no_captures_exist: in an isolated archipelago scenario, AI selects an empty tile within distance <= 2 that bridges toward target territory", () => {
      const board = createEmptyBoard(16);
      // Player 1 isolated at (4, 4)
      board[4][4] = makePiece(1, 1, "NONE");
      // Player 2 far away at (12, 12)
      board[12][12] = makePiece(2, 2, "NONE");

      const state = makeTestState(board, 1);

      const action = selectBestMove(state, 1, "MEDIUM");

      expect(action.type).toBe("PLACE_PIECE");
      if (action.type === "PLACE_PIECE") {
        const { x, y } = action.coord;
        // Distance to friendly piece (4, 4) must be <= 2
        const distFromFriendly = Math.max(Math.abs(x - 4), Math.abs(y - 4));
        expect(distFromFriendly).toBeGreaterThanOrEqual(1);
        expect(distFromFriendly).toBeLessThanOrEqual(2);

        // It must bridge toward target (12, 12), so x > 4 and y > 4
        expect(x).toBeGreaterThanOrEqual(4);
        expect(y).toBeGreaterThanOrEqual(4);
        // The closest pioneer tile to (12, 12) within Chebyshev <= 2 is (6, 6)
        expect(x).toBe(6);
        expect(y).toBe(6);
      }

      // Verify dispatching pioneer move succeeds
      const { nextState, events } = dispatch(state, action);
      expect(nextState.board[6]?.[6]?.teamId).toBe(1);
      const pioneerEvent = events.find((e) => e.type === "PIONEER_PLACED");
      expect(pioneerEvent).toBeDefined();
    });

    it("ai_passes_when_no_moves_possible: returns PASS_TURN when no standard or pioneer moves are available", () => {
      const board = createEmptyBoard(16);
      // Player 2 has pieces, but Player 1 has NO pieces anywhere
      board[7][7] = makePiece(2, 2, "NONE");
      board[8][8] = makePiece(2, 2, "NONE");

      const state = makeTestState(board, 1);

      const action = selectBestMove(state, 1, "MEDIUM");

      expect(action).toEqual({
        type: "PASS_TURN",
        playerId: 1,
      });
    });

    it("ai_operates_on_sanitized_state: verify AI evaluation does not throw when fed with sanitizeForViewer(state, botId)", () => {
      const board = createEmptyBoard(16);
      // Player 1 at (7, 5)
      board[5][7] = makePiece(1, 1, "NONE");
      // Player 2 has unrevealed hidden traps at (6, 7) and (7, 7)
      board[7][6] = makePiece(2, 2, "BOMB", false);
      board[7][7] = makePiece(2, 2, "COUNTER", false);

      const state = makeTestState(board, 1);

      // Verify state before sanitize has secret traps
      expect(state.board[7][6]?.skillType).toBe("BOMB");
      expect(state.board[7][7]?.skillType).toBe("COUNTER");

      // Sanitize for bot (Player 1)
      const sanitized = sanitizeForViewer(state, 1);
      expect(sanitized.board[7][6]?.skillType).toBe("NONE");
      expect(sanitized.board[7][7]?.skillType).toBe("NONE");

      // Bot evaluation on sanitized state must execute without errors
      expect(() => selectBestMove(sanitized, 1, "MEDIUM")).not.toThrow();

      // Bot evaluation directly on raw state must also sanitize internally without leaking
      const action = selectBestMove(state, 1, "HARD");
      expect(action).toBeDefined();
    });

    it("ai_diversifies_skill_selection: does not spam BOMB and prioritizes WALL on high-value corners", () => {
      const board = createEmptyBoard(16);
      // Place pieces so Player 1 can capture into corner (0, 0)
      board[0][2] = makePiece(1, 1, "NONE");
      board[0][1] = makePiece(2, 2, "NONE");

      const state = makeTestState(board, 1);
      const player = state.players.find((p) => p.id === 1);
      expect(player).toBeDefined();
      if (!player) return;

      // Full hand of specials
      player.hand = {
        NONE: Infinity,
        WALL: 1,
        PIERCE: 2,
        BOMB: 2,
        PURIFY: 1,
        COUNTER: 1,
      };

      const action = selectBestMove(state, 1, "MEDIUM");
      expect(action.type).toBe("PLACE_PIECE");
      if (action.type === "PLACE_PIECE") {
        expect(action.coord).toEqual({ x: 0, y: 0 });
        // On a corner, WALL creates an impregnable corner wall and should beat BOMB
        expect(action.skillType).toBe("WALL");
      }
    });

    it("ai_vs_ai_game_simulation: complete multi-turn match without any illegal move errors", () => {
      const presets: MapPreset[] = ["CROSSROADS", "ARCHIPELAGO", "TRENCHES"];
      for (const preset of presets) {
        let { state } = createInitialGame({ mapPreset: preset, boardSize: 16 });
        for (let turn = 0; turn < 40 && !state.isGameOver; turn++) {
          const action = selectBestMove(state, state.activePlayerId, "MEDIUM");
          expect(() => {
            const res = dispatch(state, action);
            state = res.nextState;
          }).not.toThrow();
        }
      }
    });
  });
});

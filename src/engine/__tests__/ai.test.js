import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPositionalWeight, selectBestMove } from "../ai.js";
import { createInitialGame, dispatch } from "../pipeline.js";
import { sanitizeForViewer } from "../sanitize.js";

import {
  createEmptyBoard,
  makePiece,
  makeTestState,
  setCell,
} from "./helpers.js";

describe("Heuristic AI Engine (src/engine/ai.ts)", () => {
  describe("Positional Weight Matrix", () => {
    it("evaluates corners, stable edges, and C/X squares correctly", () => {
      const board = createEmptyBoard(16);
      const size = 16;

      // Corners: +100
      assert.strictEqual(getPositionalWeight({ x: 0, y: 0 }, board, size), 100);
      assert.strictEqual(
        getPositionalWeight({ x: 15, y: 0 }, board, size),
        100,
      );
      assert.strictEqual(
        getPositionalWeight({ x: 0, y: 15 }, board, size),
        100,
      );
      assert.strictEqual(
        getPositionalWeight({ x: 15, y: 15 }, board, size),
        100,
      );

      // C-squares and X-squares when corner (0, 0) is empty: -30
      assert.strictEqual(getPositionalWeight({ x: 1, y: 0 }, board, size), -30);
      assert.strictEqual(getPositionalWeight({ x: 0, y: 1 }, board, size), -30);
      assert.strictEqual(getPositionalWeight({ x: 1, y: 1 }, board, size), -30);

      // Stable Edge (far from empty corners): +20
      assert.strictEqual(getPositionalWeight({ x: 5, y: 0 }, board, size), 20);
      assert.strictEqual(getPositionalWeight({ x: 0, y: 5 }, board, size), 20);

      // Interior squares: 0
      assert.strictEqual(getPositionalWeight({ x: 5, y: 5 }, board, size), 0);

      // When corner (0, 0) is occupied, adjacent edge square (1, 0) becomes a stable edge (+20)
      setCell(board, 0, 0, makePiece(1, 1, "NONE"));
      assert.strictEqual(getPositionalWeight({ x: 1, y: 0 }, board, size), 20);
    });
  });

  describe("Required Specification Tests", () => {
    it("ai_selects_valid_legal_move: AI returns a valid legal move on Crossroads, Archipelago, and Trenches presets", () => {
      const presets = ["CROSSROADS", "ARCHIPELAGO", "TRENCHES"];

      for (const mapPreset of presets) {
        const { state } = createInitialGame({ mapPreset, boardSize: 16 });
        const activePlayerId = state.activePlayerId;

        // Test MEDIUM difficulty
        const actionMedium = selectBestMove(state, activePlayerId, "MEDIUM");
        assert.strictEqual(actionMedium.type, "PLACE_PIECE");
        assert.doesNotThrow(() => dispatch(state, actionMedium));

        // Test EASY difficulty
        const actionEasy = selectBestMove(state, activePlayerId, "EASY");
        assert.strictEqual(actionEasy.type, "PLACE_PIECE");
        assert.doesNotThrow(() => dispatch(state, actionEasy));

        // Test HARD difficulty
        const actionHard = selectBestMove(state, activePlayerId, "HARD");
        assert.strictEqual(actionHard.type, "PLACE_PIECE");
        assert.doesNotThrow(() => dispatch(state, actionHard));
      }
    });

    it("ai_handles_forced_special_status: when player has isForcedSpecial: true, AI selects a special piece from available hand", () => {
      const { state } = createInitialGame({
        mapPreset: "CROSSROADS",
        boardSize: 16,
      });
      const activePlayer = state.players.find(
        (p) => p.id === state.activePlayerId,
      );
      assert.notStrictEqual(activePlayer, undefined);
      if (!activePlayer) return;

      // Force special status
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

      assert.strictEqual(action.type, "PLACE_PIECE");
      const placeAction1 = action.type === "PLACE_PIECE" ? action : null;
      assert.notStrictEqual(placeAction1?.skillType, "NONE");
      assert.strictEqual(placeAction1?.skillType, "WALL");
      assert.ok(activePlayer.hand[placeAction1?.skillType ?? "NONE"] > 0);

      // Must be a valid dispatch without throwing IllegalMoveError
      const res = dispatch(state, action);
      assert.notStrictEqual(res.nextState, undefined);
    });

    it("ai_selects_pioneer_bridge_when_no_captures_exist: in an isolated archipelago scenario, AI selects an empty tile within distance <= 2 that bridges toward target territory", () => {
      const board = createEmptyBoard(16);
      // Player 1 isolated at (4, 4)
      setCell(board, 4, 4, makePiece(1, 1, "NONE"));
      // Player 2 far away at (12, 12)
      setCell(board, 12, 12, makePiece(2, 2, "NONE"));

      const state = makeTestState(board, 1);

      const action = selectBestMove(state, 1, "MEDIUM");

      assert.strictEqual(action.type, "PLACE_PIECE");
      const placeAction2 = action.type === "PLACE_PIECE" ? action : null;
      const x = placeAction2?.coord.x ?? -1;
      const y = placeAction2?.coord.y ?? -1;
      // Distance to friendly piece (4, 4) must be <= 2
      const distFromFriendly = Math.max(Math.abs(x - 4), Math.abs(y - 4));
      assert.ok(distFromFriendly >= 1);
      assert.ok(distFromFriendly <= 2);

      // It must bridge toward target (12, 12), so x > 4 and y > 4
      assert.ok(x >= 4);
      assert.ok(y >= 4);
      // The closest pioneer tile to (12, 12) within Chebyshev <= 2 is (6, 6)
      assert.strictEqual(x, 6);
      assert.strictEqual(y, 6);

      // Verify dispatching pioneer move succeeds
      const { nextState, events } = dispatch(state, action);
      assert.strictEqual(nextState.board[6]?.[6]?.teamId, 1);
      const pioneerEvent = events.find((e) => e.type === "PIONEER_PLACED");
      assert.notStrictEqual(pioneerEvent, undefined);
    });

    it("ai_passes_when_no_moves_possible: returns PASS_TURN when no standard or pioneer moves are available", () => {
      const board = createEmptyBoard(16);
      // Player 2 has pieces, but Player 1 has NO pieces anywhere
      setCell(board, 7, 7, makePiece(2, 2, "NONE"));
      setCell(board, 8, 8, makePiece(2, 2, "NONE"));

      const state = makeTestState(board, 1);

      const action = selectBestMove(state, 1, "MEDIUM");

      assert.deepStrictEqual(action, {
        type: "PASS_TURN",
        playerId: 1,
      });
    });

    it("ai_operates_on_sanitized_state: verify AI evaluation does not throw when fed with sanitizeForViewer(state, botId)", () => {
      const board = createEmptyBoard(16);
      // Player 1 at (7, 5)
      setCell(board, 5, 7, makePiece(1, 1, "NONE"));
      // Player 2 has unrevealed hidden traps at (6, 7) and (7, 7)
      setCell(board, 7, 6, makePiece(2, 2, "BOMB", false));
      setCell(board, 7, 7, makePiece(2, 2, "COUNTER", false));

      const state = makeTestState(board, 1);

      // Verify state before sanitize has secret traps
      assert.strictEqual(state.board[7]?.[6]?.skillType, "BOMB");
      assert.strictEqual(state.board[7]?.[7]?.skillType, "COUNTER");

      // Sanitize for bot (Player 1)
      const sanitized = sanitizeForViewer(state, 1);
      assert.strictEqual(sanitized.board[7]?.[6]?.skillType, "NONE");
      assert.strictEqual(sanitized.board[7]?.[7]?.skillType, "NONE");

      // Bot evaluation on sanitized state must execute without errors
      assert.doesNotThrow(() => selectBestMove(sanitized, 1, "MEDIUM"));

      // Bot evaluation directly on raw state must also sanitize internally without leaking
      const action = selectBestMove(state, 1, "HARD");
      assert.notStrictEqual(action, undefined);
    });

    it("ai_diversifies_skill_selection: does not spam BOMB and prioritizes WALL on high-value corners", () => {
      const board = createEmptyBoard(16);
      // Place pieces so Player 1 can capture into corner (0, 0)
      setCell(board, 0, 2, makePiece(1, 1, "NONE"));
      setCell(board, 0, 1, makePiece(2, 2, "NONE"));

      const state = makeTestState(board, 1);
      const player = state.players.find((p) => p.id === 1);
      assert.notStrictEqual(player, undefined);
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
      assert.strictEqual(action.type, "PLACE_PIECE");
      const placeAction3 = action.type === "PLACE_PIECE" ? action : null;
      assert.deepStrictEqual(placeAction3?.coord, { x: 0, y: 0 });
      // On a corner, WALL creates an impregnable corner wall and should beat BOMB
      assert.strictEqual(placeAction3?.skillType, "WALL");
    });

    it("ai_voluntarily_selects_pierce_to_penetrate_wall: chooses PIERCE over NONE when enemy wall is present", () => {
      const board = createEmptyBoard(16);
      // Attacker Team 1 at (2, 2)
      // (3, 2) is Team 2 WALL; (4, 2) is Team 1 NONE
      setCell(board, 2, 3, makePiece(2, 2, "WALL", true));
      setCell(board, 2, 4, makePiece(1, 1, "NONE"));

      const state = makeTestState(board, 1);
      const player = state.players.find((p) => p.id === 1);
      assert.notStrictEqual(player, undefined);
      if (!player) return;
      player.isForcedSpecial = false;
      player.hand = {
        NONE: Infinity,
        WALL: 0,
        PIERCE: 1,
        BOMB: 0,
        PURIFY: 0,
        COUNTER: 0,
      };

      const action = selectBestMove(state, 1, "MEDIUM");
      assert.strictEqual(action.type, "PLACE_PIECE");
      const placeAction4 = action.type === "PLACE_PIECE" ? action : null;
      assert.deepStrictEqual(placeAction4?.coord, { x: 2, y: 2 });
      assert.strictEqual(placeAction4?.skillType, "PIERCE");
    });

    it("ai_voluntarily_selects_purify_against_dense_clusters: chooses PURIFY over NONE when adjacent to multiple enemies", () => {
      const board = createEmptyBoard(16);
      // Placed piece at (5, 5) PURIFY (Team 1)
      // Flanks (5, 6) [Team 2] against (5, 7) [Team 1]
      setCell(board, 5, 6, makePiece(2, 2, "NONE"));
      setCell(board, 5, 7, makePiece(1, 1, "NONE"));

      // Surrounding cluster in 3x3 of (5, 5):
      setCell(board, 4, 4, makePiece(2, 2, "NONE"));
      setCell(board, 4, 5, makePiece(2, 2, "NONE"));
      setCell(board, 5, 4, makePiece(2, 2, "NONE"));

      const state = makeTestState(board, 1);
      const player = state.players.find((p) => p.id === 1);
      assert.notStrictEqual(player, undefined);
      if (!player) return;
      player.isForcedSpecial = false;
      player.hand = {
        NONE: Infinity,
        WALL: 0,
        PIERCE: 0,
        BOMB: 0,
        PURIFY: 1,
        COUNTER: 0,
      };

      const action = selectBestMove(state, 1, "MEDIUM");
      assert.strictEqual(action.type, "PLACE_PIECE");
      const placeAction5 = action.type === "PLACE_PIECE" ? action : null;
      assert.deepStrictEqual(placeAction5?.coord, { x: 5, y: 5 });
      assert.strictEqual(placeAction5?.skillType, "PURIFY");
    });

    it("ai_voluntarily_selects_counter_on_bait_square: chooses COUNTER on C-square to punish opponent recapture", () => {
      const board = createEmptyBoard(16);
      // Placed piece at (1, 0) [C-square next to empty corner (0, 0)]
      // Flanks (2, 0) [Team 2] against (3, 0) [Team 1]
      setCell(board, 0, 2, makePiece(2, 2, "NONE"));
      setCell(board, 0, 3, makePiece(1, 1, "NONE"));

      const state = makeTestState(board, 1);
      const player = state.players.find((p) => p.id === 1);
      assert.notStrictEqual(player, undefined);
      if (!player) return;
      player.isForcedSpecial = false;
      player.hand = {
        NONE: Infinity,
        WALL: 0,
        PIERCE: 0,
        BOMB: 0,
        PURIFY: 0,
        COUNTER: 1,
      };

      const action = selectBestMove(state, 1, "MEDIUM");
      assert.strictEqual(action.type, "PLACE_PIECE");
      const placeAction6 = action.type === "PLACE_PIECE" ? action : null;
      assert.deepStrictEqual(placeAction6?.coord, { x: 1, y: 0 });
      assert.strictEqual(placeAction6?.skillType, "COUNTER");
    });

    it("ai_vs_ai_actively_deploys_special_skills: voluntary special moves occur frequently throughout match", () => {
      const { state: initState } = createInitialGame({
        mapPreset: "CROSSROADS",
        boardSize: 16,
      });
      let state = initState;
      let voluntarySpecialCount = 0;
      let totalMoves = 0;

      for (let turn = 0; turn < 40 && !state.isGameOver; turn++) {
        const activePlayer = state.players.find(
          (p) => p.id === state.activePlayerId,
        );
        const wasForced = activePlayer?.isForcedSpecial ?? false;
        const action = selectBestMove(state, state.activePlayerId, "MEDIUM");
        if (action.type === "PLACE_PIECE") {
          totalMoves++;
          if (action.skillType && action.skillType !== "NONE" && !wasForced) {
            voluntarySpecialCount++;
          }
        }
        const res = dispatch(state, action);
        state = res.nextState;
      }

      // Verify that the AI actively and voluntarily plays special skills during the match
      assert.ok(totalMoves > 20);
      assert.ok(voluntarySpecialCount > 5);
    });

    it("ai_vs_ai_game_simulation: complete multi-turn match without any illegal move errors", () => {
      const presets = ["CROSSROADS", "ARCHIPELAGO", "TRENCHES"];
      for (const preset of presets) {
        let { state } = createInitialGame({ mapPreset: preset, boardSize: 16 });
        for (let turn = 0; turn < 40 && !state.isGameOver; turn++) {
          const action = selectBestMove(state, state.activePlayerId, "MEDIUM");
          assert.doesNotThrow(() => {
            const res = dispatch(state, action);
            state = res.nextState;
          });
        }
      }
    });
  });
});

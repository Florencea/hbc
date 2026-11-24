import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SPECIAL_SKILL_TYPES } from "../../engine/constants.js";
import { getPieceVisualState } from "../gameUiConstants.js";

describe("getPieceVisualState", () => {
  it("resolves default visual state for neutral, black, and white normal pieces", () => {
    for (const teamId of [0, 1, 2]) {
      const piece = {
        teamId,
        playerId: teamId,
        skillType: "NONE",
        isRevealed: true,
      };
      const visual = getPieceVisualState(piece, {
        isPreviewFlipped: false,
        activePlayerTeamId: 1,
        viewerTeamId: 1,
      });
      assert.deepStrictEqual(visual, {
        displayTeamId: teamId,
        rimState: "default",
        isOwnHidden: false,
        glowSkill: "",
      });
    }
  });

  it("resolves revealed special skills with matching skill glow state", () => {
    for (const skillType of SPECIAL_SKILL_TYPES) {
      const piece = {
        teamId: 1,
        playerId: 1,
        skillType,
        isRevealed: true,
      };
      const visual = getPieceVisualState(piece, {
        isPreviewFlipped: false,
        activePlayerTeamId: 2,
        viewerTeamId: 1,
      });
      assert.deepStrictEqual(visual, {
        displayTeamId: 1,
        rimState: "glow",
        isOwnHidden: false,
        glowSkill: skillType,
      });
    }
  });

  it("resolves active PURIFY aura for revealed and own unrevealed pieces", () => {
    const revealedPurify = {
      teamId: 2,
      playerId: 2,
      skillType: "PURIFY",
      isRevealed: true,
      duration: 3,
    };
    const revealedVisual = getPieceVisualState(revealedPurify, {
      isPreviewFlipped: false,
      activePlayerTeamId: 1,
      viewerTeamId: 1,
    });
    assert.strictEqual(revealedVisual.rimState, "purify-active");
    assert.strictEqual(revealedVisual.isOwnHidden, false);

    const ownUnrevealedPurify = {
      ...revealedPurify,
      teamId: 1,
      playerId: 1,
      isRevealed: false,
    };
    const ownVisual = getPieceVisualState(ownUnrevealedPurify, {
      isPreviewFlipped: false,
      activePlayerTeamId: 1,
      viewerTeamId: 1,
    });
    assert.strictEqual(ownVisual.rimState, "purify-active");
    assert.strictEqual(ownVisual.isOwnHidden, true);
  });

  it("distinguishes unrevealed own traps from unrevealed enemy pieces", () => {
    const ownHidden = {
      teamId: 1,
      playerId: 1,
      skillType: "BOMB",
      isRevealed: false,
    };
    const ownVisual = getPieceVisualState(ownHidden, {
      isPreviewFlipped: false,
      activePlayerTeamId: 1,
      viewerTeamId: 1,
    });
    assert.strictEqual(ownVisual.isOwnHidden, true);
    assert.strictEqual(ownVisual.rimState, "default");

    const enemyHidden = {
      teamId: 2,
      playerId: 2,
      skillType: "NONE",
      isRevealed: false,
    };
    const enemyVisual = getPieceVisualState(enemyHidden, {
      isPreviewFlipped: false,
      activePlayerTeamId: 1,
      viewerTeamId: 1,
    });
    assert.strictEqual(enemyVisual.isOwnHidden, false);
    assert.strictEqual(enemyVisual.rimState, "default");
  });

  it("prioritizes preview flipped styling over active PURIFY aura and switches display team", () => {
    const purifyPiece = {
      teamId: 2,
      playerId: 2,
      skillType: "PURIFY",
      isRevealed: true,
      duration: 2,
    };
    const visual = getPieceVisualState(purifyPiece, {
      isPreviewFlipped: true,
      activePlayerTeamId: 1,
      viewerTeamId: 1,
    });
    assert.deepStrictEqual(visual, {
      displayTeamId: 1,
      rimState: "preview-flip",
      isOwnHidden: false,
      glowSkill: "",
    });
  });
});

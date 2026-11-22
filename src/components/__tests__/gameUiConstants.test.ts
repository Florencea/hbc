import { describe, expect, it } from "vitest";
import { SPECIAL_SKILL_TYPES, type Piece } from "../../engine/types.ts";
import { getPieceVisualClass } from "../gameUiConstants.ts";

function assertNoUtilityConflicts(className: string): void {
  const tokens = className.split(/\s+/).filter(Boolean);
  expect(new Set(tokens).size).toBe(tokens.length);

  const bgTokens = tokens.filter((token) => token.startsWith("bg-"));
  const ringWidthTokens = tokens.filter((token) => /^ring-\d+$/.test(token));
  const ringColorTokens = tokens.filter((token) =>
    /^ring-(?!\d+$|inset$)/.test(token),
  );
  const shadowSizeTokens = tokens.filter((token) =>
    /^shadow-(?:2xs|xs|sm|md|lg|xl|2xl|none|\[)/.test(token),
  );

  expect(bgTokens.length).toBeLessThanOrEqual(1);
  expect(ringWidthTokens.length).toBeLessThanOrEqual(1);
  expect(ringColorTokens.length).toBeLessThanOrEqual(1);
  expect(shadowSizeTokens.length).toBeLessThanOrEqual(1);
}

describe("getPieceVisualClass", () => {
  it("renders normal pieces without utility conflicts for neutral, black, and white teams", () => {
    for (const teamId of [0, 1, 2] as const) {
      const piece: Piece = {
        teamId,
        playerId: teamId,
        skillType: "NONE",
        isRevealed: true,
      };
      const cls = getPieceVisualClass(piece, {
        isPreviewFlipped: false,
        activePlayerTeamId: 1,
        viewerTeamId: 1,
      });
      assertNoUtilityConflicts(cls);
      expect(cls).toContain("ring-1");
    }
  });

  it("renders all revealed special skills without duplicate ring or shadow classes", () => {
    for (const skillType of SPECIAL_SKILL_TYPES) {
      const piece: Piece = {
        teamId: 1,
        playerId: 1,
        skillType,
        isRevealed: true,
      };
      const cls = getPieceVisualClass(piece, {
        isPreviewFlipped: false,
        activePlayerTeamId: 2,
        viewerTeamId: 1,
      });
      assertNoUtilityConflicts(cls);
      expect(cls).toContain("ring-1");
    }
  });

  it("renders PURIFY pieces with active duration using the amber aura without conflicts", () => {
    const revealedPurify: Piece = {
      teamId: 2,
      playerId: 2,
      skillType: "PURIFY",
      isRevealed: true,
      duration: 3,
    };
    const revealedCls = getPieceVisualClass(revealedPurify, {
      isPreviewFlipped: false,
      activePlayerTeamId: 1,
      viewerTeamId: 1,
    });
    assertNoUtilityConflicts(revealedCls);
    expect(revealedCls).toContain("ring-amber-400/80");
    expect(revealedCls).toContain("shadow-xs");
    expect(revealedCls).not.toContain("border-dashed");

    const ownUnrevealedPurify: Piece = {
      ...revealedPurify,
      teamId: 1,
      playerId: 1,
      isRevealed: false,
    };
    const ownCls = getPieceVisualClass(ownUnrevealedPurify, {
      isPreviewFlipped: false,
      activePlayerTeamId: 1,
      viewerTeamId: 1,
    });
    assertNoUtilityConflicts(ownCls);
    expect(ownCls).toContain("border-dashed");
    expect(ownCls).toContain("ring-amber-400/80");
  });

  it("distinguishes unrevealed own traps from unrevealed enemy pieces while preserving team shadow", () => {
    const ownHidden: Piece = {
      teamId: 1,
      playerId: 1,
      skillType: "BOMB",
      isRevealed: false,
    };
    const ownCls = getPieceVisualClass(ownHidden, {
      isPreviewFlipped: false,
      activePlayerTeamId: 1,
      viewerTeamId: 1,
    });
    assertNoUtilityConflicts(ownCls);
    expect(ownCls).toContain("border-dashed");
    expect(ownCls).toContain("ring-slate-400/50");
    expect(ownCls).toContain(
      "shadow-[inset_0_1px_2px_rgba(255,255,255,0.45),0_3px_6px_rgba(0,0,0,0.9)]",
    );

    const enemyHidden: Piece = {
      teamId: 2,
      playerId: 2,
      skillType: "NONE",
      isRevealed: false,
    };
    const enemyCls = getPieceVisualClass(enemyHidden, {
      isPreviewFlipped: false,
      activePlayerTeamId: 1,
      viewerTeamId: 1,
    });
    assertNoUtilityConflicts(enemyCls);
    expect(enemyCls).not.toContain("border-dashed");
    expect(enemyCls).toContain("ring-zinc-300/80");
  });

  it("prioritizes preview flipped styling over active PURIFY aura and uses active team surface", () => {
    const purifyPiece: Piece = {
      teamId: 2,
      playerId: 2,
      skillType: "PURIFY",
      isRevealed: true,
      duration: 2,
    };
    const cls = getPieceVisualClass(purifyPiece, {
      isPreviewFlipped: true,
      activePlayerTeamId: 1,
      viewerTeamId: 1,
    });
    assertNoUtilityConflicts(cls);
    expect(cls).toContain("scale-95");
    expect(cls).toContain("shadow-md");
    expect(cls).toContain("ring-2");
    expect(cls).toContain("ring-amber-300");
    expect(cls).toContain("border-zinc-400/90");
    expect(cls).not.toContain("ring-amber-400/80");
  });
});

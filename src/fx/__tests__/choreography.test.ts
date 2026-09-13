import { describe, expect, it, vi } from "vitest";
import type { GameEvent } from "../../engine/types.ts";
import { playEvents, type EventHandlers } from "../choreography.ts";

describe("event choreography", () => {
  it("plays events in chronological order with correct handler invocations", async () => {
    const callLog: string[] = [];
    const delays: number[] = [];

    const handlers: EventHandlers = {
      onPiecePlaced: (coord, piece) => {
        callLog.push(
          `place:${coord.x.toString()},${coord.y.toString()}:${piece.skillType}`,
        );
      },
      onPioneerPlaced: (coord) => {
        callLog.push(`pioneer:${coord.x.toString()},${coord.y.toString()}`);
      },
      onRaycastBlocked: (wallCoord) => {
        callLog.push(
          `blocked:${wallCoord.x.toString()},${wallCoord.y.toString()}`,
        );
      },
      onPieceFlip: (coord, toTeamId) => {
        callLog.push(
          `flip:${coord.x.toString()},${coord.y.toString()}:${toTeamId.toString()}`,
        );
      },
      onCounterTriggered: (center, reversedCoords, defenderTeamId) => {
        callLog.push(
          `counter:${center.x.toString()},${center.y.toString()}:reversed=${reversedCoords.length.toString()}:team=${defenderTeamId.toString()}`,
        );
      },
      onBombTriggered: (center, blastCoords, teamId) => {
        callLog.push(
          `bomb:${center.x.toString()},${center.y.toString()}:blast=${blastCoords.length.toString()}:team=${teamId.toString()}`,
        );
      },
      onPurifyPulse: (center, affectedCoords, teamId) => {
        callLog.push(
          `purify:${center.x.toString()},${center.y.toString()}:affected=${affectedCoords.length.toString()}:team=${teamId.toString()}`,
        );
      },
      onPieceRevealed: (coord, skillType, reason) => {
        callLog.push(
          `reveal:${coord.x.toString()},${coord.y.toString()}:${skillType}:${reason}`,
        );
      },
      onAddFloatingText: (text, coord, variant) => {
        callLog.push(
          `text:${text}:${coord.x.toString()},${coord.y.toString()}:${variant}`,
        );
      },
      onTriggerScreenShake: (durationMs) => {
        callLog.push(`shake:${(durationMs ?? 0).toString()}`);
      },
      onTriggerScreenFlash: (color, durationMs) => {
        callLog.push(`flash:${color}:${(durationMs ?? 0).toString()}`);
      },
      delayFn: (ms: number) => {
        delays.push(ms);
        return Promise.resolve();
      },
    };

    const testEvents: GameEvent[] = [
      {
        type: "PIECE_PLACED",
        coord: { x: 5, y: 5 },
        piece: {
          teamId: 1,
          playerId: 1,
          skillType: "NONE",
          isRevealed: true,
        },
      },
      {
        type: "RAYCAST_BLOCKED",
        coord: { x: 5, y: 7 },
        wallPos: { x: 5, y: 7 },
        blockerPiece: {
          teamId: 2,
          playerId: 2,
          skillType: "WALL",
          isRevealed: true,
        },
        direction: { x: 0, y: 1 },
      },
      {
        type: "PIECE_REVEALED",
        coord: { x: 5, y: 7 },
        skillType: "WALL",
        reason: "BLOCK",
      },
      {
        type: "FLIP_BATCH",
        coords: [
          { x: 5, y: 6 },
          { x: 6, y: 6 },
        ],
        fromTeamIds: [2, 2],
        toTeamId: 1,
      },
      {
        type: "COUNTER_TRIGGERED",
        coord: { x: 6, y: 6 },
        defenderTeamId: 2,
        reversedCoords: [{ x: 5, y: 6 }],
      },
      {
        type: "BOMB_TRIGGERED",
        coord: { x: 4, y: 4 },
        teamId: 1,
        blastCoords: [
          { x: 3, y: 3 },
          { x: 3, y: 4 },
        ],
      },
      {
        type: "PURIFY_PULSE",
        coord: { x: 7, y: 7 },
        teamId: 1,
        affectedCoords: [{ x: 7, y: 8 }],
        remainingDuration: 2,
      },
      {
        type: "PIONEER_PLACED",
        coord: { x: 10, y: 10 },
        playerId: 1,
        piece: {
          teamId: 1,
          playerId: 1,
          skillType: "NONE",
          isRevealed: true,
        },
      },
    ];

    await playEvents(testEvents, handlers);

    expect(callLog).toEqual([
      "place:5,5:NONE",
      "blocked:5,7",
      "text:BLOCKED!:5,7:blocked",
      "reveal:5,7:WALL:BLOCK",
      "flip:5,6:1",
      "flip:6,6:1",
      "flash:purple:250",
      "counter:6,6:reversed=1:team=2",
      "text:ABYSS COUNTER!:6,6:counter",
      "shake:200",
      "bomb:4,4:blast=2:team=1",
      "text:CHAIN BOMB!:4,4:bomb",
      "purify:7,7:affected=1:team=1",
      "text:PURIFIED:7,7:purify",
      "pioneer:10,10",
    ]);

    // Check delays
    expect(delays).toEqual([
      100, // PIECE_PLACED
      250, // RAYCAST_BLOCKED
      60, // FLIP_BATCH piece 1
      60, // FLIP_BATCH piece 2
      120, // COUNTER_TRIGGERED hitstop
      150, // COUNTER_TRIGGERED post-counter
      200, // BOMB_TRIGGERED shake/blast
      250, // PURIFY_PULSE aura
      150, // PIONEER_PLACED
    ]);
  });

  it("handles empty event lists gracefully", async () => {
    const delayFn = vi.fn().mockResolvedValue(undefined);
    await playEvents([], { delayFn });
    expect(delayFn).not.toHaveBeenCalled();
  });
});

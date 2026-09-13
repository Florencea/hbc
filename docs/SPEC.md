# HBC Engine Specification

Comprehensive game design and technical specification for **HBC (Headless Battle Chess / Multi-Team Reversi)**.

---

## 1. Game Concept

HBC is a strategic multi-team variant of classic Reversi / Othello played on a 16x16 grid with support for 2-team (1v1, 2v2) and multi-team (1v1v1, 1v1v1v1) formats.

### Core Mechanics

- **Grid Size**: Default 16x16 board (`size = 16`).
- **Initial Setup**: Four center pieces placed in alternating diagonal formation at coordinates `(mid - 1, mid - 1)` to `(mid, mid)`.
- **Turn Order**: Players take turns sequentially in a circular turn order (`(currentTurnIndex + 1) % players.length`).
- **Sandwich Captures**: A placement at coordinate `(x, y)` projects raycasts in 8 directions (horizontal, vertical, diagonal). Pieces of any opposing team sandwiched between the placed piece and a friendly piece along an unbroken line are captured and converted to the active player's team and ownership.
- **Move Legality**: A standard piece placement is legal only if it results in capturing at least one opposing piece (`capturedCoords.length > 0`).

---

## 2. 5-Skill Variant

In addition to standard pieces (`NONE`), players can deploy 5 specialized skill pieces:

| Skill         | Color  | Code | Raycast / Trap Behavior                                                                                                                                                                                       | Consumption & Lifecycle                                                                                                                        |
| :------------ | :----- | :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| **`WALL`**    | Green  | `W`  | **Raycast Blocker**: Intercepts non-piercing raycasts. Opponent cannot flip through or past a WALL.                                                                                                           | Reveals upon blocking. Retains `WALL` skill permanently unless converted/penetrated.                                                           |
| **`PIERCE`**  | Blue   | `P`  | **Penetrator & Trap Immune**: Ignores `WALL` blocking (flips the wall and continues raycast). Immune to `BOMB` blasts, `PURIFY` auras, and `COUNTER` traps.                                                   | Placed hidden; revealed upon penetrating a `WALL` or triggering a trap.                                                                        |
| **`BOMB`**    | Red    | `B`  | **Explosive Detonation**: When flipped by an enemy, triggers a 3x3 blast centered on itself for the original owner's team.                                                                                    | Consumed to `NONE` upon exploding and becomes revealed. Chains recursively into adjacent unexploded `BOMB`s and triggers crossfire `COUNTER`s. |
| **`PURIFY`**  | Yellow | `U`  | **Neutralization Pulse**: Revealed immediately upon placement. Emits a 3x3 pulse at turn end that quietly converts enemy pieces without triggering traps (`BOMB` or `COUNTER` silently neutralize to `NONE`). | 3-turn lifespan (`duration = 3`). Decays by 1 each turn end. Dissolves to `NONE` when duration reaches 0.                                      |
| **`COUNTER`** | Black  | `C`  | **Batch Hijacker Trap**: When flipped by a non-`PIERCE` piece, triggers a counter backlash that reverses the entire active flip line/batch and placed piece to the defender's team.                           | Consumed to `NONE` and revealed upon triggering. If a `WALL` stands in the backlash path, the placed piece is protected from reversal.         |

---

## 3. Information Asymmetry & Fog of War

Hidden information is a fundamental pillar of HBC. Players place special pieces in an unrevealed state (`isRevealed: false`), keeping their skill type secret from opponents.

### Visibility Rules

1. **Revealed Pieces (`isRevealed: true`)**: Visible to all players, regardless of team.
2. **Unrevealed Friendly Pieces**: All members of the same team can see the true skill type of their own and teammates' unrevealed pieces.
3. **Unrevealed Opponent Pieces**: Masked completely to `skillType: "NONE"` from the opponent's perspective.
4. **Player Economy Fog of War**:
   - **Teammates / Allies**: Can inspect real-time hand stocks (`hand`), cooldown charges (`charge`), and forced discharge status (`isForcedSpecial`).
   - **Opponents**: All `hand` numbers, `charge` numbers, and `isForcedSpecial` flags are sanitized to `0` and `false`.

---

## 4. Skill Economy & Cooldowns

Special pieces cannot be placed infinitely. Players operate under an energy charge and inventory economy.

### Cooldown and Hand Cap Specifications

```
Skill Specifications:
- WALL:    CD = 3 turns, Max Hand = 2
- PIERCE:  CD = 2 turns, Max Hand = 3
- BOMB:    CD = 2 turns, Max Hand = 3
- PURIFY:  CD = 4 turns, Max Hand = 2
- COUNTER: CD = 5 turns, Max Hand = 1
```

### Turn-End Upkeep Routine

At the end of every active turn (after piece placement or pass):

1. For each skill in `SKILL_SPECS`:
   - Increment `player.charge[skill]` by 1.
   - If `charge[skill] >= SKILL_SPECS[skill].cd`:
     - If `hand[skill] < SKILL_SPECS[skill].maxHand`:
       - `hand[skill] += 1`
       - `charge[skill] = 0`
       - Emit `SKILL_ACQUIRED` event.
     - Else if `hand[skill] === SKILL_SPECS[skill].maxHand`:
       - Hand is capped!
       - Set `player.isForcedSpecial = true`.
       - Clamp `charge[skill] = SKILL_SPECS[skill].cd`.
       - Emit `FORCED_SPECIAL_TRIGGERED` event.

---

## 5. Forced Discharge Mechanism

To prevent skill hoarding and ensure dynamic high-stakes gameplay:

- **Trigger**: When a player reaches their hand cap for any skill and completes its cooldown cycle again, their energy overflows, activating `isForcedSpecial: true`.
- **Enforcement**: On their next turn, the player **MUST** play a special piece (`action.skillType !== "NONE"`). Attempting to place a standard `NONE` piece throws:
  ```
  "Forced special move required: hand cap reached"
  ```
- **Discharge**: When a valid special skill is played:
  - The skill count is decremented in `player.hand[action.skillType]`.
  - `player.isForcedSpecial` is reset to `false`.
  - At turn end, any completed charges for skills that now have capacity will replenish normally.

---

## 6. Deterministic Event Sourcing

State progression is strictly pure and deterministic:

```ts
dispatch(state: GameState, action: Action): { nextState: GameState; events: GameEvent[] }
```

Events are ordered chronologically for rendering VFX, SFX, and match telemetry:

1. `PIECE_PLACED`
2. `PIECE_REVEALED` (immediate reveal for `PURIFY`)
3. Raycast events: `RAYCAST_BLOCKED`, `PIECE_REVEALED` (for penetrated `PIERCE` / blocking `WALL`)
4. Flip and trap events: `COUNTER_TRIGGERED`, `FLIP_BATCH`, `BOMB_TRIGGERED`
5. Aura decay: `PURIFY_PULSE`
6. Economy events: `SKILL_ACQUIRED`, `FORCED_SPECIAL_TRIGGERED`
7. Drop phase events: `DROP_PHASE_ENDED` (or `DROP_PHASE_STARTED` at match setup)
8. Turn transition: `TURN_CHANGED`
9. Game end: `GAME_OVER`

---

## 7. Map Templates, Neutral Anchors & Drop Phase (Turn 0 Setup)

Phase 3 introduces procedural board templates, neutral capture anchors, and initial player drop zones to support asymmetrical, quadrant-based, and multi-team battlefields.

### Supported Map Presets

1. **`CROSSROADS`**:
   - Clustered center anchors forming a 4x4 cross pattern around the center player anchors.
   - Preserves classic opening moves while guaranteeing neutral anchors adjacent to player drop zones.
2. **`ARCHIPELAGO`**:
   - 4 separate 2x2 neutral islands distributed symmetrically across board quadrants.
   - Player anchors are positioned adjacent to quadrant islands with assigned drop zones covering each island.
3. **`TRENCHES`**:
   - Linear neutral anchor paths intersecting perpendicularly across the center of the board.
   - Player anchors and drop zones are situated at the trench extremities, enabling immediate linear sandwich attacks.

### Neutral Pieces (`teamId: 0`)

- **Capture Target**: Pieces with `teamId: 0` are considered valid enemy capture targets by all teams during raycast checks.
- **Permanent Conversion**: When neutral pieces are flipped via sandwich, counter reversal, bomb blast, or purify pulse, they permanently convert into the capturing player's faction (`teamId` and `playerId`).
- **Sandwich Mechanics**: Neutral pieces cannot close a sandwich; only friendly pieces (`piece.teamId === attackerTeamId`) can close an unbroken line of capture.

### Drop Zones & Drop Phase Progression

- **Player Drop Zones**: Each player is assigned an anchor coordinate `center: Coord` and a drop radius `radius: number` (default 3 cells, evaluated using Chebyshev distance `Math.max(|dx|, |dy|) <= radius`).
- **Playability Guarantee**: Every map preset guarantees that each player's initial drop zone contains their anchor piece and at least one neutral piece, ensuring that the first move is immediately playable.
- **Drop Phase Restriction**: During the Drop Phase (`isDropPhase === true`, initialized with `dropTurnsRemaining = players.length * 2`):
  - Placements must fall within the active player's assigned drop zone.
  - Attempting to place outside this zone throws an `IllegalMoveError`:
    ```
    "Placement outside assigned drop zone during Drop Phase"
    ```
  - `getLegalMoves` automatically filters candidate coordinates to within the player's drop zone.
- **Phase Completion**:
  - Each completed turn (piece placement or pass) decrements `dropTurnsRemaining` by 1.
  - When `dropTurnsRemaining` reaches 0, `isDropPhase` transitions to `false` and emits a `DROP_PHASE_ENDED` event.
  - All subsequent turns allow full-board placement according to standard Reversi rules.

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
- **Move Legality**: A standard piece placement is legal only if it results in capturing at least one opposing piece (`capturedCoords.length > 0`), or if it is an optimistic legal move from the player's perspective under Fog of War that gets blocked by an unrevealed enemy `WALL`. If no standard or optimistic sandwich captures exist on the board, the player transitions to the Pioneer Phase.

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

### 5-Skill Interaction Matrix & Resolution Hierarchy

This section formally defines the resolution outcomes when special skills interact during active placement, raycasting, and chain reaction phases.

#### 1. Interaction Matrix

| Active Source / Triggered By \ Target Piece | WALL (1x1 Pillar)                                          | PIERCE (Singularity)                                               | BOMB (Detonation)                                                        | PURIFY (Domain)                                  | COUNTER (Backlash)                                                               |
| :------------------------------------------ | :--------------------------------------------------------- | :----------------------------------------------------------------- | :----------------------------------------------------------------------- | :----------------------------------------------- | :------------------------------------------------------------------------------- |
| **Standard Raycast**                        | Terminated (`break`). Ray stops; hidden WALL is revealed.  | Treated as standard piece; flipped normally.                       | Flipped normally; triggers 3x3 BOMB detonation.                          | Flipped normally; clears ongoing duration timer. | Flipped normally; triggers COUNTER backlash.                                     |
| **PIERCE (Active Attacker)**                | Penetrates WALL. WALL is flipped; PIERCE is revealed.      | Treated as standard piece; flipped normally.                       | Flipped normally; triggers 3x3 BOMB detonation.                          | Flipped normally; clears ongoing duration timer. | Flipped normally; **COUNTER is bypassed and does NOT trigger**.                  |
| **BOMB (3x3 Detonation)**                   | Destroyed and converted to exploding faction.              | **IMMUNE**. Position and faction remain unchanged; reveals PIERCE. | **CHAINS**. Enqueued into BFS queue; detonates in sequence.              | Destroyed and converted to exploding faction.    | **CROSSFIRE TRIGGER**. Detonation crossfire triggers COUNTER backlash.           |
| **PURIFY (3x3 Turn-End Pulse)**             | Silently converted to Purify's faction.                    | **IMMUNE**. Position and faction remain unchanged; reveals PIERCE. | **SILENT CONVERSION**. Converted to normal piece; **does NOT detonate**. | Replaced/assimilated by active Purify faction.   | **SILENT CONVERSION**. Converted to normal piece; **does NOT trigger backlash**. |
| **COUNTER (Backlash Stream)**               | **BLOCKS BACKLASH**. Ray-like backlash terminates at WALL. | **IMMUNE**. Position and faction remain unchanged; reveals PIERCE. | **ENGULFED / DETONATES**. Caught in backlash; pushed to BFS bomb queue.  | Overwritten by defender faction.                 | **SECONDARY BACKLASH**. If another COUNTER is hit, initiates secondary reversal. |

---

#### 2. Detailed Interaction Semantics

1. **WALL Interception & Line-of-Fire**:
   - `WALL` acts as a 1x1 absolute obstacle to both forward raycasts and backward `COUNTER` backlash lines.
   - Only `PIERCE` can pass through a `WALL` during sandwich verification and execution.
   - `WALL` possesses no area-of-effect defense: it can be overwritten and neutralized by adjacent `BOMB` detonations or `PURIFY` pulses.

2. **PIERCE Immunity Scope**:
   - **Raycast**: Penetrates `WALL` obstacles without being blocked.
   - **Trap Immunity**: Safely flips enemy `COUNTER` pieces without triggering the reverse-engulf effect.
   - **Area Effect Immunity**: Ignores both `BOMB` 3x3 explosive damage and `PURIFY` 3x3 assimilation pulses. PIERCE pieces never change faction due to non-direct sandwich captures.
   - **Reveal Condition**: An unrevealed `PIERCE` piece reveals its true identity to all players whenever its penetration or immunity properties are exercised.

3. **BOMB Chain Detonation & Crossfire**:
   - Detonates in a 3x3 area around its coordinate upon being flipped by a raycast, engulfed by a `COUNTER` backlash, or hit by an adjacent `BOMB` blast.
   - All chain reactions are resolved sequentially using a BFS queue (`Queue<BombEvent>`) to maintain deterministic order and prevent recursion deadlocks.
   - If an unrevealed enemy `COUNTER` is caught within the 3x3 explosion radius, it is triggered via crossfire, initiating backlash outward from its position.
   - Detonated `BOMB` pieces revert to standard pieces (`skillType: 'NONE'`) belonging to the exploding faction.

4. **PURIFY Non-Violent Neutralization**:
   - `PURIFY` pulses once per round at turn end in a 3x3 area for 3 consecutive rounds (`duration: 3`).
   - Assimilating enemy pieces via `PURIFY` does **NOT** count as a flip or sandwich capture.
   - Consequently, enemy `BOMB` and `COUNTER` pieces caught in a `PURIFY` pulse are silently converted into normal pieces of the purifying faction without triggering explosions or backlash.

5. **COUNTER Reversal & Termination**:
   - Triggered when an enemy piece (except `PIERCE`) flips the hidden `COUNTER` piece.
   - Reverses the entire active capture batch, converting the placed enemy piece and all captured intermediate pieces to the defender's faction.
   - If the backlash path contains a friendly or enemy `WALL`, the reversal is stopped at that coordinate.
   - If the backlash path engulfs an unexploded `BOMB`, the bomb detonates and pushes a new explosion event to the resolution pipeline.
   - Once activated, the `COUNTER` piece reverts to a standard piece (`skillType: 'NONE'`).

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

### Anti-Sonar Probing & Client Sanitization

To preserve hidden trap confidentiality and competitive balance:

- **Anti-Sonar Guarantee**: All client-side candidate move computations (`getAvailableMoves`) and hover previews are strictly evaluated against the sanitized state (`displayedState = sanitizeForViewer(state, viewerId)`).
- **Equivalent Move Candidates**: Because all unrevealed opponent pieces are masked to `skillType: "NONE"`, toggling between `NONE` and `PIERCE` produces identical move indicators on unrevealed opponent territory, preventing players from probing hidden `WALL` pieces beforehand.

### Optimistic Blind Moves & Wall Collision Resolution (樂觀盲下碰壁機制)

Under Fog of War, players act based on their perceived battlefield knowledge:

1. **Optimistic Standard Move Validation**: If a move would capture at least one piece under the viewer's sanitized perspective (`isOptimisticStandardMove`), it is accepted by the engine.
2. **Hidden Wall Interception**: When the real engine executes the raycast and hits an unrevealed enemy `WALL`:
   - The placed piece remains on the board (`PIECE_PLACED`).
   - The enemy `WALL` is revealed to all players (`PIECE_REVEALED` with `reason: "BLOCK"`), emitting `RAYCAST_BLOCKED` and triggering shield ripple VFX and `"翡翠城壁 格擋！"` floating combat text.
   - If all projected rays are blocked, `capturedCoords.length === 0`, and no `FLIP_BATCH` event is emitted.
   - The turn ends normally (consuming skill inventory if a special piece was used), and active turn passes to the next player.
3. **Truly Illegal Moves**: Moves that cannot capture any piece even under the player's sanitized perspective (and are not valid Pioneer moves) continue to throw `IllegalMoveError`. Placements into known, already-revealed `WALL` pieces with non-piercing skills are also rejected.

---

## 4. Skill Economy & Cooldowns

Special pieces cannot be placed infinitely. Players operate under an energy charge and inventory economy.

### Cooldown and Hand Cap Specifications

```
Skill Specifications:
- PIERCE:  CD = 3 turns, Max Hand = 2
- BOMB:    CD = 4 turns, Max Hand = 2
- WALL:    CD = 4 turns, Max Hand = 1
- PURIFY:  CD = 5 turns, Max Hand = 1
- COUNTER: CD = 7 turns, Max Hand = 1
```

### Turn-End Upkeep Routine & Cap Freeze Rule

At the end of every active turn (after piece placement):

1. **Cap Freeze & Charge Accumulation**: For each skill in `SKILL_SPECS`:
   - If `hand[skill] >= SKILL_SPECS[skill].maxHand`:
     - Hand capacity is reached. Charge accumulation is frozen! Keep `charge[skill] = 0`.
   - Else (`hand[skill] < SKILL_SPECS[skill].maxHand`):
     - Increment `player.charge[skill]` by 1.
     - If `charge[skill] >= SKILL_SPECS[skill].cd`:
       - `hand[skill] += 1`
       - `charge[skill] = 0`
       - Emit `SKILL_ACQUIRED` event.

2. **Hand Saturation Check**:
   - If all special skills have reached their respective `maxHand` caps (total inventory saturation: 2 + 2 + 1 + 1 + 1 = 7 special pieces):
     - Set `player.isForcedSpecial = true`.
     - Emit `FORCED_SPECIAL_TRIGGERED` event.

---

## 5. Forced Discharge Mechanism

To prevent perpetual skill hoarding while avoiding immediate refill loops:

- **Trigger**: Only triggers `isForcedSpecial: true` when ALL special skills have reached their `maxHand` capacity and cannot receive charges (the special hand inventory is completely saturated).
- **Enforcement**: On their next turn, the player **MUST** play a special piece (`action.skillType !== "NONE"`). Attempting to place a standard `NONE` piece throws:
  ```
  "Forced special move required: hand cap reached"
  ```
- **Discharge & Charge Unfreeze**: When a valid special skill is played:
  - The skill count is decremented in `player.hand[action.skillType]`.
  - `player.isForcedSpecial` is immediately reset to `false`.
  - Decrementing hand capacity below `maxHand` unfreezes the skill, allowing it to resume accumulating charges from 0 on subsequent turns.

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

---

## 8. Pioneer Placement (開拓落子 / Bridge Step)

To solve the "island isolation / gridlock" issue on sparse and sprawling battlefield maps (such as `ARCHIPELAGO` and `TRENCHES`) where players run out of legal sandwich moves before reaching an opponent:

### Trigger Conditions

1. The active player has **0 legal sandwich captures** on the board (`getLegalMoves(state, activePlayerId, skillType).length === 0`).
2. The game is not over (`!state.isGameOver`).
3. Under these conditions, the active player enters the **Pioneer Phase** (`isPioneerActive = true`), allowing them to build territorial bridges across open space instead of being forced to pass.

### Move Legality & Reachability

- **No Capture Required**: A Pioneer placement does not require sandwiching or capturing opposing or neutral pieces.
- **Empty Cell Target**: The target coordinate `(x, y)` must be an empty cell (`board[y][x] === null`).
- **Territorial Proximity**: The target coordinate must be within **Chebyshev distance \(\le 2\)** (`Math.max(|dx|, |dy|) <= 2`) of **any friendly piece** (`piece.teamId === activePlayer.teamId`).
- **Drop Phase Constraints**: If the game is in Drop Phase (`isDropPhase === true`), placements must also be within the player's assigned drop zone (`isWithinDropZone(coord, player.dropZone)`).

### Execution & Event Flow

1. Placing a pioneer piece places the piece on the board and emits:
   - `PIECE_PLACED`
   - `PIONEER_PLACED`: `{ type: "PIONEER_PLACED", coord: Coord, playerId: number, piece: Piece }`
2. If `PURIFY` is played as a pioneer piece:
   - Emits `PIECE_REVEALED` (`reason: "AURA"`).
   - At turn end, emits a 3x3 `PURIFY_PULSE`, converting adjacent opposing pieces.
3. No `FLIP_BATCH` is emitted since no sandwich capture occurred.
4. Normal turn-end upkeep is applied (energy charges, cooldown replenishment, drop turn decrement, turn change).

### Pass Fallback

If a player has 0 standard captures and 0 pioneer moves (e.g. completely surrounded or no friendly pieces), the player must pass their turn (`PASS_TURN`).

---

## 9. Project Status & Future Roadmap

### Current Completed Core

- **Phase 1**: 5-Skill Interaction Matrix & BFS Event Resolution Queue.
- **Phase 2**: Player Hand Economy, Cooldown Ticking, and Cap Freeze Rule.
- **Phase 3**: Map Presets (Crossroads, Archipelago, Trenches) & Drop Phase.
- **Phase 4**: Pioneer Placement (Chebyshev distance <= 2 bridge building).
- **Phase 5**: Anti-Sonar Fog of War, Optimistic Blind Moves, and VFX Choreography.
- **Phase 6**: 1-ply Heuristic Bot & Game Modes (PVP, PVE, AI vs AI).
- **Phase 7**: Minimax Depth Search (Alpha-Beta Pruning) & Fog-of-War Risk Modeling.
- **Phase 8**: Match History & Visual Replay System (HBC-PGN serialization and step playback).

### Future Roadmap Milestones

- **Phase 9 (Active)**: Multi-Team Scaling (1v1v1 Triangle Board & 2v2 Shared Vision Team Mode).
- **Phase 10**: Peer-to-Peer / WebSocket Headless Server Room Synchronization.

---

## 10. Match History, PGN Serialization & Visual Replay System (對局歷史與重播系統)

Phase 8 introduces event stream recording, PGN-style notation serialization, and step-by-step interactive replay controls for post-match analysis.

### 1. HBC-PGN Notation Specification

Similar to Chess PGN, HBC-PGN represents game metadata in tag pairs and actions with algebraic coordinates and event outcome annotations:

- **Algebraic Coordinates**:
  - Columns: `A` through `P` (0 to 15).
  - Rows: `1` through `16` (1-indexed).
  - Examples: `A1` is `(0, 0)`, `H8` is `(7, 7)`, `P16` is `(15, 15)`.
- **Move Tokens**:
  - Piece placement: `P<playerId>:<Coord>[<SkillType>]` (e.g. `P1:H8[NONE]`, `P2:I8[WALL]`).
  - Pass turn: `P<playerId>:PASS`.
- **Event Annotations `{...}`**:
  - `flips:N`: Number of sandwiched opponent pieces captured and flipped.
  - `block:1`: Non-piercing raycast blocked by a hidden enemy `WALL`.
  - `penetrate:1`: Unrevealed `PIERCE` penetrated a `WALL` or trap.
  - `bomb:N(K)`: `N` bomb detonations affecting `K` tiles.
  - `counter:N(K)`: `N` counter backlashes reversing `K` captured tiles.
  - `purify:N(K)`: `N` purify pulses converting `K` tiles without triggering traps.
  - `pioneer:1`: Pioneer placement bridge step across open space.

### 2. Serialization & Deterministic Reconstruction

1. **Structured JSON**: Captures `MatchMetadata`, initial state, and complete `stateSnapshot` per step to enable $O(1)$ instantaneous scrubber jumps. Preserves `Infinity` hand values via dedicated serialization revivers.
2. **Deterministic Replay (`replayMatchActions`)**: Given map preset, board size, and an ordered action sequence, pure state transitions re-execute sequentially through `dispatch(state, action)`, reproducing identical states and event streams.

### 3. Visual Replay Controller (`ReplaySession`)

- **Bidirectional Stepping**: Support for stepping forward, stepping backward, jumping to initial layout (Turn 0), and jumping to match conclusion.
- **Fog of War Perspective in Replay**: Allows analyzing the match from:
  - `上帝視角（全揭示）`: Displays all hidden traps and opponent hands.
  - `黑方視角` / `白方視角`: Renders the board as perceived by that specific player using `sanitizeForViewer`.
- **Interactive Scrubber & Variable Speed Playback**: Direct timeline slider navigation with `0.5x`, `1x`, and `2x` auto-playback speeds.

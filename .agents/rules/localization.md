---
trigger: glob
globs: "src/**"
description: Localization & UI terminology standards in Traditional Chinese (繁體中文).
---

# Localization & UI Terminology Standards (繁體中文規範)

All user-facing UI text, skill descriptions, combat notifications, and telemetry indicators must consistently use Traditional Chinese (繁體中文).

## 1. Skill Name and Color Alignment

| Skill Engine Key | Color Representation | Traditional Chinese Name | Piece Code | Visual Role & Theme             |
| :--------------- | :------------------- | :----------------------- | :--------- | :------------------------------ |
| `NONE`           | Base / None          | 常規棋                   | -          | Standard Reversi Piece          |
| `WALL`           | 綠 (Green)           | **翡翠城壁**             | `壁` / `W` | Raycast Interceptor / Defense   |
| `PIERCE`         | 藍 (Blue)            | **天空守望者**           | `守` / `P` | Penetration / Trap Immune       |
| `BOMB`           | 紅 (Red)             | **殺戮盛宴**             | `宴` / `B` | 3x3 Explosion & Chain Reaction  |
| `PURIFY`         | 黃 (Yellow)          | **救贖之光**             | `光` / `U` | 3x3 Aura Neutralization & Decay |
| `COUNTER`        | 黑 (Black / Abyss)   | **深淵復仇者**           | `仇` / `C` | Reversal Backlash Trap          |

## 2. Combat Floating Text (戰鬥浮動飄字) & VFX Unification

When skills trigger during event choreography, visual combat text and effects must strictly align with the skill identity:

- **翡翠城壁 (`WALL`) 格擋**: `"翡翠城壁 格擋！"` (Badge: Emerald glow, Shield ripple VFX, Block sound)
- **天空守望者 (`PIERCE`) 貫穿 / 免疫**: `"天空守望者 貫穿！"` (Badge: Sky cyan glow, Pierce penetration)
- **殺戮盛宴 (`BOMB`) 引爆**: `"殺戮盛宴 引爆！"` (Badge: Crimson glow, Screen shake, 3x3 blast wave)
- **救贖之光 (`PURIFY`) 淨化**: `"救贖之光 淨化！"` (Badge: Amber glow, 3x3 aura pulse)
- **深淵復仇者 (`COUNTER`) 反擊**: `"深淵復仇者 反擊！"` (Badge: Abyss purple/black glow, Screen flash hitstop)

## 3. Core UI Terminology Glossary

- **Game Title**: `HBC 多陣營黑白棋核心引擎`
- **Subheading**: `五大技能棋、隱藏陷阱與連鎖反應（16x16 無頭引擎）`
- **Game Modes**: `上帝視角（全揭示）` / `戰爭迷霧（玩家視角）`
- **Teams**: `第一隊（蒼藍）` / `第二隊（緋紅）` / `中立錨點`
- **Game Phases**:
  - `初始空降階段 (Drop Phase)`
  - `拓荒階段 (Pioneer Phase)`
  - `全域棋局階段 (Full-Board Phase)`
- **Special Mechanics**:
  - `強制特技施放階段 (Forced Special)`
  - `連鎖結算中... (Resolving Chains...)`
  - `操作鎖定 (Interaction Locked)`
  - `對局遙測資訊 (Match Telemetry)`
  - `事件溯源日誌 (Event Sourcing Stream)`

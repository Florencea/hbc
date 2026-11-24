export const SPECIAL_SKILL_TYPES = Object.freeze([
  "PIERCE",
  "BOMB",
  "WALL",
  "PURIFY",
  "COUNTER",
]);

export const SKILL_SPECS = Object.freeze({
  PIERCE: Object.freeze({ cd: 3, maxHand: 2 }),
  BOMB: Object.freeze({ cd: 4, maxHand: 2 }),
  WALL: Object.freeze({ cd: 4, maxHand: 1 }),
  PURIFY: Object.freeze({ cd: 5, maxHand: 1 }),
  COUNTER: Object.freeze({ cd: 7, maxHand: 1 }),
});

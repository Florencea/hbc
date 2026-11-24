import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAudioMuted,
  playBlockSound,
  playBombSound,
  playCounterSound,
  playFlipSound,
  playPierceSound,
  playPlaceSound,
  playPurifySound,
  playGameOverSound,
  setAudioMuted,
  toggleAudioMuted,
} from "../sound.js";

describe("sound synthesizer", () => {
  it("toggles mute state correctly", () => {
    setAudioMuted(false);
    assert.strictEqual(isAudioMuted(), false);

    const toggled = toggleAudioMuted();
    assert.strictEqual(toggled, true);
    assert.strictEqual(isAudioMuted(), true);

    setAudioMuted(false);
    assert.strictEqual(isAudioMuted(), false);
  });

  it("safely calls all sound generators without throwing in test environment", () => {
    setAudioMuted(false);
    assert.doesNotThrow(() => {
      playPlaceSound();
    });
    assert.doesNotThrow(() => {
      playFlipSound();
    });
    assert.doesNotThrow(() => {
      playPierceSound();
    });
    assert.doesNotThrow(() => {
      playBlockSound();
    });
    assert.doesNotThrow(() => {
      playCounterSound();
    });
    assert.doesNotThrow(() => {
      playBombSound();
    });
    assert.doesNotThrow(() => {
      playPurifySound();
    });
    assert.doesNotThrow(() => {
      playGameOverSound();
    });

    setAudioMuted(true);
    assert.doesNotThrow(() => {
      playPlaceSound();
    });
    setAudioMuted(false);
  });
});

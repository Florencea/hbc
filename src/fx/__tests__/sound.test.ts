import { describe, expect, it } from "vitest";
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
} from "../sound.ts";

describe("sound synthesizer", () => {
  it("toggles mute state correctly", () => {
    setAudioMuted(false);
    expect(isAudioMuted()).toBe(false);

    const toggled = toggleAudioMuted();
    expect(toggled).toBe(true);
    expect(isAudioMuted()).toBe(true);

    setAudioMuted(false);
    expect(isAudioMuted()).toBe(false);
  });

  it("safely calls all sound generators without throwing in test environment", () => {
    setAudioMuted(false);
    expect(() => {
      playPlaceSound();
    }).not.toThrow();
    expect(() => {
      playFlipSound();
    }).not.toThrow();
    expect(() => {
      playPierceSound();
    }).not.toThrow();
    expect(() => {
      playBlockSound();
    }).not.toThrow();
    expect(() => {
      playCounterSound();
    }).not.toThrow();
    expect(() => {
      playBombSound();
    }).not.toThrow();
    expect(() => {
      playPurifySound();
    }).not.toThrow();
    expect(() => {
      playGameOverSound();
    }).not.toThrow();

    setAudioMuted(true);
    expect(() => {
      playPlaceSound();
    }).not.toThrow();
    setAudioMuted(false);
  });
});

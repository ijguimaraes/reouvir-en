import { describe, expect, it } from "vitest";
import { mp3DurationMs } from "./mp3";

// MPEG1 Layer III, 128 kbps, 44,1 kHz, sem padding → quadros de 417 bytes e 1152 amostras
function frames(n: number): Buffer {
  const frame = Buffer.alloc(417);
  frame.set([0xff, 0xfb, 0x90, 0x00]);
  return Buffer.concat(Array.from({ length: n }, () => frame));
}

describe("mp3DurationMs", () => {
  it("soma os quadros", () => expect(mp3DurationMs(frames(100))).toBe(Math.round((100 * 1152) / 44100 * 1000)));
  it("ignora tag ID3v2 no início", () => {
    const id3 = Buffer.concat([Buffer.from("ID3\x03\x00\x00\x00\x00\x00\x0a", "latin1"), Buffer.alloc(10)]);
    expect(mp3DurationMs(Buffer.concat([id3, frames(10)]))).toBe(Math.round((10 * 1152) / 44100 * 1000));
  });
  it("devolve null sem quadros", () => expect(mp3DurationMs(Buffer.from("lixo"))).toBeNull());
});

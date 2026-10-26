const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** Duração de um MP3 (Layer III) somando os quadros. Devolve null se não achar nenhum quadro válido. */
export function mp3DurationMs(buf: Buffer): number | null {
  let pos = 0;
  if (buf.length >= 10 && buf.toString("latin1", 0, 3) === "ID3") {
    const size = ((buf[6]! & 0x7f) << 21) | ((buf[7]! & 0x7f) << 14) | ((buf[8]! & 0x7f) << 7) | (buf[9]! & 0x7f);
    pos = 10 + size;
  }
  let samples = 0;
  let rate = 0;
  while (pos + 4 <= buf.length) {
    if (buf[pos] !== 0xff || (buf[pos + 1]! & 0xe0) !== 0xe0) {
      pos++;
      continue;
    }
    const version = (buf[pos + 1]! >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const layer = (buf[pos + 1]! >> 1) & 3; // 1 = Layer III
    const bitrateIdx = (buf[pos + 2]! >> 4) & 0xf;
    const rateIdx = (buf[pos + 2]! >> 2) & 3;
    const padding = (buf[pos + 2]! >> 1) & 1;
    if (version === 1 || layer !== 1 || bitrateIdx === 0 || bitrateIdx === 15 || rateIdx === 3) {
      pos++;
      continue;
    }
    const v1 = version === 3;
    const bitrate = (v1 ? BITRATES_V1_L3 : BITRATES_V2_L3)[bitrateIdx]! * 1000;
    rate = RATES[version]![rateIdx]!;
    const length = Math.floor(((v1 ? 144 : 72) * bitrate) / rate) + padding;
    samples += v1 ? 1152 : 576;
    pos += length;
  }
  return rate ? Math.round((samples / rate) * 1000) : null;
}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fontWeights = {
  'Cinzel-SemiBold.ttf': 600,
  'Cinzel-Bold.ttf': 700,
  'Inter-Regular.ttf': 400,
  'Inter-Medium.ttf': 500,
  'Inter-SemiBold.ttf': 600,
  'Inter-Bold.ttf': 700,
  'JetBrainsMono-Medium.ttf': 500,
  'JetBrainsMono-SemiBold.ttf': 600,
} as const;

function readTables(font: Buffer) {
  const tableCount = font.readUInt16BE(4);
  return Array.from({ length: tableCount }, (_, index) => {
    const recordOffset = 12 + index * 16;
    return {
      tag: font.toString('ascii', recordOffset, recordOffset + 4),
      offset: font.readUInt32BE(recordOffset + 8),
    };
  });
}

function readWindowsFamilyName(font: Buffer, nameTableOffset: number): string | undefined {
  const recordCount = font.readUInt16BE(nameTableOffset + 2);
  const stringsOffset = nameTableOffset + font.readUInt16BE(nameTableOffset + 4);

  for (let index = 0; index < recordCount; index += 1) {
    const recordOffset = nameTableOffset + 6 + index * 12;
    const isFamilyName = font.readUInt16BE(recordOffset) === 3 && font.readUInt16BE(recordOffset + 6) === 1;
    if (!isFamilyName) continue;

    const length = font.readUInt16BE(recordOffset + 8);
    const offset = stringsOffset + font.readUInt16BE(recordOffset + 10);
    const bigEndian = font.subarray(offset, offset + length);
    const littleEndian = Buffer.from(bigEndian);
    littleEndian.swap16();
    return littleEndian.toString('utf16le');
  }

  return undefined;
}

describe('offline font assets', () => {
  it.each(Object.entries(fontWeights))('%s is a static TTF with weight %d', (fileName, expectedWeight) => {
    const font = readFileSync(join(__dirname, '..', 'assets', 'fonts', fileName));
    const tables = readTables(font);
    const os2 = tables.find(({ tag }) => tag === 'OS/2');
    const name = tables.find(({ tag }) => tag === 'name');

    expect(font.readUInt32BE(0)).toBe(0x00010000);
    expect(tables.map(({ tag }) => tag)).not.toContain('fvar');
    expect(os2).toBeDefined();
    expect(font.readUInt16BE(os2!.offset + 4)).toBe(expectedWeight);
    expect(name).toBeDefined();
    expect(readWindowsFamilyName(font, name!.offset)).toBe(fileName.replace('.ttf', ''));
  });

  it('embeds every font in native builds through the expo-font plugin', () => {
    const config = JSON.parse(readFileSync(join(__dirname, '..', 'app.json'), 'utf8')) as {
      expo: { plugins: (string | [string, { fonts?: string[] }])[] };
    };
    const fontPlugin = config.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-font');

    expect(fontPlugin).toEqual([
      'expo-font',
      { fonts: Object.keys(fontWeights).map((fileName) => `./assets/fonts/${fileName}`) },
    ]);
  });
});

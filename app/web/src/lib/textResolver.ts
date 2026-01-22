type Entry = { title: string; text: string; tags: readonly string[] };

type ContentPack = {
  sign: Record<string, Entry>;
  house: Record<string, Entry>;
  planet: Record<string, Entry>;
  aspect: Record<string, Entry>;
};

export type { Entry, ContentPack };

export function getSignEntry(content: ContentPack, sign: string): Entry | null {
  return content.sign[sign] ?? null;
}

export function getHouseEntry(content: ContentPack, houseNumber: number): Entry | null {
  return content.house[`House ${houseNumber}`] ?? null;
}

export function getPlanetEntry(content: ContentPack, planet: string): Entry | null {
  return content.planet[planet] ?? null;
}

export function getAspectEntry(content: ContentPack, aspect: string): Entry | null {
  return content.aspect[aspect] ?? null;
}
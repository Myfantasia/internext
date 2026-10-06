import data from '../../shared/kenyaCounties.json';

// Same file the server validates against (shared/kenyaCounties.json).
export interface KenyaCounty {
  code: number;
  name: string;
  hq: string;
  lat: number;
  lng: number;
}

export const KENYA_COUNTIES: KenyaCounty[] = [...data.counties].sort((a, b) => a.name.localeCompare(b.name));

export function findCounty(name?: string | null): KenyaCounty | undefined {
  if (!name) return undefined;
  return KENYA_COUNTIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

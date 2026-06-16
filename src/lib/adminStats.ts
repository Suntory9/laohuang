import type { VideoRecord } from '../types';

export type AdminAreaLevel = 'province' | 'prefecture' | 'county';

export interface CountedTag {
  label: string;
  count: number;
}

export interface AdminAreaStats {
  key: string;
  name: string;
  level: AdminAreaLevel;
  videoCount: number;
  caughtCount: number;
  skunkedCount: number;
  shoppingCostCny: number;
  weatherTags: CountedTag[];
  theoryTags: CountedTag[];
  videos: VideoRecord[];
}

const PREFECTURE_ALIASES: Record<string, string> = {
  恩施: '恩施土家族苗族自治州',
  宜昌: '宜昌市',
  荆州: '荆州市',
  长阳: '宜昌市',
};

export function normalizePrefectureName(city: string | null): string {
  if (!city) return '未识别市州';
  return PREFECTURE_ALIASES[city] ?? (city.endsWith('市') || city.endsWith('州') ? city : `${city}市`);
}

export function normalizeCountyName(district: string | null): string {
  return district?.trim() || '未细分地点';
}

export function buildPrefectureStats(videos: VideoRecord[]): AdminAreaStats[] {
  return buildAreaStats(videos, 'prefecture');
}

export function buildCountyStats(videos: VideoRecord[]): AdminAreaStats[] {
  return buildAreaStats(videos, 'county');
}

function buildAreaStats(videos: VideoRecord[], level: AdminAreaLevel): AdminAreaStats[] {
  const areaMap = new Map<string, AdminAreaStats>();

  videos.forEach((video) => {
    const name =
      level === 'county'
        ? normalizeCountyName(video.location.county ?? video.location.district)
        : level === 'prefecture'
          ? normalizePrefectureName(video.location.prefecture ?? video.location.city)
          : video.location.province || '未识别省份';
    const key = `${level}:${name}`;
    const current = areaMap.get(key) ?? {
      key,
      name,
      level,
      videoCount: 0,
      caughtCount: 0,
      skunkedCount: 0,
      shoppingCostCny: 0,
      weatherTags: [],
      theoryTags: [],
      videos: [],
    };

    current.videoCount += 1;
    current.caughtCount += video.fishing.caught === 'yes' ? 1 : 0;
    current.skunkedCount += video.fishing.isSkunked === 'yes' ? 1 : 0;
    current.shoppingCostCny += video.shopping.totalCostCny ?? 0;
    current.videos.push(video);
    areaMap.set(key, current);
  });

  return [...areaMap.values()]
    .map((area) => ({
      ...area,
      weatherTags: countTags(area.videos.flatMap((video) => video.weather.conditionTags)),
      theoryTags: countTags(area.videos.flatMap((video) => video.fishingTheory.tags)),
      videos: [...area.videos].sort((a, b) => a.sequenceIndex - b.sequenceIndex),
    }))
    .sort((a, b) => b.videoCount - a.videoCount || a.name.localeCompare(b.name, 'zh-CN'));
}

function countTags(tags: string[]): CountedTag[] {
  const counts = new Map<string, number>();
  tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'));
}

# ECharts Static Journey Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current AMap/SVG map with a static ECharts湖北旅程地图 that keeps video stories first and adds city/county statistics as supporting context.

**Architecture:** Keep the existing React + Vite shell. Add pure aggregation helpers for administrative-area stats, use ECharts inside `MapPanel`, and add a dedicated `AreaStoryPanel` for region-level story summaries while leaving `DetailPanel` focused on single-video details.

**Tech Stack:** React 19, TypeScript, Vite, ECharts, static JSON assets under `public/`.

---

## Repository Note

`/Users/songdc/laohuang` is not currently a git repository. The plan uses local verification checkpoints instead of commit steps. If this project is later initialized as git, commit after each task using the task title as the commit message.

## File Structure

- Modify: `package.json` and `package-lock.json` to add `echarts`.
- Add: `public/maps/hubei-prefecture.json` for the static湖北市州 GeoJSON.
- Add: `src/lib/adminStats.ts` for area normalization and aggregation.
- Add: `src/lib/echartsMap.ts` for ECharts option construction.
- Replace: `src/components/MapPanel.tsx` with the ECharts implementation.
- Add: `src/components/AreaStoryPanel.tsx` for selected-area summaries and video lists.
- Modify: `src/App.tsx` to track selected area and wire the new components.
- Modify: `src/styles.css` to style the ECharts stage and area story panel.
- Modify: `README.md` to remove AMap runtime setup and document static map assets.

## Task 1: Add ECharts and Static Map Asset

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `public/maps/hubei-prefecture.json`

- [ ] **Step 1: Install ECharts**

Run:

```bash
npm install echarts
```

Expected: `package.json` gains an `echarts` dependency and `package-lock.json` updates.

- [ ] **Step 2: Add 湖北市州 GeoJSON**

Download the湖北省子区域 GeoJSON once and save it into the static asset directory:

```bash
mkdir -p public/maps
curl -L https://geo.datav.aliyun.com/areas_v3/bound/420000_full.json -o public/maps/hubei-prefecture.json
```

Expected: `public/maps/hubei-prefecture.json` is a GeoJSON `FeatureCollection` whose feature names include湖北市州 such as `武汉市`, `宜昌市`, `荆州市`, `恩施土家族苗族自治州`.

- [ ] **Step 3: Verify dependency metadata**

Run:

```bash
npm ls echarts
```

Expected: command exits successfully and prints the installed ECharts version.

## Task 2: Add Administrative Stats Helpers

**Files:**
- Create: `src/lib/adminStats.ts`

- [ ] **Step 1: Create area aggregation types and name helpers**

Add:

```ts
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
```

- [ ] **Step 2: Add aggregation implementation**

Append:

```ts
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
        ? normalizeCountyName(video.location.district)
        : level === 'prefecture'
          ? normalizePrefectureName(video.location.city)
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
```

- [ ] **Step 3: Typecheck helper**

Run:

```bash
npm run typecheck
```

Expected: TypeScript passes or only reports pre-existing unrelated errors.

## Task 3: Add ECharts Option Builder

**Files:**
- Create: `src/lib/echartsMap.ts`

- [ ] **Step 1: Add ECharts option utilities**

Add:

```ts
import type { EChartsOption } from 'echarts';
import type { AdminAreaStats } from './adminStats';
import type { VideoRecord } from '../types';

export const HUBEI_MAP_NAME = 'hubei-prefecture';

export interface JourneyMapOptionInput {
  videos: VideoRecord[];
  areaStats: AdminAreaStats[];
  selectedBvid: string;
  selectedAreaKey: string;
  routePolyline: [number, number][];
}

export function buildJourneyMapOption(input: JourneyMapOptionInput): EChartsOption {
  const maxVideoCount = Math.max(1, ...input.areaStats.map((area) => area.videoCount));
  const areaByName = new Map(input.areaStats.map((area) => [area.name, area]));
  const pointData = input.videos
    .filter((video) => video.location.lng !== null && video.location.lat !== null)
    .map((video) => ({
      name: video.title,
      value: [video.location.lng, video.location.lat, video.sequenceIndex],
      bvid: video.bvid,
      locationLabel: video.location.label,
      isActive: video.bvid === input.selectedBvid,
      caught: video.fishing.caught,
      skunked: video.fishing.isSkunked,
    }));

  const lineData =
    input.routePolyline.length > 1
      ? [{ coords: input.routePolyline, lineStyle: { width: 2 } }]
      : [];

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params) => formatTooltip(params, areaByName),
    },
    visualMap: {
      min: 0,
      max: maxVideoCount,
      show: true,
      calculable: false,
      left: 18,
      bottom: 18,
      itemWidth: 12,
      itemHeight: 80,
      text: ['多', '少'],
      textStyle: { color: '#c8d6a0', fontSize: 11 },
      inRange: { color: ['#182514', '#486454', '#d59500'] },
    },
    geo: {
      map: HUBEI_MAP_NAME,
      roam: true,
      zoom: 1.05,
      label: { show: false },
      itemStyle: {
        areaColor: '#1a2410',
        borderColor: 'rgba(200, 214, 160, 0.28)',
        borderWidth: 1,
      },
      emphasis: {
        label: { show: true, color: '#e8e0cc', fontSize: 12 },
        itemStyle: { areaColor: '#486454' },
      },
      select: {
        label: { show: true, color: '#e8e0cc', fontWeight: 'bold' },
        itemStyle: { areaColor: '#7a9a70', borderColor: '#d59500', borderWidth: 2 },
      },
    },
    series: [
      {
        type: 'map',
        map: HUBEI_MAP_NAME,
        geoIndex: 0,
        selectedMode: 'single',
        data: input.areaStats.map((area) => ({
          name: area.name,
          value: area.videoCount,
          selected: area.key === input.selectedAreaKey,
        })),
      },
      {
        type: 'lines',
        coordinateSystem: 'geo',
        zlevel: 2,
        silent: true,
        polyline: true,
        effect: { show: false },
        lineStyle: { color: 'rgba(213, 149, 0, 0.58)', width: 2, opacity: 0.8 },
        data: lineData,
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        zlevel: 3,
        symbolSize: (value: unknown) => {
          const row = value as [number, number, number];
          return row[2] ? 10 : 8;
        },
        rippleEffect: { scale: 3, brushType: 'stroke' },
        itemStyle: { color: '#d59500', shadowColor: 'rgba(213,149,0,0.35)', shadowBlur: 10 },
        data: pointData,
      },
    ],
  };
}

function formatTooltip(params: unknown, areaByName: Map<string, AdminAreaStats>) {
  const item = params as { componentSubType?: string; name?: string; data?: Record<string, unknown> };
  if (item.componentSubType === 'effectScatter') {
    return `<strong>${item.name ?? ''}</strong><br/>${item.data?.locationLabel ?? ''}`;
  }
  const area = item.name ? areaByName.get(item.name) : null;
  if (!area) return `<strong>${item.name ?? ''}</strong><br/>暂无视频`;
  return `<strong>${area.name}</strong><br/>视频 ${area.videoCount} 期<br/>渔获 ${area.caughtCount} 期 / 空军 ${area.skunkedCount} 期`;
}
```

- [ ] **Step 2: Typecheck option builder**

Run:

```bash
npm run typecheck
```

Expected: no TypeScript errors from `echartsMap.ts`.

## Task 4: Replace MapPanel with ECharts

**Files:**
- Replace: `src/components/MapPanel.tsx`

- [ ] **Step 1: Replace imports and props**

Use these props:

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { ECharts } from 'echarts';
import type { AdminAreaStats } from '../lib/adminStats';
import { HUBEI_MAP_NAME, buildJourneyMapOption } from '../lib/echartsMap';
import type { VideoRecord } from '../types';

interface MapPanelProps {
  videos: VideoRecord[];
  selectedBvid: string;
  selectedAreaKey: string;
  areaStats: AdminAreaStats[];
  onSelectVideo: (bvid: string) => void;
  onSelectArea: (areaKey: string) => void;
  routePolyline: [number, number][];
}
```

- [ ] **Step 2: Implement ECharts lifecycle**

Replace the component body with:

```tsx
export function MapPanel({
  videos,
  selectedBvid,
  selectedAreaKey,
  areaStats,
  onSelectVideo,
  onSelectArea,
  routePolyline,
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const areaKeyByName = useMemo(
    () => new Map(areaStats.map((area) => [area.name, area.key])),
    [areaStats],
  );

  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;
    chartRef.current = echarts.init(containerRef.current, null, { renderer: 'canvas' });

    const handleResize = () => chartRef.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/maps/hubei-prefecture.json')
      .then((response) => {
        if (!response.ok) throw new Error(`地图资源加载失败：${response.status}`);
        return response.json();
      })
      .then((geoJson) => {
        if (cancelled) return;
        echarts.registerMap(HUBEI_MAP_NAME, geoJson);
        setMapReady(true);
      })
      .catch((error: Error) => setMapError(error.message));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !chartRef.current) return;
    chartRef.current.setOption(
      buildJourneyMapOption({ videos, areaStats, selectedBvid, selectedAreaKey, routePolyline }),
      true,
    );
  }, [areaStats, mapReady, routePolyline, selectedAreaKey, selectedBvid, videos]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handleClick = (params: unknown) => {
      const item = params as { componentSubType?: string; name?: string; data?: { bvid?: string } };
      if (item.componentSubType === 'effectScatter' && item.data?.bvid) {
        onSelectVideo(item.data.bvid);
        return;
      }
      if (item.name) {
        const areaKey = areaKeyByName.get(item.name);
        if (areaKey) onSelectArea(areaKey);
      }
    };

    chart.on('click', handleClick);
    return () => {
      chart.off('click', handleClick);
    };
  }, [areaKeyByName, onSelectArea, onSelectVideo]);

  return (
    <section className="map-stage echarts-map-stage">
      <div ref={containerRef} className="echarts-map" aria-label="湖北旅程地图" />
      {mapError ? <div className="map-error">{mapError}</div> : null}
      {!mapError && !mapReady ? <div className="map-loading">正在加载湖北地图...</div> : null}
    </section>
  );
}
```

- [ ] **Step 3: Typecheck MapPanel**

Run:

```bash
npm run typecheck
```

Expected: no `MapPanel` prop or ECharts lifecycle errors.

## Task 5: Add AreaStoryPanel

**Files:**
- Create: `src/components/AreaStoryPanel.tsx`

- [ ] **Step 1: Implement area story component**

Add:

```tsx
import type { AdminAreaStats } from '../lib/adminStats';
import { formatDate } from '../lib/format';

interface AreaStoryPanelProps {
  area: AdminAreaStats | null;
  onSelectVideo: (bvid: string) => void;
  onClear: () => void;
}

export function AreaStoryPanel({ area, onSelectVideo, onClear }: AreaStoryPanelProps) {
  if (!area) return null;

  return (
    <aside className="area-story-panel">
      <button type="button" className="area-story-close" onClick={onClear} aria-label="关闭地点故事">
        &#10005;
      </button>
      <div className="area-story-kicker">地点故事</div>
      <h2>{area.name}</h2>
      <div className="area-story-stats">
        <span>{area.videoCount} 期视频</span>
        <span>{area.caughtCount} 期有渔获</span>
        <span>{area.skunkedCount} 期空军</span>
        <span>¥{area.shoppingCostCny.toFixed(0)} 买菜</span>
      </div>

      {area.weatherTags.length > 0 ? (
        <div className="area-story-tags">
          {area.weatherTags.slice(0, 4).map((tag) => (
            <span key={tag.label}>{tag.label} ×{tag.count}</span>
          ))}
        </div>
      ) : null}

      <div className="area-story-list">
        {area.videos.map((video) => (
          <button key={video.bvid} type="button" onClick={() => onSelectVideo(video.bvid)}>
            <strong>#{String(video.sequenceIndex).padStart(2, '0')} {video.title}</strong>
            <small>{formatDate(video.publishedAt)} · {video.location.label}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck AreaStoryPanel**

Run:

```bash
npm run typecheck
```

Expected: no component typing errors.

## Task 6: Wire App State and Components

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import new helpers and panel**

Add imports:

```ts
import { AreaStoryPanel } from './components/AreaStoryPanel';
import { buildPrefectureStats } from './lib/adminStats';
```

- [ ] **Step 2: Add selected area state**

Inside `App`:

```ts
const [selectedAreaKey, setSelectedAreaKey] = useState<string>('');
```

- [ ] **Step 3: Build area stats**

After `filteredVideos`:

```ts
const areaStats = useMemo(() => buildPrefectureStats(filteredVideos), [filteredVideos]);
const selectedArea = areaStats.find((area) => area.key === selectedAreaKey) ?? null;
```

- [ ] **Step 4: Keep selected area valid after filters**

Add:

```ts
useEffect(() => {
  if (selectedAreaKey && !areaStats.some((area) => area.key === selectedAreaKey)) {
    setSelectedAreaKey('');
  }
}, [areaStats, selectedAreaKey]);
```

- [ ] **Step 5: Update MapPanel usage**

Replace current `MapPanel` props with:

```tsx
<MapPanel
  videos={filteredVideos}
  selectedBvid={selectedVideo?.bvid ?? ''}
  selectedAreaKey={selectedAreaKey}
  areaStats={areaStats}
  onSelectVideo={handleSelectVideo}
  onSelectArea={setSelectedAreaKey}
  routePolyline={summary.routePolyline}
/>
```

- [ ] **Step 6: Render AreaStoryPanel**

Place after `MapPanel` and before `TimelineBar`:

```tsx
<AreaStoryPanel
  area={selectedArea}
  onSelectVideo={handleSelectVideo}
  onClear={() => setSelectedAreaKey('')}
/>
```

- [ ] **Step 7: Typecheck App wiring**

Run:

```bash
npm run typecheck
```

Expected: no prop mismatch errors.

## Task 7: Update Styles

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add ECharts map styles**

Append near the map section:

```css
.echarts-map-stage {
  position: relative;
}

.echarts-map {
  width: 100%;
  height: 100%;
  min-height: 440px;
}

.map-loading,
.map-error {
  position: absolute;
  inset: auto 18px 18px auto;
  z-index: 4;
  padding: 8px 12px;
  border: 1px solid var(--border-active);
  border-radius: var(--radius);
  background: rgba(15, 26, 8, 0.88);
  color: var(--sage);
  font-size: 12px;
}

.map-error {
  color: #f1b08a;
  border-color: rgba(184, 92, 26, 0.45);
}
```

- [ ] **Step 2: Add area story styles**

Append:

```css
.area-story-panel {
  position: absolute;
  top: 74px;
  right: 18px;
  z-index: 25;
  width: min(360px, calc(100vw - 36px));
  max-height: calc(100vh - 190px);
  overflow: auto;
  padding: 16px;
  border: 1px solid var(--border-active);
  border-radius: var(--radius);
  background: rgba(15, 26, 8, 0.92);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(14px);
}

.area-story-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: rgba(200, 214, 160, 0.04);
  color: var(--text-dim);
  cursor: pointer;
}

.area-story-kicker {
  margin-bottom: 4px;
  color: var(--amber);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
}

.area-story-panel h2 {
  margin-right: 32px;
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--sage);
}

.area-story-stats,
.area-story-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.area-story-stats span,
.area-story-tags span {
  padding: 3px 7px;
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-dim);
  font-size: 11px;
}

.area-story-list {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.area-story-list button {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: rgba(200, 214, 160, 0.035);
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.area-story-list button:hover {
  border-color: var(--amber-glow);
}

.area-story-list small {
  color: var(--text-dim);
  font-size: 11px;
}

@media (max-width: 768px) {
  .area-story-panel {
    position: static;
    width: auto;
    max-height: none;
    margin: 10px;
  }
}
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build pass.

## Task 8: Clean AMap References and Update Docs

**Files:**
- Modify: `README.md`
- Optional delete: `src/lib/amap.ts` if no imports remain

- [ ] **Step 1: Check for AMap references**

Run:

```bash
rg -n "AMap|amap|VITE_AMAP|高德" .
```

Expected: only README/history references remain before cleanup.

- [ ] **Step 2: Update README**

Replace the optional environment variable section with:

```md
地图说明：

- 前端地图使用 ECharts 渲染静态 GeoJSON。
- 湖北市州边界文件位于 `public/maps/hubei-prefecture.json`。
- 构建后的站点只需要静态文件服务，不需要地图 API Key。
```

- [ ] **Step 3: Remove unused AMap loader**

If `rg -n "loadAmap|hasAmapConfig" src` returns no references, delete `src/lib/amap.ts`.

- [ ] **Step 4: Final verification**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands pass.

## Task 9: Manual Browser Verification

**Files:**
- No code changes expected

- [ ] **Step 1: Start dev server**

Run:

```bash
npm run dev
```

Expected: Vite prints a local URL, usually `http://localhost:5173/`.

- [ ] **Step 2: Verify core flows**

Open the local URL and check:

- 湖北地图 renders, not a blank rectangle.
- Video points appear over the map.
- Route line appears when `summary.routePolyline` has at least two coordinates.
- Clicking a video point opens `DetailPanel`.
- Clicking an administrative area opens `AreaStoryPanel`.
- Clicking a video inside `AreaStoryPanel` opens `DetailPanel`.
- TopBar filters update map coloring, point visibility, timeline cards, and area story content.
- Empty filters show the existing no-match state instead of crashing.

- [ ] **Step 3: Stop dev server**

Stop the `npm run dev` session with Ctrl-C after verification.

## Self-Review Checklist

- Spec coverage: the plan covers ECharts migration, static GeoJSON, story-first area panel, existing component reuse, AMap cleanup, and validation.
- Placeholder scan: no task asks workers to invent an unspecified component boundary.
- Type consistency: `AdminAreaStats`, `selectedAreaKey`, `areaStats`, `onSelectArea`, and `HUBEI_MAP_NAME` are introduced before use.

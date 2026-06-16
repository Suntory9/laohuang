# 最新 20 期游钓视频情报地图 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目从「湖北篇」升级为「最新 20 期跨省视频情报地图」，新增评论证据源、候选排序推断、全国自适应地图和证据解释详情面板。

**Architecture:** 渐进式管线升级，7 个阶段。数据层优先（阶段 1-4）：类型升级 → 评论缓存 → 信号提取 → 推断重构；然后前端改造（阶段 5-6）：地图 → 详情面板；最后验证（阶段 7）。

**Tech Stack:** Node.js (ES modules) + TypeScript 5 + React 19 + Vite 7 + ECharts 5 + OpenCLI (B站评论/字幕)

---

## 阶段 1：类型系统 + 管线适配

### Task 1: 升级 `src/types.ts` — EvidenceSource 和 EvidenceItem

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: 更新 `EvidenceSource` 类型和 `EvidenceItem` 接口**

将文件顶部的类型定义替换为：

```ts
export type Confidence = 'high' | 'medium' | 'low' | 'unknown';

export type EvidenceSource =
  | 'meta'
  | 'subtitle'
  | 'asr'
  | 'frame_ocr'
  | 'frame_visual'
  | 'comment'
  | 'sequence-inference'
  | 'manual_override'
  | string;

export interface EvidenceItem {
  source: EvidenceSource;
  quote: string;
  timestamp?: string;
  weight?: number;
  ref?: string;
}
```

- [ ] **Step 2: 在 `LocatedEntity` 接口中新增 `prefecture` 和 `county` 字段**

将 `LocatedEntity` 替换为：

```ts
export interface LocatedEntity {
  label: string;
  province: string | null;
  /** @deprecated 使用 prefecture */
  city: string | null;
  /** @deprecated 使用 county */
  district: string | null;
  prefecture: string | null;
  county: string | null;
  poi: string | null;
  lat: number | null;
  lng: number | null;
  confidence: Confidence;
  evidence: EvidenceItem[];
}
```

- [ ] **Step 3: 新增所有中间类型（CommentEvidence 到 VideoIntel）**

在 `LocatedEntity` 之后插入：

```ts
export interface CommentEvidence {
  source: 'comment';
  rpid: string;
  userName: string;
  likeCount: number;
  text: string;
  publishedAt: string;
  signals: {
    locationMentions: string[];
    fishMentions: string[];
    routeMentions: string[];
    correctionMentions: string[];
  };
  credibility: 'high' | 'medium' | 'low';
}

export interface LocationCandidate {
  label: string;
  province: string | null;
  prefecture: string | null;
  county: string | null;
  poi: string | null;
  lat: number | null;
  lng: number | null;
  confidence: Confidence;
  score: number;
  evidence: EvidenceItem[];
}

export interface CatchCandidate {
  species: string;
  countText: string | null;
  weightText: string | null;
  confidence: Confidence;
  score: number;
  evidence: EvidenceItem[];
}

export interface RouteCandidate {
  fromLabel: string;
  toLabel: string;
  evidence: EvidenceItem[];
}

export interface WeatherCandidate {
  summary: string;
  conditionTags: string[];
  confidence: Confidence;
  score: number;
  evidence: EvidenceItem[];
}

export interface StoryEvent {
  label: string;
  timeText: string | null;
  evidence: EvidenceItem[];
}

export interface EvidenceConflict {
  field: string;
  candidates: Array<{ value: string; source: EvidenceSource; quote: string }>;
  resolution: string | null;
}

export interface VideoIntel {
  bvid: string;
  title: string;
  sequenceIndex: number;
  candidates: {
    locations: LocationCandidate[];
    catches: CatchCandidate[];
    routeSegments: RouteCandidate[];
    weather: WeatherCandidate[];
    storyEvents: StoryEvent[];
  };
  conflicts: EvidenceConflict[];
  final: VideoRecord;
}
```

- [ ] **Step 4: 更新 `JourneySummary`，`cityStops` 改为 `prefectureStops`**

将 `JourneySummary` 接口中的 `cityStops` 替换为：

```ts
export interface JourneySummary {
  title: string;
  playlistId: string;
  playlistUrl: string;
  generatedAt: string;
  totalVideos: number;
  coveredPrefectures: number;
  videosWithCatch: number;
  videosWithUnknownCatch: number;
  skunkedVideos: number;
  videosWithUnknownSkunk: number;
  totalShoppingCostCny: number;
  averageActivitySpanHours: number;
  topDinnerFoods: Array<{ label: string; count: number }>;
  topFishingTheoryTags: Array<{ label: string; count: number }>;
  prefectureStops: Array<{ prefecture: string; count: number; lat: number | null; lng: number | null }>;
  routePolyline: [number, number][];
  mapViewport?: MapViewport;
}
```

- [ ] **Step 5: 类型检查验证**

```bash
cd /Users/songdc/ABCD/laohuang && npm run typecheck 2>&1 | head -50
```

预期：类型错误出现在使用旧字段 `city`/`district`/`cityStops`/`coveredCities` 的地方（后续任务逐一修复），没有语法错误。

- [ ] **Step 6: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add VideoIntel, LocationCandidate, CommentEvidence; deprecate city/district

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 更新 `scripts/lib/extractors.mjs` — Gazetteer 字段升级

**Files:**
- Modify: `scripts/lib/extractors.mjs`

- [ ] **Step 1: 更新 `locationGazetteer` 条目，新增 `prefecture`/`county` 并保留 `city`/`district`**

将每个 gazetteer 条目增加 `prefecture` 和 `county` 字段。例如第一个条目：

```js
// 将:
// { label: '湖北省', aliases: ['湖北'], province: '湖北省', city: null, district: null, poi: null, ... }
// 改为:
{
  label: '湖北省',
  aliases: ['湖北'],
  province: '湖北省',
  city: null,          // deprecated, keep
  district: null,      // deprecated, keep
  prefecture: null,
  county: null,
  poi: null,
  lat: 30.5454,
  lng: 114.3423,
  priority: 1,
},
```

对所有 15 个条目的映射规则：
- `city: '荆州'` → `prefecture: '荆州市'`
- `city: '长阳'` → `prefecture: '宜昌市'`, `county: '长阳土家族自治县'`
- `city: '恩施'` → `prefecture: '恩施土家族苗族自治州'`
- `city: '宜昌'` → `prefecture: '宜昌市'`
- `district` 值移到 `county`

- [ ] **Step 2: 更新 `inferLocation` 返回值，同时写 `city`/`district` 和 `prefecture`/`county`**

在 `inferLocation` 的 return 语句中，`city` 和 `district` 保持旧值写入（向后兼容），同时新增 `prefecture`/`county`：

```js
return {
  label: resolved?.label ?? normalized.at(0) ?? '未在视频中明确提及',
  province: resolved?.province ?? null,
  city: resolved?.city ?? null,           // keep deprecated
  district: resolved?.district ?? null,   // keep deprecated
  prefecture: resolved?.prefecture ?? null,
  county: resolved?.county ?? null,
  poi: resolved?.poi ?? null,
  lat: resolved?.lat ?? null,
  lng: resolved?.lng ?? null,
  confidence: best ? 'high' : visualMatch ? 'medium' : normalized.length > 0 ? 'medium' : 'unknown',
  evidence: /* ... existing ... */,
};
```

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/extractors.mjs
git commit -m "feat(extractors): add prefecture/county fields to gazetteer and inferLocation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 更新 `scripts/lib/build-record.mjs`

**Files:**
- Modify: `scripts/lib/build-record.mjs`

- [ ] **Step 1: 无需大改 — `buildVideoRecord` 只是透传 `inferLocation` 返回值**

确认当前代码 (`build-record.mjs:14-49`) 已经将 `inferLocation` 的返回值完整传入 `video.location`。新增字段自动携带。无需代码修改。

- [ ] **Step 2: Commit (如无改动则跳过)**

---

### Task 4: 更新 `scripts/lib/aggregate.mjs` — prefectureStops

**Files:**
- Modify: `scripts/lib/aggregate.mjs`

- [ ] **Step 1: 将 `cityStops` 改为 `prefectureStops`**

将 `buildJourneySummary` 函数中：

```js
// 旧的 city 聚合:
if (video.location.city) {
  const current = cityStopsMap.get(video.location.city) ?? { ... };
}

// 改为 prefecture 聚合:
const prefectureStopsMap = new Map();
// ...
if (video.location.prefecture) {
  const current = prefectureStopsMap.get(video.location.prefecture) ?? {
    prefecture: video.location.prefecture,
    count: 0,
    lat: video.location.lat,
    lng: video.location.lng,
  };
  current.count += 1;
  prefectureStopsMap.set(video.location.prefecture, current);
}
```

- [ ] **Step 2: 更新返回值**

```js
return {
  title: '老黄游钓中国旅程图谱',
  playlistId,
  playlistUrl,
  generatedAt: new Date().toISOString(),
  totalVideos: videos.length,
  coveredPrefectures: prefectureStopsMap.size,
  videosWithCatch: /* ... same ... */,
  videosWithUnknownCatch: /* ... */,
  skunkedVideos: /* ... */,
  videosWithUnknownSkunk: /* ... */,
  totalShoppingCostCny: /* ... */,
  averageActivitySpanHours: /* ... */,
  topDinnerFoods: /* ... */,
  topFishingTheoryTags: /* ... */,
  prefectureStops: [...prefectureStopsMap.values()],
  routePolyline,
  mapViewport: buildMapViewport(routePolyline, videos),
};
```

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/aggregate.mjs
git commit -m "feat(aggregate): switch cityStops to prefectureStops

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 更新 `scripts/lib/refine-videos.mjs` — 适配新字段

**Files:**
- Modify: `scripts/lib/refine-videos.mjs`

- [ ] **Step 1: 更新字段拷贝和条件判断**

将函数中所有 `.city` 引用同步写 `.prefecture`：

```js
// needsLocationInference:
function needsLocationInference(video) {
  return video.location.prefecture === null ||
    video.location.label === '未在视频中明确提及' ||
    video.location.label === '湖北省';
}

// findNearestKnown:
if (candidate.location.prefecture !== null && candidate.location.label !== '湖北省') {
  return candidate.location;
}

// chooseInference:
if (previousKnown && nextKnown && previousKnown.prefecture === nextKnown.prefecture) {
  return {
    ...preferMoreSpecific(previousKnown, nextKnown),
    reason: `前后相邻视频都落在 ${previousKnown.prefecture} 一带，按连续旅程推断当前位置沿用同城节点。`,
  };
}

// 地点赋值处增加 prefecture/county:
current.location = {
  ...current.location,
  label: inferred.label,
  province: inferred.province,
  city: inferred.city,
  district: inferred.district,
  prefecture: inferred.prefecture,
  county: inferred.county,
  poi: inferred.poi,
  lat: inferred.lat,
  lng: inferred.lng,
  confidence: 'low',
  evidence: [ ... ],
};
```

- [ ] **Step 2: Commit**

```bash
git add scripts/lib/refine-videos.mjs
git commit -m "fix(refine-videos): use prefecture field for sequential inference

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 更新 `scripts/pipeline.mjs` — 数据质量报告

**Files:**
- Modify: `scripts/pipeline.mjs`

- [ ] **Step 1: 在管线末尾添加数据质量报告输出**

在 `console.log(`Generated ${refinedVideos.length} video records.`);` 之后添加：

```js
// 数据质量报告
const subtitledCount = videos.filter((v) => v.transcriptSource === 'official_subtitle').length;
const asrCount = videos.filter((v) => v.transcriptSource === 'asr').length;
const withCoords = videos.filter((v) => v.location.lat !== null && v.location.lng !== null).length;
const lowConfLoc = videos.filter((v) => v.location.confidence === 'low').length;
const unknownCatch = videos.filter((v) => v.fishing.caught === 'unknown').length;
const unknownSkunk = videos.filter((v) => v.fishing.isSkunked === 'unknown').length;
// 评论统计占位（阶段2接入）
const commentSuccess = 0;

console.log('\n=== 数据质量报告 ===');
console.log(`视频总数: ${refinedVideos.length}`);
console.log(`字幕数: ${subtitledCount}`);
console.log(`ASR 数: ${asrCount}`);
console.log(`有坐标视频数: ${withCoords}`);
console.log(`低置信地点数: ${lowConfLoc}`);
console.log(`unknown 鱼获数: ${unknownCatch}`);
console.log(`unknown 空军数: ${unknownSkunk}`);
console.log(`评论抓取成功数: ${commentSuccess}`);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/pipeline.mjs
git commit -m "feat(pipeline): add data quality report output

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: 更新 `scripts/rebuild-from-raw.mjs` — 同步 prefecture 字段

**Files:**
- Modify: `scripts/rebuild-from-raw.mjs`

- [ ] **Step 1: 同样添加质量报告输出**

在 `console.log(...)` 末尾之后添加与 Task 6 相同的质量报告代码块。

- [ ] **Step 2: Commit**

```bash
git add scripts/rebuild-from-raw.mjs
git commit -m "feat(rebuild): add data quality report output

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: 修复前端编译错误 — 适配新类型

**Files:**
- Modify: `src/lib/adminStats.ts`
- Modify: `src/lib/echartsMap.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/TopBar.tsx`
- Modify: `src/components/Filters.tsx`

- [ ] **Step 1: 更新 `src/lib/adminStats.ts`**

将 `buildPrefectureStats` 中按 `city` 分组改为按 `prefecture` 分组：

```ts
export interface AdminAreaStats {
  key: string;
  name: string;
  count: number;
  videos: VideoRecord[];
}

export function buildPrefectureStats(videos: VideoRecord[]): AdminAreaStats[] {
  const map = new Map<string, { name: string; count: number; videos: VideoRecord[] }>();
  for (const v of videos) {
    const key = v.location.prefecture ?? v.location.city ?? '__unknown__';
    if (key === '__unknown__') continue;
    const entry = map.get(key) ?? { name: key, count: 0, videos: [] };
    entry.count += 1;
    entry.videos.push(v);
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
```

- [ ] **Step 2: 更新 `src/lib/echartsMap.ts`**

暂时保留现有函数签名，后续阶段 5 会整体重写。仅将 `cityStops` → `prefectureStops` 引用更新。

- [ ] **Step 3: 更新 `src/App.tsx` 中的城市列表构建**

将 `cities` useMemo 改为使用 `prefecture`：

```tsx
const prefectures = useMemo(
  () =>
    [...new Set(videos.map((v) => v.location.prefecture).filter((c): c is string => Boolean(c)))].sort(
      (a, b) => a.localeCompare(b, 'zh-CN'),
    ),
  [videos],
);
```

同时更新传给 `TopBar` 的 prop 名称和过滤逻辑中的 `filters.city` → `filters.prefecture`（FiltersState 也需要对应更新，见下一步）。

- [ ] **Step 4: 更新 `src/components/Filters.tsx`**

将 `FiltersState` 的 `city` 字段改为 `prefecture`：

```ts
export interface FiltersState {
  keyword: string;
  prefecture: string;
  weatherTag: string;
  catchState: 'all' | 'yes' | 'no' | 'unknown';
  skunkedState: 'all' | 'yes' | 'no' | 'unknown';
  hasShopping: 'all' | 'yes' | 'no';
  theoryTag: string;
}
```

- [ ] **Step 5: 更新 `App.tsx` 的过滤逻辑**

```tsx
if (filters.prefecture && video.location.prefecture !== filters.prefecture) return false;
```

- [ ] **Step 6: 更新 `src/components/TopBar.tsx`**

将 `cities` prop 改为 `prefectures`，传给 Filters。

- [ ] **Step 7: 运行类型检查确认全部通过**

```bash
cd /Users/songdc/ABCD/laohuang && npm run typecheck 2>&1
```

预期：0 错误。

- [ ] **Step 8: Commit**

```bash
git add src/lib/adminStats.ts src/lib/echartsMap.ts src/App.tsx src/components/TopBar.tsx src/components/Filters.tsx
git commit -m "fix(frontend): migrate city/district to prefecture/county across components

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 阶段 2：评论缓存

### Task 9: 创建 `scripts/fetch-comments.mjs`

**Files:**
- Create: `scripts/fetch-comments.mjs`

- [ ] **Step 1: 编写评论抓取脚本**

```js
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const rawDir = resolve(root, 'raw/videos');

/**
 * 为单个视频抓取评论缓存。
 * @param {string} bvid
 * @param {{ limit?: number, forceRefresh?: boolean }} options
 * @returns {{ success: boolean, count: number, error?: string }}
 */
export function fetchComments(bvid, { limit = 200, forceRefresh = false } = {}) {
  const videoDir = resolve(rawDir, bvid);
  const cachePath = resolve(videoDir, 'comments.json');

  if (!forceRefresh && existsSync(cachePath)) {
    const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
    if (Array.isArray(cached) && cached.length > 0) {
      return { success: true, count: cached.length, cached: true };
    }
  }

  const allComments = [];
  const seenRpids = new Set();

  try {
    // B站 API 每页最多 50 条，分多页抓取
    const pages = Math.ceil(limit / 50);
    for (let page = 1; page <= pages; page++) {
      const pageLimit = Math.min(50, limit - allComments.length);
      if (pageLimit <= 0) break;

      const raw = execFileSync('opencli', [
        'bilibili', 'comments', bvid,
        '--limit', String(pageLimit),
        '-f', 'json',
        '--site-session', 'persistent',
      ], { encoding: 'utf8', timeout: 60000, stdio: 'pipe' });

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // 可能返回非 JSON（如提示信息）
        if (raw.includes('no comments') || raw.includes('暂无评论')) break;
        throw new Error(`JSON parse failed: ${raw.slice(0, 200)}`);
      }

      if (!Array.isArray(parsed) || parsed.length === 0) break;

      for (const comment of parsed) {
        if (seenRpids.has(comment.rpid)) continue;
        seenRpids.add(comment.rpid);
        allComments.push({
          rpid: comment.rpid,
          author: comment.author,
          text: comment.text,
          likes: comment.likes,
          replies: comment.replies,
          time: comment.time,
        });
      }

      if (parsed.length < pageLimit) break; // no more pages
    }

    writeFileSync(cachePath, JSON.stringify(allComments, null, 2) + '\n');
    return { success: true, count: allComments.length };
  } catch (err) {
    // 写入失败记录
    const failureNote = { error: err.message, time: new Date().toISOString() };
    writeFileSync(cachePath, JSON.stringify(failureNote, null, 2) + '\n');
    return { success: false, count: 0, error: err.message };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/fetch-comments.mjs
git commit -m "feat: add fetch-comments.mjs using opencli bilibili comments

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: 接入评论缓存到 pipeline 和 rebuild

**Files:**
- Modify: `scripts/pipeline.mjs`
- Modify: `scripts/rebuild-from-raw.mjs`

- [ ] **Step 1: 在 pipeline.mjs 中接入 fetchComments**

在 `pipeline.mjs` 顶部添加 import：

```js
import { fetchComments } from './fetch-comments.mjs';
```

在主循环内，`buildVideoRecord` 调用之前添加评论抓取：

```js
// 在 visual analysis 之后，buildVideoRecord 之前:
const commentResult = fetchComments(entry.id, { limit: 200, forceRefresh });
```

在质量报告中更新 `commentSuccess`：

```js
const commentResults = videos.map(/* 收集 commentResult */);
const commentSuccess = commentResults.filter((r) => r?.success).length;
```

注意：pipeline 的 `videos` 数组目前存的是 `buildVideoRecord` 返回的 `{ video, evidence }` 对象。需要重构为同时存储 `commentResult`。

具体实施方案：将主循环内每期处理结果暂存到一个 `results` 数组：

```js
const results = [];
// 循环内:
results.push({ video: built.video, evidence: built.evidence, commentResult });
// 循环后:
const videos = results.map((r) => r.video);
const commentSuccess = results.filter((r) => r.commentResult?.success).length;
```

- [ ] **Step 2: 在 rebuild-from-raw.mjs 中同样接入**

对 rebuild 脚本做相同的 import 和循环内调用。

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline.mjs scripts/rebuild-from-raw.mjs
git commit -m "feat: integrate fetchComments into pipeline and rebuild

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 阶段 3：评论信号提取

### Task 11: 创建 `scripts/lib/comment-extractors.mjs`

**Files:**
- Create: `scripts/lib/comment-extractors.mjs`

- [ ] **Step 1: 编写评论信号提取器**

```js
const locationCues = /(这里是|这个地方叫|本地人|就在|坐标是|这是|位置在|属于|小镇叫|村叫|镇叫|县城|市区|市里)/;
const fishCues = /(鲫鱼|鲤鱼|草鱼|鲢鳙|白条|翘嘴|黄颡鱼|鲶鱼|马口|鳊鱼|鳜鱼|黑鱼|罗非|黄辣丁|鳑鲏|麦穗|鳡鱼|青鱼|鳊|鲮|鲻|鲈|鳟)/;
const routeCues = /(从.*到|上一期|下一期|应该是.*附近|大概在|估计在|看起来像|好像是)/;
const correctionCues = /(不是|这不是|纠正|错了|明明|怎么可能|搞错了|认错了|其实不是)/;

/**
 * 从评论列表中提取信号。
 * @param {Array<{rpid: string, author: string, text: string, likes: number, time: string}>} comments
 * @returns {Array<import('../../src/types').CommentEvidence>}
 */
export function extractCommentEvidence(comments) {
  return comments.map((comment) => {
    const text = comment.text;
    const signals = {
      locationMentions: extractLocationMentions(text),
      fishMentions: extractFishMentions(text),
      routeMentions: extractRouteMentions(text),
      correctionMentions: extractCorrectionMentions(text),
    };
    const credibility = scoreCredibility(comment, signals);
    return {
      source: 'comment',
      rpid: comment.rpid,
      userName: comment.author,
      likeCount: comment.likes,
      text,
      publishedAt: comment.time,
      signals,
      credibility,
    };
  });
}

function extractLocationMentions(text) {
  if (!locationCues.test(text)) return [];
  // 简单地名匹配：中文字符2-6字的地名模式
  const matches = text.match(/(?:是|在|到|叫|属于)([一-鿿]{2,6}(?:市|县|区|镇|乡|村|段|河|江|湖|库|桥|湾|沟|口|坪|岭|岗|坡|坝))+/g);
  return matches ? matches.map((m) => m.replace(/^(?:是|在|到|叫|属于)/, '')) : [];
}

function extractFishMentions(text) {
  const matches = text.match(new RegExp(fishCues.source, 'g'));
  if (!matches) return [];
  const countMatch = text.match(/(\d+)\s*(条|尾|斤|两)/);
  return countMatch ? [`${matches[0]} ${countMatch[0]}`] : matches;
}

function extractRouteMentions(text) {
  return routeCues.test(text) ? [text.slice(0, 80)] : [];
}

function extractCorrectionMentions(text) {
  return correctionCues.test(text) ? [text.slice(0, 80)] : [];
}

function scoreCredibility(comment, signals) {
  let score = 0;
  // 点赞数加权
  if (comment.likes >= 100) score += 3;
  else if (comment.likes >= 10) score += 2;
  else if (comment.likes >= 1) score += 1;

  // 本地人表达加权
  if (/本地人|我是.*人|我家|我们这/.test(comment.text)) score += 2;

  // 有实质信号
  if (signals.locationMentions.length > 0) score += 1;
  if (signals.correctionMentions.length > 0 && signals.locationMentions.length > 0) score += 1;

  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

/**
 * 从 CommentEvidence 列表中收集所有地名提及，合并计数。
 * @param {import('../../src/types').CommentEvidence[]} evidenceList
 * @returns {Map<string, {count: number, users: string[], totalLikes: number}>}
 */
export function aggregateCommentLocations(evidenceList) {
  const map = new Map();
  for (const ev of evidenceList) {
    for (const mention of ev.signals.locationMentions) {
      const entry = map.get(mention) ?? { count: 0, users: [], totalLikes: 0 };
      entry.count += 1;
      if (!entry.users.includes(ev.userName)) entry.users.push(ev.userName);
      entry.totalLikes += ev.likeCount;
      map.set(mention, entry);
    }
  }
  return map;
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/lib/comment-extractors.mjs
git commit -m "feat: add comment-extractors.mjs for location/fish/route/correction signals

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: 接入评论提取到 pipeline — 产出 `comment-evidence.json`

**Files:**
- Modify: `scripts/pipeline.mjs`
- Modify: `scripts/rebuild-from-raw.mjs`

- [ ] **Step 1: 在 pipeline.mjs 中添加评论证据生成**

在 `fetchComments` 调用后，添加：

```js
import { extractCommentEvidence } from './lib/comment-extractors.mjs';

// 在评论抓取后:
let commentEvidence = [];
if (commentResult.success && commentResult.count > 0) {
  const comments = JSON.parse(readFileSync(resolve(rawVideoDir, 'comments.json'), 'utf8'));
  if (Array.isArray(comments)) {
    commentEvidence = extractCommentEvidence(comments);
    writeFileSync(
      resolve(rawVideoDir, 'comment-evidence.json'),
      JSON.stringify(commentEvidence, null, 2) + '\n',
    );
  }
}
```

- [ ] **Step 2: 同样更新 rebuild-from-raw.mjs**

在 rebuild 循环中添加相同的评论提取逻辑（从已有 `comments.json` 读取，无需重新抓取）。

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline.mjs scripts/rebuild-from-raw.mjs
git commit -m "feat: integrate comment evidence extraction into pipeline

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 阶段 4：推断重构

### Task 13: 创建 `scripts/lib/evidence-scoring.mjs`

**Files:**
- Create: `scripts/lib/evidence-scoring.mjs`

- [ ] **Step 1: 编写统一证据打分逻辑**

```js
/**
 * 证据来源基础权重。
 */
const SOURCE_WEIGHTS = {
  meta: 100,
  subtitle: 80,
  asr: 60,
  frame_ocr: 70,
  frame_visual: 50,
  comment: 40,
  'sequence-inference': 30,
  manual_override: 1000,
};

/**
 * 为一组 EvidenceItem 计算加权总分。
 * @param {import('../../src/types').EvidenceItem[]} evidenceList
 * @returns {number}
 */
export function scoreEvidence(evidenceList) {
  let total = 0;
  for (const item of evidenceList) {
    const base = SOURCE_WEIGHTS[item.source] ?? 20;
    const weight = item.weight ?? 1;
    total += base * weight;
  }
  return total;
}

/**
 * 文本中出现频次（归一化到 0-1）。
 */
export function frequencyBoost(occurrences, maxOccurrences = 5) {
  return Math.min(occurrences / maxOccurrences, 1);
}

/**
 * 评论多人重复加权。
 * @param {number} uniqueUsers
 * @returns {number}
 */
export function commentConsensusBoost(uniqueUsers) {
  if (uniqueUsers >= 5) return 1.5;
  if (uniqueUsers >= 3) return 1.2;
  if (uniqueUsers >= 2) return 1.0;
  return 0.5;
}

/**
 * 计算置信度等级。
 * @param {number} score
 * @returns {'high' | 'medium' | 'low' | 'unknown'}
 */
export function scoreToConfidence(score) {
  if (score >= 200) return 'high';
  if (score >= 100) return 'medium';
  if (score >= 30) return 'low';
  return 'unknown';
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/lib/evidence-scoring.mjs
git commit -m "feat: add evidence-scoring.mjs with unified scoring logic

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 14: 创建 `scripts/lib/location-candidates.mjs`

**Files:**
- Create: `scripts/lib/location-candidates.mjs`

- [ ] **Step 1: 编写多源地点候选合并逻辑**

```js
import { locationGazetteer } from './extractors.mjs';
import { scoreEvidence, scoreToConfidence } from './evidence-scoring.mjs';

/**
 * 从标题+字幕中提取地点候选。
 */
function fromTitleAndTranscript(title, transcript) {
  const sourceText = `${title} ${transcript}`;
  return locationGazetteer
    .map((entry) => {
      const alias = entry.aliases.find((a) => sourceText.includes(a));
      if (!alias) return null;
      return {
        label: entry.label,
        province: entry.province,
        prefecture: entry.prefecture,
        county: entry.county,
        poi: entry.poi,
        lat: entry.lat,
        lng: entry.lng,
        evidence: [{
          source: 'subtitle',
          quote: `在标题或字幕中识别到地名：${alias}`,
          weight: 2,
        }],
      };
    })
    .filter(Boolean);
}

/**
 * 从 OCR 文本中提取地点候选。
 */
function fromOcr(visualAnalysis) {
  const ocrText = (visualAnalysis?.signals?.ocrMentions ?? []).join(' ');
  if (!ocrText) return [];
  return locationGazetteer
    .map((entry) => {
      const alias = entry.aliases.find((a) => ocrText.includes(a));
      if (!alias) return null;
      return {
        label: entry.label,
        province: entry.province,
        prefecture: entry.prefecture,
        county: entry.county,
        poi: entry.poi,
        lat: entry.lat,
        lng: entry.lng,
        evidence: [{
          source: 'frame_ocr',
          quote: `关键帧 OCR 识别到地点词：${alias}`,
          weight: 2,
        }],
      };
    })
    .filter(Boolean);
}

/**
 * 从评论证据中提取地点候选。
 */
function fromComments(commentEvidenceList, aggregatedLocations) {
  if (!aggregatedLocations || aggregatedLocations.size === 0) return [];
  const candidates = [];
  for (const [mention, stats] of aggregatedLocations) {
    // 尝试匹配 gazetteer
    const gazMatch = locationGazetteer.find((entry) =>
      entry.aliases.some((a) => mention.includes(a) || a.includes(mention))
    );
    candidates.push({
      label: gazMatch?.label ?? mention,
      province: gazMatch?.province ?? null,
      prefecture: gazMatch?.prefecture ?? null,
      county: gazMatch?.county ?? null,
      poi: gazMatch?.poi ?? null,
      lat: gazMatch?.lat ?? null,
      lng: gazMatch?.lng ?? null,
      evidence: [{
        source: 'comment',
        quote: `${stats.count} 位用户在评论中提到「${mention}」（共 ${stats.totalLikes} 赞）`,
        weight: stats.count,
        ref: stats.users.join(','),
      }],
    });
  }
  return candidates;
}

/**
 * 从前后视频顺序推断候选。
 */
function fromSequence(previousVideo, nextVideo) {
  const candidates = [];
  if (previousVideo?.location?.prefecture) {
    candidates.push({
      label: previousVideo.location.label,
      province: previousVideo.location.province,
      prefecture: previousVideo.location.prefecture,
      county: previousVideo.location.county,
      poi: previousVideo.location.poi,
      lat: previousVideo.location.lat,
      lng: previousVideo.location.lng,
      evidence: [{
        source: 'sequence-inference',
        quote: `前序视频在 ${previousVideo.location.label}，推断当前位置相近`,
        weight: 1,
      }],
    });
  }
  return candidates;
}

/**
 * 合并所有来源的地点候选，去重并打分排序。
 * @returns {import('../../src/types').LocationCandidate[]}
 */
export function buildLocationCandidates({
  title, transcript, visualAnalysis, commentEvidenceList,
  aggregatedCommentLocations, previousVideo,
}) {
  const raw = [
    ...fromTitleAndTranscript(title, transcript),
    ...fromOcr(visualAnalysis),
    ...fromComments(commentEvidenceList, aggregatedCommentLocations),
    ...fromSequence(previousVideo, null),
  ];

  // 按 label 去重合并 evidence
  const merged = new Map();
  for (const candidate of raw) {
    const key = candidate.label;
    if (merged.has(key)) {
      const existing = merged.get(key);
      existing.evidence.push(...candidate.evidence);
      // 取更精确的坐标
      if (!existing.lat && candidate.lat) {
        existing.lat = candidate.lat;
        existing.lng = candidate.lng;
      }
    } else {
      merged.set(key, { ...candidate });
    }
  }

  // 计算分数和置信度
  return [...merged.values()]
    .map((c) => ({
      ...c,
      score: scoreEvidence(c.evidence),
      confidence: scoreToConfidence(scoreEvidence(c.evidence)),
    }))
    .sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/lib/location-candidates.mjs
git commit -m "feat: add location-candidates.mjs for multi-source location merging

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 15: 创建 `scripts/lib/intel-builder.mjs`

**Files:**
- Create: `scripts/lib/intel-builder.mjs`

- [ ] **Step 1: 编写 VideoIntel 组装器**

```js
import { buildLocationCandidates } from './location-candidates.mjs';

/**
 * 组装 VideoIntel 中间结果。
 * @returns {import('../../src/types').VideoIntel}
 */
export function buildVideoIntel({
  meta, transcriptText, transcriptSource, sequenceIndex,
  previousVideo, visualAnalysis, commentEvidenceList,
  aggregatedCommentLocations,
  // 现有推断结果
  inferredLocation, inferredWeather, inferredFishing,
  inferredRoute, inferredDinner, inferredShopping,
  inferredFishingTheory, inferredTimeSpan,
}) {
  const locationCandidates = buildLocationCandidates({
    title: meta.title,
    transcript: transcriptText,
    visualAnalysis,
    commentEvidenceList,
    aggregatedCommentLocations,
    previousVideo,
  });

  // 如果没有任何候选，用原始推断结果作为唯一候选
  if (locationCandidates.length === 0 && inferredLocation.label !== '未在视频中明确提及') {
    locationCandidates.push({
      label: inferredLocation.label,
      province: inferredLocation.province,
      prefecture: inferredLocation.prefecture,
      county: inferredLocation.county,
      poi: inferredLocation.poi,
      lat: inferredLocation.lat,
      lng: inferredLocation.lng,
      confidence: inferredLocation.confidence,
      score: 20,
      evidence: inferredLocation.evidence,
    });
  }

  // 检查评论与规则推断之间的冲突
  const conflicts = buildConflicts(locationCandidates, inferredLocation, commentEvidenceList);

  // 最终地点：取最高分候选，有冲突时保留冲突信息
  const best = locationCandidates[0] ?? null;
  const finalLocation = best
    ? {
        ...inferredLocation,
        label: best.label,
        province: best.province,
        prefecture: best.prefecture,
        county: best.county,
        poi: best.poi,
        lat: best.lat,
        lng: best.lng,
        confidence: best.confidence,
        evidence: best.evidence,
      }
    : inferredLocation;

  // 构建故事事件
  const storyEvents = buildStoryEvents({
    title: meta.title, transcript: transcriptText,
    weather: inferredWeather, fishing: inferredFishing,
    visualAnalysis, location: finalLocation,
  });

  const final = {
    bvid: meta.id,
    title: meta.title,
    publishedAt: toIsoDate(meta.upload_date),
    durationSec: Math.round(meta.duration ?? 0),
    coverUrl: meta.thumbnail,
    bilibiliUrl: meta.webpage_url,
    sequenceIndex,
    transcriptSource,
    location: finalLocation,
    weather: inferredWeather,
    route: inferredRoute,
    timeSpan: inferredTimeSpan,
    dinner: inferredDinner,
    shopping: inferredShopping,
    fishingTheory: inferredFishingTheory,
    fishing: inferredFishing,
    visualAnalysis: visualAnalysis ?? null,
    transcriptExcerpt: (transcriptText ?? '').replace(/\s+/g, ' ').trim().slice(0, 180),
    rawEvidenceRefs: [],
  };

  return {
    bvid: meta.id,
    title: meta.title,
    sequenceIndex,
    candidates: {
      locations: locationCandidates,
      catches: [],
      routeSegments: [],
      weather: [],
      storyEvents,
    },
    conflicts,
    final,
  };
}

function buildConflicts(locationCandidates, originalLocation, commentEvidenceList) {
  const conflicts = [];
  const correctionComments = (commentEvidenceList ?? []).filter(
    (c) => c.signals.correctionMentions.length > 0 && c.credibility !== 'low'
  );
  if (correctionComments.length > 0 && locationCandidates.length > 0) {
    const topCandidate = locationCandidates[0];
    const commentSource = topCandidate.evidence.find((e) => e.source === 'comment');
    const ruleSource = topCandidate.evidence.find((e) => e.source === 'subtitle' || e.source === 'frame_ocr');
    if (commentSource && ruleSource && ruleSource.quote !== commentSource.quote) {
      conflicts.push({
        field: 'location',
        candidates: [
          { value: `规则推断: ${originalLocation.label}`, source: 'subtitle', quote: ruleSource.quote },
          { value: `评论认为: ${topCandidate.label}`, source: 'comment', quote: commentSource.quote },
        ],
        resolution: correctionComments.length >= 3 ? '多数评论支持相同纠正，采纳评论位置' : null,
      });
    }
  }
  return conflicts;
}

function buildStoryEvents({ title, transcript, weather, fishing, visualAnalysis, location }) {
  const events = [];
  const text = `${title} ${transcript}`;

  if (/到达|来到|终于到了/.test(text)) {
    events.push({
      label: `到达 ${location.label}`,
      timeText: null,
      evidence: [{ source: 'subtitle', quote: text.match(/(?:到达|来到|终于到了)[^，。]*/)?.[0] ?? '' }],
    });
  }

  if (fishing.caught === 'yes') {
    events.push({
      label: `中鱼${fishing.species.length > 0 ? '：' + fishing.species.join('、') : ''}`,
      timeText: null,
      evidence: fishing.evidence.slice(0, 2),
    });
  }

  if (fishing.isSkunked === 'yes') {
    events.push({
      label: '空军',
      timeText: null,
      evidence: fishing.evidence.slice(0, 1),
    });
  }

  if (weather.conditionTags.includes('下雨') || weather.conditionTags.includes('强降雨')) {
    events.push({
      label: '冒雨前行',
      timeText: null,
      evidence: [{ source: 'subtitle', quote: weather.summary }],
    });
  }

  return events;
}

function toIsoDate(uploadDate) {
  if (!uploadDate || uploadDate.length !== 8) return new Date().toISOString();
  return `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}T12:00:00.000Z`;
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/lib/intel-builder.mjs
git commit -m "feat: add intel-builder.mjs for VideoIntel assembly

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 16: 接入 intel-builder 到 pipeline + rebuild

**Files:**
- Modify: `scripts/pipeline.mjs`
- Modify: `scripts/rebuild-from-raw.mjs`

- [ ] **Step 1: 在 pipeline.mjs 中接入 intel-builder**

在 `buildVideoRecord` 调用之后，用 `buildVideoIntel` 包装：

```js
import { buildVideoIntel } from './lib/intel-builder.mjs';
import { aggregateCommentLocations } from './lib/comment-extractors.mjs';

// 在 buildVideoRecord 之后:
const aggregatedLocations = aggregateCommentLocations(commentEvidence);
const intel = buildVideoIntel({
  meta,
  transcriptText,
  transcriptSource,
  sequenceIndex: index + 1,
  previousVideo: results.at(-1)?.intel?.final ?? null,
  visualAnalysis,
  commentEvidenceList: commentEvidence,
  aggregatedCommentLocations: aggregatedLocations,
  inferredLocation: built.video.location,
  inferredWeather: built.video.weather,
  inferredFishing: built.video.fishing,
  inferredRoute: built.video.route,
  inferredDinner: built.video.dinner,
  inferredShopping: built.video.shopping,
  inferredFishingTheory: built.video.fishingTheory,
  inferredTimeSpan: built.video.timeSpan,
});

writeFileSync(
  resolve(rawVideoDir, 'intel.json'),
  JSON.stringify(intel, null, 2) + '\n',
);

// 用 intel.final 替换 built.video
results.push({ video: intel.final, evidence: built.evidence, commentResult, intel });
```

- [ ] **Step 2: 同样更新 rebuild-from-raw.mjs**

对 rebuild 脚本做相同的调用链。rebuild 中 `comment-evidence.json` 已在之前阶段生成，从文件读取即可。

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline.mjs scripts/rebuild-from-raw.mjs
git commit -m "feat: integrate intel-builder into pipeline and rebuild

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 阶段 5：地图改造

### Task 17: 重写 `src/lib/echartsMap.ts` — 全国自适应地图

**Files:**
- Modify: `src/lib/echartsMap.ts`

- [ ] **Step 1: 重写为不依赖湖北 GeoJSON 的通用地图 option 构造器**

```ts
import type { AdminAreaStats } from './adminStats';
import type { VideoRecord } from '../types';

export function buildJourneyMapOption(params: {
  videos: VideoRecord[];
  areaStats: AdminAreaStats[];
  selectedBvid: string;
  routePolyline: [number, number][];
  mapViewport?: { center: [number, number]; zoom: number; bounds: { west: number; south: number; east: number; north: number } };
}) {
  const { videos, selectedBvid, routePolyline, mapViewport } = params;

  const routeCoords = routePolyline.length > 0
    ? routePolyline.map(([lng, lat]) => [lng, lat])
    : videos
        .filter((v) => v.location.lng !== null && v.location.lat !== null)
        .map((v) => [v.location.lng!, v.location.lat!]);

  const scatterData = videos
    .filter((v) => v.location.lat !== null && v.location.lng !== null)
    .map((v) => ({
      name: v.title.slice(0, 20),
      value: [v.location.lng!, v.location.lat!, v],
      bvid: v.bvid,
    }));

  // 分组：按鱼获状态+置信度
  const catchHigh = scatterData.filter((d) => {
    const v = d.value[2] as VideoRecord;
    return v.fishing.caught === 'yes' && v.location.confidence !== 'low';
  });
  const catchLow = scatterData.filter((d) => {
    const v = d.value[2] as VideoRecord;
    return v.fishing.caught === 'yes' && v.location.confidence === 'low';
  });
  const unknown = scatterData.filter((d) => {
    const v = d.value[2] as VideoRecord;
    return v.fishing.caught === 'unknown';
  });
  const skunked = scatterData.filter((d) => {
    const v = d.value[2] as VideoRecord;
    return v.fishing.isSkunked === 'yes';
  });
  const selected = scatterData.filter((d) => d.bvid === selectedBvid);

  const series: Array<Record<string, unknown>> = [
    // 路线
    {
      type: 'lines',
      coordinateSystem: 'geo',
      polyline: false,
      data: [{ coords: routeCoords }],
      lineStyle: { color: '#ff9800', width: 2, opacity: 0.7, curveness: 0.1 },
      effect: { show: routeCoords.length > 1, period: 6, trailLength: 0.3, symbolSize: 4 },
      zlevel: 1,
    },
    // 有渔获+高置信
    {
      type: 'effectScatter',
      coordinateSystem: 'geo',
      data: catchHigh.map((d) => ({ ...d, symbolSize: 12 })),
      symbol: 'circle',
      itemStyle: { color: '#4caf50', borderColor: '#2e7d32', borderWidth: 1.5 },
      zlevel: 2,
    },
    // 有渔获+低置信
    {
      type: 'effectScatter',
      coordinateSystem: 'geo',
      data: catchLow.map((d) => ({ ...d, symbolSize: 11 })),
      symbol: 'emptyCircle',
      itemStyle: { color: '#81c784', borderColor: '#81c784', borderWidth: 2, borderType: 'dashed' },
      zlevel: 2,
    },
    // 未知
    {
      type: 'effectScatter',
      coordinateSystem: 'geo',
      data: unknown.map((d) => ({ ...d, symbolSize: 10 })),
      symbol: 'circle',
      itemStyle: { color: '#9e9e9e', borderColor: '#757575', borderWidth: 1 },
      zlevel: 2,
    },
    // 空军
    {
      type: 'effectScatter',
      coordinateSystem: 'geo',
      data: skunked.map((d) => ({ ...d, symbolSize: 11 })),
      symbol: 'triangle',
      itemStyle: { color: '#ef5350', borderColor: '#c62828', borderWidth: 1.5 },
      zlevel: 2,
    },
    // 选中高亮
    {
      type: 'effectScatter',
      coordinateSystem: 'geo',
      data: selected.map((d) => ({ ...d, symbolSize: 18 })),
      symbol: 'circle',
      itemStyle: { color: '#ffffff', borderColor: '#ff9800', borderWidth: 3 },
      rippleEffect: { brushType: 'stroke', scale: 3 },
      zlevel: 3,
    },
  ];

  // 自适应视口
  const bounds = mapViewport?.bounds;
  const geoOption: Record<string, unknown> = {
    map: '',
    roam: true,
    center: mapViewport?.center ?? [111, 30.5],
    zoom: mapViewport?.zoom ?? 6,
    itemStyle: { areaColor: '#1a1a2e', borderColor: '#333355', borderWidth: 1 },
    emphasis: { itemStyle: { areaColor: '#252540' }, label: { show: false } },
  };

  return {
    backgroundColor: '#0f0f1a',
    geo: geoOption,
    series,
    tooltip: {
      trigger: 'item',
      formatter: (p: { name?: string; data?: { value: unknown[] } }) => {
        const v = p.data?.value?.[2] as VideoRecord | undefined;
        if (!v) return p.name ?? '';
        const status = v.fishing.caught === 'yes' ? '✅ 有渔获'
          : v.fishing.isSkunked === 'yes' ? '❌ 空军' : '❓ 未知';
        const conf = v.location.confidence === 'high' ? '🟢'
          : v.location.confidence === 'medium' ? '🟡' : '🔴';
        return `${conf} ${v.title.slice(0, 30)}<br/>${v.location.label}<br/>${status}`;
      },
    },
  };
}
```

- [ ] **Step 2: 更新 MapPanel.tsx 引用**

移除 `HUBEI_MAP_NAME` 导出。需要同步更新 MapPanel（下个任务）。

- [ ] **Step 3: Commit**

```bash
git add src/lib/echartsMap.ts
git commit -m "feat(echartsMap): rewrite for national adaptive viewport, remove Hubei GeoJSON dependency

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 18: 重写 `src/components/MapPanel.tsx`

**Files:**
- Modify: `src/components/MapPanel.tsx`

- [ ] **Step 1: 移除湖北 GeoJSON 加载，改为纯 geo 模式**

```tsx
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { ECharts } from 'echarts';
import type { AdminAreaStats } from '../lib/adminStats';
import { buildJourneyMapOption } from '../lib/echartsMap';
import type { VideoRecord } from '../types';

interface MapPanelProps {
  videos: VideoRecord[];
  selectedBvid: string;
  onSelectVideo: (bvid: string) => void;
  routePolyline: [number, number][];
  mapViewport?: { center: [number, number]; zoom: number; bounds: { west: number; south: number; east: number; north: number } };
}

export function MapPanel({
  videos, selectedBvid, onSelectVideo, routePolyline, mapViewport,
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);

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
    if (!chartRef.current) return;
    chartRef.current.setOption(
      buildJourneyMapOption({ videos, selectedBvid, routePolyline, mapViewport, areaStats: [] }),
      true,
    );
  }, [videos, selectedBvid, routePolyline, mapViewport]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const handleClick = (params: unknown) => {
      const item = params as { componentSubType?: string; data?: { bvid?: string } };
      if (item.data?.bvid) onSelectVideo(item.data.bvid);
    };
    chart.on('click', handleClick);
    return () => { chart.off('click', handleClick); };
  }, [onSelectVideo]);

  return (
    <section className="map-stage echarts-map-stage">
      <div ref={containerRef} className="echarts-map" aria-label="游钓旅程地图" />
    </section>
  );
}
```

- [ ] **Step 2: 更新 `App.tsx` 中 MapPanel 的 props**

移除 `selectedAreaKey`、`areaStats`、`onSelectArea` 传参（地图不再支持区域点击），新增 `mapViewport`：

```tsx
<MapPanel
  videos={filteredVideos}
  selectedBvid={selectedVideo?.bvid ?? ''}
  onSelectVideo={handleSelectVideo}
  routePolyline={summary.routePolyline}
  mapViewport={summary.mapViewport}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MapPanel.tsx src/App.tsx
git commit -m "feat(MapPanel): switch to pure geo mode, remove Hubei GeoJSON dependency

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 阶段 6：详情面板改造

### Task 19: 重写 `src/components/DetailPanel.tsx` — 证据解释面板

**Files:**
- Modify: `src/components/DetailPanel.tsx`

- [ ] **Step 1: 新增证据来源标注、候选列表和评论证据展示**

保留现有天气/时间/晚餐/购物/钓鱼理论/渔获/画面证据卡片，新增以下区域：

（在 "渔获信息" 卡片之前插入）

```tsx
{/* 地点最终结果 */}
<div className="detail-card">
  <h3>📍 最终地点</h3>
  <p className="location-label">{video.location.label}</p>
  <p className="muted">
    {[
      video.location.province,
      video.location.prefecture,
      video.location.county,
      video.location.poi,
    ].filter(Boolean).join(' > ') || '未明确'}
  </p>
  <p className={`confidence-tag confidence-${video.location.confidence}`}>
    置信度：{video.location.confidence === 'high' ? '🟢 高' : video.location.confidence === 'medium' ? '🟡 中' : video.location.confidence === 'low' ? '🔴 低' : '⚪ 未知'}
  </p>
</div>

{/* 地点证据来源 */}
{video.location.evidence.length > 0 && (
  <div className="detail-card">
    <h3>🔍 地点证据</h3>
    <ul className="evidence-detail-list">
      {video.location.evidence.map((item, i) => (
        <li key={i} className={`evidence-item evidence-source-${item.source}`}>
          <span className="evidence-source-badge">{formatSource(item.source)}</span>
          <span className="evidence-quote">{item.quote}</span>
        </li>
      ))}
    </ul>
  </div>
)}
```

辅助函数：

```tsx
function formatSource(source: string): string {
  const map: Record<string, string> = {
    meta: '📋 元数据',
    subtitle: '📝 字幕',
    asr: '🎙️ ASR',
    frame_ocr: '📷 OCR',
    frame_visual: '🖼️ 画面',
    comment: '💬 评论',
    'sequence-inference': '🔗 顺序推断',
    manual_override: '✅ 人工修正',
  };
  return map[source] ?? source;
}
```

- [ ] **Step 2: 更新证据摘录区**

在现有证据列表末尾追加评论相关证据引用。

- [ ] **Step 3: Commit**

```bash
git add src/components/DetailPanel.tsx
git commit -m "feat(DetailPanel): add evidence source badges and location hierarchy display

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 20: 更新 `src/components/TimelineBar.tsx` — 置信度标记

**Files:**
- Modify: `src/components/TimelineBar.tsx`

- [ ] **Step 1: 在卡片上增加置信度视觉标记**

在每条视频卡片的标题区域增加低置信度标记。检查现有 TimelineBar 代码，找到渲染 `video.location` 的位置，增加：

```tsx
{/* 在地点显示行 */}
<span className="timeline-location">
  {video.location.prefecture ?? video.location.city ?? '未知地点'}
  {video.location.confidence === 'low' && (
    <span className="confidence-warn" title="低置信度">⚠️</span>
  )}
  {video.location.confidence === 'unknown' && (
    <span className="confidence-warn" title="未知置信度">❓</span>
  )}
</span>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TimelineBar.tsx
git commit -m "feat(TimelineBar): add confidence markers on video cards

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 21: 更新 `src/App.tsx` — 副标题和文案

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 更新标题屏文案**

将 `<p className="title-subtitle">Field Journal · 湖北篇</p>` 改为动态：

```tsx
const subtitle = summary
  ? `最新 ${summary.totalVideos} 期 · ${summary.coveredPrefectures} 个地级市`
  : 'Field Journal';

// 在 title-screen 渲染中:
<p className="title-subtitle">{subtitle}</p>
```

- [ ] **Step 2: 更新描述文案**

将 "湖北篇" 相关的硬编码文字去掉。

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "fix(App): dynamic subtitle based on actual data coverage

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 阶段 7：验证与收尾

### Task 22: 运行数据重建验证

- [ ] **Step 1: 运行 rebuild**

```bash
cd /Users/songdc/ABCD/laohuang && npm run data:rebuild 2>&1
```

预期：成功输出 `Rebuilt N videos from raw artifacts.` 和数据质量报告。

- [ ] **Step 2: 检查输出文件**

```bash
ls -la public/data/videos.json public/data/journey.json
cat public/data/journey.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'videos: {d[\"totalVideos\"]}, prefectures: {d[\"coveredPrefectures\"]}')"
```

预期：prefectures > 0（如果数据中有地级市信息）。

- [ ] **Step 3: 抽查 intel.json**

```bash
ls raw/videos/*/intel.json 2>/dev/null | head -5
cat raw/videos/BV12cwjzCExF/intel.json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'bvid: {d[\"bvid\"]}, candidates: {len(d[\"candidates\"][\"locations\"])}, conflicts: {len(d[\"conflicts\"])}')"
```

---

### Task 23: 运行前端构建验证

- [ ] **Step 1: TypeCheck**

```bash
cd /Users/songdc/ABCD/laohuang && npm run typecheck 2>&1
```

预期：0 errors。

- [ ] **Step 2: Build**

```bash
cd /Users/songdc/ABCD/laohuang && npm run build 2>&1
```

预期：build 成功。

---

### Task 24: 运行开发服务器验证

- [ ] **Step 1: 启动 dev server**

```bash
cd /Users/songdc/ABCD/laohuang && npm run dev 2>&1 &
```

- [ ] **Step 2: 浏览器检查**

打开 `http://localhost:5173`，检查：
1. 地图渲染（不再是湖北底图，自适应视口）
2. 点位颜色（绿/灰/红）
3. 路线显示
4. 点击视频打开详情面板
5. 详情面板显示地点证据来源

- [ ] **Step 3: 提交最终 commit**

```bash
git add -A
git commit -m "chore: final verification and cleanup for latest-20 intel map

Co-Authored-By: Claude <noreply@anthropic.com>"
```

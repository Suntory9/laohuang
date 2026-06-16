# 最新 20 期游钓视频情报地图 — 设计文档

日期：2026-06-16
状态：已确认
上游需求：`docs/latest-20-video-intel-map-requirements.md`

## 1. 总体策略

**渐进式管线升级**：严格按 7 阶段执行，每阶段产出可独立验证的中间结果。数据层优先，前端改造在后。

```
阶段 1: 数据窗口 + 质量报告
阶段 2: 评论缓存 (fetch-comments.mjs)
阶段 3: 评论信号提取 (comment-extractors.mjs)
阶段 4: 推断重构 (intel-builder + location-candidates + evidence-scoring)
阶段 5: 地图改造 (湖北 → 全国自适应)
阶段 6: 详情页改造 (结果展示 → 证据解释)
阶段 7: 验证收尾
```

## 2. 类型系统升级 (`src/types.ts`)

### 2.1 EvidenceSource 扩展

```ts
export type EvidenceSource =
  | 'meta'
  | 'subtitle'
  | 'asr'
  | 'frame_ocr'
  | 'frame_visual'
  | 'comment'
  | 'sequence-inference'
  | 'manual_override'
  | string; // 保留向后兼容
```

### 2.2 EvidenceItem 增强

```ts
export interface EvidenceItem {
  source: EvidenceSource;
  quote: string;
  timestamp?: string;
  weight?: number;   // 新增：证据权重
  ref?: string;       // 新增：引用标识（如评论 rpid）
}
```

### 2.3 新增类型

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
  prefecture: string | null;  // 地级市/州
  county: string | null;       // 县/市辖区/县级市
  poi: string | null;          // 具体地点
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

### 2.4 LocatedEntity 字段升级

保留旧字段 `city`/`district` 作为 deprecated alias，新增 `prefecture`/`county`：

```ts
export interface LocatedEntity {
  label: string;
  province: string | null;
  /** @deprecated 使用 prefecture */
  city: string | null;
  /** @deprecated 使用 county */
  district: string | null;
  prefecture: string | null;  // 地级市/州
  county: string | null;       // 县/市辖区/县级市
  poi: string | null;
  lat: number | null;
  lng: number | null;
  confidence: Confidence;
  evidence: EvidenceItem[];
}
```

### 2.5 JourneySummary.cityStops → prefectureStops

```ts
prefectureStops: Array<{ prefecture: string; count: number; lat: number | null; lng: number | null }>;
```

## 3. 数据管线

### 3.1 新增脚本

| 文件 | 职责 |
|------|------|
| `scripts/fetch-comments.mjs` | 调用 `opencli bilibili comments` 分页拉取评论 → `comments.json` |
| `scripts/lib/comment-extractors.mjs` | 从评论中提取地名/鱼种/路线/纠错信号 → `comment-evidence.json` |
| `scripts/lib/location-candidates.mjs` | 多源合并 + 打分排序 → `LocationCandidate[]` |
| `scripts/lib/evidence-scoring.mjs` | 统一证据打分逻辑 |
| `scripts/lib/intel-builder.mjs` | 组装 `VideoIntel` → `intel.json` |

### 3.2 评论抓取 (`fetch-comments.mjs`)

- 后端：`opencli bilibili comments <bvid> --limit 50 -f json`
- 每期目标 100-300 条（分多次调用，利用 B 站 API 分页）
- 缓存到 `raw/videos/<bvid>/comments.json`
- 失败不阻塞已有数据重建，记录失败原因
- `--site-session persistent` 复用浏览器登录态

### 3.3 评论信号提取 (`comment-extractors.mjs`)

从评论文本提取四类信号：
- **locationMentions**：正则匹配 `(这里是|这个地方叫|本地人|就在|坐标是)` + 地名
- **fishMentions**：正则匹配鱼种名 + 数量/重量
- **routeMentions**：`(从.*到|上一期.*这一期|应该是.*附近)` 等路线表达
- **correctionMentions**：`(不是|这不是|纠正|错了|明明)` 等纠错表达

可信度规则：
- 点赞数越高权重越高
- 「本地人」「这里是」等表达加权
- 多条评论重复同一地点加权
- 与标题/字幕/OCR 一致加权
- 与其他证据矛盾时进入冲突列表

### 3.4 地点候选打分 (`location-candidates.mjs`)

多源合并排序：

| 来源 | 基础权重 |
|------|---------|
| 标题明确地名 | 100 |
| 字幕多次出现 | 80 |
| OCR 路牌/桥名/镇名 | 70 |
| 评论多人重复 | 60 |
| 前后视频顺序推断 | 30 |
| 人工修正 | 最高优先 |

流程：
1. 收集所有来源候选（标题/字幕/OCR/评论/前后视频/人工修正）
2. 去重合并（同 label 或相近坐标合并 evidence）
3. 加权打分排序
4. 最高分作为 final.location，保留 Top 3 候选
5. 人工修正直接覆盖最终结果

### 3.5 地理解析

方案：手动扩展 Gazetteer + Nominatim 混合。

- 对新视频中出现的地名，先用 Nominatim 做一次性批量解析
- 沉淀到 `locationGazetteer`（扩展为全国版）
- 后续推断走本地词库匹配
- Gazetteer 格式升级为 `province/prefecture/county/poi` 四层结构

### 3.6 Pipeline 数据流

```
pipeline.mjs
  ├─ opencli bilibili video → meta.json
  ├─ opencli bilibili subtitle → .srt / transcript.txt
  │   (无字幕: bili audio + whisper ASR)
  ├─ visual-analysis.mjs → visual-evidence.json (现有)
  ├─ fetch-comments.mjs → comments.json              [新增]
  ├─ comment-extractors.mjs → comment-evidence.json  [新增]
  ├─ intel-builder.mjs → intel.json                  [新增]
  │     ├─ location-candidates.mjs
  │     └─ evidence-scoring.mjs
  ├─ build-record.mjs → VideoRecord (final 取自 intel)
  ├─ refine-videos.mjs (保留顺序推断)
  ├─ aggregate.mjs → journey.json + videos.json
  └─ 数据质量报告 → stdout
```

### 3.7 数据质量报告

Pipeline 完成后输出：

```
视频总数: N
字幕数: N
ASR 数: N
有坐标视频数: N
低置信地点数: N
unknown 鱼获数: N
unknown 空军数: N
评论抓取成功数: N
```

### 3.8 人工修正层

- 文件：`data/overrides/videos.json`
- 格式：按 bvid 索引，覆盖 location/fishing/species/route 等字段
- 优先级最高，但保留原始候选和证据

## 4. 前端改造

### 4.1 地图 (`MapPanel.tsx`)

**从湖北地图 → 全国自适应路线地图：**

- 去掉 `fetch('/maps/hubei-prefecture.json')` 和 `echarts.registerMap`
- 改为纯 `geo` 坐标系，视口由 `JourneySummary.mapViewport` 自动适配
- 保留 `lines` 系列绘制时间路线
- 视频点位 `effectScatter`，颜色/形态按状态编码：

| 状态 | 颜色 | 形态 |
|------|------|------|
| 有渔获 + 高/中置信 | `#4caf50` 绿 | 实心圆 |
| 有渔获 + 低置信 | `#81c784` 浅绿 | 空心虚线圆 |
| 未知 | `#9e9e9e` 灰 | 实心圆 |
| 空军 | `#ef5350` 红 | 空心三角 |
| 选中 | `#ffffff` 白 | 放大 + 光晕 |

- 保留点击散点触发 `onSelectVideo`
- 移除行政区点击（不再注册区域地图）

### 4.2 详情面板 (`DetailPanel.tsx`)

升级为证据解释面板，新增区域：

- **地点最终结果**：显示 final location
- **地点候选 Top 3**：每个候选标注来源（标题/字幕/OCR/评论/顺序推断/人工修正）和分数
- **评论补充**：高可信度评论引用，标注用户名和点赞数
- **冲突提示**：评论与规则推断矛盾时黄色警告
- **保留**：天气、时间、晚餐、购物、钓鱼理论、渔获、画面证据、B站链接

### 4.3 其他组件

- **`TimelineBar.tsx`**：卡片增加置信度标记（低置信虚线边框）
- **`App.tsx`**：过滤字段从 `city` 切到 `prefecture`；标题副标题动态生成
- **`Filters.tsx`**：城市过滤 → 地级市过滤
- **`lib/adminStats.ts`**：`buildPrefectureStats` 适配新字段

## 5. 文件变更清单

### 新增文件

```
scripts/fetch-comments.mjs
scripts/lib/comment-extractors.mjs
scripts/lib/location-candidates.mjs
scripts/lib/evidence-scoring.mjs
scripts/lib/intel-builder.mjs
data/overrides/videos.json          (模板)
```

### 修改文件

```
src/types.ts                        (类型系统升级)
src/App.tsx                         (prefecture 过滤)
src/components/MapPanel.tsx         (全国自适应地图)
src/components/DetailPanel.tsx      (证据解释面板)
src/components/TimelineBar.tsx      (置信度标记)
src/components/Filters.tsx          (prefecture 过滤)
src/components/TopBar.tsx           (动态标题)
src/lib/adminStats.ts              (prefecture 统计)
src/lib/echartsMap.ts              (新地图 option)
src/lib/format.ts                  (新增格式化函数)
scripts/pipeline.mjs               (接入评论+intel流程)
scripts/rebuild-from-raw.mjs       (同步升级)
scripts/lib/build-record.mjs       (intel 接入)
scripts/lib/aggregate.mjs          (prefecture 统计)
scripts/lib/refine-videos.mjs      (适配新字段)
scripts/lib/extractors.mjs         (Gazetteer 扩展+字段升级)
```

### 不删除

```
public/maps/hubei-prefecture.json   (保留但不加载)
scripts/lib/route-inference.mjs     (保留备用)
scripts/lib/visual-analysis.mjs     (保留作为候选源)
```

## 6. 验收标准

- `public/data/videos.json` 包含最新 20 期视频
- 每期视频有 `raw/videos/<bvid>/meta.json`
- ≥80% 视频有字幕或 ASR 文本
- ≥80% 视频有 `comments.json` 缓存，失败的记录原因
- 每期生成 `intel.json`（候选列表 + 最终结果）
- 地图展示最新 20 期点位和路线，颜色区分鱼获/置信度
- 详情面板展示证据来源和评论补充
- `npm run build` 通过

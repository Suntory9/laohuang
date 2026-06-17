# 最新 20 期游钓视频情报地图需求与开发说明

日期：2026-06-16

项目路径：`/Users/songdc/ABCD/laohuang`

## 1. 背景

当前项目「老黄游钓中国旅程图谱」已经具备 React + Vite 静态前端、ECharts 地图、离线数据生成脚本和部分原始视频资料缓存。现有实现主要围绕「湖北篇」展开，地图底图使用 `public/maps/hubei-prefecture.json`，数据规则也偏向湖北地名。

新的产品方向不再限定湖北。第一阶段目标改为分析合集中的「最新 20 期视频」，综合 B 站元数据、字幕、ASR、画面 OCR、评论和本地规则，推断每期视频的地点、路线、鱼获、天气、做饭、购物等信息，并在静态前端地图上按时间顺序展示。

地图不是唯一目标。核心目标是为每期视频建立「多来源证据档案」，再从证据中得到可解释的地图点、路线和视频信息。

## 2. 当前项目状态

### 2.1 已完成能力

- 前端使用 React 19、TypeScript、Vite 7。
- 地图组件已经切到 ECharts，入口位于 `src/components/MapPanel.tsx`。
- 数据结构集中在 `src/types.ts`，核心对象为 `VideoRecord` 和 `JourneySummary`。
- 数据管线位于 `scripts/`：
  - `pipeline.mjs`：抓取合集、元数据、字幕或 ASR，生成前端 JSON。
  - `rebuild-from-raw.mjs`：从 `raw/videos/` 重建前端数据。
  - `lib/extractors.mjs`：规则抽取地点、天气、鱼获、购物、做饭等信息。
  - `lib/visual-analysis.mjs`：抽帧、OCR、画面标签推断。
  - `lib/route-inference.mjs`：路线增强模块，当前未接入主流程。
- `npm run build` 已验证通过。

### 2.2 已知问题

- 当前产物只有 20 条视频，但目标语义仍偏湖北。
- 地图底图绑定湖北市州 GeoJSON，不适合最新 20 期跨省路线。
- 地名模型混用行政层级，例如 `长阳` 被放入 `location.city`，同时又在前端被归到 `宜昌市`。
- 鱼获和空军字段存在较多 `unknown`。
- `route-inference.mjs` 没有接入 `pipeline.mjs` 和 `rebuild-from-raw.mjs`。
- 当前推断主要依赖标题、字幕和少量画面信号，尚未正式使用 B 站评论。
- 缺少人工修正层，规则误判后不容易稳定修正。

## 3. 第一阶段目标

第一阶段只做「最新 20 期视频」的完整流程，不直接追求全量合集。

目标描述：

> 抓取老黄合集最新 20 期视频，综合标题、字幕或 ASR、画面 OCR、B 站评论和本地推断规则，生成每期视频的证据档案，推断地点、路线、鱼获、天气和故事事件，并在静态地图上展示视频点位、时间路线、鱼获状态和证据详情。

### 3.1 必须支持

- 选择合集最新 20 期视频作为数据窗口。
- 每期视频缓存原始资料到 `raw/videos/<bvid>/`。
- 每期视频生成结构化证据档案。
- 地点推断支持跨省，不再依赖湖北地名词库。
- 地图展示视频点位和时间路线。
- 点位颜色或形态体现鱼获状态和地点置信度。
- 详情面板展示证据来源，包括标题、字幕、ASR、OCR、评论和人工修正。
- 评论作为正式证据源参与地点、鱼种、路线和纠错判断。
- 前端保持静态部署，不依赖运行时后端服务。

### 3.2 暂不支持

- 不做全量 245 期处理。
- 不做全国行政区统计看板。
- 不做道路级精确导航复原。
- 不做自动发布和定时更新。
- 不做复杂 LLM Agent 工作流，优先使用本地脚本、缓存和可审计规则。

## 4. 数据来源

### 4.1 视频元数据

来源：B 站视频详情。

缓存文件：

```text
raw/videos/<bvid>/meta.json
```

用途：

- 标题
- 发布时间
- 视频时长
- 封面图
- 简介
- BVID / AID
- 播放、点赞、投币、收藏等互动数据
- 合集顺序

### 4.2 字幕与 ASR

优先使用 B 站官方或 AI 字幕。无字幕时下载音频并使用本地 ASR。

缓存文件：

```text
raw/videos/<bvid>/<bvid>.ai-zh.srt
raw/videos/<bvid>/transcript.txt
```

用途：

- 地点提及
- 行进路线
- 鱼种和鱼获
- 空军判断
- 天气和水情
- 做饭和购物
- 时间线事件

### 4.3 画面证据

通过抽帧、OCR 和简单画面标签得到。

缓存文件：

```text
raw/videos/<bvid>/visual-evidence.json
public/frames/<bvid>/
```

用途：

- 路牌、店招、地名牌 OCR
- 河流、水库、桥梁、镇名等画面线索
- 鱼特写
- 做饭、买菜、露营、雨具等场景判断

### 4.4 B 站评论

评论是新增重点来源。评论不能直接作为事实，但可以作为「民间证据」。观众经常补充或纠正：

- 具体地名：例如「这里是某县某镇」
- 河流或钓点：例如「这是清江某段」
- 鱼种：例如「这个不是鲫鱼，是马口」
- 路线：例如「上一期还在某地，这期应该到某地了」
- 本地人纠错：例如「本地人表示这里不是某地」

缓存文件：

```text
raw/videos/<bvid>/comments.json
raw/videos/<bvid>/comment-evidence.json
```

抓取策略：

- 优先复用浏览器登录态或现有 B 站工具获取评论。
- 若工具不支持评论，使用 B 站公开 reply API，基于视频 `aid` 抓取热评和最新评论。
- 第一阶段每期建议抓取 100 至 300 条评论。
- 评论抓取结果必须缓存，避免重复请求。
- 评论时间、点赞数、楼层关系、用户昵称和原文都要保留。

### 4.5 人工修正

规则和评论都可能出错，需要单独的人工修正层。

建议文件：

```text
data/overrides/videos.json
```

用途：

- 覆盖最终地点
- 覆盖鱼获状态
- 覆盖鱼种
- 标记错误评论
- 标记确认过的路线
- 写入人工备注

人工修正优先级最高，但必须保留原始候选和证据。

## 5. 目标数据模型

现有 `VideoRecord` 可以继续作为前端最终展示模型，但数据管线需要新增「候选与证据层」。建议新增中间模型，不直接把所有不确定信息写死到 `VideoRecord`。

### 5.1 证据项

```ts
type EvidenceSource =
  | 'meta'
  | 'subtitle'
  | 'asr'
  | 'frame_ocr'
  | 'frame_visual'
  | 'comment'
  | 'sequence_inference'
  | 'manual_override';

interface EvidenceItem {
  source: EvidenceSource;
  quote: string;
  timestamp?: string;
  weight?: number;
  ref?: string;
}
```

### 5.2 评论证据

```ts
interface CommentEvidence {
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
```

评论可信度建议规则：

- 点赞数越高，权重越高。
- 出现「本地人」「这里是」「这个地方叫」等表达，加权。
- 多条评论重复同一地点，加权。
- 与标题、字幕、OCR 一致，加权。
- 与其他证据矛盾时，不直接覆盖最终结论，进入冲突列表。

### 5.3 候选地点

```ts
interface LocationCandidate {
  label: string;
  province: string | null;
  prefecture: string | null;
  county: string | null;
  poi: string | null;
  lat: number | null;
  lng: number | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  score: number;
  evidence: EvidenceItem[];
}
```

行政层级建议统一为：

- `province`：省级，例如 `湖北省`、`湖南省`。
- `prefecture`：地级市或州，例如 `宜昌市`、`恩施土家族苗族自治州`。
- `county`：县、市辖区、县级市，例如 `长阳土家族自治县`、`利川市`。
- `poi`：具体地点，例如 `清江`、`龙舟坪镇`、`谋道镇`。

不要再把 `长阳` 直接作为 `city` 使用。

### 5.4 视频情报中间结果

```ts
interface VideoIntel {
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

`final` 用于前端主展示，`candidates` 和 `conflicts` 用于详情页解释。

## 6. 推断策略

### 6.1 地点推断

地点推断不应只靠单条正则命中。建议改为候选排序：

```text
标题证据
+ 字幕 / ASR 证据
+ OCR 证据
+ 评论证据
+ 前后视频顺序推断
+ 人工修正
= 地点候选列表
```

第一阶段可采用规则打分，不必引入复杂模型。

基础规则：

- 标题中明确地名权重较高。
- 字幕多次出现同一地名权重较高。
- OCR 识别到路牌、桥名、镇名，权重较高。
- 评论中多人重复的地名，作为候选加权。
- 前后视频地点相近时，低置信补全缺失地点。
- 人工修正直接确定最终地点。

### 6.2 路线推断

路线第一阶段表达「视频顺序上的移动」，不表达真实行车轨迹。

建议：

- 每期视频产生一个最终点位。
- 按 `sequenceIndex` 连线。
- 同地点连续视频不重复拉长路线。
- 如果评论或字幕明确提到「从 A 到 B」，生成 `routeSegments` 候选。
- `route-inference.mjs` 可作为增强模块接入，但不是第一阶段必要条件。

### 6.3 鱼获推断

鱼获字段至少包含：

- 是否有鱼获：`yes` / `no` / `unknown`
- 是否空军：`yes` / `no` / `unknown`
- 鱼种列表
- 数量或重量文本
- 证据来源
- 置信度

评论在鱼种识别上价值较高，但遇到争议时需要进入冲突列表。

### 6.4 故事事件

每期视频可以提取若干故事事件，用于详情页和地图弹窗。

示例：

- 到达某地
- 找废弃房
- 冒雨前行
- 买菜
- 做饭
- 开钓
- 中鱼
- 空军
- 转场

第一阶段只需要规则提取，不需要复杂摘要。

## 7. 前端展示要求

### 7.1 地图

湖北市州地图需要降级为可选展示，不再作为主地图。

第一阶段推荐地图方案：

- 使用全国或通用 GeoJSON 底图。
- 或者只使用 ECharts `geo` + 点线图，视口根据最新 20 期坐标自动适配。
- 主视觉展示时间路线、视频点位和当前选中视频。

点位编码建议：

- 绿色：有明确鱼获。
- 灰色：未知。
- 红色或空心：空军。
- 虚线描边：地点低置信。
- 高亮：当前选中视频。

### 7.2 时间线

按最新 20 期的合集顺序或发布时间展示。

每条卡片至少展示：

- 期数或序号
- 标题
- 发布时间
- 推断地点
- 鱼获状态
- 地点置信度

### 7.3 详情面板

详情面板应从「结果展示」升级为「证据解释」。

至少展示：

- 最终地点
- 地点候选 Top 3
- 地点证据来源
- 鱼获判断和鱼种
- 评论补充
- 冲突提示
- 原始视频链接

### 7.4 质量提示

前端需要让不确定性可见：

- 低置信地点不能和高置信地点展示成同一种状态。
- `unknown` 鱼获不能误展示成空军。
- 评论推断必须标明来自评论。
- 人工修正必须标明已人工确认。

## 8. 文件与目录建议

新增或调整：

```text
data/
  overrides/
    videos.json

scripts/
  fetch-comments.mjs
  lib/
    comment-extractors.mjs
    intel-builder.mjs
    location-candidates.mjs
    evidence-scoring.mjs

raw/videos/<bvid>/
  comments.json
  comment-evidence.json
  intel.json

public/data/
  videos.json
  journey.json
  intel-index.json
```

保留：

```text
raw/videos/<bvid>/meta.json
raw/videos/<bvid>/transcript.txt
raw/videos/<bvid>/visual-evidence.json
```

## 9. 实施步骤

### 阶段 1：稳定最新 20 期数据窗口

- 明确 `pipeline.mjs` 默认处理最新 20 期。
- 确认排序规则是合集最新 20 期，而不是最早 20 期。
- 输出数据质量报告，至少包含：
  - 视频总数
  - 字幕数
  - ASR 数
  - 有坐标视频数
  - 低置信地点数
  - `unknown` 鱼获数
  - `unknown` 空军数
  - 评论抓取成功数

### 阶段 2：接入评论缓存

- 新增评论抓取脚本。
- 每期视频缓存 `comments.json`。
- 控制抓取频率，避免重复请求。
- 失败时记录原因，不阻塞已有数据重建。

### 阶段 3：提取评论信号

- 从评论中提取地名、鱼种、路线、纠错表达。
- 生成 `comment-evidence.json`。
- 为评论证据计算可信度。

### 阶段 4：重构地点和鱼获推断

- 从「单结果」改为「候选列表 + 最终结果」。
- 接入标题、字幕、OCR、评论、顺序推断和人工修正。
- 输出 `intel.json`。

### 阶段 5：改造地图

- 从湖北地图改为适配最新 20 期的路线地图。
- 路线按最新 20 期顺序绘制。
- 点位展示鱼获状态和地点置信度。

### 阶段 6：改造详情页

- 展示地点候选、证据、评论补充和冲突。
- 保留原始视频信息和字幕摘录。

### 阶段 7：验证与收尾

- 运行 `npm run data:rebuild`。
- 运行 `npm run build`。
- 浏览器检查地图、时间线、详情面板。
- 抽查 3 至 5 条视频，确认证据和最终判断一致。

## 10. 验收标准

第一阶段完成后，应满足：

- `public/data/videos.json` 包含最新 20 期视频。
- 每期视频都有 `raw/videos/<bvid>/meta.json`。
- 至少 80% 视频有字幕或 ASR 文本。
- 至少 80% 视频有评论缓存，评论失败的视频有失败记录。
- 每期视频生成地点候选列表。
- 每期视频生成最终地点，无法确认时明确标记低置信或未知。
- 地图上能看到最新 20 期视频点位和时间路线。
- 点位能区分鱼获、空军、未知和低置信地点。
- 点击视频能查看证据详情。
- `npm run build` 通过。

## 11. 给后续 AI 的执行提示

优先处理数据层，不要先重做视觉设计。当前前端已经可以构建，真正影响产品效果的是证据质量和推断口径。

推荐执行顺序：

1. 先读 `CLAUDE.md`、`src/types.ts`、`scripts/pipeline.mjs`、`scripts/rebuild-from-raw.mjs`。
2. 确认当前 `public/data/videos.json` 是否真的是最新 20 期。
3. 新增评论缓存脚本，并保证可重复运行。
4. 新增数据质量报告，先暴露问题。
5. 再改推断模型和前端展示。

不要直接删除湖北相关文件。湖北地图可以作为旧方案保留，第一阶段只需要让主展示不再依赖湖北底图。

任何自动推断都要保留证据。无法解释的字段不应写入最终展示结果。

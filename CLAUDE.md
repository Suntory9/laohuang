# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概要

老黄游钓中国旅程图谱 — 基于 B 站合集数据、字幕/ASR 转写和本地规则推断生成的静态前端展示页。

- `scripts/`: Node.js 离线数据管线（`.mjs`，ES modules）
- `src/`: React 19 + TypeScript + Vite 7 前端

## 常用命令

```bash
npm install                # 安装依赖
npm run dev                # 启动 Vite 开发服务器 (端口 5173)
npm run build              # 类型检查 + 生产构建
npm run typecheck          # 仅类型检查 (tsc --noEmit)
npm run data:sample        # 生成样例数据 → public/data/*.json
npm run data:pipeline      # 全量数据管线（需要 Chrome 登录 B 站 + yt-dlp）
npm run data:rebuild       # 从已有 raw/videos/ 产物重建 public/data/*.json
npm run preview            # 预览生产构建
```

## 环境变量

- `BILI_SAMPLE_LIMIT`: pipeline 处理最近 N 条视频，默认 `5`
- `BILI_PLAYLIST_URL`: B 站合集地址
- `WHISPER_CLI_PATH` / `WHISPER_MODEL_PATH`: ASR 回退的 whisper-cli 路径和模型
- `FFMPEG_PATH` / `FFPROBE_PATH`: 视觉分析用的 ffmpeg/ffprobe 路径，默认 `ffmpeg` / `ffprobe`
- `TESSERACT_PATH`: 关键帧 OCR 用的 tesseract 路径，默认 `tesseract`（需要安装中文语言包 `chi_sim`）
- `VITE_AMAP_KEY` / `VITE_AMAP_SECURITY_CODE`: 前端地图可选配置（当前后台路线推断不使用高德，使用 OSRM + Nominatim）

配置模板见 `.env.example`。

## 静态资源目录 (`public/`)

- `public/data/journey.json` + `videos.json` — 管线产物，前端唯一数据源
- `public/maps/hubei-prefecture.json` — ECharts 湖北市州 GeoJSON（MapPanel 在挂载时 fetch + `echarts.registerMap()`）
- `public/covers/<bvid>.jpg` — 视频封面图，按 bvid 命名
- `public/frames/` — 可选的逐帧截图（管线 visual analysis 产出）

## 架构

### 数据管线

```
scripts/
  pipeline.mjs              # 主入口：抓合集 → 逐视频抓元数据/字幕/转写 → 提取 → 聚合 → 输出
  rebuild-from-raw.mjs      # 跳过抓取，直接从 raw/videos/<bvid>/ 重建
  generate-sample-data.mjs  # 手工构造 2 条样例数据用于开发演示
  lib/
    extractors.mjs          # 核心：所有 regex + gazetteer 规则提取器（位置、天气、晚餐、买菜、渔获、钓鱼理论等）
    build-record.mjs        # 组装单条 VideoRecord
    aggregate.mjs           # 从 VideoRecord[] 聚合出 JourneySummary
    refine-videos.mjs       # 后处理：利用前后视频推断缺失地点、补全路线
    route-inference.mjs     # 路线推断：利用 OSRM 路径规划 + Nominatim 地理编码在视频间生成道路级 polyline（尚未接入主 pipeline）
    visual-analysis.mjs     # 视觉分析：ffmpeg 提取关键帧 + tesseract OCR + 场景标签推断（露营/做饭/鱼获/路牌/买菜等）
```

管线产物目录：
- `raw/videos/<bvid>/` — meta.json, subtitle.ai-zh.srt, transcript.txt, evidence.json, visual-evidence.json, preview.mp4
- `scripts/.cache/` — route-cache.json, geocode-cache.json（路线推断的 Nominatim/OSRM 缓存）
- `public/data/journey.json` — JourneySummary
- `public/data/videos.json` — VideoRecord[]

字幕获取策略：优先 `ai-zh` 官方字幕 → 无字幕时回退本地 `whisper-cli` 做 ASR 转写。

视觉分析是可选的增强管线：需要 ffmpeg + tesseract 支持。从 B 站下载预览视频 → 场景检测 + 均匀采样 6 帧 → OCR 逐帧文字 → 规则推断场景标签（搭营/做饭/鱼获展示/路牌/天气/买菜）→ 产出 `visual-evidence.json` 和 `public/frames/<bvid>/` 逐帧截图。`route-inference.mjs` 是独立的路线精细化模块（OSRM 驾车路径 + Nominatim 地理编码），当前尚未接入 `pipeline.mjs`。

### 前端

```
src/
  types.ts                  # 所有类型定义 (VideoRecord, JourneySummary 及其子类型)
  main.tsx                  # 入口：挂载 <App /> 到 #root
  App.tsx                   # 根组件：加载 JSON 数据、管理 filters/selectedBvid/selectedArea 状态
  lib/
    adminStats.ts           # 行政区名称归一化与市州/县市区统计聚合
    echartsMap.ts           # ECharts 湖北地图 option 构造
    format.ts               # 格式化工具（日期/时长/金额/置信度）
  components/
    TopBar.tsx              # 顶部栏：品牌标识 + Filters 过滤 UI + 统计摘要（覆盖城市/累计买菜/空军次数）
    MapPanel.tsx            # ECharts 静态湖北旅程地图：行政区、路线、视频点位
    AreaStoryPanel.tsx      # 行政区地点故事面板：统计摘要 + 区域内视频列表
    TimelineBar.tsx         # 视频时间线列表：封面 + 标题 + 地点 + 天气/渔获标签
    DetailPanel.tsx         # 详情面板：单条视频的完整剖面（地点/天气/时间/晚餐/买菜/钓鱼理论/渔获/证据）
    Filters.tsx             # FiltersState 类型定义（7 维过滤状态：关键词、城市、天气、渔获、空军、买菜、钓鱼理论）
styles.css                  # 全部样式（暗色暖调主题、响应式断点 1280px/720px）
```

地图资源：ECharts 运行时读取 `public/maps/hubei-prefecture.json`，构建后的站点只需要静态文件服务，不需要地图 API Key。

数据流：`App` 启动时 fetch `public/data/journey.json` + `public/data/videos.json` → 存入 state → 经 `Filters` 筛选用 `useMemo` 计算 `filteredVideos` 和行政区统计 → 分发到 `MapPanel`、`AreaStoryPanel`、`TimelineBar`、`DetailPanel`。选中视频通过 `selectedBvid` 在各面板间同步，选中行政区通过 `selectedAreaKey` 驱动地点故事面板。`TopBar` 接收 cities/weatherTags/theoryTags 去重列表渲染过滤 UI，同时展示 JourneySummary 中的关键统计数字。

地图加载：`MapPanel` 挂载时 fetch `public/maps/hubei-prefecture.json` → `echarts.registerMap('hubei-prefecture', geoJson)` → 注册成功后 `setMapReady(true)` 触发 chart option 更新。点击散点触发 `onSelectVideo`，点击行政区触发 `onSelectArea`。

### 关键类型 (src/types.ts)

TypeScript 编译配置较严格：`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch` 均开启，新增代码须确保无未使用变量和参数。

`VideoRecord` 是最核心的数据结构，包含 `location`、`weather`、`route`、`timeSpan`、`dinner`、`shopping`、`fishingTheory`、`fishing` 八个子对象，每个都带有 `confidence` 等级和 `evidence` 证据链。`JourneySummary` 是全量聚合统计。

`VisualAnalysis` / `VisualFrame` / `VisualSignals` 是可选的可视化分析层，存储逐帧 OCR 文本、场景标签（露营/做饭/鱼获特写/路牌/雨具/买菜场景），通过 `VideoRecord.visualAnalysis` 可选字段接入。

`RouteInfo.method` 区分三种来源：`explicit`（字幕中明确提到从 A 到 B）、`inferred-sequential`（前后视频位置推断）、`none`（无路线数据）。

### 提取规则设计 (scripts/lib/extractors.mjs)

所有信息抽取都是基于 regex + 硬编码词表的规则匹配，不做 NLP/ML。包括：
- 地点：`locationGazetteer` 硬编码湖北各地名及其经纬度，通过别名匹配
- 天气：7 组正则模式（下雨/强降雨/弱降雨/刮风/降温/晴天/阴天）
- 购物花费：金额正则 + 上下文验证 + 品类推断
- 渔获/空军：信号提取 + 第三人称上下文过滤
- 路线：`refine-videos.mjs` 后处理，对 route 为 `none` 的视频用前后视频位置推断 sequential route，最终合成 `JourneySummary.routePolyline`（扁平 `[lng, lat][]` 数组，供 ECharts lines 系列渲染）

## Agent skills

### Issue tracker

GitHub Issues on `Suntory9/laohuang` — use the `gh` CLI for all operations. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` at the root, one `docs/adr/` directory. See `docs/agents/domain.md`.

## Claude Code 配置

项目 `.claude/` 目录下安装了大量 superpowers 技能（TDD、debugging、code-review、brainstorming 等），通过 `Skill` 工具调用。`settings.local.json` 预授权了常用命令（`npm run *`、`npx tsc`、vite 相关的 kill/curl 等），无需逐次确认。

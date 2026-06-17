# 老黄游钓中国旅程图谱

基于 B 站合集最新 20 期视频，综合标题、字幕/ASR、画面 OCR、B 站评论和本地推断规则生成的静态前端展示页。每期视频建立多来源证据档案，在地图上按时间顺序展示旅程路线、鱼获状态和证据详情。

- `scripts/`: 离线数据管线（Node.js ES modules）
- `src/`: React 19 + TypeScript + Vite 7 前端

## 快速开始

```bash
npm install                # 安装依赖
npm run data:sample        # 生成样例数据 → public/data/*.json
npm run dev                # 启动 Vite 开发服务器 (端口 5173)
```

## 数据管线

### 半自动完整管线

需要 Chrome 登录 B 站账号 + OpenCLI 扩展 + `yt-dlp`：

```bash
npm run data:pipeline
```

### 从已有产物重建

跳过抓取，直接从 `raw/videos/<bvid>/` 产物重建前端 JSON：

```bash
npm run data:rebuild
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `BILI_SAMPLE_LIMIT` | 处理最近 N 条视频 | `5` |
| `BILI_PLAYLIST_URL` | B 站合集地址 | 老黄游钓合集 |
| `WHISPER_CLI_PATH` | whisper-cli 路径 | `/opt/homebrew/bin/whisper-cli` |
| `WHISPER_MODEL_PATH` | Whisper 模型路径 | `tmp/models/ggml-base.bin` |
| `FFMPEG_PATH` / `FFPROBE_PATH` | 视觉分析用 | `ffmpeg` / `ffprobe` |
| `TESSERACT_PATH` | 关键帧 OCR 用 | `tesseract` |
| `VITE_AMAP_KEY` / `VITE_AMAP_SECURITY_CODE` | 前端地图（可选） | — |

## 推断策略

每期视频通过多来源证据候选排序得出最终结论：

```
标题 + 字幕/ASR + 画面OCR + 评论 + 前后视频顺序推断 + 人工修正
                    ↓
              候选列表 (打分排序)
                    ↓
           VideoIntel (候选 + 冲突 + final)
                    ↓
              VideoRecord (前端展示)
```

### 证据来源

| 来源 | 标识 | 权重 | 说明 |
|------|------|------|------|
| 标题 | `meta` | 高 | 标题中明确地名 |
| 字幕 | `subtitle` | 高 | 官方或 AI 字幕 |
| ASR | `asr` | 中 | 本地 Whisper 转写 |
| 画面 OCR | `frame_ocr` | 中 | 路牌、地名牌文字识别 |
| 画面标签 | `frame_visual` | 低 | 场景分类（露营/做饭/鱼获等） |
| 评论 | `comment` | 中 | 观众补充/纠正，按点赞数和多人重复加权 |
| 顺序推断 | `sequence-inference` | 低 | 前后视频地点推断 |
| 人工修正 | `manual_override` | 最高 | `data/overrides/videos.json` |

## 原始产物目录

每条视频在 `raw/videos/<bvid>/` 下输出：

| 文件 | 说明 |
|------|------|
| `meta.json` | 视频元数据（标题、发布时间、互动数据等） |
| `<bvid>.ai-zh.srt` | 官方或 AI 字幕 |
| `transcript.txt` | 字幕或 ASR 转写纯文本 |
| `evidence.json` | 元数据证据摘要 |
| `visual-evidence.json` | 画面抽帧+OCR+场景标签 |
| `comments.json` | B 站评论缓存（100-300 条） |
| `comment-evidence.json` | 评论信号提取结果 |
| `intel.json` | 情报中间结果（候选列表+冲突+最终结论） |
| `preview.mp4` | 预览视频片段（视觉分析用） |

## 前端组件

| 组件 | 说明 |
|------|------|
| `TopBar` | 品牌标识 + 过滤 UI（地级市/天气/鱼获/空军/买菜/钓理）+ 统计摘要 |
| `MapPanel` | ECharts 全国自适应地图：路线 + 视频点位（颜色区分鱼获/置信度） |
| `TimelineBar` | 视频时间线列表：封面 + 标题 + 地点（含置信度标记） |
| `DetailPanel` | 详情面板：地点层级 + 证据来源 + 天气/渔获/晚餐/购物/钓理/画面证据 |
| `AreaStoryPanel` | 行政区域地点故事面板 |
| `Filters` | 7 维过滤状态管理 |

## 地图点位编码

| 状态 | 颜色 | 形态 |
|------|------|------|
| 有渔获 + 高/中置信 | 绿 `#4caf50` | 实心圆 |
| 有渔获 + 低置信 | 浅绿 `#81c784` | 虚线空心圆 |
| 未知 | 灰 `#9e9e9e` | 实心圆 |
| 空军 | 红 `#ef5350` | 三角 |
| 选中 | 白 + 光晕 | 放大 |

## 技术栈

- React 19 + TypeScript + Vite 7
- ECharts 5（纯 geo 坐标系，无外部底图依赖）
- Node.js ES modules（数据管线）
- OpenCLI（B 站评论 + 字幕抓取）
- Whisper（本地 ASR 回退）
- Tesseract（关键帧 OCR）

## 命令参考

```bash
npm install              # 安装依赖
npm run dev              # 开发服务器 (localhost:5173)
npm run build            # 类型检查 + 生产构建
npm run typecheck        # 仅类型检查
npm run data:sample      # 样例数据
npm run data:pipeline    # 全量管线（需 Chrome + B 站登录）
npm run data:rebuild     # 从 raw/videos/ 重建
npm run preview          # 预览生产构建
```

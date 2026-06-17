# 老黄游钓中国旅程图谱

基于 B 站合集最新 20 期视频，综合标题、字幕/ASR、画面 OCR、B 站评论和本地推断规则生成的静态前端展示页。每期视频建立多来源证据档案，在地图上按时间顺序展示旅程路线、鱼获状态和证据详情。

- `scripts/`: 离线数据管线（Node.js ES modules）
- `src/`: React 19 + TypeScript + Vite 7 前端

## 环境准备

- **Node.js** >= 18（推荐 20+），项目开发环境为 v26
- **npm** >= 9（随 Node.js 自带）
- **Git**（克隆仓库用）

验证环境：

```bash
node --version   # 应输出 v18.x 或更高
npm --version    # 应输出 9.x 或更高
git --version    # 应输出 2.x 或更高
```

如果还没有装 Node.js，macOS 推荐用 Homebrew：

```bash
brew install node
```

## 快速开始（5 分钟跑起来）

从头到尾，每一步解释清楚在做什么。

### 1. 克隆仓库并安装依赖

```bash
git clone git@github.com:Suntory9/laohuang.git
cd laohuang
npm install
```

> `npm install` 会根据 `package.json` 下载 React、ECharts、Vite 等依赖到 `node_modules/`。这一步只需要执行一次（除非 `package.json` 变了）。

### 2. 生成样例数据

```bash
npm run data:sample
```

> 运行 `scripts/generate-sample-data.mjs`，手工构造 2 条示例视频数据，输出到 `public/data/journey.json` 和 `public/data/videos.json`。**这一步是为了让你不跑完整管线也能看到页面长什么样。**

### 3. 启动开发服务器

```bash
npm run dev
```

> 启动 Vite 开发服务器，默认监听 `http://localhost:5173`。浏览器打开这个地址就能看到页面了。

**预期效果：** 页面展示湖北地图 + 2 条示例视频的时间线和详情面板。地图上有彩色散点标记视频位置。

### 4. 停止服务器

在终端按 `Ctrl+C` 即可停止。

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

## 日常使用指南

如果你**不写前端代码**，只是想在页面上看到最新的视频旅程数据，只需要关注数据侧。

### 数据 vs 前端 — 它们是分开的

```
数据侧（你关心的）              前端代码（基本不用改）
─────────────────────         ─────────────────────
scripts/*.mjs                 src/*.tsx
    ↓ 产出                        ↓ 读取
public/data/journey.json  ──→  页面渲染
public/data/videos.json
public/covers/<bvid>.jpg
```

**更新数据不需要懂 React、TypeScript、Vite。** 只需要：

1. 运行数据管线拿到新的 JSON + 封面图
2. 刷新浏览器（或用 `npm run dev` 重新打开）

### 场景 A：我只是想看看最新的视频数据

```bash
npm run data:pipeline    # 抓取合集最新视频 → 生成 public/data/*.json
npm run dev              # 启动页面查看
```

### 场景 B：以前跑过管线，从已有产物重建

如果你已经有 `raw/videos/<bvid>/` 目录下的产物，想跳过抓取直接生成前端 JSON：

```bash
npm run data:rebuild     # 从 raw/ 产物重建 public/data/*.json
npm run dev
```

### 场景 C：给管线加新的提取规则

编辑 `scripts/lib/extractors.mjs`，然后：

```bash
npm run data:rebuild     # 用新规则重新提取
npm run dev              # 看效果
```

### 封面图

管线会自动下载视频封面到 `public/covers/<bvid>.jpg`。如果页面显示缺图，检查这个目录下是否有对应的 jpg 文件。

## 如何部署/分享给他人看

这个项目是**纯静态站点** — 所有数据在构建时打进 `dist/` 目录，不需要后端服务器。

### 方式一：本地构建 + 静态文件服务

```bash
npm run build            # 产出 dist/ 目录
npm run preview          # 本地预览构建产物 (localhost:4173)
```

`dist/` 目录可以直接用任意静态文件服务托管：

```bash
# 用 Python（如果装了）
cd dist && python3 -m http.server 8080

# 用 npx（无需安装）
npx serve dist
```

### 方式二：推送到 GitHub Pages / Vercel / Netlify

1. `npm run build` 生成 `dist/`
2. 将 `dist/` 部署到任意静态托管平台
3. **不需要**任何 API Key 或后端服务

> 地图使用的是 ECharts + 本地 GeoJSON（`public/maps/hubei-prefecture.json`），不依赖高德/百度等商业地图 API，所以部署零成本。

## 常见问题

### `npm install` 报错

- 确认 Node.js 版本 >= 18：`node --version`
- 尝试清除缓存：`rm -rf node_modules package-lock.json && npm install`
- 如果网络慢，可以设置 npm 镜像：`npm config set registry https://registry.npmmirror.com`

### 端口 5173 已被占用

Vite 默认用 5173 端口。如果被占：

```bash
# 查看是谁在用
lsof -i :5173
# 换一个端口
npx vite --port 3000
```

### 浏览器打开页面是空白

1. 确认 `public/data/journey.json` 和 `public/data/videos.json` 存在
2. 打开浏览器开发者工具 (F12) → Console 面板，看有没有红色报错
3. 最常见原因：忘了先跑 `npm run data:sample` 生成数据

### 封面图不显示

- 检查 `public/covers/` 目录下是否有对应的 `<bvid>.jpg` 文件
- 样例数据（`data:sample`）不生成封面图，这是正常的 — 封面图只有完整管线（`data:pipeline`）才会下载

### 地图不显示

- 地图区域在 `MapPanel` 组件用 ECharts 渲染，依赖 `public/maps/hubei-prefecture.json`
- 如果这个文件缺失，地图区域会是空白，但时间线和详情面板仍可正常使用
- 注意：当前地图集中在湖北省，如果视频地点在其他省份，地图上可能看不到点位

### 如何修改页面样式

- 全部样式在 `src/styles.css`，是纯 CSS，不涉及 CSS-in-JS 或预处理器
- 修改后保存，Vite 会自动热更新浏览器页面

## 命令参考

```bash
npm install              # 安装依赖（首次或 package.json 变更后）
npm run dev              # 启动开发服务器 (localhost:5173)，修改代码自动刷新
npm run build            # 类型检查 + 生产构建 → dist/
npm run typecheck        # 仅类型检查 (tsc --noEmit)，不构建
npm run data:sample      # 生成 2 条样例数据 → public/data/*.json
npm run data:pipeline    # 全量管线（需 Chrome + B 站登录 + yt-dlp）
npm run data:rebuild     # 从 raw/videos/ 产物重建前端 JSON
npm run preview          # 本地预览 dist/ 构建产物 (localhost:4173)
```

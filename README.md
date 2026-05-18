# 老黄游钓中国旅程图谱

一个基于 B 站合集数据、字幕和本地推断规则生成的静态前端展示页。当前仓库包含两部分：

- `scripts/`: 离线数据管线与样例数据生成
- `src/`: React + TypeScript 前端页面

## 快速开始

1. 安装依赖
   `npm install`
2. 生成样例数据
   `npm run data:sample`
3. 启动开发环境
   `npm run dev`

## 全量或半自动数据管线

如果你已经登录了 Chrome 中的 B 站账号，并且机器上可用 `yt-dlp`，可以运行：

`npm run data:pipeline`

若已经抓过原始资料，只想重建前端 JSON：

`npm run data:rebuild`

可选环境变量：

- `BILI_SAMPLE_LIMIT`: 先处理最近 N 条视频，默认 `5`

地图说明：

- 前端地图使用 ECharts 渲染静态 GeoJSON。
- 湖北市州边界文件位于 `public/maps/hubei-prefecture.json`。
- 构建后的站点只需要静态文件服务，不需要地图 API Key。

当前 `pipeline.mjs` 已经实现：

- 抓合集清单
- 抓单视频元数据
- 优先尝试下载 `ai-zh` 字幕
- 无字幕时回退到本地 `whisper-cli`
- 把每条视频原始资料落盘到 `raw/videos/<bvid>/`
- 用规则抽取位置、天气、晚餐、买菜花费、钓鱼理论、渔获、时间跨度
- 生成 `public/data/journey.json` 与 `public/data/videos.json`
- 支持复用已抓取的 `raw/` 产物，避免每次重新请求 B 站

下一步可继续增强：

- 缺字幕视频的 Whisper 回退
- 地点归一化、地理编码和历史天气 API
- 更强的地点、鱼种、金额、理论归类规则
- 全量 245 期批处理与缓存

## 原始产物目录

每条视频会在 `raw/videos/<bvid>/` 下输出：

- `meta.json`
- `subtitle.ai-zh.srt` 或下载得到的原字幕文件
- `transcript.txt`
- `evidence.json`

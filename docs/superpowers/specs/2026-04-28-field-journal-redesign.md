# 野钓手记 UI 翻新 — 设计规格

## 目标

将"老黄游钓中国旅程图谱"前端整体翻新为"野钓手记 (Field Journal)"风格，用 Leaflet + OSM 替换当前地图方案，改为地图优先的沉浸式布局。

## 视觉方向

- **调色盘**: 泥炭黑底 (`#0f1a08`, `#1a2410`) → 苔藓绿 (`#486454`) → 橄榄绿 (`#7a9a70`) → 鼠尾草 (`#c8d6a0`) → 琥珀金 (`#d59500`) 作为强调
- **字体**: 宋体/Noto Serif SC (标题), 无衬线/Noto Sans SC (正文), JetBrains Mono (数据/编号)
- **质感**: CSS 噪点纹理覆盖层, 粗糙边框 (border-radius: 2-4px), 印章式品牌标记
- **氛围**: 户外野钓笔记的粗粝手工感，暗色为主但层次分明

## 布局重构

当前: 三栏网格 (侧栏 300px | 地图 1fr | 详情 400px)

改为: **地图优先沉浸式布局**

```
┌──────────────────────────────────────────────┐
│  TopBar: 品牌 + 筛选 Chips + 统计数据          │
├──────────────────────────────────────────────┤
│                                              │
│               Leaflet 地图                     │
│            (全幅, 占满可用空间)                 │
│                                              │
├──────────────────────────────────────────────┤
│  Bottom Timeline: 横向滚动视频卡片             │
└──────────────────────────────────────────────┘

详情: 右侧滑出面板 (点击标记/卡片时滑入, 宽 ~420px)
```

### 组件拆分

| 组件 | 当前状态 | 目标 |
|------|---------|------|
| App.tsx | 三栏布局 | 改为 grid-rows 布局 |
| Sidebar.tsx | 完整侧栏 | **移除**, 功能分散到 TopBar + Timeline |
| MapPanel.tsx | AMap/SVG 回退 | 重写为 Leaflet + OSM, 暗色瓦片 |
| DetailPanel.tsx | 右栏固定面板 | 改为滑出式 overlay 面板 |
| Timeline.tsx | 存在但未使用 | 改为底部横向滚动卡片, 集成进主布局 |
| Filters.tsx | 仅类型定义 | 改为 TopBar 中的 chip 筛选器 |

### 新增组件

- `TopBar.tsx` — 顶部导航栏 (品牌、筛选 chips、统计数字)
- `TimelineBar.tsx` — 底部横向卡片流

## 地图方案

- **Leaflet** (`leaflet` npm 包) + `react-leaflet`
- **瓦片**: CartoDB Dark Matter 或 Stadia Alidade Smooth Dark (无需 API Key 的暗色瓦片)
- **标注**: 自定义 CircleMarker, 选中态用琥珀色高亮 + 脉冲动画
- **路线**: Polyline 串联所有地点, 虚线样式
- **回退**: 无 Leaflet 场景下的纯 SVG 地图保留 (简化版)

## 交互流程

1. 页面加载 → 地图全幅展示所有标记点 + 路线
2. 底部时间线显示所有视频卡片, 按发布时间排序
3. 点击地图标记 或 底部卡片 → 右侧详情面板滑入
4. 点击地图空白处 或 关闭按钮 → 面板滑出
5. TopBar 筛选 chips 点击 → 筛选视频, 联动地图标记 + 时间线
6. 点击 "➕ 筛选" chip → 展开完整筛选下拉 (天气/渔获/买菜/理论等)
7. 地图标记 hover → 浮窗显示视频标题 + 地点
8. 时间线卡片 hover → 对应地图标记高亮

## 数据流 (不变)

`App` fetch JSON → state → useMemo filteredVideos → 分发到各面板。
筛选状态 `FiltersState` 保持不变, 仅 UI 呈现方式从侧栏表单变为 TopBar chips + 下拉。

## 响应式

- ≥ 1024px: 完整布局
- 768px-1023px: TopBar 统计隐藏, 底部卡片缩小
- < 768px: 详情面板全宽, 底部时间线单行

## 不改变的部分

- `src/types.ts` — 所有类型定义不变
- `src/lib/format.ts` — 格式化工具不变
- 数据管线 (`scripts/`) — 完全不动
- `public/data/*.json` — 数据结构不变

## 依赖变更

- **新增**: `leaflet`, `react-leaflet`, `@types/leaflet`
- **移除 (代码层面)** : `src/lib/amap.ts` (AMap SDK 加载器, 不再需要)
- **移除 env**: `VITE_AMAP_KEY`, `VITE_AMAP_SECURITY_CODE` (不再需要)

## 风险

- Leaflet 暗色瓦片在国内访问速度可能较慢, 考虑瓦片 CDN 备选
- 移除高德地图后失去国内路网细节, OSM 中国数据精度略低
- react-leaflet 与 React 19 兼容性需验证

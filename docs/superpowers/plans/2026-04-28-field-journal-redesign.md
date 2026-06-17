# 野钓手记 UI 翻新 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 整体翻新前端为"野钓手记"风格：Leaflet + OSM 暗色地图、地图优先布局、右侧滑出详情、底部横向时间线。

**Architecture:** 三栏布局改为 `grid-rows` 三层结构 (TopBar / Map / TimelineBar)，DetailPanel 改为 fixed overlay 滑出面板。Sidebar 移除，功能分散到 TopBar 筛选 chips + TimelineBar。leaflet 通过 ref 集成，避免 react-leaflet 与 React 19 兼容性问题。

**Tech Stack:** React 19, TypeScript, Vite 7, Leaflet, CartoDB Dark Matter tiles

---

### Task 1: 安装 Leaflet 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 leaflet 包**

```bash
cd /Users/songdc/laohuang && npm install leaflet @types/leaflet
```

- [ ] **Step 2: 验证安装**

```bash
ls node_modules/leaflet/dist/leaflet.css && echo "leaflet OK"
ls node_modules/@types/leaflet/index.d.ts && echo "types OK"
```

Expected: both files exist.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add leaflet and @types/leaflet dependencies"
```

---

### Task 2: 重写 styles.css — 野钓手记主题

**Files:**
- Modify: `src/styles.css` (完整重写)

- [ ] **Step 1: 重写全部 CSS**

将 `src/styles.css` 完整替换为以下内容：

```css
/* ═══ Field Journal Theme ═══ */
:root {
  color-scheme: dark;
  --soil: #1a2410;
  --soil-deep: #0f1a08;
  --soil-dark: #0a0f05;
  --moss: #486454;
  --moss-soft: rgba(72, 100, 84, 0.25);
  --olive: #7a9a70;
  --olive-muted: rgba(122, 154, 112, 0.45);
  --sage: #c8d6a0;
  --sage-soft: rgba(200, 214, 160, 0.1);
  --amber: #d59500;
  --amber-glow: rgba(213, 149, 0, 0.35);
  --rust: #b85c1a;
  --canvas: #e8e0cc;
  --canvas-soft: rgba(232, 224, 204, 0.06);
  --border: rgba(200, 214, 160, 0.1);
  --border-active: rgba(200, 214, 160, 0.2);
  --text: #d4d8c8;
  --text-dim: rgba(212, 216, 200, 0.5);
  --font-display: "Noto Serif SC", "Songti SC", "STSong", serif;
  --font-body: "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", "Cascadia Code", monospace;
  --shadow-panel: -4px 0 24px rgba(0, 0, 0, 0.5);
  --radius: 4px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-body);
  background: var(--soil-deep);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; }
button, input, select { font: inherit; }

/* ═══ App Shell ═══ */
.app-shell {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 20% 10%, rgba(72,100,84,0.12), transparent 50%),
    radial-gradient(ellipse at 80% 90%, rgba(122,154,112,0.06), transparent 40%),
    var(--soil-deep);
}

/* noise texture overlay */
.app-shell::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.app-shell.loading-state,
.app-shell.error-state {
  display: grid;
  place-content: center;
  font-size: 18px;
  grid-template-rows: 1fr;
}

/* ═══ TopBar ═══ */
.topbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 20px;
  background: rgba(15, 26, 8, 0.94);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(12px);
  z-index: 20;
  overflow-x: auto;
}

.topbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.topbar-stamp {
  width: 34px;
  height: 34px;
  border: 1.5px solid var(--olive);
  border-radius: 3px;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--olive);
  transform: rotate(-3deg);
  flex-shrink: 0;
}

.topbar-title-group h1 {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--sage);
  letter-spacing: -0.02em;
  line-height: 1.2;
  white-space: nowrap;
}

.topbar-title-group span {
  font-size: 10px;
  color: var(--olive-muted);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.topbar-stats {
  display: flex;
  gap: 16px;
  margin-left: auto;
  flex-shrink: 0;
}

.topbar-stat {
  text-align: right;
}

.topbar-stat strong {
  display: block;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
  color: var(--sage);
}

.topbar-stat small {
  display: block;
  font-size: 9px;
  color: var(--text-dim);
  letter-spacing: 0.06em;
}

/* ═══ Filter Chips ═══ */
.filter-chips {
  display: flex;
  gap: 6px;
  flex-shrink: 1;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-chips::-webkit-scrollbar { display: none; }

.filter-chip {
  padding: 4px 11px;
  border-radius: 3px;
  border: 1px solid var(--border);
  background: rgba(200, 214, 160, 0.03);
  color: var(--text-dim);
  font-size: 11px;
  cursor: pointer;
  transition: all 140ms ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.filter-chip:hover {
  border-color: var(--border-active);
  color: var(--sage);
}

.filter-chip.active {
  background: rgba(200, 214, 160, 0.08);
  border-color: rgba(200, 214, 160, 0.25);
  color: var(--sage);
}

.filter-chip.has-value {
  border-color: var(--amber-glow);
  color: var(--amber);
}

.filter-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 6px;
  background: rgba(20, 30, 12, 0.98);
  border: 1px solid var(--border-active);
  border-radius: var(--radius);
  padding: 10px;
  display: grid;
  gap: 6px;
  min-width: 180px;
  z-index: 30;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
}

.filter-dropdown select,
.filter-dropdown input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: rgba(15, 26, 8, 0.8);
  color: var(--text);
  font-size: 12px;
}

.filter-dropdown select:focus,
.filter-dropdown input:focus {
  outline: none;
  border-color: var(--amber-glow);
}

/* ═══ Map Stage ═══ */
.map-stage {
  position: relative;
  border-top: 1px solid rgba(200, 214, 160, 0.04);
  border-bottom: 1px solid rgba(200, 214, 160, 0.04);
  overflow: hidden;
}

.map-stage .leaflet-container {
  width: 100%;
  height: 100%;
  background: var(--soil-deep);
}

/* Custom marker styles */
.marker-active {
  filter: drop-shadow(0 0 8px rgba(213, 149, 0, 0.6));
}

/* Leaflet overrides for dark theme */
.map-stage .leaflet-control-zoom a {
  background: rgba(15, 26, 8, 0.9);
  border-color: var(--border);
  color: var(--sage);
}

.map-stage .leaflet-control-attribution {
  background: rgba(15, 26, 8, 0.7);
  color: rgba(200, 214, 160, 0.35);
  font-size: 9px;
  font-family: var(--font-mono);
  padding: 2px 6px;
}

.map-stage .leaflet-control-attribution a {
  color: rgba(200, 214, 160, 0.5);
}

.map-stage .leaflet-popup-content-wrapper {
  background: rgba(20, 30, 12, 0.96);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-family: var(--font-body);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.map-stage .leaflet-popup-tip {
  background: rgba(20, 30, 12, 0.96);
  border: 1px solid var(--border);
}

.map-error {
  position: absolute;
  inset-inline: 16px;
  bottom: 16px;
  padding: 10px 14px;
  border-radius: var(--radius);
  background: rgba(184, 92, 26, 0.92);
  color: #fff;
  font-size: 13px;
  z-index: 10;
}

/* ═══ Timeline Bar ═══ */
.timeline-bar {
  display: flex;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(15, 26, 8, 0.94);
  border-top: 1px solid rgba(200, 214, 160, 0.06);
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(200, 214, 160, 0.08) transparent;
  z-index: 20;
  align-items: flex-start;
}

.timeline-bar::-webkit-scrollbar { height: 3px; }
.timeline-bar::-webkit-scrollbar-thumb {
  background: rgba(200, 214, 160, 0.08);
  border-radius: 2px;
}

.t-card {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 148px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: rgba(26, 36, 16, 0.6);
  cursor: pointer;
  transition: all 180ms ease;
  color: inherit;
  text-align: left;
  font-family: inherit;
}

.t-card:hover {
  border-color: var(--border-active);
  background: rgba(200, 214, 160, 0.04);
  transform: translateY(-2px);
}

.t-card.active {
  border-color: rgba(213, 149, 0, 0.35);
  background: rgba(213, 149, 0, 0.06);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  position: relative;
}

.t-card.active::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 10px;
  right: 10px;
  height: 2px;
  background: var(--amber);
  border-radius: 0 0 2px 2px;
}

.t-card-num {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--olive);
  letter-spacing: 0.04em;
}

.t-card-thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 2px;
  overflow: hidden;
  background: rgba(200, 214, 160, 0.05);
}

.t-card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.t-card h4 {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  color: var(--sage);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.t-card-meta {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.t-card-tag {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 2px;
  background: rgba(200, 214, 160, 0.06);
  color: var(--text-dim);
  white-space: nowrap;
}

.t-card-tag.caught {
  background: rgba(213, 149, 0, 0.1);
  color: rgba(213, 149, 0, 0.85);
}

.t-card-tag.skunked {
  background: rgba(184, 92, 26, 0.1);
  color: rgba(184, 92, 26, 0.85);
}

/* ═══ Detail Overlay ═══ */
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 40;
  opacity: 0;
  pointer-events: none;
  transition: opacity 250ms ease;
}

.detail-overlay.open {
  opacity: 1;
  pointer-events: auto;
}

.detail-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 420px;
  max-width: 92vw;
  height: 100vh;
  background:
    linear-gradient(180deg, rgba(20, 30, 12, 0.985), rgba(15, 22, 8, 0.985));
  border-left: 1px solid var(--border);
  z-index: 41;
  transform: translateX(100%);
  transition: transform 300ms cubic-bezier(0.22, 0.61, 0.36, 1);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-shadow: var(--shadow-panel);
}

.detail-panel.open {
  transform: translateX(0);
}

.detail-panel .close-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: rgba(15, 26, 8, 0.8);
  color: var(--text-dim);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 16px;
  line-height: 1;
  z-index: 2;
  transition: all 140ms ease;
}

.detail-panel .close-btn:hover {
  border-color: var(--border-active);
  color: var(--sage);
}

.detail-header {
  padding: 24px 24px 16px;
  border-bottom: 1px solid var(--border);
}

.detail-header .episode-num {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--amber);
  letter-spacing: 0.12em;
  margin-bottom: 8px;
}

.detail-header h2 {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--sage);
  letter-spacing: -0.02em;
  margin-bottom: 10px;
}

.detail-meta-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.detail-meta-row span {
  padding: 3px 9px;
  border-radius: 2px;
  background: rgba(200, 214, 160, 0.06);
  font-size: 11px;
  color: var(--text-dim);
}

.detail-body {
  padding: 18px 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-card {
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: rgba(200, 214, 160, 0.02);
}

.detail-card h3 {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  color: var(--olive);
  margin-bottom: 5px;
  letter-spacing: 0.04em;
}

.detail-card p {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text);
}

.detail-card .muted {
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-dim);
}

.detail-bilibili-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: auto;
  padding: 10px 16px;
  border-radius: 3px;
  border: 1px solid var(--amber-glow);
  background: rgba(213, 149, 0, 0.08);
  color: var(--amber);
  text-decoration: none;
  font-size: 13px;
  transition: all 140ms ease;
}

.detail-bilibili-link:hover {
  background: rgba(213, 149, 0, 0.14);
}

.detail-cover {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 2px;
  margin-bottom: 12px;
}

.detail-evidence {
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.detail-evidence h3 {
  font-family: var(--font-display);
  font-size: 13px;
  color: var(--sage);
  margin-bottom: 8px;
}

.detail-evidence .excerpt {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text);
  margin-bottom: 10px;
}

.evidence-list {
  margin: 0;
  padding-left: 16px;
  display: grid;
  gap: 6px;
}

.evidence-list li {
  line-height: 1.5;
  font-size: 12px;
}

.evidence-list strong {
  display: inline-block;
  margin-right: 4px;
  color: var(--amber);
}

/* ═══ Loading & Error ═══ */
.loading-state,
.error-state {
  font-family: var(--font-display);
  color: var(--sage);
}

/* ═══ Responsive ═══ */
@media (max-width: 1100px) {
  .topbar-stats { display: none; }
  .filter-chips { gap: 4px; }
  .filter-chip { padding: 3px 8px; font-size: 10px; }
}

@media (max-width: 768px) {
  .app-shell {
    grid-template-rows: auto 1fr auto;
  }

  .topbar {
    padding: 8px 12px;
    gap: 8px;
  }

  .topbar-title-group h1 { font-size: 13px; }
  .topbar-stamp { width: 28px; height: 28px; font-size: 14px; }

  .filter-chips { display: none; }

  .timeline-bar {
    padding: 8px 12px;
    gap: 6px;
  }

  .t-card { width: 120px; padding: 6px; }

  .detail-panel {
    width: 100vw;
    max-width: 100vw;
  }
}
```

- [ ] **Step 2: 验证类型检查通过**

```bash
cd /Users/songdc/laohuang && npm run typecheck 2>&1
```

Expected: 会有未使用变量的警告，但不应有类型错误。CSS 文件不影响类型检查。

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: rewrite styles.css with Field Journal dark theme"
```

---

### Task 3: 创建 TopBar 组件

**Files:**
- Create: `src/components/TopBar.tsx`

- [ ] **Step 1: 编写 TopBar 组件**

```typescript
import type { JourneySummary } from '../types';
import type { FiltersState } from './Filters';

interface TopBarProps {
  summary: JourneySummary;
  filters: FiltersState;
  onChange: (next: FiltersState) => void;
  cities: string[];
  weatherTags: string[];
  theoryTags: string[];
  resultCount: number;
  totalCount: number;
}

export function TopBar({
  summary,
  filters,
  onChange,
  cities,
  weatherTags,
  theoryTags,
  resultCount,
  totalCount,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="topbar-stamp">钓</div>
        <div className="topbar-title-group">
          <h1>{summary.title}</h1>
          <span>Field Journal · 湖北篇</span>
        </div>
      </div>

      <div className="filter-chips">
        <button
          type="button"
          className={`filter-chip ${!filters.city ? 'active' : ''}`}
          onClick={() => onChange({ ...filters, city: '' })}
        >
          全部城市
        </button>
        {cities.map((city) => (
          <button
            key={city}
            type="button"
            className={`filter-chip ${filters.city === city ? 'active' : ''}`}
            onClick={() => onChange({ ...filters, city: filters.city === city ? '' : city })}
          >
            {city}
          </button>
        ))}
        <button
          type="button"
          className={`filter-chip ${filters.weatherTag ? 'has-value' : ''}`}
          onClick={() => onChange({ ...filters, weatherTag: filters.weatherTag ? '' : (weatherTags[0] ?? '') })}
        >
          {filters.weatherTag || '天气'}
        </button>
        <select
          className="filter-chip"
          value={filters.catchState}
          onChange={(e) =>
            onChange({ ...filters, catchState: e.target.value as FiltersState['catchState'] })
          }
        >
          <option value="all">全部渔获</option>
          <option value="yes">有渔获</option>
          <option value="no">无渔获</option>
          <option value="unknown">未知</option>
        </select>
        <select
          className="filter-chip"
          value={filters.skunkedState}
          onChange={(e) =>
            onChange({ ...filters, skunkedState: e.target.value as FiltersState['skunkedState'] })
          }
        >
          <option value="all">全部空军</option>
          <option value="yes">空军</option>
          <option value="no">非空军</option>
          <option value="unknown">未知</option>
        </select>
        <select
          className="filter-chip"
          value={filters.hasShopping}
          onChange={(e) =>
            onChange({ ...filters, hasShopping: e.target.value as FiltersState['hasShopping'] })
          }
        >
          <option value="all">全部买菜</option>
          <option value="yes">有记录</option>
          <option value="no">无记录</option>
        </select>
        <button
          type="button"
          className={`filter-chip ${filters.theoryTag ? 'has-value' : ''}`}
          onClick={() => onChange({ ...filters, theoryTag: filters.theoryTag ? '' : (theoryTags[0] ?? '') })}
        >
          {filters.theoryTag || '钓鱼理论'}
        </button>
        <input
          className="filter-chip"
          type="text"
          value={filters.keyword}
          onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
          placeholder="搜索…"
          style={{ minWidth: 80 }}
        />
      </div>

      <div className="topbar-stats">
        <div className="topbar-stat">
          <strong>{resultCount}/{totalCount}</strong>
          <small>筛选结果</small>
        </div>
        <div className="topbar-stat">
          <strong>{summary.coveredCities}</strong>
          <small>覆盖城市</small>
        </div>
        <div className="topbar-stat">
          <strong>¥{summary.totalShoppingCostCny.toFixed(0)}</strong>
          <small>累计买菜</small>
        </div>
        <div className="topbar-stat">
          <strong>{summary.skunkedVideos}</strong>
          <small>空军</small>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd /Users/songdc/laohuang && npm run typecheck 2>&1
```

Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
git add src/components/TopBar.tsx
git commit -m "feat: add TopBar component with filter chips and stats"
```

---

### Task 4: 创建 TimelineBar 组件

**Files:**
- Create: `src/components/TimelineBar.tsx`

- [ ] **Step 1: 编写 TimelineBar 组件**

```typescript
import type { VideoRecord } from '../types';
import { formatDate } from '../lib/format';

interface TimelineBarProps {
  videos: VideoRecord[];
  selectedBvid: string;
  onSelectVideo: (bvid: string) => void;
}

export function TimelineBar({ videos, selectedBvid, onSelectVideo }: TimelineBarProps) {
  if (videos.length === 0) {
    return (
      <nav className="timeline-bar">
        <span style={{ color: 'var(--text-dim)', fontSize: 13, padding: '8px 0' }}>
          无匹配视频
        </span>
      </nav>
    );
  }

  return (
    <nav className="timeline-bar">
      {videos.map((video) => {
        const active = video.bvid === selectedBvid;
        return (
          <button
            key={video.bvid}
            type="button"
            className={`t-card ${active ? 'active' : ''}`}
            onClick={() => onSelectVideo(video.bvid)}
          >
            <span className="t-card-num">#{String(video.sequenceIndex).padStart(2, '0')}</span>
            <div className="t-card-thumb">
              <img src={video.coverUrl} alt="" loading="lazy" />
            </div>
            <h4>{video.title}</h4>
            <div className="t-card-meta">
              <span className="t-card-tag">{video.location.city ?? video.location.label}</span>
              {video.weather.conditionTags.slice(0, 1).map((tag) => (
                <span key={tag} className="t-card-tag">{tag}</span>
              ))}
              {video.fishing.isSkunked === 'yes' ? (
                <span className="t-card-tag skunked">空军</span>
              ) : video.fishing.caught === 'yes' ? (
                <span className="t-card-tag caught">有渔获</span>
              ) : null}
              {video.shopping.hasShopping && video.shopping.totalCostCny !== null ? (
                <span className="t-card-tag">¥{video.shopping.totalCostCny.toFixed(0)}</span>
              ) : null}
              <span className="t-card-tag">{formatDate(video.publishedAt)}</span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd /Users/songdc/laohuang && npm run typecheck 2>&1
```

Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
git add src/components/TimelineBar.tsx
git commit -m "feat: add TimelineBar component with horizontal scrolling cards"
```

---

### Task 5: 重写 MapPanel — Leaflet + OSM 集成

**Files:**
- Modify: `src/components/MapPanel.tsx` (完整重写)
- No longer used (will be removed later): `src/lib/amap.ts`

Leaflet 集成策略：使用 useRef 持有 map 实例，useEffect 管理生命周期。不使用 react-leaflet（避免 React 19 兼容问题）。瓦片使用 CartoDB Dark Matter 免费暗色瓦片，无需 API Key。

- [ ] **Step 1: 重写 MapPanel.tsx**

```typescript
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { VideoRecord } from '../types';

interface MapPanelProps {
  videos: VideoRecord[];
  selectedBvid: string;
  onSelectVideo: (bvid: string) => void;
  routePolyline: [number, number][];
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

const defaultCenter: [number, number] = [30.5, 112.2];
const defaultZoom = 7;

export function MapPanel({ videos, selectedBvid, onSelectVideo, routePolyline }: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      const map = L.map(containerRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 18,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    } catch (err) {
      setMapError(err instanceof Error ? err.message : '地图加载失败');
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersLayerRef.current = null;
        routeLayerRef.current = null;
      }
    };
  }, []);

  // Update markers when videos/selectedBvid change
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const points = videos.filter(
      (v) => v.location.lat !== null && v.location.lng !== null,
    );

    if (points.length === 0) return;

    points.forEach((video) => {
      const lat = video.location.lat!;
      const lng = video.location.lng!;
      const isActive = video.bvid === selectedBvid;
      const isSkunked = video.fishing.isSkunked === 'yes';
      const hasCatch = video.fishing.caught === 'yes';

      const color = isActive ? '#d59500' : isSkunked ? '#b85c1a' : hasCatch ? '#486454' : '#7a9a70';
      const radius = isActive ? 9 : 6;

      const marker = L.circleMarker([lat, lng], {
        radius,
        fillColor: color,
        color: '#0f1a08',
        weight: 2,
        fillOpacity: 0.95,
      });

      if (isActive) {
        marker.setStyle({ weight: 3, color: '#d59500' });
        const pulse = L.circleMarker([lat, lng], {
          radius: radius + 8,
          fillColor: 'transparent',
          color: '#d59500',
          weight: 1,
          fillOpacity: 0,
          opacity: 0.5,
        });
        pulse.addTo(layerGroup);
      }

      const popupContent = `<strong>${video.location.label}</strong><br/><small>${video.title}</small>`;
      marker.bindPopup(popupContent, { offset: [0, -4] });

      marker.on('click', () => onSelectVideo(video.bvid));

      marker.addTo(layerGroup);
    });

    // Fit bounds
    const lats = points.map((p) => p.location.lat!);
    const lngs = points.map((p) => p.location.lng!);
    const bounds = L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    );
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [videos, selectedBvid, onSelectVideo]);

  // Update route polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (routePolyline.length < 2) return;

    const latlngs = routePolyline.map(([lng, lat]) => [lat, lng] as [number, number]);
    routeLayerRef.current = L.polyline(latlngs, {
      color: '#486454',
      weight: 3,
      opacity: 0.6,
      dashArray: '8 6',
    }).addTo(map);
  }, [routePolyline]);

  return (
    <section className="map-stage">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {mapError ? <div className="map-error">{mapError}</div> : null}
    </section>
  );
}
```

- [ ] **Step 2: 在 index.html 中引入 Leaflet CSS**

在 `index.html` 的 `<head>` 中添加 Leaflet CSS（因为 Vite 的 CSS import 方式可能无法正确处理 node_modules 中的 leaflet.css）：

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

So the head becomes:

```html
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>老黄游钓中国旅程图谱</title>
    <meta name="description" content="基于 B 站合集的旅程数据、地图轨迹、天气和渔获信息，直观查看老黄一路游钓过程。" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</head>
```

- [ ] **Step 3: 验证类型检查**

```bash
cd /Users/songdc/laohuang && npm run typecheck 2>&1
```

Expected: 无类型错误。（如果 `leaflet` 的 CSS import 方式有问题，我们已通过 CDN 引入 CSS）

- [ ] **Step 4: Commit**

```bash
git add src/components/MapPanel.tsx index.html
git commit -m "feat: rewrite MapPanel with Leaflet + CartoDB dark tiles"
```

---

### Task 6: 重写 DetailPanel — 滑出式面板

**Files:**
- Modify: `src/components/DetailPanel.tsx` (完整重写)

- [ ] **Step 1: 编写 DetailPanel**

```typescript
import type { VideoRecord } from '../types';
import { formatConfidence, formatDate, formatDuration, formatMoney } from '../lib/format';

interface DetailPanelProps {
  video: VideoRecord;
  open: boolean;
  onClose: () => void;
}

export function DetailPanel({ video, open, onClose }: DetailPanelProps) {
  return (
    <>
      <div
        className={`detail-overlay ${open ? 'open' : ''}`}
        onClick={onClose}
        role="presentation"
      />
      <aside className={`detail-panel ${open ? 'open' : ''}`}>
        <button type="button" className="close-btn" onClick={onClose} aria-label="关闭详情">
          &#10005;
        </button>

        <div className="detail-header">
          <div className="episode-num">EPISODE #{String(video.sequenceIndex).padStart(2, '0')}</div>
          <h2>{video.title}</h2>
          <div className="detail-meta-row">
            <span>{formatDate(video.publishedAt)}</span>
            <span>{formatDuration(video.durationSec)}</span>
            <span>{video.location.label}</span>
            <span>{video.transcriptSource === 'official_subtitle' ? '官方字幕' : 'ASR 转写'}</span>
          </div>
        </div>

        <div className="detail-body">
          <div className="detail-card">
            <h3>地点与路线</h3>
            <p>{video.location.label}</p>
            <p className="muted">置信度：{formatConfidence(video.location.confidence)}</p>
            {video.route.fromLabel && video.route.toLabel ? (
              <p className="muted">{video.route.fromLabel} → {video.route.toLabel}</p>
            ) : null}
          </div>

          <div className="detail-card">
            <h3>当天天气</h3>
            <p>{video.weather.summary}</p>
            <p className="muted">{video.weather.conditionTags.join(' / ') || '未提及'}</p>
          </div>

          <div className="detail-card">
            <h3>视频跨度时间</h3>
            <p>{video.timeSpan.startTimeText ?? '未提及'} - {video.timeSpan.endTimeText ?? '未提及'}</p>
            <p className="muted">{video.timeSpan.durationHintText ?? '未提及'}</p>
          </div>

          <div className="detail-card">
            <h3>晚餐</h3>
            <p>{video.dinner.summary}</p>
            <p className="muted">{video.dinner.foods.join(' / ') || '未提及'}</p>
          </div>

          <div className="detail-card">
            <h3>买菜花费</h3>
            <p>{formatMoney(video.shopping.totalCostCny, video.shopping.totalCostText)}</p>
            <p className="muted">{video.shopping.items.join(' / ') || '未提及'}</p>
          </div>

          <div className="detail-card">
            <h3>钓鱼理论</h3>
            <p>{video.fishingTheory.summary}</p>
            <p className="muted">{video.fishingTheory.tags.join(' / ') || '未提及'}</p>
          </div>

          <div className="detail-card">
            <h3>渔获信息</h3>
            <p>
              {video.fishing.caught === 'yes' ? '有渔获' : video.fishing.caught === 'no' ? '无渔获' : '结果未知'}
              {' / '}
              {video.fishing.isSkunked === 'yes' ? '空军' : video.fishing.isSkunked === 'no' ? '非空军' : '空军未知'}
            </p>
            <p className="muted">
              {[video.fishing.species.join(' / '), video.fishing.weightText, video.fishing.countText]
                .filter(Boolean)
                .join(' | ') || '未提及'}
            </p>
          </div>

          <a
            className="detail-bilibili-link"
            href={video.bilibiliUrl}
            target="_blank"
            rel="noreferrer"
          >
            前往 B 站原视频
          </a>

          <div className="detail-evidence">
            <h3>证据摘录</h3>
            <p className="excerpt">{video.transcriptExcerpt}</p>
            <ul className="evidence-list">
              {video.location.evidence
                .concat(video.weather.evidence)
                .concat(video.shopping.evidence)
                .concat(video.fishingTheory.evidence)
                .concat(video.fishing.evidence)
                .slice(0, 6)
                .map((item, index) => (
                  <li key={`${item.source}-${index}`}>
                    <strong>{item.source}</strong>
                    {item.timestamp ? `${item.timestamp} ` : ''}{item.quote}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd /Users/songdc/laohuang && npm run typecheck 2>&1
```

Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
git add src/components/DetailPanel.tsx
git commit -m "feat: rewrite DetailPanel as slide-over panel"
```

---

### Task 7: 重写 App.tsx — 新布局

**Files:**
- Modify: `src/App.tsx` (完整重写)

- [ ] **Step 1: 重写 App.tsx**

```typescript
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TopBar } from './components/TopBar';
import { MapPanel } from './components/MapPanel';
import { TimelineBar } from './components/TimelineBar';
import { DetailPanel } from './components/DetailPanel';
import type { FiltersState } from './components/Filters';
import type { JourneySummary, VideoRecord } from './types';

const defaultFilters: FiltersState = {
  keyword: '',
  city: '',
  weatherTag: '',
  catchState: 'all',
  skunkedState: 'all',
  hasShopping: 'all',
  theoryTag: '',
};

export default function App() {
  const [summary, setSummary] = useState<JourneySummary | null>(null);
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [selectedBvid, setSelectedBvid] = useState<string>('');
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/data/journey.json').then((response) => response.json() as Promise<JourneySummary>),
      fetch('/data/videos.json').then((response) => response.json() as Promise<VideoRecord[]>),
    ])
      .then(([journeyData, videosData]) => {
        setSummary(journeyData);
        setVideos(videosData);
        setSelectedBvid(videosData[0]?.bvid ?? '');
      })
      .catch((fetchError: Error) => setError(fetchError.message));
  }, []);

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      const keyword = filters.keyword.trim();
      const haystack = [
        video.title,
        video.location.label,
        video.dinner.summary,
        video.fishing.species.join(' '),
        video.fishingTheory.summary,
        video.shopping.items.join(' '),
      ]
        .join(' ')
        .toLowerCase();

      if (keyword && !haystack.includes(keyword.toLowerCase())) return false;
      if (filters.city && video.location.city !== filters.city) return false;
      if (filters.weatherTag && !video.weather.conditionTags.includes(filters.weatherTag)) return false;
      if (filters.catchState !== 'all' && video.fishing.caught !== filters.catchState) return false;
      if (filters.skunkedState !== 'all' && video.fishing.isSkunked !== filters.skunkedState) return false;
      if (filters.hasShopping === 'yes' && !video.shopping.hasShopping) return false;
      if (filters.hasShopping === 'no' && video.shopping.hasShopping) return false;
      if (filters.theoryTag && !video.fishingTheory.tags.includes(filters.theoryTag)) return false;
      return true;
    });
  }, [filters, videos]);

  const selectedVideo = filteredVideos.find((video) => video.bvid === selectedBvid) ?? filteredVideos[0] ?? null;

  useEffect(() => {
    if (selectedVideo && selectedVideo.bvid !== selectedBvid) {
      setSelectedBvid(selectedVideo.bvid);
    }
  }, [selectedBvid, selectedVideo]);

  const handleSelectVideo = useCallback((bvid: string) => {
    setSelectedBvid(bvid);
    setDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
  }, []);

  // Derive filter options from all videos
  const cities = useMemo(
    () => [...new Set(videos.map((v) => v.location.city).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [videos],
  );

  const weatherTags = useMemo(
    () => [...new Set(videos.flatMap((v) => v.weather.conditionTags))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [videos],
  );

  const theoryTags = useMemo(
    () => [...new Set(videos.flatMap((v) => v.fishingTheory.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [videos],
  );

  if (error) {
    return <main className="app-shell error-state">数据加载失败：{error}</main>;
  }

  if (!summary || videos.length === 0 || !selectedVideo) {
    return <main className="app-shell loading-state">正在加载旅程图谱…</main>;
  }

  return (
    <main className="app-shell">
      <TopBar
        summary={summary}
        filters={filters}
        onChange={setFilters}
        cities={cities}
        weatherTags={weatherTags}
        theoryTags={theoryTags}
        resultCount={filteredVideos.length}
        totalCount={videos.length}
      />

      <MapPanel
        videos={filteredVideos}
        selectedBvid={selectedVideo.bvid}
        onSelectVideo={handleSelectVideo}
        routePolyline={summary.routePolyline}
      />

      <TimelineBar
        videos={filteredVideos}
        selectedBvid={selectedVideo.bvid}
        onSelectVideo={handleSelectVideo}
      />

      <DetailPanel
        video={selectedVideo}
        open={detailOpen}
        onClose={handleCloseDetail}
      />
    </main>
  );
}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd /Users/songdc/laohuang && npm run typecheck 2>&1
```

Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: rewrite App with map-first layout (TopBar + Map + TimelineBar)"
```

---

### Task 8: 清理旧文件

**Files:**
- Delete: `src/components/Sidebar.tsx`
- Delete: `src/lib/amap.ts`

- [ ] **Step 1: 删除不再使用的文件**

```bash
rm /Users/songdc/laohuang/src/components/Sidebar.tsx
rm /Users/songdc/laohuang/src/lib/amap.ts
```

- [ ] **Step 2: 验证构建**

```bash
cd /Users/songdc/laohuang && npm run build 2>&1
```

Expected: 构建成功，无错误。

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx src/lib/amap.ts
git commit -m "chore: remove unused Sidebar and amap loader"
```

---

### Task 9: 最终验证与调优

- [ ] **Step 1: 完整类型检查 + 构建**

```bash
cd /Users/songdc/laohuang && npm run build 2>&1
```

Expected: tsc 无错误 + Vite 构建成功。

- [ ] **Step 2: 检查构建产物**

```bash
ls -la /Users/songdc/laohuang/dist/ && echo "Build OK"
```

Expected: `dist/` 目录存在，包含 `index.html` 和 `assets/`。

- [ ] **Step 3: 启动开发服务器验证**

```bash
cd /Users/songdc/laohuang && npm run dev &
sleep 3
curl -s http://localhost:5173 | head -20
```

Expected: 返回 HTML 页面，包含 `<div id="root"></div>`。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: final verification pass"
```

---

### 完成检查

- [ ] `npm run typecheck` 通过
- [ ] `npm run build` 成功
- [ ] Leaflet 地图正确渲染（需在浏览器中验证）
- [ ] 筛选功能正常
- [ ] 详情滑出面板正常
- [ ] 响应式布局正常

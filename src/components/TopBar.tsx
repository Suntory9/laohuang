import type { JourneySummary } from '../types';
import type { FiltersState } from './Filters';

interface TopBarProps {
  summary: JourneySummary;
  filters: FiltersState;
  onChange: (next: FiltersState) => void;
  prefectures: string[];
  weatherTags: string[];
  theoryTags: string[];
  resultCount: number;
  totalCount: number;
}

export function TopBar({
  summary,
  filters,
  onChange,
  prefectures,
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
          <span>最新 {summary.totalVideos} 期 · {summary.coveredPrefectures} 个地级市</span>
        </div>
      </div>

      <div className="filter-chips">
        <button
          type="button"
          className={`filter-chip ${!filters.prefecture ? 'active' : ''}`}
          onClick={() => onChange({ ...filters, prefecture: '' })}
        >
          全部城市
        </button>
        {prefectures.map((prefecture) => (
          <button
            key={prefecture}
            type="button"
            className={`filter-chip ${filters.prefecture === prefecture ? 'active' : ''}`}
            onClick={() => onChange({ ...filters, prefecture: filters.prefecture === prefecture ? '' : prefecture })}
          >
            {prefecture}
          </button>
        ))}
        <select
          className="filter-chip"
          value={filters.weatherTag}
          onChange={(e) => onChange({ ...filters, weatherTag: e.target.value })}
        >
          <option value="">全部天气</option>
          {weatherTags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
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
        <select
          className="filter-chip"
          value={filters.theoryTag}
          onChange={(e) => onChange({ ...filters, theoryTag: e.target.value })}
        >
          <option value="">全部理论</option>
          {theoryTags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
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
          <strong>{summary.coveredPrefectures}</strong>
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

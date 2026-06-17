import type { AdminAreaStats } from '../lib/adminStats';
import { formatDate } from '../lib/format';

interface AreaStoryPanelProps {
  area: AdminAreaStats | null;
  onSelectVideo: (bvid: string) => void;
  onClear: () => void;
}

export function AreaStoryPanel({ area, onSelectVideo, onClear }: AreaStoryPanelProps) {
  if (!area) return null;

  return (
    <aside className="area-story-panel">
      <button type="button" className="area-story-close" onClick={onClear} aria-label="关闭地点故事">
        &#10005;
      </button>
      <div className="area-story-kicker">地点故事</div>
      <h2>{area.name}</h2>
      <div className="area-story-stats">
        <span>{area.videoCount} 期视频</span>
        <span>{area.caughtCount} 期有渔获</span>
        <span>{area.skunkedCount} 期空军</span>
        <span>¥{area.shoppingCostCny.toFixed(0)} 买菜</span>
      </div>

      {area.weatherTags.length > 0 ? (
        <div className="area-story-tags">
          {area.weatherTags.slice(0, 4).map((tag) => (
            <span key={tag.label}>{tag.label} ×{tag.count}</span>
          ))}
        </div>
      ) : null}

      <div className="area-story-list">
        {area.videos.map((video) => (
          <button key={video.bvid} type="button" onClick={() => onSelectVideo(video.bvid)}>
            <strong>#{String(video.sequenceIndex).padStart(2, '0')} {video.title}</strong>
            <small>{formatDate(video.publishedAt)} · {video.location.label}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}

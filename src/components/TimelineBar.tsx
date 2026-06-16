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
        const localCoverUrl = `/covers/${video.bvid}.jpg`;
        const remoteCoverUrl = video.coverUrl.replace(/^http:\/\//, 'https://');
        return (
          <button
            key={video.bvid}
            type="button"
            className={`t-card ${active ? 'active' : ''}`}
            onClick={() => onSelectVideo(video.bvid)}
          >
            <span className="t-card-num">#{String(video.sequenceIndex).padStart(2, '0')}</span>
            <div className="t-card-thumb">
              <img
                src={localCoverUrl}
                alt={video.title}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  const img = event.currentTarget;
                  if (img.src.endsWith(localCoverUrl)) {
                    img.src = remoteCoverUrl;
                    return;
                  }
                  img.onerror = null;
                }}
              />
            </div>
            <h4>{video.title}</h4>
            <div className="t-card-meta">
              <span className="t-card-tag">{video.location.prefecture ?? video.location.city ?? video.location.label}</span>
              {/* Confidence indicator */}
              {video.location.confidence === 'low' && (
                <span className="confidence-warn" title="地点低置信度">⚠️</span>
              )}
              {video.location.confidence === 'unknown' && (
                <span className="confidence-warn" title="地点未知">❓</span>
              )}
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

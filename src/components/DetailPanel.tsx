import type { VideoRecord } from '../types';
import { formatConfidence, formatDate, formatDuration, formatMoney } from '../lib/format';

function formatSource(source: string): string {
  const map: Record<string, string> = {
    meta: '📋 元数据',
    subtitle: '📝 字幕',
    asr: '🎙️ ASR',
    frame_ocr: '📷 OCR',
    frame_visual: '🖼️ 画面',
    comment: '💬 评论',
    'sequence-inference': '🔗 顺序推断',
    manual_override: '✅ 人工修正',
  };
  return map[source] ?? source;
}

function formatConfidenceLabel(confidence: string): string {
  const map: Record<string, string> = {
    high: '🟢 高',
    medium: '🟡 中',
    low: '🔴 低',
    unknown: '⚪ 未知',
  };
  return map[confidence] ?? confidence;
}

interface DetailPanelProps {
  video: VideoRecord;
  open: boolean;
  onClose: () => void;
}

export function DetailPanel({ video, open, onClose }: DetailPanelProps) {
  const visualFrames = video.visualAnalysis?.frames?.slice(0, 6) ?? [];

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
            <h3>📍 最终地点</h3>
            <p className="location-label">{video.location.label}</p>
            <p className="muted">
              {[
                video.location.province,
                video.location.prefecture ?? video.location.city,
                video.location.county ?? video.location.district,
                video.location.poi,
              ]
                .filter(Boolean)
                .join(' > ') || '未明确'}
            </p>
            <p className={`confidence-tag`}>
              置信度：{formatConfidenceLabel(video.location.confidence)}
            </p>
            {video.route.fromLabel && video.route.toLabel ? (
              <p className="muted">🚗 {video.route.fromLabel} → {video.route.toLabel}</p>
            ) : null}

            {/* Evidence sources */}
            {video.location.evidence.length > 0 ? (
              <div className="evidence-sources">
                <h4>证据来源</h4>
                <ul className="evidence-detail-list">
                  {video.location.evidence.slice(0, 6).map((item, i) => (
                    <li key={i} className="evidence-item">
                      <span className="evidence-source-badge">{formatSource(item.source)}</span>
                      <span className="evidence-quote">{item.quote}</span>
                    </li>
                  ))}
                </ul>
              </div>
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

          {video.visualAnalysis ? (
            <div className="detail-card">
              <h3>画面证据</h3>
              <p className="visual-summary">{video.visualAnalysis.summary}</p>
              <p className="muted">
                {[
                  video.visualAnalysis.signals.hasCampScene ? '搭营' : null,
                  video.visualAnalysis.signals.hasCookingScene ? '做饭' : null,
                  video.visualAnalysis.signals.hasFishCloseup ? '鱼获展示' : null,
                  video.visualAnalysis.signals.hasRoadSignText ? '路牌文字' : null,
                  video.visualAnalysis.signals.hasRainGearOrWetGround ? '雨天环境' : null,
                  video.visualAnalysis.signals.hasShoppingScene ? '买菜场景' : null,
                ]
                  .filter(Boolean)
                  .join(' / ') || '已抽取关键帧'}
              </p>

              {visualFrames.length > 0 ? (
                <div className="visual-frame-grid">
                  {visualFrames.map((frame, index) => (
                    <div key={`${frame.timestampText}-${index}`} className="visual-frame-card">
                      {frame.imageUrl ? <img src={frame.imageUrl} alt={`关键帧 ${frame.timestampText}`} /> : null}
                      <div className="visual-frame-card-body">
                        <div className="visual-frame-time">{frame.timestampText}</div>
                        {frame.sceneTags.length > 0 ? (
                          <div className="visual-frame-tags">
                            {frame.sceneTags.map((tag) => <span key={tag}>{tag}</span>)}
                          </div>
                        ) : null}
                        {frame.ocrText ? <p className="visual-frame-ocr">OCR：{frame.ocrText}</p> : null}
                        {frame.transcriptWindow ? <p className="visual-frame-note">关联台词：{frame.transcriptWindow}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

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

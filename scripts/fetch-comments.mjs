import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const rawDir = resolve(root, 'raw/videos');

/**
 * 为单个视频抓取评论缓存。
 * 使用 opencli bilibili comments 命令（复用浏览器登录态）。
 * @param {string} bvid
 * @param {{ limit?: number, forceRefresh?: boolean }} options
 * @returns {{ success: boolean, count: number, cached?: boolean, error?: string }}
 */
export function fetchComments(bvid, { limit = 200, forceRefresh = false } = {}) {
  const videoDir = resolve(rawDir, bvid);
  mkdirSync(videoDir, { recursive: true });
  const cachePath = resolve(videoDir, 'comments.json');

  // 如果已有缓存且不强制刷新，直接返回
  if (!forceRefresh && existsSync(cachePath)) {
    try {
      const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
      if (Array.isArray(cached) && cached.length > 0) {
        return { success: true, count: cached.length, cached: true };
      }
    } catch {
      // 缓存损坏，重新抓取
    }
  }

  const allComments = [];
  const seenRpids = new Set();

  try {
    // B站 API 每页最多 50 条，分多页抓取
    const pages = Math.ceil(limit / 50);
    for (let page = 1; page <= pages; page++) {
      const pageLimit = Math.min(50, limit - allComments.length);
      if (pageLimit <= 0) break;

      try {
        const raw = execFileSync('opencli', [
          'bilibili', 'comments', bvid,
          '--limit', String(pageLimit),
          '-f', 'json',
          '--site-session', 'persistent',
          '--window', 'background',
        ], { encoding: 'utf8', timeout: 60000, stdio: 'pipe' });

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          // 可能返回非 JSON 提示信息
          if (raw.includes('no comments') || raw.includes('暂无评论')) break;
          console.warn(`  [comments] JSON parse warning for ${bvid} page ${page}: ${raw.slice(0, 100)}`);
          break;
        }

        if (!Array.isArray(parsed) || parsed.length === 0) break;

        for (const comment of parsed) {
          if (seenRpids.has(comment.rpid)) continue;
          seenRpids.add(comment.rpid);
          allComments.push({
            rpid: comment.rpid,
            author: comment.author,
            text: comment.text,
            likes: comment.likes,
            replies: comment.replies,
            time: comment.time,
          });
        }

        // 如果返回数量少于请求数量，说明没有更多了
        if (parsed.length < pageLimit) break;

        // 页间短暂延迟，避免触发风控
        if (page < pages) {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
        }
      } catch (pageErr) {
        console.warn(`  [comments] page ${page} failed for ${bvid}: ${pageErr.message}`);
        break;
      }
    }

    writeFileSync(cachePath, JSON.stringify(allComments, null, 2) + '\n');
    console.log(`  [comments] ${bvid}: ${allComments.length} comments cached`);
    return { success: true, count: allComments.length };
  } catch (err) {
    // 写入失败记录，不阻塞后续流程
    const failureNote = { error: err.message, time: new Date().toISOString() };
    writeFileSync(cachePath, JSON.stringify(failureNote, null, 2) + '\n');
    console.warn(`  [comments] ${bvid} failed: ${err.message}`);
    return { success: false, count: 0, error: err.message };
  }
}

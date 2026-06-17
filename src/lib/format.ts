export function formatDate(input: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(input));
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}小时${minutes}分`;
  }
  return `${minutes}分${secs}秒`;
}

export function formatMoney(value: number | null, fallback: string | null): string {
  if (value === null) {
    return fallback ?? '未在视频中明确提及';
  }
  return `¥${value.toFixed(2)}`;
}

export function formatConfidence(level: string): string {
  switch (level) {
    case 'high':
      return '高';
    case 'medium':
      return '中';
    case 'low':
      return '低';
    default:
      return '未知';
  }
}

const COLORS = {
  online: '#22c55e',
  away: '#f59e0b',
}

export function OnlineDot({ status, size = 'sm' }) {
  if (!status || !COLORS[status]) return null
  const dim = size === 'lg' ? 'w-4 h-4' : size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'
  return (
    <span
      className={`absolute bottom-0 right-0 ${dim} rounded-full border-2`}
      style={{ background: COLORS[status], borderColor: 'var(--bg-card)' }}
      title={status === 'online' ? 'Онлайн' : 'Недавно был(а) в сети'}
    />
  )
}

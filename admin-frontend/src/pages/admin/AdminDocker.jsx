import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../api/auth'
import { useTranslation } from '../../hooks/useTranslation'
import { RefreshCw, RotateCcw, Terminal, Server, Cpu, MemoryStick, HardDrive } from 'lucide-react'
import toast from 'react-hot-toast'

function statusColor(state) {
  if (state === 'running') return '#22c55e'
  if (state === 'exited')  return '#ef4444'
  return '#f59e0b'
}

function fmtBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes, i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${units[i]}`
}

function ProgressBar({ pct }) {
  const p = Math.min(100, Math.max(0, pct || 0))
  const c = p > 85 ? '#ef4444' : p > 60 ? '#f59e0b' : 'var(--accent)'
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
      <div style={{ width: `${p}%`, background: c, height: '100%', borderRadius: 'inherit', transition: 'width 0.3s' }} />
    </div>
  )
}

function ContainerCard({ container, onRestart, restarting }) {
  const { t } = useTranslation()
  const s = container.stats
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor(container.state), boxShadow: `0 0 6px ${statusColor(container.state)}` }} />
            <span className="font-mono text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{container.name}</span>
          </div>
          <p className="text-xs mt-0.5 ml-4" style={{ color: 'var(--text-muted)' }}>{container.image}</p>
        </div>
        <button onClick={() => onRestart(container.name)} disabled={restarting} title={t('dockerRestartConfirm')}
          className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-40">
          <RotateCcw size={14} className={restarting ? 'animate-spin' : ''} style={{ color: '#ef4444' }} />
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{container.status}</p>

      {s ? (
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1"><Cpu size={11} /> CPU</span>
              <span>{s.cpu_pct.toFixed(1)}%</span>
            </div>
            <ProgressBar pct={s.cpu_pct} />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-1"><MemoryStick size={11} /> RAM</span>
              <span>{fmtBytes(s.mem_usage)} / {fmtBytes(s.mem_limit)} ({s.mem_pct.toFixed(1)}%)</span>
            </div>
            <ProgressBar pct={s.mem_pct} />
          </div>
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dockerStatsUnavailable')}</p>
      )}
    </div>
  )
}

function LogsPanel({ containers }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState('')
  const [lines, setLines] = useState(200)
  const [autoScroll, setAutoScroll] = useState(true)

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['container-logs', selected, lines],
    queryFn: () => adminApi.containerLogs(selected, lines).then((r) => r.data),
    enabled: !!selected,
    refetchInterval: false,
  })

  const logs = data?.logs || []

  return (
    <div className="card p-4 flex flex-col gap-3" style={{ minHeight: 400 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <Terminal size={15} style={{ color: 'var(--accent)' }} />
        <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('dockerContainerLogs')}</h2>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input text-sm py-1" style={{ maxWidth: 200 }}>
          <option value="">{t('dockerSelectContainer')}</option>
          {containers.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        <select value={lines} onChange={(e) => setLines(Number(e.target.value))} className="input text-sm py-1" style={{ maxWidth: 110 }}>
          {[50, 100, 200, 500, 1000].map((n) => <option key={n} value={n}>{n} {t('dockerLines')}</option>)}
        </select>
        <button onClick={refetch} disabled={!selected || isFetching} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> {t('dockerRefresh')}
        </button>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          {t('dockerAutoScroll')}
        </label>
      </div>

      <div className="font-mono text-xs rounded-lg p-3 overflow-auto flex-1"
        style={{ background: '#0d1117', color: '#c9d1d9', maxHeight: 500, minHeight: 200 }}
        ref={(el) => { if (el && autoScroll && logs.length) el.scrollTop = el.scrollHeight }}>
        {!selected && <span style={{ color: '#6e7681' }}>{t('dockerSelectForLogs')}</span>}
        {selected && isFetching && !logs.length && <span style={{ color: '#6e7681' }}>{t('loading')}</span>}
        {logs.map((line, i) => (
          <div key={i} className="leading-5" style={{ color: line.stream === 'stderr' ? '#f85149' : '#c9d1d9' }}>{line.text}</div>
        ))}
        {selected && !isFetching && !logs.length && <span style={{ color: '#6e7681' }}>{t('dockerNoLogs')}</span>}
      </div>
    </div>
  )
}

export function AdminDocker() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [restartingMap, setRestartingMap] = useState({})

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['docker-containers'],
    queryFn: () => adminApi.listContainers().then((r) => r.data),
    refetchInterval: 15000,
  })

  const containers = data?.containers || []
  const disk       = data?.disk

  const handleRestart = async (name) => {
    if (!window.confirm(`${t('dockerRestartConfirm')} «${name}»?`)) return
    setRestartingMap((m) => ({ ...m, [name]: true }))
    try {
      await adminApi.restartContainer(name)
      toast.success(`${name} ${t('dockerRestarting')}`)
      setTimeout(() => qc.invalidateQueries({ queryKey: ['docker-containers'] }), 5000)
    } catch (err) {
      toast.error(err.response?.data?.detail || t('dockerRestartError'))
    } finally {
      setRestartingMap((m) => ({ ...m, [name]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server size={20} style={{ color: 'var(--accent)' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Docker</h1>
        </div>
        <button onClick={refetch} disabled={isFetching} className="btn-secondary text-sm flex items-center gap-2">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> {t('dockerRefresh')}
        </button>
      </div>

      {disk && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={14} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('dockerDisk')}</span>
            <span className="text-sm ml-auto" style={{ color: 'var(--text-muted)' }}>
              {fmtBytes(disk.used)} / {fmtBytes(disk.total)} ({disk.pct}%)
            </span>
          </div>
          <ProgressBar pct={disk.pct} />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('dockerLoadingContainers')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {containers.map((c) => (
            <ContainerCard key={c.name} container={c} onRestart={handleRestart} restarting={!!restartingMap[c.name]} />
          ))}
        </div>
      )}

      <LogsPanel containers={containers} />
    </div>
  )
}

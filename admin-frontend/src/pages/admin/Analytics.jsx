import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { adminApi } from '../../api/auth'
import { PageSpinner } from '../../components/ui/Spinner'
import { useAppStore } from '../../store/appStore'
import {
  Settings2, Eye, TrendingUp, Download, Upload, MessageSquare, Star,
  Users, CheckCircle, BookOpen,
} from 'lucide-react'

const PERIODS = [
  { value: 'week', label: '7 дней' },
  { value: 'month', label: '30 дней' },
  { value: 'year', label: '12 месяцев' },
  { value: 'all', label: 'Всё время' },
]

const CHART_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#14b8a6', '#f97316', '#ec4899', '#06b6d4', '#84cc16',
]

const BOOK_WIDGETS = [
  { id: 'most_read',       label: 'Самые читаемые',    icon: BookOpen },
  { id: 'most_completed',  label: 'Самые дочитываемые', icon: CheckCircle },
  { id: 'most_downloaded', label: 'Самые скачиваемые', icon: Download },
]
const USER_WIDGETS = [
  { id: 'top_uploaders',  label: 'Активные загрузчики',     icon: Upload },
  { id: 'top_commenters', label: 'Активные комментаторы',   icon: MessageSquare },
  { id: 'top_raters',     label: 'Активные оценщики',       icon: Star },
]
const ALL_WIDGETS = [
  { id: 'visits', label: 'Посещения сайта', icon: TrendingUp },
  ...BOOK_WIDGETS,
  ...USER_WIDGETS,
]

function useWidgetConfig(userId) {
  const storageKey = `admin_dashboard_${userId}`
  const [hidden, setHidden] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  const toggle = useCallback((id) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(storageKey, JSON.stringify([...next]))
      return next
    })
  }, [storageKey])

  return { hidden, toggle }
}

// ── Toggle switch (same style as profile privacy toggles) ────────────────────
function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={onChange}
      className="w-10 h-5 rounded-full transition-colors flex-shrink-0 relative cursor-pointer"
      style={{ background: checked ? 'var(--accent)' : 'var(--border)' }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
        style={{ left: checked ? '22px' : '2px' }}
      />
    </div>
  )
}

// ── Widget constructor panel ──────────────────────────────────────────────────
function WidgetConstructor({ hidden, toggle }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        style={{
          background: open ? 'var(--accent-muted)' : 'var(--bg-secondary)',
          color: open ? 'var(--accent)' : 'var(--text-secondary)',
          border: '1px solid var(--border)',
        }}
      >
        <Settings2 size={15} /> Виджеты
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-10 z-50 rounded-2xl shadow-xl p-4 min-w-[240px]"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Показывать / скрывать
            </p>
            <div className="space-y-3">
              {ALL_WIDGETS.map(({ id, label }) => (
                <div key={id} className="flex items-center justify-between gap-3">
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
                  <Toggle checked={!hidden.has(id)} onChange={() => toggle(id)} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} style={{ color: 'var(--accent)' }} />
        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function BookRow({ item, rankField, rank }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
      <span className="w-5 text-center text-sm font-bold" style={{ color: 'var(--text-muted)' }}>{rank}</span>
      <div
        className="w-8 h-10 rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ background: 'var(--bg-secondary)' }}
      >
        {(item.book__cover_path || item.cover_path) ? (
          <img src={item.book__cover_path || item.cover_path} alt="" className="w-full h-full object-cover" />
        ) : (
          <BookOpen size={14} style={{ color: 'var(--text-muted)' }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {item.book__title || item.title}
        </p>
      </div>
      <span className="text-sm font-bold flex-shrink-0" style={{ color: 'var(--accent)' }}>
        {item[rankField]}
      </span>
    </div>
  )
}

function UserRow({ item, rankField, rank }) {
  const username = item.user__username || item.uploaded_by__username
  const avatar   = item.user__avatar   || item.uploaded_by__avatar
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
      <span className="w-5 text-center text-sm font-bold" style={{ color: 'var(--text-muted)' }}>{rank}</span>
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden text-xs font-bold"
        style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
      >
        {avatar ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          (username || '?')[0].toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{username}</p>
      </div>
      <span className="text-sm font-bold flex-shrink-0" style={{ color: 'var(--accent)' }}>
        {item[rankField]}
      </span>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

function MiniBarChart({ data: rows, dataKey, nameKey }) {
  return (
    <div className="mb-4">
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} />
          <YAxis type="category" dataKey={nameKey} tick={false} width={0} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey={dataKey} name={dataKey} radius={4}>
            {rows.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Book widget renderer ──────────────────────────────────────────────────────
function BookWidget({ id, title, icon, data }) {
  const rows = data?.slice(0, 5) || []
  const { dataKey, nameKey } = id === 'most_downloaded'
    ? { dataKey: 'download_count', nameKey: 'title' }
    : id === 'most_completed'
    ? { dataKey: 'completions', nameKey: 'book__title' }
    : { dataKey: 'readers', nameKey: 'book__title' }

  return (
    <Section title={title} icon={icon}>
      {rows.length ? (
        <>
          <MiniBarChart data={rows} dataKey={dataKey} nameKey={nameKey} />
          {rows.map((item, i) => (
            <BookRow key={i} item={item} rankField={dataKey} rank={i + 1} />
          ))}
        </>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Нет данных</p>
      )}
    </Section>
  )
}

// ── User widget renderer ──────────────────────────────────────────────────────
function UserWidget({ id, title, icon, data }) {
  const rows = data?.slice(0, 5) || []
  const rankField = id === 'top_uploaders' ? 'uploads' : id === 'top_commenters' ? 'comments' : 'ratings'
  return (
    <Section title={title} icon={icon}>
      {rows.length ? rows.map((item, i) => (
        <UserRow key={i} item={item} rankField={rankField} rank={i + 1} />
      )) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Нет данных</p>
      )}
    </Section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function Analytics() {
  const { user } = useAppStore()
  const [period, setPeriod] = useState('month')
  const { hidden, toggle } = useWidgetConfig(user?.id || 'anon')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'analytics', period],
    queryFn: () => adminApi.analytics(period).then((r) => r.data),
  })

  const visitChartData = useMemo(() => (data?.visits_daily || []).map((v) => ({
    date: v.date, Всего: v.total, 'Зарег.': v.registered,
  })), [data])

  const visibleBookWidgets = BOOK_WIDGETS.filter((w) => !hidden.has(w.id))
  const visibleUserWidgets = USER_WIDGETS.filter((w) => !hidden.has(w.id))

  if (isLoading) return <PageSpinner />

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Аналитика</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className="px-3 py-1.5 text-sm font-medium transition-colors"
                style={{
                  background: period === p.value ? 'var(--accent)' : 'transparent',
                  color: period === p.value ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <WidgetConstructor hidden={hidden} toggle={toggle} />
        </div>
      </div>

      {/* Visit summary cards */}
      {!hidden.has('visits') && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-500">
              <Eye size={22} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{data?.total_visits ?? 0}</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Уникальных посещений</p>
            </div>
          </div>
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-500">
              <Users size={22} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{data?.registered_visits ?? 0}</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Из них зарегистрированных</p>
            </div>
          </div>
        </div>
      )}

      {/* Visit chart */}
      {!hidden.has('visits') && visitChartData.length > 0 && (
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Посещения по дням</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={visitChartData}>
              <defs>
                <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradReg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Всего" stroke="#6366f1" fill="url(#gradTotal)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="Зарег." stroke="#22c55e" fill="url(#gradReg)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Book widgets — only visible ones, auto-fill grid */}
      {visibleBookWidgets.length > 0 && (
        <div
          className="gap-5 mb-5"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(visibleBookWidgets.length, 3)}, minmax(0, 1fr))`,
          }}
        >
          {visibleBookWidgets.map(({ id, label, icon }) => (
            <BookWidget key={id} id={id} title={label} icon={icon} data={data?.[id]} />
          ))}
        </div>
      )}

      {/* User widgets — only visible ones, auto-fill grid */}
      {visibleUserWidgets.length > 0 && (
        <div
          className="gap-5"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(visibleUserWidgets.length, 3)}, minmax(0, 1fr))`,
          }}
        >
          {visibleUserWidgets.map(({ id, label, icon }) => (
            <UserWidget key={id} id={id} title={label} icon={icon} data={data?.[id]} />
          ))}
        </div>
      )}
    </div>
  )
}

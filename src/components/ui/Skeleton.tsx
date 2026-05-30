'use client'

export function Skeleton({ width = '100%', height = 16, radius = 6, style = {} }: {
  width?: string | number
  height?: string | number
  radius?: number
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--bg-3) 25%, var(--bg-4) 50%, var(--bg-3) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.4s ease infinite',
      ...style,
    }} />
  )
}

export function SkeletonCard() {
  return (
    <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Skeleton width={60} height={10} radius={4} />
      <Skeleton width="70%" height={28} radius={6} />
      <Skeleton width={80} height={10} radius={4} />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <tr>
      {[90, 160, 80, 80, 60, 60].map((w, i) => (
        <td key={i} style={{ padding: '12px 14px' }}>
          <Skeleton width={w} height={12} radius={4} />
        </td>
      ))}
    </tr>
  )
}

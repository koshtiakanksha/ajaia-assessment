const COLORS = ['#2563eb', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0891b2']

/** Circle with initials; the color is stable per email. */
export default function Avatar({ user, size = 32 }: { user: { email: string; name?: string | null }; size?: number }) {
  const label = user.name || user.email
  const initials = label
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  const hash = [...user.email].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0)
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.4, background: COLORS[hash % COLORS.length] }}
    >
      {initials}
    </span>
  )
}

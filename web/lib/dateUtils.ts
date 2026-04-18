export function getDemoDate(): string {
  const d = new Date()
  // Используем локальную дату, а не UTC — важно для часовых поясов (UTC+5 и т.д.)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

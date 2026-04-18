export function getDemoDate(): string {
  const d = new Date()
  const day = d.getDay()
  if (day === 0) {
    // Sunday -> Friday
    d.setDate(d.getDate() - 2)
  } else if (day === 6) {
    // Saturday -> Friday
    d.setDate(d.getDate() - 1)
  }
  return d.toISOString().split('T')[0]
}

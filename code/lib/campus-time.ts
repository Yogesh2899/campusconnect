export const campusZone = 'Asia/Kolkata'
const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: campusZone, year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFormat = new Intl.DateTimeFormat('en-IN', { timeZone: campusZone, hour: 'numeric', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('en-IN', { timeZone: campusZone, weekday: 'short', day: 'numeric', month: 'short' })

export const campusDay = (date: Date) => dateFormat.format(date)
export const campusTime = (date: Date) => timeFormat.format(date)
export const campusDate = (date: Date) => dayFormat.format(date)
export const dayStart = (day: string) => new Date(day + 'T00:00:00+05:30')
export const shiftDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000)
export const monday = (date: Date) => {
  const start = dayStart(campusDay(date))
  const day = shiftDays(start, 1).getUTCDay()
  return shiftDays(start, -((day + 6) % 7))
}

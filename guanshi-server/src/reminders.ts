import { createTimer } from './repos'
import type { Duty } from './types'
import { atLocal, now } from './util'

/** 给新建的待办补一个默认提醒时间，保证真的会响 */
export function armByTimeLabel(userId: string, duty: Duty): void {
  const hm = duty.timeLabel.match(/(\d{1,2})[:：](\d{2})/)
  const time = hm ? `${hm[1].padStart(2, '0')}:${hm[2]}` : duty.timeLabel.includes('晚') ? '20:00' : '09:00'
  const due = atLocal(duty.date, time)
  if (due > now()) {
    createTimer(userId, due, { dutyId: duty.id })
  }
}

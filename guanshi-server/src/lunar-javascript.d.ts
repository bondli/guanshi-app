declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar
    getFestivals(): string[]
    getLunar(): Lunar
  }

  export class Lunar {
    getFestivals(): string[]
    getJieQi(): string
  }

  export class Holiday {
    getName(): string
    isWork(): boolean
  }

  export const HolidayUtil: {
    getHoliday(year: number, month: number, day: number): Holiday | null
  }
}

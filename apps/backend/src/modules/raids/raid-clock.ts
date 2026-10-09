/** Injectable clock, so tests can pin the week a Raid is created in. */
export const RAID_CLOCK = Symbol('RAID_CLOCK');
export type RaidClock = () => Date;
export const systemRaidClock: RaidClock = () => new Date();

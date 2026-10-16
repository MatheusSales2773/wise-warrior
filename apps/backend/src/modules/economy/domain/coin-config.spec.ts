import { getRaidWinCoins } from './coin-config';

describe('getRaidWinCoins', () => {
  const original = process.env.RAID_WIN_COINS;
  afterEach(() => {
    if (original === undefined) delete process.env.RAID_WIN_COINS;
    else process.env.RAID_WIN_COINS = original;
  });

  it('defaults to 50', () => {
    delete process.env.RAID_WIN_COINS;
    expect(getRaidWinCoins()).toBe(50);
  });

  it('reads RAID_WIN_COINS and falls back to 50 when it is invalid', () => {
    process.env.RAID_WIN_COINS = '80';
    expect(getRaidWinCoins()).toBe(80);
    for (const bad of ['abc', '-5', '2.5', '']) {
      process.env.RAID_WIN_COINS = bad;
      expect(getRaidWinCoins()).toBe(50);
    }
  });
});

import { PresenceRegistry } from './presence.registry';

describe('PresenceRegistry', () => {
  it('keeps a user online until their last socket leaves the guild', () => {
    const presence = new PresenceRegistry();
    expect(presence.connect('g1', 'u1', 's1')).toBe(true);
    expect(presence.connect('g1', 'u1', 's2')).toBe(false);
    expect(presence.onlineUserIds('g1')).toEqual(['u1']);
    expect(presence.disconnect('g1', 'u1', 's1')).toBe(false);
    expect(presence.disconnect('g1', 'u1', 's2')).toBe(true);
    expect(presence.onlineUserIds('g1')).toEqual([]);
  });

  it('ignores unknown sockets and scopes presence per guild', () => {
    const presence = new PresenceRegistry();
    presence.connect('g1', 'u1', 's1');
    expect(presence.disconnect('g2', 'u1', 's1')).toBe(false);
    expect(presence.onlineUserIds('g2')).toEqual([]);
  });
});

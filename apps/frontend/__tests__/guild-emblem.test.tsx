import { render, screen } from '@testing-library/react-native';
import { GuildEmblem, guildEmblemFor } from '@/features/guild/guild-emblem';

const idAt = (index: number) => `0b9f6c1e-52a4-4d7e-9a3b-${String(index).padStart(12, '0')}`;
const ids = Array.from({ length: 40 }, (_, index) => idAt(index));

describe('guildEmblemFor', () => {
  it('derives the same emblem for the same Guild id', () => {
    expect(guildEmblemFor(idAt(0))).toEqual(guildEmblemFor(idAt(0)));
  });

  it('tends to give different Guilds different emblems', () => {
    const looks = new Set(ids.map((id) => JSON.stringify(guildEmblemFor(id))));
    expect(looks.size).toBeGreaterThan(ids.length / 2);
  });
});

describe('GuildEmblem', () => {
  const emblemJson = async (guildId: string) => {
    const view = await render(<GuildEmblem guildId={guildId} name="Ordem do Foco" />);
    const json = JSON.stringify(view.toJSON());
    await view.unmount();
    return json;
  };

  it('renders the same emblem on every render for the same Guild', async () => {
    expect(await emblemJson(idAt(1))).toBe(await emblemJson(idAt(1)));
  });

  it('renders different emblems for Guilds with different looks', async () => {
    const other = ids.find((id) => JSON.stringify(guildEmblemFor(id)) !== JSON.stringify(guildEmblemFor(idAt(0))))!;
    expect(await emblemJson(idAt(0))).not.toBe(await emblemJson(other));
  });

  it('is labelled with the Guild name for assistive technology', async () => {
    await render(<GuildEmblem guildId={idAt(2)} name="Ordem do Foco" />);
    expect(screen.getByRole('image', { name: 'Emblema da guilda Ordem do Foco' })).toBeTruthy();
  });

  it('can be decorative when the name is already next to it', async () => {
    await render(<GuildEmblem decorative guildId={idAt(2)} name="Ordem do Foco" />);
    expect(screen.queryByRole('image')).toBeNull();
    expect(screen.queryByLabelText('Emblema da guilda Ordem do Foco')).toBeNull();
  });
});

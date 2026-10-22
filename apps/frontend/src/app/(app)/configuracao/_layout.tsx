import { SettingsLayout } from '@/features/settings/settings-screen';

// A deep link or a reload on a section keeps the Configuração list beneath it, so back returns there.
export const unstable_settings = { anchor: 'index' };

export default SettingsLayout;

import type { PixelSpriteData } from '@/features/character/sprites';

/*
 * Cena da Raid 'Vulcão do Devorador', exportada do Figma (06b · Guilda, componente 'Cena/Raid — Vulcão do Devorador',
 * 180 × 80 pixels). O fundo e o chefe são fixos; os membros são desenhados por cima, nas vagas de `raidPartySlots`.
 * Escale só por inteiros (×6 no desktop, ×2 no celular).
 */

export const RAID_SCENE_WIDTH = 180;
export const RAID_SCENE_HEIGHT = 80;

/** Céu, lua, torre, vulcão e chão. Usa mais de 26 cores, então também tem letras maiúsculas. */
export const raidSceneBackground: PixelSpriteData = {
  palette: ['#0d0b1f', '#f3ead4', '#6a5a8a', '#4a3e6a', '#7aa8e0', '#f0a050', '#cfc8e8', '#ffffff', '#d8d0b8', '#efe6cf', '#bdb49a', '#4e3550', '#16112e', '#6a3a42', '#24173f', '#f0c050', '#f08030', '#e8702a', '#f0a040', '#3a1d4f', '#120a1a', '#2a1530', '#331a3a', '#5a2552', '#f0b040', '#c44a2a', '#8a3448', '#b8483c', '#2a1838', '#c08030', '#d8693a', '#1e1129', '#e8853a', '#1e1226', '#140c18', '#3a2848'],
  rows: [
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'aaaaabaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaacdaaaaaaaaba',
    'aaaaaeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaacdaaaaaaaaaaa',
    'aaaaaaaaaabaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaafaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaeaaaaaaaaaaaaaaaaaaaaaaaaaaaafaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'aaaaaaaaeaaaaaaaaaaaaagaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaacdaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaaaaaaaghgaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabaaaaaaaaaaaaaaaaaaacdaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaaaaaaaagaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaeaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaagaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaacdaaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaeaaaaaaaaaeaaaaaaaaaaaaaaaaaaaaaaaaaaabaaaaaaaaaaaaaaaaaaaabaaaaaaaaaaaaaaaaghgaaaaaaaaaaaaaaaaaabaaaaaaaaaaaaaaaaaaaaaacdaaaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaaabaaaaaaaaaaaaaaaaaiijjjkkaaaabaaaabaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaagaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabiijjjkkkkkkaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaalalalalaaaaaaaaaacdaaaaaabaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaaaaaaaaaaabaaaaaaijjjjkkkkkkkkaaaaaaaaaaaaaaaaaaaaaaaaagaaaaaaaaaaaaaaaaaaaabaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaalalalaaaaaaaaaacdaaaaaaaaaaaaaaaaaaaa',
    'emamamamamamamamamamamamamamamamijjjkkkkkkkkkmamamamamamamamamaeamamaghgamamamamamamamamamamamamamamamamamamamamamamamamamamamamamamamamlmlmamlmlmlmlmabamamamamamamamamamamamamamam',
    'mmmammmammmammmammmammmammmammmijjjjkkkkkkkkkkmammmammmammmammmammmammgammmammmammmammmammmammmammmammmammmbmmmammmammmammmammmammmammmlmlmlmmflmlmlmmmammmacdmammmammmammmammmambma',
    'mmmmmmbmmmmmmmmmmmmmmmmmmmmmmmmijjjkkkkkkkkkkkmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmlmlmlmlmlmlmlmlmmmmmmcdmmmmmmmmmmmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmjjjjkkkkkkkkkkkmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmlmlmlmlmlmlmlmlmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmjjjjkkkkkkkkkkkmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmbmmmmmmmmmmmmmmmlmlmlblmmmmmmmmmmmcddmmmmmmmmmmmmmmmmmmmmmmmmm',
    'mmemmmmmmmmmmmmmmmmmmmmmmmmmmmmjjjjjkkkkkkkkkkmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmlmlmlmlmlmmmmmmmmmmmmmmmmmmmmmmbmmmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmijjjjkkkkkkkkkkmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmbmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmlmlmlmlmlmlmmmmmcdmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmijjjjjkkkkkkkkkmmmmmmmbmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmemmmmmmmmmmlmlmlmlmlmlmmmcdmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmijjjjjkkkkkkkmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmlmlmlmlmlmlmmghgmmmmmmmbmmmmmmmmmmmmmmmmmmmm',
    'mmmmmmmmmmmmmmmmmmmmmbmmmmmmmmmmijjjjjjjkkkjimmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmnmnmnmnmnmndmgmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
    'momomomomomomomomomomomomomomomomiijjjjjjjiimomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomomonononononomomomomomomomomomomomomomomomomo',
    'ooomooomooomooomooomooomooomooomoooiijjjiiomooomooomooomooomooomooomooomooomooomooomooomooomooomooomooomoobmooomooomooomooomooomooomooomononononononooomooomooomooomooomooomooomooom',
    'ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooofoooooooooooooooooooooooooooooooooooooooooooooooooooonononononooooooooooooooooooooooooooooooooo',
    'oooooooooooooooooooooooooooooooooooooooooooooooooboooooooooooooooooooooooooooooooooooooooooooooogoooooooooooooooooooooooooooooooobooooooononononononoooooooooooooooooooooooooooooooo',
    'oooooooooooooooooooooooooooobooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooghgoooooooooooooooooooooooooooooooooooooooonononononooooboeoooooooooooooooooooooooooo',
    'ooooooooooobooooooooooooooooooooooooooooooooooooooooooooooooooooooooooeooooooooooooooooooooooooogoooooooooooooooooooooooooooooooooooooooooononononoooooooooooooooooooooooooooooooooo',
    'oooooooooooooooooooooooooooooooooooooooooooooooooooooooobooooooooooooooooooooooooooooooooooooooooooooooooboooooooooooooooooooooooooooooooooonononooooooooooooooooooooooooooooooooooo',
    'oooooooooooooooooooooooooooooooooooooooooooobooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooopppppooooooooooooooooooooooooooooooooboo',
    'ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooqqqqqqqqqooooooooooooooooooooooooooooooooo',
    'oooooooooooooooeoooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooorsrsrsrsroooooooooooooofoooooooooooooooooo',
    'otototototutututututototototototototototototototototototototototototototototototototototototototototototototototototototototototftotototototvrrwwtototototototototototototototototot',
    'tttotttottuoutuoutuotttotttotttotttotttotttotttotttotttotttotttotttotttotttotttotttotttotttotttotttotttotttotbtotttotttotttotttotttotttotbtovrvrwttotttotttotttotttotttotttotttottto',
    'ttttttttttuuuuuuuuuuttttttttttttttttttttttttttttttttttttttttttttttttttbttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttvvrvrwwtttttttttttttttttttttttbtttttttttt',
    'ttttttttttuuuuuuuuuuttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttvvvpvrwwwtttttttttttttttttttettttttttttttt',
    'ttttttttttuuuuuuuuuuttttttttttttttttttttttttttttttttttttttttttttttttttttttttttettttttttttttttttttttttttttttttttttttttttttttttttttttttttttvvvrvvvpwwwtttttttttttttttttttttttttttttttt',
    'ttttttttttuuuuuuuuuuttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttbttttttttttttttttttttttttttttttttttttvvvrvvvrwwwtttttttttttttttttttttttttttttttt',
    'ttttttttttuuuuuuuuuuttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttvvvrvvvvvrwwwttttttttttttttttttttttttttttttt',
    'tttttttttbuuuuuuuuuuttttttttbtttttttbttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttftvvvvrvvvvvwrwwwtttttttttttttttttttttttttttttt',
    'txtxtxtxtxuuuuyyuuuutxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtftxtxtxtxtxtxtxtxtxvvvvpvvvvvvwrwwwwxtxtxbxtxtxtxtxtxtxtxtxtxtxtx',
    'xxxtxxxtxxuuuuyyuuuuxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxxxtxvvvvrvvvvvvzvwrwwwwxxxtxxxtxxxtxxxtxxxtxxxtxxxt',
    'xxxxxxxxxxuuuuyyuuuuxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxvvvvrvvvvvzvvwpwwwwxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'xxxxxxxxxxuuuuuuuuuuxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxbxxxxxxxxxxxexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxvvvvrvvvvvvzvvwrwwwwwxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'xxxxxxxxxxuuuuuuuuuuxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxvvvvvrvvvvvzvvvwwrwwwwwxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'xxxxxxxxxxuuuuuuuuuuxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxvvvvvvpvvvvvzvvvvwrwwwwwwxxxxxxxxxxxxxxxxxxxxxxxxx',
    'xAxAxAxAxAuuuuuuuuuuxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAxAvvvvvvrvvvvvzvvvvwrwwwwwwAxAxAxAxAxAxAxAxAxAxAxAxA',
    'AAAxAAAxAAuuuuuuuuuuAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAAAxAvvvvvvvrvvvvzvvvvvwrwwwwwwwAAAxAAAxAAAxAAAxAAAxAAAx',
    'AAAAAAAAAAuuuuuuuuuuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAvvvvvvvvrvvvvvzvvvvwpwwwwwwwwAAAAAAAAAAAAAAAAAAAAAAA',
    'AAAAAAAAAAuuuuuuuuuuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAvvvvvvvvrvvvvvvzvvvvvrwwwwwwwwwAAAAAAAAAAAAAAAAAAAAAA',
    'AAAAAAAAAAuuuuuuuuuuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAvvvvvvvvvpvvvvvvvzvvvvrwwwwwwwwwwAAAAAAAAAAAAAAAAAAAAA',
    'ABACCCCCCBuuuuuuuuuuABABABABABABABABABABABABABABABABABABABABABABABABABABABABABACCCABABABABABABABABABABABABABABABABABABABABABABvvvvvvvvvrvvvvvvvzvvvvrwwwwwwwwwwBABABABABABABABABABAB',
    'BBCCCCCCCCuuuuuDuuuuBBBABBBABBBABBBABBBABBBABBBABBBABBBABBCCCCCABBBABBBABBBACCCCCCCCBBBABBBABBBABBBABBBABBBABBBABBBABBBABBBABvvvvvvvvvvrvvvvvvvvzvvvvrwwwwwwwwwwBBBABBBABBBABBBABBBA',
    'CCCCCCCCCCuuuuuDuuuuBBCCCCCCCCBBBBBBBBBBBBBBBBBBBBBBBBBBCCCCCCCCCCCBBBBBBCCCCCCCCCCCCCBBBBBBBBBBBBBBBBBBBBBBBBBBBBCCBBBBBBBBvvvvvvvvvvrvvvvvvvvvzvvvvrwwwwwwwwwwwBBBBBBBBBBBBBBBBBBB',
    'CCCCCCCCCCuuuuuuuuuuCCCCCCCCCCCBBBBBBBBBBBBBBBBBBBBBBBBCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBBBBBBBBBBBBBBBBBBBBBBBBCCCCCCCCCCCCvvvvvvvvvvrvvvvvvvvvvzvvvvpwwwwwwwwwwwwBBBBBBBBBBBBBBBBBB',
    'CCCCCCCCCCuuuuuuuuuuCCCCCCCCCCCCBEBEBEBEBEBEBEBEBEBEBECCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCBEBEBEBEBEBEBEBEBEBEBCCCCCCCCCCCCCCvvvvvvvvvvpvvvvvvvvvvzvvvvwrwwwwwwwwwwwwEBCCCCCCCCCCCCCCC',
    'CCCCCCCCCCuuuuuuuuuuCCCCCCCCCCCCCCEBEEEBEEEBEEEBEEEBECCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCEEBEEEBEEEBEEEBEEEBCCCCCCCCCCCCCCvvvvvvvvvvrvvvvvvvvvvzvvvvvvwrwwwwwwwwwwwBCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCuuuuuuuuuuCCCCCCCCCCCCCCCEEEEEEFFFEEEEEEEECCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCEEEEEEEEEEEEEEEEECCCCCCCCCCCCCCvvvvvvvvvvrvvvvvvvvvvvzvvvvvvwrwwwwwwwwwwwwCCCCCCCCCFFFCCCC',
    'CCCCCCCCCCuuuuuuuuuuCCCCCCCCCCCCCCCGEGEFFFFFFFEGEGECCCCCCCCCCCCCCCCCCCCCCCCCCCCFFFFFFCCCCCEGEGEGEGEGEGEGEGCCCCCCCCCCCCCCvvvvvvvvvvvrvvvvvvvvvvzvvvvvvvwwrwwwwwwwwwwwwCCCCCCFFFFFFFCC',
    'FFFFFFCCCCuuuuuuuuuuCCCCCCCCCCCCCCCCGGFFFFFFFFFEGGCCCCCCCCCCCCCCCCCCCCCCCCCCCCFFFFFFFFCCCCCEGGGEGGGEGGGEGCCCCCCCCCCCCCCvvvvvvvvvvvrvvvvvvvvvvvzvvvvvvvwwrwwwwwwwwwwwwwCCCCFFFFFFFFFC',
    'FFFFFFFCCCuuuuuuuuuuCCCCCCCCCCCCCCCCCFFFFFFFFFFFGCCCCCCCCCCCCCCCCCCCCCCCCCCCCFFFFFFFFFFFCCCCGGGGGGGGGGGGCCCCCCCCCCCCCCCvvvvvvvvvvvpvvvvvvvvvvvzvvvvvvvvwwpwwwwwwwwwwwwCCCFFFFFFFFFFF',
    'FFFFFFFFCCuuuuuuuuuuCCCCCCCCCCCCCCCCFFFFFFFFFFFFFCCCCCCCCCCCCCCCCCCCCCCCCCCCFFFFFFFFFFFFFCCCCGGGGGGGGGGCCCCCCCCCCCCCCCvvvvvvvvvvvvrvvvvvvvvvvvzvvvvvvvvwwrwwwwwwwwwwwwwCFFFFFFFFFFFF',
    'FFFFFFFFFCuuuuuuuuuuCCCCCCCCCCCCCCCFFFFFFFFFFFFFFCCCCCCCCCCCCCCCCCCCCCCCCCCCFFFFFFFFFFFFFFFFFFFFFFFGGGCCCCCCCCCCCCCCFvvvvvvvvvvvvvrvvvvvvvvvvvvzvvvvvvvwwrwwwwwwwwwwwwwwFFFFFFFFFFFF',
    'FFFFFFFFFFuuuuuuuuuuCCCCCCCCCCCCCFFFFFFFFFFFFFFFFFCCCCCCCCCCCCCCCCCCCCCCCCCFFFFFFFFFFFFFFFFFFFFFFFFFFCCCCCCCCCCCCCCFvvvvvvvvvvvvvvrvvvvvvvvvvvvzvvvvvvvvwwrwwwwwwwwwwwwwwFFFFFFFFFFF',
    'FFFFFFFFFFuuuuuuuuuuCCCFFFFFFFFFFFFFFFFFFFFFFFFFFFFFCCCCCCCCCCCCCCCCCCCCCCFFFFFFFFFFFFFFFFFFFFFFFFFFFFCCCCCCCCCCCCCvvvvvvvvvvvvvvvrvvvvvvvvvvvvvzvvvvvvvwwrwwwwwwwwwwwwwwwFFFFFFFFFF',
    'FFFFFFFFFFuuuuuuuuuuCCFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFCCCFFFFFFFCCCCCCCCCFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFCCCCCCCCCCCFvvvvvvvvvvvvvvvpvvvvvvvvvvvvvzvvvvvvvwwrwwwwwwwwwwwwwwwFFFFFFFFFF',
    'FFFFFFFFFFuuuuuuuuuuFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFCCCCCCFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFCCCCCCCCCFvvvvvvvvvvvvvvvvrvvvvvvvvvvvvvvzvvvvvvwwpwwwwwwwwwwwwwwwwFFFFFFFFF',
    'FFFFFFFFFFuuuuuuuuuuFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFCCCCCCCFvvvvvvvvvvvvvvvvrvvvvvvvvvvvvvvzvvvvvvvvwrwwwwwwwwwwwwwwwwwFFFFFFFF',
    'FFFFFFFFFFuuuuuuuuuuFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFCCCFFvvvvvvvvvvvvvvvvvrvvvvvvvvvvvvvvzvvvvvvvvwrwwwwwwwwwwwwwwwwwwFFFFFFF',
    'FFFFFFFFFFuuuuuuuuuuFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFvvvvvvvvvvvvvvvvrvvvvvvvvvvvvvvvzvvvvvvvvwrwwwwwwwwwwwwwwwwwwFFFFFFF',
    'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
    'IIIIIIIrIIIIIIIIIrrrIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIJIIIIIIIIIIIIIIIIIIIIrIIIIIIIIIIIIIIIIIIIIIIIIIIIzzIIIIIIIIIIIIzIIIIIIIIIIzzIIIIIrrIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIsIIIIIIII',
    'IrrIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIrIIIIIIIIIIIIIIIIIIIIIIIIIIJJIIIIIIIIIIIIzzIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIrIIzIIIIrIIIIIIIrrIIIrrIIIIIIIIIIIIIII',
    'zzIIIIIIIIIIIIIIIIIJIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIzIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIrrIIIIIIIIIII',
    'IIIIIIIrIrrIIIIIIrIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII',
    'IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIrIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIsIIIIIIIIIIrrIIIrrIIIIIsIIIIIIIIzzIIIIIIIIIIIIIIIIIIIIIzzIIIIIrIIIIIIIIIIJIIIIrIIIsIIIII',
    'IIIIIIIIIIIIIIIIIIIIIIIIIIIrrIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIrrIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIJzIIIIrrIIIzzIIIIIr',
    'IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIJIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIrIIIIIIIIIJJIIIzIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIzzIIIIIIIIIIIIIIIIIIIIIIIIIIIIr',
    'IIIIIIIIIIIIIIIIIIIzIIIIIIIIIIIIIIIIIIIIIIIIIIIzzIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIsIIIIJJIIIIIIIIIIIIIIIIIIIIIIIIIIzzIIIIIIIIII',
    'IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIzzIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIzIIIIIIIIIIIIIIIIIIIIIIIIIrrIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIrIIIIIJIIIIIIIIIIIIIIII',
  ],
};

/** O dragão e o sopro de fogo, desenhados por cima dos membros. Fica em (103, 36) na cena. */
export const RAID_SCENE_BOSS_POSITION = { x: 103, y: 36 } as const;
/** Centro do topo do Golpe mais recente, diante da cabeça do dragão (Figma 06b: "−75" em 690,192 na cena ×6). */
export const RAID_SCENE_HIT_ANCHOR = { x: 120, y: 32 } as const;

/** Chefe e efeitos da cena. */
export const raidSceneBoss: PixelSpriteData = {
  palette: ['#ffffff', '#c9cfdc', '#f0c97a', '#f08030', '#1a0a0e', '#f3ead4', '#7d2a2a', '#e06a5a', '#c44545', '#5a1a1e', '#3a0d12', '#d4a85a'],
  rows: [
    '................................e.............e..........................',
    '.........................eee...efe...........egeeee......................',
    '........................efffe.effe..........ehhhgggeeee..................',
    '........................effe.efffe..........ehhggggggggeeee..............',
    '........................effe.effe...........ehhgggggggggggge.............',
    '........................effeeffe............ehhgggggggggghhhe............',
    '........................effeffe............ehhgggggggggghhhggee..........',
    '......................eeeffiffe............ehhggggggggghhhggggge.........',
    '.....................eiiifiiiiie...........ehhgggggggghhhggggggge........',
    '.................eeeehhhhhhhiiiie..........ehhggggggghhhgggggggggee......',
    '...............aeiiiiiiiiicciiiie.........ehhggggggghhhgggggggghhhhe.....',
    '.................eiiiiiiiiieiiiiie........ehhgggggghhhggggggghhhhhe......',
    '..............b..eiiiiiiiiiiihhiie........ehhggggghhggggggghhhhhge.......',
    '.................eiiiiiiiiiiihhiije......ehhggggghhhgggghhhhhhgge........',
    '..............a..efkfkfkfkiiiihhijje.....ehhggghhhgggghhhhheeeee.........',
    '.................ekfkfkfkfiiiiihhiiee....ehhgghhhggghhhhhge..............',
    '...............bceiiiiiiiieiiiihhiiije...ehhghhhgghhhhhgge...............',
    '......dd.cc.dd....eeeeeeee.eiiiihhiijje.ehhghhhhhhhhheggge...............',
    'dd.cc.......................eiiihhhiie.ejhhhhhhhhhjee.eee................',
    '.............................eiiihhiiieejjhhhhhhggjjeeje.................',
    '.............................eiiiihhiiieehhiiiiiiiiieejje................',
    '..............................eiiihhiiiiiiiiiiiiiiiiiiiee...............e',
    '...............................eiiiiiiiiiiiiiiiiiiiiiiiiie.............eg',
    '................................eiiiiiiiiiiiiiiiiiiiiiiiiie..e.........ee',
    '................................eiiiiiiiiiiiiiiiiiiiiiiiiiieeje.......ege',
    '.................................eiiiiiiiiiiiiiiiiiiiiiiiiiiejje.e...eege',
    '..................................eiiiiiiiiiiiiiiiiiiiiiiiiieee.eje.eigge',
    '.................................eiiiiiiiiiiiiiiiiiiiiiiiiiiieeeejjeiigge',
    '..................................eiiiiiiiccccccciiiiiiiiiiiiiiieeeiiggge',
    '..................................eiiillllllllllllllliiiiiiiiiiiieiiiiie.',
    '...................................ecccccccccccccccccciiiiiiiiiiiiiiiie..',
    '...................................ellllllllllllllllllgggggggiiiiiiiie...',
    '..................................eiiiiiicccccccccgggggggeeggiiiiiiie....',
    '..................................eiiiiiillgggggllggggggge.eeeiiiiiie....',
    '..................................eiiiiiieegggggiiggggggge....eiiiie.....',
    '..................................eiiiiiieegggggeeggggggge.....eeee......',
    '..................................eiiiiiieegggggeeggggggge...............',
    '..................................eiiiiiieegggggeeggggggge...............',
    '..................................eeeeeee.eeeeee.eeeeeeee................',
    '.................................efefefe.efefefeefefefe..................',
    '..................................e.e.e...e.e.e..e.e.e...................',
  ],
};

/** Vagas dos membros: 16 × 24 a cada 19 pixels a partir de x = 10, com o pé em y = 76. */
export const RAID_PARTY_ORIGIN = { x: 10, y: 52 } as const;
export const RAID_PARTY_SPACING = 19;
export const RAID_PARTY_SIZE = 5;
export const RAID_HERO_SIZE = { width: 16, height: 24 } as const;
/** Sombra sob cada herói: 14 × 1, um pixel para dentro da vaga. */
export const RAID_SHADOW = { x: 1, y: 24, width: 14, color: '#07050a' } as const;

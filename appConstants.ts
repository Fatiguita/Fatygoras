import { AppTheme } from './types';

export enum Tab {
    CLASSROOM = 'classroom',
    SYLLABUS = 'syllabus',
    LEVEL_TEST = 'level_test',
    PRESENTATION = 'presentation'
}

export const getBackgroundStyle = (theme: AppTheme): string => {
    switch (theme) {
        case AppTheme.CHALKBOARD: return 'bg-[#2b2b2b] text-gray-100';
        case AppTheme.BLUEPRINT: return 'bg-[#1e3a8a] text-blue-100';
        case AppTheme.DARK: return 'bg-gray-900 text-gray-100';
        case AppTheme.NARUTO: return 'bg-[#fffaf0] text-gray-900';
        case AppTheme.POKEMON: return 'bg-[#fffef6] text-gray-900';
        case AppTheme.SAKURA: return 'bg-[#fff7fb] text-gray-900';
        case AppTheme.MATRIX: return 'bg-[#03110a] text-[#9affb3]';
        case AppTheme.NEON: return 'bg-[#05040a] text-[#c7f9e8]';
        case AppTheme.WINDOWS_XP: return 'bg-[#cfe8ff] text-[#15386b]';
        case AppTheme.NARUTO_FIRE: return 'bg-[#0f1410] text-[#ffb86b]';
        case AppTheme.L_DEATHNOTE: return 'bg-[#0b0b0b] text-[#e8e8e8]';
        case AppTheme.RETRO_ARCADE: return 'bg-[#05020a] text-[#39ff14]';
        case AppTheme.SOLARIZED: return 'bg-[#fdf6e3] text-[#657b83]';
        default: return 'bg-[#fdfbf7] text-gray-900';
    }
};

export const applyThemeClass = (theme: AppTheme): void => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'chalkboard', 'blueprint', 'naruto', 'pokemon', 'matrix', 'neon', 'sakura');
    root.classList.remove('light', 'dark', 'chalkboard', 'blueprint', 'naruto', 'pokemon', 'matrix', 'neon', 'sakura', 'windows-xp', 'naruto-fire', 'l-deathnote', 'retro-arcade', 'solarized');
    if (theme === AppTheme.DARK) root.classList.add('dark');
    else if (theme === AppTheme.CHALKBOARD) { root.classList.add('dark', 'chalkboard'); }
    else if (theme === AppTheme.BLUEPRINT) { root.classList.add('blueprint', 'dark'); }
    else if (theme === AppTheme.MATRIX) { root.classList.add('matrix', 'dark'); }
    else if (theme === AppTheme.NEON) { root.classList.add('neon', 'dark'); }
    else if (theme === AppTheme.NARUTO) { root.classList.add('naruto', 'light'); }
    else if (theme === AppTheme.POKEMON) { root.classList.add('pokemon', 'light'); }
    else if (theme === AppTheme.SAKURA) { root.classList.add('sakura', 'light'); }
    else if (theme === AppTheme.WINDOWS_XP) { root.classList.add('windows-xp', 'light'); }
    else if (theme === AppTheme.NARUTO_FIRE) { root.classList.add('naruto-fire', 'dark'); }
    else if (theme === AppTheme.L_DEATHNOTE) { root.classList.add('l-deathnote', 'dark'); }
    else if (theme === AppTheme.RETRO_ARCADE) { root.classList.add('retro-arcade', 'dark'); }
    else if (theme === AppTheme.SOLARIZED) { root.classList.add('solarized', 'light'); }
    else root.classList.add('light');
};

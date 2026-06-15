import { useEffect } from 'react';
import { AppTheme } from '../types';
import { applyThemeClass } from '../appConstants';

export const useTheme = (theme: AppTheme) => {
    useEffect(() => {
        applyThemeClass(theme);
    }, [theme]);
};

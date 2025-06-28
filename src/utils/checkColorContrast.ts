/**
 * Utility to check color contrast ratios
 * Based on WCAG 2.1 guidelines
 */

import { lightTheme, darkTheme } from '../renderer/contexts/ThemeContext';

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

// Calculate relative luminance
function getLuminance(rgb: { r: number; g: number; b: number }): number {
  const { r, g, b } = rgb;
  const sRGB = [r, g, b].map((val) => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

// Calculate contrast ratio
function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  const lum1 = getLuminance(rgb1);
  const lum2 = getLuminance(rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// WCAG guidelines:
// - Normal text: 4.5:1 minimum (AA), 7:1 preferred (AAA)
// - Large text (18pt+ or 14pt+ bold): 3:1 minimum (AA), 4.5:1 preferred (AAA)

function checkThemeContrast(themeName: string, theme: typeof lightTheme | typeof darkTheme) {
  console.log(`\n=== ${themeName} Theme Contrast Ratios ===\n`);

  const checks = [
    {
      name: 'Text on Background',
      fg: theme.colors.text,
      bg: theme.colors.background,
      minRatio: 4.5,
    },
    {
      name: 'Text on Surface',
      fg: theme.colors.text,
      bg: theme.colors.surface,
      minRatio: 4.5,
    },
    {
      name: 'Subtle Text on Background',
      fg: theme.colors.textSubtle,
      bg: theme.colors.background,
      minRatio: 4.5,
    },
    {
      name: 'Subtle Text on Surface',
      fg: theme.colors.textSubtle,
      bg: theme.colors.surface,
      minRatio: 4.5,
    },
    {
      name: 'Accent Text on Background',
      fg: theme.colors.accent,
      bg: theme.colors.background,
      minRatio: 4.5,
    },
    {
      name: 'White Text on Accent',
      fg: theme.colors.textInverse,
      bg: theme.colors.accent,
      minRatio: 4.5,
    },
    {
      name: 'Success Text on Background',
      fg: theme.colors.success,
      bg: theme.colors.background,
      minRatio: 4.5,
    },
    {
      name: 'Error Text on Background',
      fg: theme.colors.error,
      bg: theme.colors.background,
      minRatio: 4.5,
    },
  ];

  let allPass = true;

  checks.forEach(({ name, fg, bg, minRatio }) => {
    const ratio = getContrastRatio(fg, bg);
    const pass = ratio >= minRatio;
    const status = pass ? '✅ PASS' : '❌ FAIL';
    
    console.log(`${name}:`);
    console.log(`  ${fg} on ${bg}`);
    console.log(`  Ratio: ${ratio.toFixed(2)}:1 ${status}`);
    console.log(`  Required: ${minRatio}:1\n`);
    
    if (!pass) allPass = false;
  });

  return allPass;
}

// Run the checks
const lightPass = checkThemeContrast('Light', lightTheme);
const darkPass = checkThemeContrast('Dark', darkTheme);

console.log('\n=== Summary ===');
console.log(`Light theme: ${lightPass ? '✅ All checks passed' : '❌ Some checks failed'}`);
console.log(`Dark theme: ${darkPass ? '✅ All checks passed' : '❌ Some checks failed'}`);

if (!lightPass || !darkPass) {
  console.log('\n⚠️  Some color combinations do not meet WCAG AA standards.');
  console.log('Consider adjusting the colors to improve accessibility.');
}
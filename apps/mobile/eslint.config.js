// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

// UI-3 (#97): colors and sizes come from the theme in src/constants, not from
// numbers typed into each screen. See docs/process/ui-checklist.md.
// Hits from before the rule existed are counted per file in
// eslint-suppressions.json, so only new ones fail. After fixing some, run
// `npm run lint:prune` to lower the counts.
const SIZE_PROPS =
  '/^(fontSize|gap|rowGap|columnGap|borderRadius|border(Top|Bottom)(Left|Right)Radius|padding|margin|(padding|margin)(Top|Bottom|Left|Right|Horizontal|Vertical|Start|End))$/';

const tokenRules = [
  {
    selector: 'Literal[value=/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i]',
    message: 'Use a color from @/constants/theme (Palette or Theme.colors) instead of a hex value.',
  },
  {
    selector: 'Literal[value=/rgba?\\(/i], TemplateElement[value.raw=/rgba?\\(/i]',
    message: 'Use a color from @/constants/theme (Palette or Theme.colors) instead of rgba().',
  },
  {
    selector: `Property[key.name=${SIZE_PROPS}] > Literal.value[value!=0], Property[key.name=${SIZE_PROPS}] > UnaryExpression.value > Literal`,
    message:
      'Use Spacing, Radii or Typography from @/constants/theme instead of a number. If the design needs a size that isn\'t there, add it to a token file in src/constants.',
  },
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/constants/**'],
    rules: {
      'no-restricted-syntax': ['error', ...tokenRules],
    },
  },
]);

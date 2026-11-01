export const defaultLang = 'en';

export const ui = {
  en: {
    'brand.name': 'SongKhem',
    'hero.badge': 'ជំនួយការមើលឃើញឆ្លាតវៃ \u2022 Assistive AI for Khmer',
    'hero.title': 'Read the Khmer file via sound.',
    'hero.description': 'SongKhem converts the Khmer text printed into a clear sound with real-time words created specifically for the vision impaired and the discovery problem.',
    'hero.cta': 'Try now',
    'nav.home': 'Home',
    'nav.stories': 'Stories',
    'nav.about': 'About us',
    'theme.light': 'Theme: Light',
    'theme.dark': 'Theme: Dark',
    'theme.contrast': 'Theme: Contrast',
    'lang.label': 'ភាសាខ្មែរ',
  },
  km: {
    'brand.name': 'SongKhem',
    'hero.badge': 'ជំនួយការមើលឃើញឆ្លាតវៃ \u2022 Assistive AI',
    'hero.title': 'អានឯកសារខ្មែរតាមរយៈសំឡេង។',
    'hero.description': 'SongKhem បំប្លែងអត្ថបទខ្មែរដែលបានបោះពុម្ពទៅជាសំឡេងច្បាស់លាស់ ជាមួយនឹងការរំលេចពាក្យតាមពេលវេលាជាក់ស្តែង ដែលបង្កើតឡើងជាពិសេសសម្រាប់អ្នកមានបញ្ហាគំហើញ។',
    'hero.cta': 'សាកល្បងឥឡូវនេះ',
    'nav.home': 'ទំព័រដើម',
    'nav.stories': 'រឿងរ៉ាវ',
    'nav.about': 'អំពីយើង',
    'theme.light': 'ស្បែក: ភ្លឺ',
    'theme.dark': 'ស្បែក: ងងឹត',
    'theme.contrast': 'ស្បែក: កម្រិតច្បាស់ខ្ពស់',
    'lang.label': 'English',
  },
} as const;

export type Language = keyof typeof ui;
export type TranslationKey = keyof (typeof ui)['en'];

export function useTranslations(lang: Language = defaultLang) {
  return function t(key: TranslationKey): string {
    return ui[lang]?.[key] || ui[defaultLang][key];
  };
}

// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	vite: {
		plugins: [tailwindcss()],
	},
	markdown: {
		// Dual themes emit both palettes as CSS variables; the post styles pick one with light-dark().
		shikiConfig: {
			themes: { light: 'rose-pine-dawn', dark: 'rose-pine' },
			defaultColor: false,
		},
	},
	fonts: [
		{
			provider: fontProviders.fontsource(),
			name: 'Bricolage Grotesque',
			cssVariable: '--font-display',
			weights: ['400 800'],
			fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
		},
		{
			provider: fontProviders.fontsource(),
			name: 'Inter',
			cssVariable: '--font-body',
			weights: ['400 700'],
			fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
		},
		{
			provider: fontProviders.fontsource(),
			name: 'JetBrains Mono',
			cssVariable: '--font-mono',
			weights: ['400 800'],
			fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
		},
	],
});

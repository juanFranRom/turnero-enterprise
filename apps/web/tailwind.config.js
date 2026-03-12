const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		join(__dirname, 'src/**/*.{js,ts,jsx,tsx,mdx}'),
	],
	theme: {
		extend: {
			colors: {
				primary: 'var(--color-primary)',
				'primary-hover': 'var(--color-primary-hover)',
				secondary: 'var(--color-secondary)',
				success: 'var(--color-success)',
				warning: 'var(--color-warning)',
				danger: 'var(--color-danger)',
				bg: 'var(--color-bg)',
				card: 'var(--color-card)',
				border: 'var(--color-border)',
				'text-primary': 'var(--color-text-primary)',
				'text-secondary': 'var(--color-text-secondary)',
				'sidebar-active': 'var(--color-sidebar-active)',
			},
			borderRadius: {
				sm: 'var(--radius-sm)',
				md: 'var(--radius-md)',
				lg: 'var(--radius-lg)',
				card: 'var(--radius-card)',
				button: 'var(--radius-button)',
			},
			boxShadow: {
				card: 'var(--shadow-card)',
				hover: 'var(--shadow-hover)',
				floating: 'var(--shadow-floating)',
			},
			backgroundImage: {
				'brand-gradient': 'var(--gradient-brand)',
			},
			transitionDuration: {
				fast: '150ms',
			},
			transitionTimingFunction: {
				timora: 'var(--motion-ease)',
			},
			fontSize: {
				hero: ['48px', { lineHeight: '56px', fontWeight: '700' }],
				h1: ['36px', { lineHeight: '44px', fontWeight: '700' }],
				h2: ['28px', { lineHeight: '36px', fontWeight: '700' }],
				h3: ['22px', { lineHeight: '30px', fontWeight: '600' }],
				body: ['16px', { lineHeight: '24px' }],
				small: ['14px', { lineHeight: '20px' }],
				caption: ['12px', { lineHeight: '16px' }],
			},
		},
	},
	plugins: [],
};
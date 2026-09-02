/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        'pb-bg':      '#040412',
        'pb-surface': 'rgba(255,255,255,0.035)',
        'pb-border':  'rgba(255,255,255,0.07)',
        'pb-primary': '#7c3aed',
        'pb-primary-l':'#a78bfa',
        'pb-accent':  '#06b6d4',
        'pb-success': '#10b981',
        'pb-warning': '#f59e0b',
        'pb-danger':  '#ef4444',
        'pb-muted':   '#64748b',
        'pb-text':    '#f1f5f9',
        'pb-subtext': '#94a3b8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'spin-slow':  'spin 3s linear infinite',
        'ping-slow':  'ping 2s cubic-bezier(0,0,0.2,1) infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' },                               '100%': { opacity: '1' } },
        slideUp:   { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(124,58,237,0.15)' },
          '50%':      { boxShadow: '0 0 45px rgba(124,58,237,0.40)' },
        },
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.018'%3E%3Cpath d='M0 0h1v40H0zm39 0h1v40h-1zM0 0v1h40V0zm0 39v1h40v-1z'/%3E%3C/g%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};

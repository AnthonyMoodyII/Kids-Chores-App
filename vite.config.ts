import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import postcssOklabFunction from '@csstools/postcss-oklab-function'

// Tailwind v4 stores "in oklab" colour-interpolation inside CSS custom property
// values (e.g. --tw-gradient-position: to bottom right in oklab).
// Browsers that don't understand that syntax ignore the entire gradient, making
// coloured elements invisible.  This plugin strips " in oklab / in oklch" from
// all CSS custom-property and background-image declarations at build time.
const stripGradientColorInterpolation = {
  postcssPlugin: 'strip-gradient-color-interpolation',
  Declaration(decl: { prop: string; value: string }) {
    if (
      decl.prop.startsWith('--tw-gradient') ||
      decl.prop === 'background-image'
    ) {
      decl.value = decl.value
        .replace(/\s+in\s+oklab\b/gi, '')
        .replace(/\s+in\s+oklch\b/gi, '');
    }
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  css: {
    // Compatibility fixes so older/embedded browsers (Samsung fridge, LG TV,
    // older WebKit) render colours and gradients correctly:
    //   1. Strip "in oklab/oklch" interpolation mode from gradient CSS vars
    //   2. Convert remaining oklch() colour functions → rgb()
    postcss: {
      plugins: [
        stripGradientColorInterpolation as never,
        postcssOklabFunction({ preserve: false }),
      ],
    },
  },
})

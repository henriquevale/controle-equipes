import { defineConfig } from 'vite'
import react from '@vitejs/react-refresh' // ou seu plugin do react

export default defineConfig({
  plugins: [react()],
  build: {
    cssMinify: 'esbuild' // <-- Adicione esta linha dentro de build
  }
})
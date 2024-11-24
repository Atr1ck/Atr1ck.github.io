import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react';
import { plugin as mdPlugin, Mode } from "vite-plugin-markdown";

export default defineConfig({
  plugins: [react(), mdPlugin({
    mode: [Mode.MARKDOWN]
  })],
  base: "./",
})

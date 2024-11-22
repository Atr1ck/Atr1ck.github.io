import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {plugin as mdPlugin} from 'vite-plugin-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export default defineConfig({
  plugins: [react(), mdPlugin({
    mode: ["react"] ,
    wrapperComponent: 'MarkdownWrapper', // 使用自定义组件渲染Markdown
    markdownIt: {
      html: true,
      linkify: true,
      typographer: true,
    },
    remarkPlugins: [remarkGfm], // 支持表格，任务列表等扩展语法
    rehypePlugins: [rehypeHighlight], // 可选：用于代码高亮
  })],
  base: "./",
})

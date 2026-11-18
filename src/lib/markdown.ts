import MarkdownIt, { type RendererRule } from 'markdown-it'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import anchor from 'markdown-it-anchor'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'

export interface RenderOptions {
  baseDir: string
  resolveAsset: (reference: string) => string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Parse Markdown to sanitised HTML. Raw HTML in the source is never executed. */
export function renderMarkdown(source: string, options: RenderOptions): string {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    highlight(code: string, lang: string): string {
      if (lang && hljs.getLanguage(lang)) {
        const highlighted = hljs.highlight(code, { language: lang }).value
        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`
      }
      return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`
    },
  })

  md.use(anchor)
  md.use(footnote)
  md.use(taskLists)

  const defaultImage = md.renderer.rules.image
  const imageRule: RendererRule = (tokens, idx, envOptions, env, self) => {
    const token = tokens[idx]
    const reference = String(token.attrGet('src') ?? '')
    const isExternal = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(reference) || reference.startsWith('//')
    if (!isExternal && reference) {
      token.attrSet('src', options.resolveAsset(reference))
    }
    return defaultImage
      ? defaultImage(tokens, idx, envOptions, env, self)
      : self.renderToken(tokens, idx, envOptions)
  }
  md.renderer.rules.image = imageRule

  const html = md.render(source)
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'form', 'object', 'embed'],
    FORBID_ATTR: ['style'],
    // Keep DOMPurify's relative-URL allowance (so `type="checkbox"` survives)
    // and add the Tauri asset scheme. javascript:/data: remain blocked.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|file|asset):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  })
}

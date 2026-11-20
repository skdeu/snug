// Copyright 2026 Sanjaykumar Sagadevan Vijayakumar
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
      try {
        token.attrSet('src', options.resolveAsset(reference))
      } catch {
        // A hostile or malformed path must never blank the reading view.
        token.attrSet(
          'src',
          'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
        )
      }
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

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

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const outDir = path.join(root, 'src-tauri', 'icons')
await mkdir(outDir, { recursive: true })

// Prefer the locally generated PNG (Rule 3). Fall back to the hand-built SVG.
const localPng = path.join(root, 'assets', 'snug-logo-local.png')
let source
try {
  const { data, info } = await sharp(localPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    // The generator puts pure white outside the rounded square — make it transparent.
    if (data[i] > 248 && data[i + 1] > 248 && data[i + 2] > 248) data[i + 3] = 0
  }
  source = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer()
  console.log('using local generated logo')
} catch {
  source = await readFile(path.join(root, 'assets', 'snug-logo.svg'))
  console.log('using SVG fallback logo')
}

const sizes = [16, 32, 64, 128, 256, 512]
for (const size of sizes) {
  const file = path.join(outDir, `icon-${size}.png`)
  await sharp(source).resize(size, size).png().toFile(file)
  console.log('wrote', path.relative(root, file))
}

await writeFile(path.join(outDir, 'icon.png'), await sharp(source).resize(512, 512).png().toBuffer())
console.log('wrote src-tauri/icons/icon.png')

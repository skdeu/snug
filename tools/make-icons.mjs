import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const svg = await readFile(path.join(root, 'assets', 'snug-logo.svg'))
const outDir = path.join(root, 'src-tauri', 'icons')
await mkdir(outDir, { recursive: true })

const sizes = [16, 32, 64, 128, 256, 512]
const pngs = {}

for (const size of sizes) {
  const file = path.join(outDir, `icon-${size}.png`)
  await sharp(svg).resize(size, size).png().toFile(file)
  pngs[size] = await readFile(file)
  console.log('wrote', path.relative(root, file))
}

await writeFile(path.join(outDir, 'icon.png'), pngs[512])
await writeFile(path.join(outDir, 'icon.ico'), pngs[256])
console.log('wrote src-tauri/icons/icon.png and icon.ico')

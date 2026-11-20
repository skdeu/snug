import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')

describe('version 1.3.2', () => {
  it('is the version in package.json and the lock file', () => {
    expect(JSON.parse(read('package.json')).version).toBe('1.3.2')
    const lock = JSON.parse(read('package-lock.json'))
    expect(lock.version).toBe('1.3.2')
    expect(lock.packages[''].version).toBe('1.3.2')
  })

  it('is the version in the Tauri config and the Rust crate', () => {
    expect(JSON.parse(read('src-tauri', 'tauri.conf.json')).version).toBe('1.3.2')
    expect(read('src-tauri', 'Cargo.toml')).toMatch(/^version = "1\.3\.2"$/m)
    expect(read('src-tauri', 'Cargo.lock')).toMatch(/name = "snug"\nversion = "1\.3\.2"/)
  })
})

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

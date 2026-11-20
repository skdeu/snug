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

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Reader from '../src/components/Reader'

describe('Reader', () => {
  it('applies_dark_theme_by_default', () => {
    const { container } = render(
      <Reader source="# Hello" baseDir="" theme="dark" fontSize={18} />,
    )
    expect(container.querySelector('.snug-reader')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeTruthy()
    expect(container.querySelector('.theme-dark')).not.toBeNull()
  })
})

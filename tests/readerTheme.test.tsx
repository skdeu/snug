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

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Reader from '../src/components/Reader'

describe('Reader theme hooks', () => {
  it('renders footnotes in their own section', () => {
    const { container } = render(
      <Reader source={'A claim[^1].\n\n[^1]: The source.\n'} baseDir="" theme="dark" fontSize={17} />,
    )
    expect(container.querySelector('.footnotes')).not.toBeNull()
    expect(container.querySelector('.footnote-ref')).not.toBeNull()
  })

  it('renders task-list items with a checkbox each', () => {
    const { container } = render(
      <Reader source={'- [x] Done\n- [ ] Open\n'} baseDir="" theme="light" fontSize={17} />,
    )
    expect(container.querySelectorAll('.task-list-item')).toHaveLength(2)
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2)
  })

  it('puts the reader on the reader ground', () => {
    const { container } = render(<Reader source="# Hi" baseDir="" theme="dark" fontSize={17} />)
    expect(container.querySelector('.snug-reader-pane')).not.toBeNull()
  })
})

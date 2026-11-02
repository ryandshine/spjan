import { describe, expect, it } from 'vitest'

import { gabungParam } from './use-param-url'

describe('gabungParam', () => {
  it('menambah, mengganti, dan menghapus tanpa menyentuh parameter lain', () => {
    expect(gabungParam('tab=data&x=1', { tab: 'pelaksana', pelaksana: '3' })).toBe('tab=pelaksana&x=1&pelaksana=3')
    expect(gabungParam('tab=data&x=1', { tab: null })).toBe('x=1')
  })
})

import { describe, expect, it } from 'vitest'
import { CaptureStream } from '../../src/runtime/utils/capture-stream'

describe('CaptureStream size limit', () => {
  it('retains responses at or below the limit', () => {
    const capture = new CaptureStream(5)
    capture.write('hello')
    expect(capture.exceeded).toBe(false)
    expect(capture.getBuffer().toString()).toBe('hello')
  })

  it('drops retained chunks and ignores subsequent data after exceeding the limit', () => {
    const capture = new CaptureStream(5)
    capture.write('hello')
    capture.write('!')
    capture.write('more')
    expect(capture.exceeded).toBe(true)
    expect(capture.getBuffer()).toHaveLength(0)
  })
})

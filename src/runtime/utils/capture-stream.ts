import { Writable, type WritableOptions } from 'node:stream'

export class CaptureStream extends Writable {
  private chunks: Buffer[]
  private size = 0
  private readonly maxBytes: number
  exceeded = false

  constructor(maxBytes = Number.POSITIVE_INFINITY, options?: WritableOptions) {
    super(options)
    this.chunks = []
    this.maxBytes = maxBytes
  }

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    if (this.exceeded) {
      callback()
      return
    }

    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding)
    this.size += buffer.byteLength
    if (this.size > this.maxBytes) {
      this.exceeded = true
      this.chunks = []
      callback()
      return
    }

    this.chunks.push(buffer)
    callback()
  }

  getBuffer(): Buffer {
    return Buffer.concat(this.chunks)
  }
}

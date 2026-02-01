import type { DetectedBarcode } from 'barcode-detector/ponyfill'

import type { DecodeResponse, Init } from './worker.types'

const WORKER_LOAD_TIMEOUT = 1000 * 32
const WORKER_DECODE_TIMEOUT = 1000 * 16

function createWorker() {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    const workerReady = new Promise<boolean>((res, rej) => {
        const timeoutId = setTimeout(() => {
            rej(new Error('Worker load timeout'))
        }, WORKER_LOAD_TIMEOUT)

        worker.addEventListener(
            'message',
            ({ data: { payload, type } }: MessageEvent<Init>) => {
                if (type !== 'init') {
                    return
                }

                clearTimeout(timeoutId)

                if (payload.status === 'success') {
                    res(true)
                } else {
                    rej(new Error('Worker failed to load'))
                }
            },
            {
                once: true,
            },
        )
    })

    async function decode(imageData: ImageData): Promise<DetectedBarcode | null> {
        await workerReady

        const uuid = `${performance.now()}-${Math.random().toString(36).slice(2)}`

        return new Promise((res, rej) => {
            const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
                worker.removeEventListener('message', handleMessage)

                rej(new Error('Decode timeout'))
            }, WORKER_DECODE_TIMEOUT)

            const handleMessage = ({ data: { payload, type } }: MessageEvent<DecodeResponse>) => {
                if (type !== 'decode' || payload.uuid !== uuid) {
                    return
                }

                clearTimeout(timeoutId)

                worker.removeEventListener('message', handleMessage)

                res(payload.data)
            }

            worker.addEventListener('message', handleMessage)
            worker.postMessage({ payload: { data: imageData, uuid }, type: 'decode' })
        })
    }

    return {
        decode,
        worker,
    }
}

export { createWorker }

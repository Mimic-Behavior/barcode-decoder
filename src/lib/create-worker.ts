import type { BarcodeFormat, DetectedBarcode } from 'barcode-detector/ponyfill'

import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url&no-inline'

import type { DecodeResponse, Init } from './worker.types'

import {
    WORKER_DECODE_TIMEOUT,
    WORKER_DECODE_TIMEOUT_CAUSE,
    WORKER_LOAD_FAILURE_CAUSE,
    WORKER_LOAD_TIMEOUT,
    WORKER_LOAD_TIMEOUT_CAUSE,
} from './constants'

function createWorker({ formats }: { formats: BarcodeFormat[] }) {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    const workerReady = new Promise<boolean>((res, rej) => {
        const timeoutId = setTimeout(() => {
            worker.removeEventListener('message', handleMessage)

            rej(new Error(WORKER_LOAD_TIMEOUT_CAUSE))
        }, WORKER_LOAD_TIMEOUT)

        const handleMessage = ({ data: { payload, type } }: MessageEvent<Init>) => {
            if (type !== 'init') {
                return
            }

            clearTimeout(timeoutId)

            worker.removeEventListener('message', handleMessage)

            if (payload.status === 'success') {
                res(true)
            } else {
                rej(new Error(WORKER_LOAD_FAILURE_CAUSE))
            }
        }

        worker.addEventListener('message', handleMessage)
        worker.postMessage({
            payload: {
                formats,
                wasmUrl,
            },
            type: 'config',
        })
    })

    async function decode(imageData: ImageData): Promise<DetectedBarcode | null> {
        await workerReady

        const uuid = `${performance.now()}-${Math.random().toString(36).slice(2)}`

        return new Promise((res, rej) => {
            const timeoutId = setTimeout(() => {
                worker.removeEventListener('message', handleMessage)

                rej(new Error(WORKER_DECODE_TIMEOUT_CAUSE))
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
            worker.postMessage({
                payload: {
                    data: imageData,
                    uuid,
                },
                type: 'decode',
            })
        })
    }

    return {
        decode,
        worker,
    }
}

export { createWorker }

import { type DetectedBarcode } from 'barcode-detector/ponyfill'

import type { DecodeRes } from './worker.types'

import { instance } from './worker.instance'

async function decode(imageData: ImageData): Promise<DetectedBarcode | null> {
    const worker = instance.value

    if (!worker) {
        throw new Error('Worker not installed')
    }

    const uuid = `${performance.now()}-${Math.random().toString(36).slice(2)}`

    return new Promise((res, rej) => {
        let timeoutId: ReturnType<typeof setTimeout> = 0

        const handleMessage = ({ data: { payload, type } }: MessageEvent<DecodeRes>) => {
            if (type !== 'decode' || payload.uuid !== uuid) {
                return
            }

            clearTimeout(timeoutId)

            worker.removeEventListener('message', handleMessage)

            res(payload.data)
        }

        timeoutId = setTimeout(() => {
            worker.removeEventListener('message', handleMessage)

            rej(null)
        }, 1000 * 6)

        worker.addEventListener('message', handleMessage)
        worker.postMessage({ payload: { data: imageData, uuid }, type: 'decode' })
    })
}

export { decode }

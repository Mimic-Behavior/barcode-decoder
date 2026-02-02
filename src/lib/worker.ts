import {
    type BarcodeDetectorOptions,
    BarcodeDetector as BarcodeDetectorPonyfill,
    prepareZXingModule,
} from 'barcode-detector/ponyfill'
import zxingUrl from 'zxing-wasm/reader/zxing_reader.wasm?url&no-inline'

import type { DecodeRequest, DecodeResponse, Init } from './worker.types'

import { isBarcodeDetectorAvailable } from './utils'

const worker = self as unknown as Worker

let barcodeDetector: BarcodeDetectorPonyfill | null = null

const barcodeDetectorOptions: BarcodeDetectorOptions = { formats: ['qr_code'] }

try {
    if (isBarcodeDetectorAvailable(worker)) {
        barcodeDetector = new worker.BarcodeDetector(barcodeDetectorOptions)

        worker.postMessage({
            payload: {
                status: 'success',
            },
            type: 'init',
        } satisfies Init)
    } else {
        prepareZXingModule({
            overrides: {
                locateFile(url, scriptDirectory) {
                    if (url.endsWith('.wasm')) {
                        return zxingUrl
                    }

                    return scriptDirectory + url
                },
                postRun: [
                    () => {
                        worker.postMessage({
                            payload: {
                                status: 'success',
                            },
                            type: 'init',
                        } satisfies Init)
                    },
                ],
            },
        })

        barcodeDetector = new BarcodeDetectorPonyfill(barcodeDetectorOptions)
    }
} catch (error) {
    console.error(error)

    worker.postMessage({
        payload: {
            status: 'failure',
        },
        type: 'init',
    } satisfies Init)
}

worker.addEventListener('message', handleDecode)

async function handleDecode({ data: { payload, type } }: MessageEvent<DecodeRequest>) {
    if (type !== 'decode') {
        return
    }

    const response: DecodeResponse = {
        payload: {
            data: null,
            uuid: payload.uuid,
        },
        type,
    }

    try {
        if (barcodeDetector === null) {
            throw new Error('Barcode detector not initialized')
        }

        if (payload.data) {
            response.payload.data = (await barcodeDetector.detect(payload.data))[0]
        }
    } catch (error) {
        console.error(error)
    }

    worker.postMessage(response)
}

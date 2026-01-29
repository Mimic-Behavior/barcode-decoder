import {
    BarcodeDetector as BarcodeDetectorPonyfill,
    prepareZXingModule,
} from 'barcode-detector/ponyfill'
import zxingUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

import type { BarcodeDetector, DetectedBarcode } from './barcode-detector.type'
import type { WorkerRequest, WorkerResponse } from './barcode-scanner.types'

import { isBarcodeDetectorAvailable } from './utils'

prepareZXingModule({
    overrides: {
        locateFile(url, scriptDirectory) {
            if (url.endsWith('.wasm')) {
                return zxingUrl
            }

            return scriptDirectory + url
        },
    },
})

let barcodeDetector: BarcodeDetector | BarcodeDetectorPonyfill | null = null

const worker = self as unknown as Worker

async function decode(imageData: ImageData) {
    if (barcodeDetector === null) {
        if (isBarcodeDetectorAvailable(worker)) {
            barcodeDetector = new worker.BarcodeDetector({ formats: ['qr_code'] })
        } else {
            barcodeDetector = new BarcodeDetectorPonyfill({ formats: ['qr_code'] })
        }
    }

    const barcodes = await barcodeDetector.detect(imageData)

    return barcodes[0]
}

worker.addEventListener(
    'message',
    async ({ data: { data, uuid } }: MessageEvent<WorkerRequest>) => {
        const response = { data: null, uuid } as WorkerResponse

        try {
            if (data) {
                response.data = (await decode(data)) as DetectedBarcode
            }
        } catch (error) {
            console.error(error)
        }

        worker.postMessage(response)
    },
)

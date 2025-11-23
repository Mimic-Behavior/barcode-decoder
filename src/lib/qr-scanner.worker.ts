import jsQR from 'jsqr'

import type { BarcodeDetector, DetectedBarcode } from './barcode-detector.type'
import type { DecodeData, WorkerRequest, WorkerResponse } from './qr-scanner.type'

let barcodeDetector: BarcodeDetector | null = null

const worker = self as unknown as Worker

/**
 * Decode the data
 * @param data - The data to decode
 * @returns The detected barcode
 */
async function decode(data: DecodeData): Promise<DetectedBarcode | null> {
    if (!isBarcodeDetectorAvailable(worker)) {
        return decodeFallback(data)
    }

    const detector = getBarcodeDetector(worker)
    const barcodes = await detector.detect(data.imageData)

    return barcodes[0]
}

/**
 * Decode the data using the fallback method
 * @param data - The data to decode
 * @returns The detected barcode
 */
function decodeFallback(data: DecodeData): DetectedBarcode | null {
    const result = jsQR(data.imageData, data.imageWidth, data.imageHeight)

    if (!result) {
        return null
    }

    return {
        boundingBox: new DOMRectReadOnly(0, 0, data.imageWidth, data.imageHeight),
        cornerPoints: [
            result.location.topLeftCorner,
            result.location.topRightCorner,
            result.location.bottomRightCorner,
            result.location.bottomLeftCorner,
        ],
        format: 'qr_code',
        rawValue: result.data,
    }
}

/**
 * Get the barcode detector
 * @param worker - The worker
 * @returns The barcode detector
 */
function getBarcodeDetector(worker: { BarcodeDetector: BarcodeDetector } & Worker): BarcodeDetector {
    if (barcodeDetector === null) {
        barcodeDetector = new worker.BarcodeDetector({ formats: ['qr_code'] })
    }

    return barcodeDetector
}

/**
 * Check if the barcode detector is available
 * @param worker - The worker
 * @returns Whether the barcode detector is available
 */
function isBarcodeDetectorAvailable(worker: Worker): worker is { BarcodeDetector: BarcodeDetector } & Worker {
    return 'BarcodeDetector' in worker
}

/**
 * Listen for messages from the main thread
 * @param event - The event
 */
worker.addEventListener('message', async ({ data: { data, id } }: MessageEvent<WorkerRequest>) => {
    const response = { data: null, id } as WorkerResponse

    try {
        if (data) {
            response.data = await decode(data)
        }
    } catch (error) {
        console.error(error)
    }

    worker.postMessage(response)
})

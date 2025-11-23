import type { DetectedBarcode } from './barcode-detector.type'

/**
 * Decode data
 */
export type DecodeData = {
    imageData: Uint8ClampedArray
    imageHeight: number
    imageWidth: number
}

/**
 * Worker request
 */
export type WorkerRequest = {
    data: DecodeData | null
    id: number
}

/**
 * Worker response
 */
export type WorkerResponse = {
    data: DetectedBarcode | null
    id: number
}

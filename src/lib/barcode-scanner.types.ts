import type { DetectedBarcode } from './barcode-detector.type'

/**
 * The image data to decode
 */
export type DecodeData = {
    /**
     * The image data
     */
    imageData: Uint8ClampedArray
    /**
     * The height of the image
     */
    imageHeight: number
    /**
     * The width of the image
     */
    imageWidth: number
}

/**
 * Worker request sent to the worker thread
 */
export type WorkerRequest = {
    /**
     * The image data to decode
     */
    data: DecodeData | null
    /**
     * The request UUID
     */
    uuid: string
}

/**
 * Worker response sent from the worker thread
 */
export type WorkerResponse = {
    /**
     * The detected barcode
     */
    data: DetectedBarcode | null
    /**
     * The request UUID
     */
    uuid: string
}

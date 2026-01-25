import type { DetectedBarcode } from './barcode-detector.type'

export type OnDecode = (data: null | string, area?: ScanArea) => void

export type OnDecodeError = () => void

export type ScanArea = {
    height: number
    width: number
    x: number
    y: number
}

/**
 * Worker request sent to the worker thread
 */
export type WorkerRequest = {
    /**
     * The image data to decode
     */
    data: ImageData | null
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

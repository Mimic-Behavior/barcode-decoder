/**
 * Type definitions for the Barcode Detection API
 * @see https://wicg.github.io/shape-detection-api/#barcode-detection-api
 */

/**
 * BarcodeDetector type
 * @see https://wicg.github.io/shape-detection-api/#barcodedetector
 *
 * @example
 * ```typescript
 * const detector = new BarcodeDetector({ formats: ['qr_code'] });
 * const barcodes = await detector.detect(imageElement);
 * ```
 */
export type BarcodeDetector = {
    /**
     * Creates a new BarcodeDetector instance
     * @param barcodeDetectorOptions Optional configuration for the detector
     */
    new (barcodeDetectorOptions?: BarcodeDetectorOptions): BarcodeDetector

    /**
     * Detects barcodes in the provided image source
     * @param image The image source to detect barcodes in
     * @returns Promise that resolves to an array of DetectedBarcode objects
     *
     * @example
     * ```typescript
     * const detector = new BarcodeDetector();
     * const barcodes = await detector.detect(imageElement);
     * barcodes.forEach(barcode => {
     *     console.log('Found:', barcode.rawValue, 'Format:', barcode.format);
     * });
     * ```
     */
    detect(image: ImageBitmapSource | Uint8ClampedArray): Promise<DetectedBarcode[]>

    /**
     * Returns a promise that resolves to an array of barcode formats
     * supported by the user agent
     * @returns Promise that resolves to an array of supported BarcodeFormat values
     *
     * @example
     * ```typescript
     * const formats = await BarcodeDetector.getSupportedFormats();
     * console.log('Supported formats:', formats);
     * ```
     */
    getSupportedFormats(): Promise<BarcodeFormat[]>
}

/**
 * Options for BarcodeDetector constructor
 * @see https://wicg.github.io/shape-detection-api/#dictdef-barcodedetectoroptions
 */
export type BarcodeDetectorOptions = {
    /**
     * Optional array of barcode formats to detect.
     * If not specified, all supported formats will be detected.
     */
    formats?: BarcodeFormat[]
}

/**
 * Supported barcode formats
 * @see https://wicg.github.io/shape-detection-api/#enumdef-barcodeformat
 */
export type BarcodeFormat =
    | 'aztec'
    | 'codabar'
    | 'code_128'
    | 'code_39'
    | 'code_93'
    | 'data_matrix'
    | 'ean_13'
    | 'ean_8'
    | 'itf'
    | 'pdf417'
    | 'qr_code'
    | 'unknown'
    | 'upc_a'
    | 'upc_e'

/**
 * Represents a detected barcode in an image
 * @see https://wicg.github.io/shape-detection-api/#dictdef-detectedbarcode
 */
export type DetectedBarcode = {
    /**
     * The bounding box of the detected barcode
     */
    readonly boundingBox: DOMRectReadOnly

    /**
     * The four corner points of the detected barcode in clockwise order
     * (top-left, top-right, bottom-right, bottom-left)
     */
    readonly cornerPoints: Point2D[]

    /**
     * The format of the detected barcode
     */
    readonly format: BarcodeFormat

    /**
     * The raw value decoded from the barcode
     */
    readonly rawValue: string
}

/**
 * Point2D represents a 2D point with x and y coordinates
 * @see https://w3c.github.io/mediacapture-image/#dictdef-point2d
 */
export type Point2D = {
    x: number
    y: number
}

/**
 * Global declaration for BarcodeDetector (extends Window interface)
 * This allows TypeScript to recognize BarcodeDetector as a global when available
 */
declare global {
    interface Window {
        BarcodeDetector?: BarcodeDetector
    }
}

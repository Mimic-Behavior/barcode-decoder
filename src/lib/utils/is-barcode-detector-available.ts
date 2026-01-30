import type { BarcodeDetector, BarcodeDetectorOptions } from 'barcode-detector/ponyfill'

function isBarcodeDetectorAvailable<T extends object>(
    value: T,
): value is {
    BarcodeDetector: {
        new (barcodeDetectorOptions?: BarcodeDetectorOptions): BarcodeDetector
    } & BarcodeDetector
} & T {
    return 'BarcodeDetector' in value
}

export { isBarcodeDetectorAvailable }

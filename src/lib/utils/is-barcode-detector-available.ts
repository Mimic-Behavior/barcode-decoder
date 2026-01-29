import type { BarcodeDetector } from '../barcode-detector.type'

function isBarcodeDetectorAvailable<T extends object>(
    value: T,
): value is { BarcodeDetector: BarcodeDetector } & T {
    return 'BarcodeDetector' in value
}

export { isBarcodeDetectorAvailable }

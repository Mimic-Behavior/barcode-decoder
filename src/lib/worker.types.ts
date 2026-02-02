import type { BarcodeFormat, DetectedBarcode } from 'barcode-detector/ponyfill'

type Config = {
    payload: {
        formats: BarcodeFormat[]
        wasmUrl: string
    }
    type: 'config'
}

type DecodeRequest = {
    payload: {
        data: ImageData
        uuid: string
    }
    type: 'decode'
}

type DecodeResponse = {
    payload: {
        data: DetectedBarcode | null
        uuid: string
    }
    type: 'decode'
}

type Init = {
    payload: {
        status: 'failure' | 'success'
    }
    type: 'init'
}

export type { Config, DecodeRequest, DecodeResponse, Init }

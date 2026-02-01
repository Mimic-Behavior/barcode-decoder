import type { DetectedBarcode } from 'barcode-detector/ponyfill'

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

export type { DecodeRequest, DecodeResponse, Init }

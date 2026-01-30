import type { DetectedBarcode } from 'barcode-detector/ponyfill'

type DecodeReq = {
    payload: {
        data: ImageData
        uuid: string
    }
    type: 'decode'
}

type DecodeRes = {
    payload: {
        data: DetectedBarcode | null
        uuid: string
    }
    type: 'decode'
}

export type { DecodeReq, DecodeRes }

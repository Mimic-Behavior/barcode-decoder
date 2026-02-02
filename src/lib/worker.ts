import { BarcodeDetector as BarcodeDetectorPonyfill, prepareZXingModule } from 'barcode-detector/ponyfill'

import type { Config, DecodeRequest, DecodeResponse, Init } from './worker.types'

import { isBarcodeDetectorAvailable } from './utils/is-barcode-detector-available'

const worker = self as unknown as Worker

let barcodeDetector: BarcodeDetectorPonyfill | null = null

worker.addEventListener('message', async ({ data: { payload, type } }: MessageEvent<Config>) => {
    if (type !== 'config') {
        return
    }

    const barcodeDetectorOptions = { formats: payload.formats }

    try {
        if (isBarcodeDetectorAvailable(worker)) {
            barcodeDetector = new worker.BarcodeDetector(barcodeDetectorOptions)

            sendInitResponse('success')
        } else {
            prepareZXingModule({
                overrides: {
                    instantiateWasm(imports, successCallback) {
                        fetch(payload.wasmUrl)
                            .then((response) => response.arrayBuffer())
                            .then((arrayBuffer) =>
                                WebAssembly.instantiate(arrayBuffer, imports).then(({ instance }) =>
                                    successCallback(instance),
                                ),
                            )

                        return {}
                    },
                    postRun: [() => sendInitResponse('success')],
                },
            })

            barcodeDetector = new BarcodeDetectorPonyfill(barcodeDetectorOptions)
        }
    } catch (error) {
        console.error(error)

        sendInitResponse('failure')
    }
})

worker.addEventListener('message', async ({ data: { payload, type } }: MessageEvent<DecodeRequest>) => {
    if (type !== 'decode') {
        return
    }

    const response: DecodeResponse = {
        payload: {
            data: null,
            uuid: payload.uuid,
        },
        type,
    }

    try {
        if (barcodeDetector === null) {
            throw new Error('Barcode detector not initialized')
        }

        if (payload.data) {
            response.payload.data = (await barcodeDetector.detect(payload.data))[0]
        }
    } catch (error) {
        console.error(error)
    }

    worker.postMessage(response)
})

function sendInitResponse(status: 'failure' | 'success') {
    worker.postMessage({
        payload: {
            status,
        },
        type: 'init',
    } satisfies Init)
}

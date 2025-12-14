import BarcodeScanner from './lib/barcode-scanner'

const video = document.querySelector('video')

/**
 * Get the control elements
 */
const buttonStart = document.querySelector('[data-id="button-start"]')
const buttonPause = document.querySelector('[data-id="button-pause"]')
const buttonStop = document.querySelector('[data-id="button-stop"]')

/**
 * Get the result elements
 */
const resultTitle = document.querySelector('[data-id="result-title"]')
const resultValue = document.querySelector('[data-id="result-value"]')

if (video) {
    const barcodeScanner = new BarcodeScanner({
        onDecode: (result) => {
            if (!resultTitle || !resultValue) {
                return
            }

            resultValue.textContent = result.rawValue
        },
        onDecodeError: (error) => {
            if (!resultTitle || !resultValue) {
                return
            }

            resultValue.textContent = error
        },
        options: {
            debug: true,
            scanArea: (video) => {
                return {
                    height: video.videoHeight,
                    width: video.videoWidth,
                    x: 0,
                    y: 0,
                }
            },
            scanRate: 24,
        },
        video,
    })

    buttonStart?.addEventListener('click', () => {
        barcodeScanner.start()
    })
    buttonPause?.addEventListener('click', () => {
        barcodeScanner.pause()
    })
    buttonStop?.addEventListener('click', () => {
        barcodeScanner.stop()
    })
}

import BarcodeDecoder from './lib/barcode-decoder'

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
    const barcodeDecoder = new BarcodeDecoder(
        video,
        (result) => {
            if (!resultTitle || !resultValue) {
                return
            }

            console.log('BarcodeDecoder: ', result)

            resultTitle.textContent = 'Barcode:'
            resultValue.textContent = result.rawValue
        },
        {
            debug: true,
            facingMode: 'environment',
            onDecodeError: (error) => {
                if (!resultTitle || !resultValue) {
                    return
                }

                resultTitle.textContent = 'Error: '
                resultValue.textContent = error
            },
            scanRate: 24,
        },
    )

    buttonStart?.addEventListener('click', () => {
        barcodeDecoder.play()
    })
    buttonPause?.addEventListener('click', () => {
        barcodeDecoder.pause()
    })
    buttonStop?.addEventListener('click', () => {
        barcodeDecoder.stop()
    })
}

import QrScanner from './lib/qr-scanner'

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
    const qrScanner = new QrScanner(
        video,
        (result) => {
            if (!resultTitle || !resultValue) {
                return
            }

            console.log('QrScanner: ', result)

            resultTitle.textContent = 'QR Code:'
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
        qrScanner.start()
    })
    buttonPause?.addEventListener('click', () => {
        qrScanner.pause()
    })
    buttonStop?.addEventListener('click', () => {
        qrScanner.stop()
    })
}

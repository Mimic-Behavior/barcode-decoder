import { createBarcodeScanner, translateAreaToVideoSource } from './lib'
import './main.css'

const video = document.querySelector<HTMLVideoElement>('[data-id="video"]')
const videoContainer = document.querySelector<HTMLDivElement>('[data-id="video-container"]')

/**
 * Get the control elements
 */
const buttonStart = document.querySelector('[data-id="button-start"]')
const buttonPause = document.querySelector('[data-id="button-pause"]')
const buttonStop = document.querySelector('[data-id="button-stop"]')
const selectObjectFit = document.querySelector('[data-id="select-object-fit"]')
const selectObjectPosition = document.querySelector('[data-id="select-object-position"]')

/**
 * Get the result elements
 */
const resultTitle = document.querySelector('[data-id="result-title"]')
const resultValue = document.querySelector('[data-id="result-value"]')

if (video && videoContainer) {
    const barcodeScanner = await createBarcodeScanner(video, {
        calcScanArea(video) {
            const size = (2 / 3) * Math.min(video.offsetWidth, video.offsetHeight)
            const area = {
                height: size,
                width: size,
                x: (video.offsetWidth - size) / 2,
                y: (video.offsetHeight - size) / 2,
            }

            return translateAreaToVideoSource(video, area)
        },
        debug: true,
        onDecodeFailure,
        onDecodeSuccess,
        setAreaDetectedVariables: true,
        setAreaPositionVariables: true,
    })

    function onDecodeSuccess(data: string) {
        if (!resultTitle || !resultValue) {
            return
        }

        if (data) {
            resultValue.textContent = data
        } else {
            resultValue.textContent = 'No data'
        }
    }

    function onDecodeFailure() {
        if (!resultTitle || !resultValue) {
            return
        }

        resultValue.textContent = 'Decode error'
    }

    buttonStart?.addEventListener('click', () => {
        barcodeScanner.start({ facingMode: 'environment' })
    })
    buttonPause?.addEventListener('click', () => {
        barcodeScanner.pause()
    })
    buttonStop?.addEventListener('click', () => {
        barcodeScanner.stop()
    })
    selectObjectFit?.addEventListener('change', (event) => {
        video.style.objectFit = (event.target as HTMLSelectElement).value
    })
    selectObjectPosition?.addEventListener('change', (event) => {
        video.style.objectPosition = (event.target as HTMLSelectElement).value
    })

    /**
     * Debug video scan area
     */
    const canvas = document.createElement('canvas')
    const canvasContext = canvas.getContext('2d')

    window.addEventListener('barcode-scanner:decode-frame', (event) => {
        if (!(event instanceof CustomEvent) || !event.detail || !event.detail.imageData) {
            return
        }

        const { imageData } = event.detail as { imageData: ImageData }

        canvas.width = imageData.width
        canvas.height = imageData.height
        canvasContext?.putImageData(imageData, 0, 0)

        const img = document.querySelector<HTMLImageElement>('[data-id="video-preview"]')
        if (img) {
            img.src = canvas.toDataURL()
        } else {
            const img = document.createElement('img')
            img.classList.add('demo__video-preview')
            img.src = canvas.toDataURL()
            img.dataset.id = 'video-preview'
            videoContainer.appendChild(img)
        }
    })
}

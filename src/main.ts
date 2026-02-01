import {
    createBarcodeScanner,
    type ScanArea,
    translateAreaToVideoRender,
    translateAreaToVideoSource,
    wait,
} from './lib'
import './main.css'

const video = document.querySelector<HTMLVideoElement>('[data-id="video"]')
const videoContainer = document.querySelector<HTMLDivElement>('[data-id="video-container"]')

/**
 * Get the control elements
 */
const buttonPause = document.querySelector('[data-id="button-pause"]')
const buttonStart = document.querySelector('[data-id="button-start"]')
const buttonStop = document.querySelector('[data-id="button-stop"]')
const checkboxAlertOnSuccess = document.querySelector<HTMLInputElement>('[data-id="checkbox-alert-on-success"]')
const selectObjectFit = document.querySelector('[data-id="select-object-fit"]')
const selectObjectPosition = document.querySelector('[data-id="select-object-position"]')

/**
 * Get the result elements
 */
const resultTitle = document.querySelector('[data-id="result-title"]')
const resultValue = document.querySelector('[data-id="result-value"]')

function delAreaVariable(element: HTMLElement, prefix: string) {
    element.style.removeProperty(`${prefix}-height`)
    element.style.removeProperty(`${prefix}-width`)
    element.style.removeProperty(`${prefix}-x`)
    element.style.removeProperty(`${prefix}-y`)
}
function setAreaVariable(element: HTMLElement, prefix: string, area: ScanArea) {
    element.style.setProperty(`${prefix}-height`, `${area.height}px`)
    element.style.setProperty(`${prefix}-width`, `${area.width}px`)
    element.style.setProperty(`${prefix}-x`, `${area.x}px`)
    element.style.setProperty(`${prefix}-y`, `${area.y}px`)
}

if (video && videoContainer) {
    const barcodeScanner = await createBarcodeScanner(video, {
        debug: true,
        getScanArea(video) {
            const size = (2 / 3) * Math.min(video.offsetWidth, video.offsetHeight)
            const area = {
                height: size,
                width: size,
                x: (video.offsetWidth - size) / 2,
                y: (video.offsetHeight - size) / 2,
            }

            return translateAreaToVideoSource(video, area)
        },
        handleDecodeFailure() {
            if (!resultTitle || !resultValue) {
                return
            }

            delAreaVariable(this.video.parentElement!, 'barcode-scanner-area-detected')

            resultValue.textContent = 'No data'
        },
        async handleDecodeSuccess(data, area) {
            if (!resultTitle || !resultValue) {
                return
            }

            setAreaVariable(
                this.video.parentElement!,
                'barcode-scanner-area-detected',
                translateAreaToVideoRender(this.video, area),
            )

            if (checkboxAlertOnSuccess?.checked) {
                await barcodeScanner.pause()
                await wait(400)

                alert(`Barcode decoded: ${data}`)
            }

            resultValue.textContent = data
        },
        lifecycle: {
            onBeforeDecode() {
                setAreaVariable(
                    this.video.parentElement!,
                    'barcode-scanner-area',
                    translateAreaToVideoRender(this.video, this.scanArea),
                )
            },
            onStart() {
                setAreaVariable(
                    this.video.parentElement!,
                    'barcode-scanner-area',
                    translateAreaToVideoRender(this.video, this.scanArea),
                )
            },
        },
    })

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

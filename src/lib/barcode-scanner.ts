import type { DetectedBarcode, Point2D } from './barcode-detector.type'
import type { WorkerRequest, WorkerResponse } from './barcode-scanner.types'

class BarcodeScanner {
    private canvas: HTMLCanvasElement
    private canvasContext: CanvasRenderingContext2D
    private debug?: boolean
    private decodeFrameRequestTimestamp: number
    private decodeTimeout: number
    private facingMode: 'environment' | 'user'
    private hasHighlightCodeArea: boolean
    private hasHighlightScanArea: boolean
    private isDecodeFrameProcessed: boolean
    private isDestroyed: boolean
    private onDecode: (result: string, area: Point2D[]) => void
    private onDecodeError?: (error: string) => void
    private requestFrame: (callback: () => void) => number
    private scanArea: { height: number; width: number; x: number; y: number }
    private scanRate: number
    private video: HTMLVideoElement
    private worker: Worker

    constructor({
        onDecode,
        onDecodeError,
        options,
        video,
    }: {
        onDecode: (data: string, area?: Point2D[]) => void
        onDecodeError?: (error: string) => void
        options?: {
            calcScanArea?: (video: HTMLVideoElement) => { height: number; width: number; x: number; y: number }
            debug?: boolean
            decodeTimeout?: number
            highlightCodeArea?: boolean
            highlightScanArea?: boolean
            scanRate?: number
        }
        video: HTMLVideoElement
    }) {
        if (!(video instanceof HTMLVideoElement)) {
            throw new Error('video is not a HTMLVideoElement')
        }

        if (!(onDecode instanceof Function)) {
            throw new Error('onDecode is not a function')
        }

        if (!(onDecodeError instanceof Function)) {
            throw new Error('onDecodeError is not a function')
        }

        this.canvas = document.createElement('canvas')

        const context = this.canvas.getContext('2d', { willReadFrequently: true })

        if (!context) {
            throw new Error('Failed to get canvas context')
        }

        this.canvasContext = context
        this.debug = options?.debug
        this.decodeTimeout = options?.decodeTimeout ?? 1000
        this.facingMode = 'environment'
        this.isDecodeFrameProcessed = false
        this.isDestroyed = false
        this.onDecode = onDecode
        this.onDecodeError = onDecodeError
        this.requestFrame = video.requestVideoFrameCallback
            ? video.requestVideoFrameCallback.bind(video)
            : requestAnimationFrame
        this.decodeFrameRequestTimestamp = performance.now()
        this.hasHighlightCodeArea = options?.highlightCodeArea ?? false
        this.hasHighlightScanArea = options?.highlightScanArea ?? false
        this.scanArea = this.getScanArea(video)
        this.scanRate = options?.scanRate ?? 24

        /**
         * Setup video
         */
        this.video = video
        this.video.autoplay = true
        this.video.disablePictureInPicture = true
        this.video.hidden = false
        this.video.muted = true
        this.video.playsInline = true

        const resizeObserver = new ResizeObserver(() => {
            this.scanArea = this.getScanArea(this.video)
            this.render()
        })

        resizeObserver.observe(this.video)

        /**
         * Setup worker
         */
        this.worker = new Worker(new URL('./barcode-scanner.worker.ts', import.meta.url), { type: 'module' })
    }

    public async decode(imageData: ImageData): Promise<DetectedBarcode | null> {
        if (!(imageData instanceof ImageData)) {
            throw new Error('Invalid decode data')
        }

        const requestId = crypto.randomUUID()

        return new Promise((res, rej) => {
            let timeout: ReturnType<typeof setTimeout> = 0

            const handleWorkerResponse = ({ data: { data, uuid } }: MessageEvent<WorkerResponse>) => {
                if (uuid !== requestId) {
                    return
                }

                clearTimeout(timeout)

                this.worker.removeEventListener('message', handleWorkerResponse)

                res(data)
            }

            /**
             * Timeout for the scan request
             */
            timeout = setTimeout(() => {
                this.worker.removeEventListener('message', handleWorkerResponse)

                rej(null)
            }, this.decodeTimeout)

            this.worker.addEventListener('message', handleWorkerResponse)
            this.worker.postMessage({ data: imageData, uuid: requestId } satisfies WorkerRequest)
        })
    }

    public async destroy(): Promise<void> {
        if (this.isDestroyed) {
            return
        }

        await this.stop()
        this.worker.terminate()
        this.isDestroyed = true
    }

    public async getCameraAccess(): Promise<boolean> {
        if (await this.hasCameraAccess()) {
            return true
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true })
            const tracks = stream.getTracks()

            for (const track of tracks) {
                track.stop()
            }

            return true
        } catch {
            return false
        }
    }

    public async hasCameraAccess(): Promise<boolean> {
        try {
            const status = await navigator.permissions.query({ name: 'camera' })

            return status.state === 'granted'
        } catch {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const cameras = devices.filter((device) => device.deviceId && device.kind === 'videoinput')

            return cameras.length > 0
        }
    }

    public pause(): void {
        this.video.pause()
    }

    public async start({ facingMode = 'environment' }: { facingMode?: 'environment' | 'user' } = {}): Promise<void> {
        const hasAccess = await this.getCameraAccess()

        if (!hasAccess) {
            throw new Error('No camera access')
        }

        if (this.video.srcObject instanceof MediaStream && this.video.paused) {
            await this.video.play()
        } else {
            this.video.srcObject = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode,
                },
            })

            await this.video.play()
        }

        this.facingMode = facingMode
        this.scanArea = this.getScanArea(this.video)
        this.video.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'none'
        this.render()
        this.decodeFrame()
    }

    public async stop(): Promise<void> {
        if (this.video.srcObject instanceof MediaStream) {
            this.video.srcObject.getTracks().forEach((track) => track.stop())
        }

        this.video.srcObject = null
    }

    private decodeFrame(): void {
        if (this.isDestroyed) {
            return
        }

        this.requestFrame(() => {
            if (
                // Skip if the time since the last request frame is less than the scan rate
                performance.now() - this.decodeFrameRequestTimestamp < 1000 / this.scanRate ||
                // Skip if the frame is already processed
                this.isDecodeFrameProcessed ||
                // Skip if the video is ended
                this.video.ended ||
                // Skip if the video is paused
                this.video.paused ||
                // Skip if the video is not ready
                this.video.readyState <= 1
            ) {
                this.decodeFrameRequestTimestamp = performance.now()
                this.decodeFrame()
                return
            }

            this.isDecodeFrameProcessed = true

            this.canvas.height = this.scanArea.height
            this.canvas.width = this.scanArea.width
            this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height)
            this.canvasContext.drawImage(
                this.video,
                this.scanArea.x,
                this.scanArea.y,
                this.scanArea.width,
                this.scanArea.height,
                0,
                0,
                this.canvas.width,
                this.canvas.height,
            )

            const imageData = this.canvasContext.getImageData(0, 0, this.canvas.width, this.canvas.height)

            if (this.debug) {
                window.dispatchEvent(
                    new CustomEvent('barcode-scanner:decode-frame', {
                        detail: {
                            imageData,
                        },
                    }),
                )
            }

            this.decode(imageData)
                .then((result) => {
                    if (!result) {
                        return
                    }

                    this.onDecode(
                        result.rawValue,
                        result.cornerPoints.map((point) => ({
                            x: point.x + this.scanArea.x,
                            y: point.y + this.scanArea.y,
                        })),
                    )
                })
                .catch(() => {
                    this.onDecodeError?.('Decode error')
                })
                .finally(() => {
                    this.isDecodeFrameProcessed = false
                    this.decodeFrameRequestTimestamp = performance.now()
                    this.decodeFrame()
                })
        })
    }

    private getScanArea(video: HTMLVideoElement) {
        const size = Math.round((2 / 3) * Math.min(video.videoWidth, video.videoHeight))

        return {
            height: size,
            width: size,
            x: Math.round((video.videoWidth - size) / 2),
            y: Math.round((video.videoHeight - size) / 2),
        }
    }

    private getScanAreaPosition() {
        const computedStyle = window.getComputedStyle(this.video)
        const isMirrored = computedStyle.transform === 'matrix(-1, 0, 0, 1, 0, 0)'
        const objectFit = computedStyle.objectFit
        const objectPosition = computedStyle.objectPosition
        const elementOffsetX = this.video.offsetLeft
        const elementOffsetY = this.video.offsetTop
        const elementHeight = this.video.offsetHeight
        const elementWidth = this.video.offsetWidth
        const elementAspectRatio = elementWidth / elementHeight
        const videoHeight = this.video.videoHeight
        const videoWidth = this.video.videoWidth
        const videoAspectRatio = videoWidth / videoHeight
        const areaWidth = this.scanArea.width || videoWidth
        const areaHeight = this.scanArea.height || videoHeight
        const areaX = this.scanArea.x || 0
        const areaY = this.scanArea.y || 0

        let scaledHeight: number
        let scaledWidth: number

        switch (objectFit) {
            case 'contain':
            case 'cover': {
                const limitedByHeight =
                    objectFit === 'contain'
                        ? videoAspectRatio < elementAspectRatio
                        : videoAspectRatio > elementAspectRatio
                scaledHeight = limitedByHeight ? elementHeight : elementWidth / videoAspectRatio
                scaledWidth = limitedByHeight ? elementHeight * videoAspectRatio : elementWidth
                break
            }
            case 'none': {
                scaledHeight = videoHeight
                scaledWidth = videoWidth
                break
            }
            case 'scale-down': {
                const limitedByHeight = videoAspectRatio < elementAspectRatio
                scaledHeight = Math.min(limitedByHeight ? elementWidth / videoAspectRatio : elementHeight, videoHeight)
                scaledWidth = Math.min(limitedByHeight ? elementHeight * videoAspectRatio : elementWidth, videoWidth)
                break
            }
            default: {
                scaledHeight = elementHeight
                scaledWidth = elementWidth
                break
            }
        }

        // prettier-ignore
        const [
            positionX,
            positionY
        ] = objectPosition
            .split(' ')
            .map((part, index) =>
                part.endsWith('%')
                    ? ((index === 0 ? elementWidth - scaledWidth : elementHeight - scaledHeight) * parseFloat(part)) /
                      100
                    : parseFloat(part),
            )

        const areaOffsetX = ((isMirrored ? areaX : videoWidth - areaX - areaWidth) / videoWidth) * scaledWidth
        const areaOffsetY = (areaY / videoHeight) * scaledHeight
        const scaleX = scaledWidth / videoWidth
        const scaleY = scaledHeight / videoHeight

        return {
            height: areaHeight * scaleY,
            width: areaWidth * scaleX,
            x: elementOffsetX + (isMirrored ? positionX : elementWidth - positionX - scaledWidth) + areaOffsetX,
            y: elementOffsetY + positionY + areaOffsetY,
        }
    }

    private render() {
        const area = this.getScanAreaPosition()

        document.documentElement.style.setProperty('--barcode-scanner-area-height', `${area.height}px`)
        document.documentElement.style.setProperty('--barcode-scanner-area-width', `${area.width}px`)
        document.documentElement.style.setProperty('--barcode-scanner-area-x', `${area.x}px`)
        document.documentElement.style.setProperty('--barcode-scanner-area-y', `${area.y}px`)
    }
}

export default BarcodeScanner

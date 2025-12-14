import type { DetectedBarcode } from './barcode-detector.type'
import type { DecodeData, WorkerRequest, WorkerResponse } from './barcode-scanner.types'

class BarcodeScanner {
    private canvas: HTMLCanvasElement
    private canvasContext: CanvasRenderingContext2D
    private debug?: boolean
    private decodeFrameRequestTimestamp: number
    private decodeTimeout: number
    private isDecodeFrameProcessed: boolean
    private isDestroyed: boolean
    private onDecode: (result: DetectedBarcode) => void
    private onDecodeError?: (error: string) => void
    private requestFrame: (callback: () => void) => number
    private scanArea: (video: HTMLVideoElement) => { height: number; width: number; x: number; y: number }
    private scanRate: number
    private video: HTMLVideoElement
    private worker: Worker

    constructor({
        onDecode,
        onDecodeError,
        options,
        video,
    }: {
        onDecode: (result: DetectedBarcode) => void
        onDecodeError?: (error: string) => void
        options?: {
            debug?: boolean
            decodeTimeout?: number
            scanArea?: (video: HTMLVideoElement) => { height: number; width: number; x: number; y: number }
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
        this.isDecodeFrameProcessed = false
        this.isDestroyed = false
        this.onDecode = onDecode
        this.onDecodeError = onDecodeError
        this.requestFrame = video.requestVideoFrameCallback
            ? video.requestVideoFrameCallback.bind(video)
            : requestAnimationFrame
        this.decodeFrameRequestTimestamp = performance.now()
        this.scanArea = options?.scanArea ?? this.getScanArea
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

        /**
         * Setup worker
         */
        this.worker = new Worker(new URL('./barcode-scanner.worker.ts', import.meta.url), { type: 'module' })
    }

    public async decode(data: DecodeData): Promise<DetectedBarcode | null> {
        if (
            !data ||
            !data.imageData ||
            !data.imageHeight ||
            !data.imageWidth ||
            !(data.imageData instanceof Uint8ClampedArray)
        ) {
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

                if (data) {
                    res(data)

                    if (this.debug) {
                        console.log('BarcodeScanner: ', data)
                    }
                } else {
                    rej(null)
                }
            }

            /**
             * Timeout for the scan request
             */
            timeout = setTimeout(() => {
                this.worker.removeEventListener('message', handleWorkerResponse)

                rej(null)
            }, this.decodeTimeout)

            this.worker.addEventListener('message', handleWorkerResponse)
            this.worker.postMessage({ data, uuid: requestId } satisfies WorkerRequest)
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

        this.decodeFrame()

        // prettier-ignore
        if (
            this.video.srcObject instanceof MediaStream &&
            this.video.paused
        ) {
            return this.video.play()
        } else {
            this.video.srcObject = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode,
                },
            })

            return this.video.play()
        }
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

            const scanArea = this.scanArea(this.video)

            this.canvas.height = scanArea.height
            this.canvas.width = scanArea.width
            this.canvasContext.drawImage(this.video, scanArea.x, scanArea.y, scanArea.width, scanArea.height)

            this.decode({
                imageData: this.canvasContext.getImageData(0, 0, this.canvas.width, this.canvas.height).data,
                imageHeight: this.canvas.height,
                imageWidth: this.canvas.width,
            })
                .then((result) => {
                    if (result) {
                        this.onDecode(result)
                    }
                })
                .catch(() => {
                    if (this.onDecodeError) {
                        this.onDecodeError('No barcode detected')
                    }
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
}

export default BarcodeScanner

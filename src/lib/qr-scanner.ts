import type { DetectedBarcode } from './barcode-detector.type'
import type { WorkerRequest, WorkerResponse } from './qr-scanner.type'

/**
 * QR Scanner
 * @param video - The video element
 * @param onDecode - The function to call when a QR code is decoded
 * @param options - The options for the scanner
 * @returns The QR scanner
 */
class QrScanner {
    private canvas: HTMLCanvasElement
    private canvasContext: CanvasRenderingContext2D
    private debug?: boolean
    private facingMode?: 'environment' | 'user'
    private isDestroyed: boolean
    private isProcessed: boolean
    private onDecode: (result: DetectedBarcode) => void
    private onDecodeError?: (error: string) => void
    private requestFrame: (callback: () => void) => number
    private requestFrameTimestamp: number
    private scanRate?: number
    private scanRegion?: { height: number; width: number; x: number; y: number }
    private video: HTMLVideoElement
    private worker: Worker

    constructor(
        video: HTMLVideoElement,
        onDecode: (result: DetectedBarcode) => void,
        options?: {
            debug?: boolean
            facingMode?: 'environment' | 'user'
            onDecodeError?: (error: string) => void
            scanRate?: number
            scanRegion?: { height: number; width: number; x: number; y: number }
        },
    ) {
        if (!(video instanceof HTMLVideoElement)) {
            throw new Error('video is not a HTMLVideoElement')
        }

        if (!(onDecode instanceof Function)) {
            throw new Error('onDecode is not a function')
        }

        if (options?.onDecodeError && !(options.onDecodeError instanceof Function)) {
            throw new Error('onDecodeError is not a function')
        }

        this.canvas = document.createElement('canvas')

        const context = this.canvas.getContext('2d', { willReadFrequently: true })

        if (!context) {
            throw new Error('Failed to get canvas context')
        }

        this.canvasContext = context
        this.debug = options?.debug
        this.facingMode = options?.facingMode
        this.isDestroyed = false
        this.isProcessed = false
        this.onDecode = onDecode
        this.onDecodeError = options?.onDecodeError
        this.requestFrame = video.requestVideoFrameCallback
            ? video.requestVideoFrameCallback.bind(video)
            : requestAnimationFrame
        this.requestFrameTimestamp = Date.now()
        this.scanRate = options?.scanRate
        this.scanRegion = options?.scanRegion

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
        this.worker = new Worker(new URL('./qr-scanner.worker.ts', import.meta.url), { type: 'module' })
        this.worker.addEventListener('message', ({ data: { data } }: MessageEvent<WorkerResponse>) => {
            this.isProcessed = false

            if (data) {
                this.onDecode(data)

                if (this.debug) {
                    console.log('QrScanner: ', data)
                }
            } else {
                this.onDecodeError?.('No data')
            }
        })
    }

    /**
     * Destroy the scanner
     */
    async destroy(): Promise<void> {
        if (this.isDestroyed) {
            return
        }

        await this.stop()
        this.worker.terminate()
        this.isDestroyed = true
    }

    /**
     * Get the camera access
     * @returns Whether the camera has access
     */
    async getCameraAccess(): Promise<boolean> {
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

    /**
     * Check if the camera has access
     * @returns Whether the camera has access
     */
    async hasCameraAccess(): Promise<boolean> {
        try {
            const status = await navigator.permissions.query({ name: 'camera' })

            return status.state === 'granted'
        } catch {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const cameras = devices.filter((device) => device.deviceId && device.kind === 'videoinput')

            return cameras.length > 0
        }
    }

    /**
     * Pause the camera
     */
    async pause(): Promise<void> {
        this.video.pause()
    }

    /**
     * Start the camera
     * @throws If the camera has no access
     * @throws If the camera is already started
     */
    async start(): Promise<void> {
        const hasAccess = await this.getCameraAccess()

        if (!hasAccess) {
            throw new Error('No camera access')
        }

        // prettier-ignore
        if (
            this.video.srcObject instanceof MediaStream &&
            this.video.paused
        ) {
            await this.video.play()
            return
        }

        this.video.srcObject = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: this.facingMode ?? 'environment',
            },
        })
        this.video.play()
        this.scanFrame()
    }

    /**
     * Stop the camera
     */
    async stop(): Promise<void> {
        if (this.video.srcObject instanceof MediaStream) {
            this.video.srcObject.getTracks().forEach((track) => track.stop())
        }

        this.video.srcObject = null
    }

    /**
     * Scan the frame
     */
    private scanFrame(): void {
        if (this.isDestroyed) {
            return
        }

        this.requestFrame(() => {
            // prettier-ignore
            if (
                // Skip if the time since the last request frame is less than the scan rate
                Date.now() - this.requestFrameTimestamp < 1000 / (this.scanRate ?? 24) ||
                // Skip if the frame is already processed
                this.isProcessed ||
                // Skip if the video is ended
                this.video.ended ||
                // Skip if the video is paused
                this.video.paused ||
                // Skip if the video is not ready
                this.video.readyState <= 1
            ) {
                this.scanFrame()
                return
            }

            this.isProcessed = true

            this.canvas.height = this.video.videoHeight
            this.canvas.width = this.video.videoWidth
            this.canvasContext.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height)

            this.worker.postMessage({
                data: {
                    imageData: this.canvasContext.getImageData(
                        this.scanRegion?.x ?? 0,
                        this.scanRegion?.y ?? 0,
                        this.scanRegion?.width ?? this.canvas.width,
                        this.scanRegion?.height ?? this.canvas.height,
                    ).data,
                    imageHeight: this.canvas.height,
                    imageWidth: this.canvas.width,
                },
                id: Date.now(),
            } satisfies WorkerRequest)

            this.requestFrameTimestamp = Date.now()
            this.scanFrame()
        })
    }
}

export default QrScanner

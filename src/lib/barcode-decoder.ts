import type { DecodeData, WorkerRequest, WorkerResponse } from './barcode-decoder.types'
import type { DetectedBarcode } from './barcode-detector.type'

/**
 * Barcode Decoder class for detecting barcodes from video streams
 */
class BarcodeDecoder {
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

    /**
     * Creates a new Barcode Decoder instance
     * @param video - The HTML video element to use for capturing frames
     * @param onDecode - Callback function that is called when a barcode is successfully decoded
     * @param options - Optional configuration options for the scanner
     * @param options.debug - Enable debug logging to console
     * @param options.facingMode - Camera facing mode: 'environment' for back camera, 'user' for front camera
     * @param options.onDecodeError - Optional callback function called when a decode error occurs
     * @param options.scanRate - Maximum number of frames to scan per second (default: 24)
     * @param options.scanRegion - Optional region of the video frame to scan for barcodes
     * @param options.scanRegion.x - X coordinate of the scan region
     * @param options.scanRegion.y - Y coordinate of the scan region
     * @param options.scanRegion.width - Width of the scan region
     * @param options.scanRegion.height - Height of the scan region
     * @throws {Error} If video is not a HTMLVideoElement
     * @throws {Error} If onDecode is not a function
     * @throws {Error} If onDecodeError is provided but is not a function
     * @throws {Error} If canvas context cannot be obtained
     */
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
    }

    /**
     * Scans image data for barcodes using a worker thread
     *
     * Sends image data to a worker thread for barcode detection. The method uses
     * a unique request ID to match responses and includes a timeout mechanism to
     * prevent hanging requests.
     *
     * @param data - The image data to decode, containing pixel data and dimensions
     * @param data.imageData - The raw image pixel data as a Uint8ClampedArray
     * @param data.imageHeight - The height of the image in pixels
     * @param data.imageWidth - The width of the image in pixels
     * @returns Promise that resolves to a DetectedBarcode if a barcode is found, or null if not found or timeout occurs
     * @throws {null} Rejects with null if no barcode is detected or if the request times out (after 1000ms)
     *
     * @example
     * ```typescript
     * const imageData = canvasContext.getImageData(0, 0, width, height);
     * const result = await scanner.scan({
     *     imageData: imageData.data,
     *     imageWidth: width,
     *     imageHeight: height
     * });
     * if (result) {
     *     console.log('Barcode found:', result.rawValue);
     * }
     * ```
     */
    public async decode(data: DecodeData): Promise<DetectedBarcode | null> {
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
                        console.log('BarcodeDecoder: ', data)
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
            }, 1000)

            this.worker.addEventListener('message', handleWorkerResponse)
            this.worker.postMessage({ data, uuid: requestId } satisfies WorkerRequest)
        })
    }

    /**
     * Destroys the scanner instance
     *
     * Stops the camera stream, terminates the worker thread, and marks the scanner as destroyed.
     * This method is idempotent and can be called multiple times safely.
     *
     * @returns Promise that resolves when the scanner has been fully destroyed
     */
    public async destroy(): Promise<void> {
        if (this.isDestroyed) {
            return
        }

        await this.stop()
        this.worker.terminate()
        this.isDestroyed = true
    }

    /**
     * Requests camera access from the user
     *
     * First checks if camera access is already granted. If not, attempts to request
     * camera permissions from the user. The method will stop any tracks immediately
     * after checking permissions to avoid holding the camera stream.
     *
     * @returns Promise that resolves to true if camera access is granted, false otherwise
     */
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

    /**
     * Checks if the camera has access permissions
     *
     * Attempts to query the camera permission status. If the Permissions API is not
     * available, falls back to checking if any camera devices are available.
     *
     * @returns Promise that resolves to true if camera access is available, false otherwise
     */
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

    /**
     * Pauses the video playback
     *
     * Pauses the video element, which will stop frame scanning. The camera stream
     * remains active and can be resumed by calling start() again.
     *
     * @returns Promise that resolves when the video has been paused
     */
    public async pause(): Promise<void> {
        this.video.pause()
    }

    /**
     * Starts the camera and begins scanning for barcodes
     *
     * Requests camera access if not already granted, then starts the video stream
     * and begins scanning frames. If the video is already paused with an active
     * stream, it will resume playback instead of creating a new stream.
     *
     * @returns Promise that resolves when the camera has started and scanning has begun
     * @throws {Error} If camera access is not available or denied
     */
    public async play(): Promise<void> {
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
                    facingMode: this.facingMode ?? 'environment',
                },
            })

            return this.video.play()
        }
    }

    /**
     * Stops the camera stream
     *
     * Stops all video tracks and clears the video source object. This will
     * effectively stop frame scanning as the video stream is no longer available.
     *
     * @returns Promise that resolves when the camera has been stopped
     */
    public async stop(): Promise<void> {
        if (this.video.srcObject instanceof MediaStream) {
            this.video.srcObject.getTracks().forEach((track) => track.stop())
        }

        this.video.srcObject = null
    }

    /**
     * Scan the current video frame for barcodes
     *
     * This method recursively schedules frame scanning using requestVideoFrameCallback
     * or requestAnimationFrame. It captures the current video frame, draws it to a canvas,
     * and sends the image data to a worker thread for barcode detection.
     *
     * The method automatically skips frames if:
     * - The scanner has been destroyed
     * - The time since the last scan is less than the configured scan rate
     * - A frame is already being processed
     * - The video has ended, is paused, or is not ready
     *
     * @private
     */
    private decodeFrame(): void {
        if (this.isDestroyed) {
            return
        }

        this.requestFrame(() => {
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
                this.decodeFrame()
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
                uuid: crypto.randomUUID(),
            } satisfies WorkerRequest)

            this.requestFrameTimestamp = Date.now()
            this.decodeFrame()
        })
    }
}

export default BarcodeDecoder

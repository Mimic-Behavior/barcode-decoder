import { createWatchable } from './create-watchable'
import { createWorker } from './create-worker'
import { getCameraAccess, getScanArea as getScanAreaDefault, type ScanArea } from './utils'

type DecodeFailureHandler = (this: State) => Promise<void> | void

type DecodeSuccessHandler = (this: State, data: string, area: ScanArea) => Promise<void> | void

type LifecycleHook = (this: State) => void

type State = {
    decodeFrameTs: number
    isDecodeFrameProcessed: boolean
    isDestroyed: boolean
    isVideoActive: boolean
    isVideoPaused: boolean
    scanArea: ScanArea
    scanRate: number
    video: HTMLVideoElement
}

async function createBarcodeScanner(
    video: HTMLVideoElement,
    {
        debug,
        getScanArea = getScanAreaDefault,
        handleDecodeFailure = () => {},
        handleDecodeSuccess = () => {},
        lifecycle = {},
        scanRate = 24,
    }: {
        debug?: boolean
        getScanArea?: (video: HTMLVideoElement) => ScanArea
        handleDecodeFailure?: DecodeFailureHandler
        handleDecodeSuccess?: DecodeSuccessHandler
        lifecycle?: {
            onBeforeCreate?: LifecycleHook
            onBeforeDecode?: LifecycleHook
            onBeforeStart?: LifecycleHook
            onBeforeStop?: LifecycleHook
            onCreate?: LifecycleHook
            onDecode?: LifecycleHook
            onStart?: LifecycleHook
            onStop?: LifecycleHook
        }
        scanRate?: number
    } = {},
) {
    if (!(video instanceof HTMLVideoElement)) {
        throw new Error('video is not a HTMLVideoElement')
    }

    if (!(handleDecodeSuccess instanceof Function)) {
        throw new Error('handleDecodeSuccess is not a function')
    }

    if (!(handleDecodeFailure instanceof Function)) {
        throw new Error('handleDecodeFailure is not a function')
    }

    const canvas = document.createElement('canvas')
    const canvasContext = canvas.getContext('2d', { willReadFrequently: true })!

    if (!canvasContext) {
        throw new Error('canvas context is not supported')
    }

    const { decode, worker } = createWorker()
    const { state } = createWatchable<State>({
        decodeFrameTs: performance.now(),
        isDecodeFrameProcessed: false,
        isDestroyed: false,
        isVideoActive: false,
        isVideoPaused: false,
        scanArea: getScanArea(video),
        scanRate,
        video,
    })

    const requestFrame = video.requestVideoFrameCallback?.bind(video) ?? requestAnimationFrame

    state.video.autoplay = true
    state.video.disablePictureInPicture = true
    state.video.hidden = false
    state.video.muted = true
    state.video.playsInline = true

    if (lifecycle.onCreate) {
        lifecycle.onCreate.call(state)
    }

    function handleDecode(handleDecodeSuccess: DecodeSuccessHandler, handleDecodeFailure: DecodeFailureHandler) {
        requestFrame(tick)

        async function tick() {
            if (state.isDestroyed || state.isVideoActive === false) {
                return
            }

            if (
                // Skip if the time since the last request frame is less than the scan rate
                performance.now() - state.decodeFrameTs < 1000 / state.scanRate ||
                // Skip if the frame is already processed
                state.isDecodeFrameProcessed ||
                // Skip if the video is not ready
                state.video.readyState <= 1
            ) {
                requestFrame(tick)
                return
            }

            state.isDecodeFrameProcessed = true

            state.scanArea = getScanArea(state.video)

            if (lifecycle.onBeforeDecode) {
                lifecycle.onBeforeDecode.call(state)
            }

            canvas.height = state.scanArea.height
            canvas.width = state.scanArea.width
            canvasContext.clearRect(0, 0, canvas.width, canvas.height)
            canvasContext.drawImage(
                state.video,
                state.scanArea.x,
                state.scanArea.y,
                state.scanArea.width,
                state.scanArea.height,
                0,
                0,
                canvas.width,
                canvas.height,
            )

            const imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height)

            if (debug) {
                window.dispatchEvent(
                    new CustomEvent('barcode-scanner:decode-frame', {
                        detail: {
                            imageData,
                        },
                    }),
                )
            }

            try {
                const data = await decode(imageData)

                if (data) {
                    const cornerPointsX = data.cornerPoints.map((p) => p.x)
                    const cornerPointsY = data.cornerPoints.map((p) => p.y)
                    const area = {
                        height: Math.max(...cornerPointsY) - Math.min(...cornerPointsY),
                        width: Math.max(...cornerPointsX) - Math.min(...cornerPointsX),
                        x: Math.min(...cornerPointsX) + state.scanArea.x,
                        y: Math.min(...cornerPointsY) + state.scanArea.y,
                    }

                    await Promise.resolve(handleDecodeSuccess.call(state, data.rawValue, area))
                } else {
                    await Promise.resolve(handleDecodeFailure.call(state))
                }
            } catch (err) {
                console.warn('Failed to decode barcode')

                if (err) {
                    console.error(err)
                }
            } finally {
                if (lifecycle.onDecode) {
                    lifecycle.onDecode.call(state)
                }

                state.decodeFrameTs = performance.now()
                state.isDecodeFrameProcessed = false

                requestFrame(tick)
            }
        }
    }

    function destroy() {
        if (state.isDestroyed) {
            return
        }

        stop()

        worker.terminate()

        state.isDestroyed = true
    }

    async function pause(): Promise<void> {
        if (state.isVideoActive === false || state.isVideoPaused || state.isDestroyed) {
            return
        }

        state.video.pause()

        canvas.height = state.video.videoHeight
        canvas.width = state.video.videoWidth
        canvasContext.drawImage(state.video, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)

        state.video.poster = canvas.toDataURL('image/jpeg', 0.9)

        if (state.video.srcObject instanceof MediaStream) {
            state.video.srcObject.getTracks().forEach((track) => track.stop())
        }

        state.isVideoPaused = true
        state.video.srcObject = null
    }

    async function start({
        facingMode = 'environment',
        ...rest
    }: {
        facingMode?: 'environment' | 'user'
        handleDecodeFailure?: DecodeFailureHandler
        handleDecodeSuccess?: DecodeSuccessHandler
    } = {}) {
        if (lifecycle.onBeforeStart) {
            lifecycle.onBeforeStart.call(state)
        }

        const hasAccess = await getCameraAccess()

        if (!hasAccess) {
            throw new Error('No camera access')
        }

        if (state.video.srcObject instanceof MediaStream) {
            return
        } else {
            state.video.srcObject = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode,
                },
            })

            await state.video.play()
        }

        state.isVideoActive = true
        state.isVideoPaused = false
        state.scanArea = getScanArea(state.video)
        state.video.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'none'

        if (lifecycle.onStart) {
            lifecycle.onStart.call(state)
        }

        handleDecode(rest.handleDecodeSuccess ?? handleDecodeSuccess, rest.handleDecodeFailure ?? handleDecodeFailure)
    }

    async function stop() {
        if (state.isVideoActive === false || state.isDestroyed) {
            return
        }

        if (lifecycle.onBeforeStop) {
            lifecycle.onBeforeStop.call(state)
        }

        if (state.video.srcObject instanceof MediaStream) {
            state.video.srcObject.getTracks().forEach((track) => track.stop())
        }

        state.isVideoActive = false
        state.isVideoPaused = false
        state.video.poster = ''
        state.video.srcObject = null

        if (lifecycle.onStop) {
            lifecycle.onStop.call(state)
        }
    }

    return {
        decode,
        destroy,
        pause,
        start,
        state,
        stop,
    }
}

export type { DecodeFailureHandler, DecodeSuccessHandler, LifecycleHook, State }
export { createBarcodeScanner }

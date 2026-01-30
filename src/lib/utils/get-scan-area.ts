type ScanArea = {
    height: number
    width: number
    x: number
    y: number
}

function getScanArea(video: HTMLVideoElement): ScanArea {
    const size = Math.round((2 / 3) * Math.min(video.videoWidth, video.videoHeight))

    return {
        height: size,
        width: size,
        x: Math.round((video.videoWidth - size) / 2),
        y: Math.round((video.videoHeight - size) / 2),
    }
}

export type { ScanArea }
export { getScanArea }

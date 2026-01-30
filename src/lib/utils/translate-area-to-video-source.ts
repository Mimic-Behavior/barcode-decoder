import type { ScanArea } from './get-scan-area'

import { getVideoRenderOffset } from './get-video-render-offset'
import { getVideoRenderSize } from './get-video-render-size'

function translateAreaToVideoSource(video: HTMLVideoElement, area: ScanArea): ScanArea {
    const isMirrored = /scaleX\(-1\)/.test(video.style.transform)
    const videoRenderSize = getVideoRenderSize(video)
    const videoRenderOffset = getVideoRenderOffset(video, videoRenderSize)
    const areaX = isMirrored
        ? videoRenderSize.width - (area.x - videoRenderOffset.x) - area.width
        : area.x - videoRenderOffset.x
    const areaY = area.y - videoRenderOffset.y
    const scaleFactorHeight = video.videoHeight / videoRenderSize.height
    const scaleFactorWidth = video.videoWidth / videoRenderSize.width

    return {
        height: area.height * scaleFactorHeight,
        width: area.width * scaleFactorWidth,
        x: areaX * scaleFactorWidth,
        y: areaY * scaleFactorHeight,
    }
}

export { translateAreaToVideoSource }

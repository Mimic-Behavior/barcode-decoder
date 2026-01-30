import type { ScanArea } from './get-scan-area'

import { getVideoRenderOffset } from './get-video-render-offset'
import { getVideoRenderSize } from './get-video-render-size'

function translateAreaToVideoRender(video: HTMLVideoElement, area: ScanArea): ScanArea {
    const isMirrored = /scaleX\(-1\)/.test(video.style.transform)
    const videoRenderSize = getVideoRenderSize(video)
    const videoRenderOffset = getVideoRenderOffset(video, videoRenderSize)
    const areaX = isMirrored ? video.videoWidth - area.x - area.width : area.x
    const areaY = area.y

    return {
        height: (area.height / video.videoHeight) * videoRenderSize.height,
        width: (area.width / video.videoWidth) * videoRenderSize.width,
        x: (areaX / video.videoWidth) * videoRenderSize.width + videoRenderOffset.x,
        y: (areaY / video.videoHeight) * videoRenderSize.height + videoRenderOffset.y,
    }
}

export { translateAreaToVideoRender }

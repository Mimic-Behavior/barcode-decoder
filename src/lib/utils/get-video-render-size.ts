type RenderSize = {
    height: number
    width: number
}

function getVideoRenderSize(video: HTMLVideoElement): RenderSize {
    const computedStyle = window.getComputedStyle(video)
    const renderSize = { height: video.offsetHeight, width: video.offsetWidth }
    const renderAspectRatio = renderSize.width / renderSize.height
    const sourceSize = { height: video.videoHeight, width: video.videoWidth }
    const sourceAspectRatio = sourceSize.width / sourceSize.height

    switch (computedStyle.objectFit) {
        case 'contain': {
            return {
                height:
                    sourceAspectRatio < renderAspectRatio ? video.offsetHeight : video.offsetWidth / sourceAspectRatio,
                width:
                    sourceAspectRatio < renderAspectRatio ? video.offsetHeight * sourceAspectRatio : video.offsetWidth,
            }
        }
        case 'cover': {
            return {
                height:
                    sourceAspectRatio > renderAspectRatio ? video.offsetHeight : video.offsetWidth / sourceAspectRatio,
                width:
                    sourceAspectRatio > renderAspectRatio ? video.offsetHeight * sourceAspectRatio : video.offsetWidth,
            }
        }
        case 'fill': {
            return renderSize
        }
        case 'none': {
            return sourceSize
        }
        case 'scale-down': {
            return {
                height: Math.min(
                    sourceAspectRatio < renderAspectRatio ? video.offsetHeight : video.offsetWidth / sourceAspectRatio,
                    video.videoHeight,
                ),
                width: Math.min(
                    sourceAspectRatio < renderAspectRatio ? video.offsetHeight * sourceAspectRatio : video.offsetWidth,
                    video.videoWidth,
                ),
            }
        }
        default: {
            return sourceSize
        }
    }
}

export type { RenderSize }
export { getVideoRenderSize }

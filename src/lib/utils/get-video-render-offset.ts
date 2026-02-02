import type { RenderSize } from './get-video-render-size'

type RenderOffset = {
    x: number
    y: number
}

function getVideoRenderOffset(video: HTMLVideoElement, renderSize: RenderSize): RenderOffset {
    const computedStyle = window.getComputedStyle(video)

    const [x, y] = computedStyle.objectPosition
        .split(' ')
        .map((part, index) =>
            part.endsWith('%')
                ? ((index === 0 ? video.offsetWidth - renderSize.width : video.offsetHeight - renderSize.height) *
                      parseFloat(part)) /
                  100
                : parseFloat(part),
        )

    return {
        x,
        y,
    }
}

export type { RenderOffset }
export { getVideoRenderOffset }

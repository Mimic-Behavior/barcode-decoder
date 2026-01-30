import { hasCameraAccess } from './has-camera-access'

async function getCameraAccess() {
    if (await hasCameraAccess()) {
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

export { getCameraAccess }

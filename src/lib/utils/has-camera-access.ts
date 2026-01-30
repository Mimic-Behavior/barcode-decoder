async function hasCameraAccess() {
    try {
        const status = await navigator.permissions.query({ name: 'camera' })

        return status.state === 'granted'
    } catch {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cameras = devices.filter((device) => device.deviceId && device.kind === 'videoinput')

        return cameras.length > 0
    }
}

export { hasCameraAccess }

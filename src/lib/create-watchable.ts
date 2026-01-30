function createWatchable<T extends object>(init: T) {
    const eventTarget = new EventTarget()
    const state = new Proxy(init, {
        get(target, p, receiver) {
            return Reflect.get(target, p, receiver)
        },
        set(target, p, newValue, receiver) {
            const result = Reflect.set(target, p, newValue, receiver)

            eventTarget.dispatchEvent(new CustomEvent('change'))

            return result
        },
    })

    function watch<T>(source: () => T, callback: (newValue: T) => void) {
        let cacheVal: T = source()

        function listener() {
            const value = source()

            if (JSON.stringify(value) === JSON.stringify(cacheVal)) {
                return
            }

            cacheVal = value
            callback(value)
        }

        eventTarget.addEventListener('change', listener)

        return () => eventTarget.removeEventListener('change', listener)
    }

    return {
        state,
        watch,
    }
}

export { createWatchable }

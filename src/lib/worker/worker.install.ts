import { instance } from './worker.instance'

function install(): Promise<Worker> {
    if (instance.value) {
        return Promise.resolve(instance.value)
    }

    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
    })

    return new Promise((res, rej) => {
        worker.addEventListener(
            'message',
            ({ data: { type } }: MessageEvent<{ type: 'init' }>) => {
                if (type === 'init') {
                    res(worker)
                } else {
                    rej(new Error('Worker load failed'))
                }
            },
            {
                once: true,
            },
        )

        instance.value = worker
    })
}

export { install }

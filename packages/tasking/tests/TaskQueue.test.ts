import { TaskQueue } from '../src/TaskQueue';

describe('TaskQueue', () => {
    it('should run tasks in parallel', async () => {
        let maxCurrentlyRunning = 0;
        let currentlyRunning = {
            value: 0,
            increment: () => {
                ++currentlyRunning.value;
                if (currentlyRunning.value > maxCurrentlyRunning) {
                    maxCurrentlyRunning = currentlyRunning.value;
                }
            },
            decrement: () => {
                --currentlyRunning.value;
            },
        };

        const fn = jest.fn(
            () =>
                new Promise((resolve) => {
                    currentlyRunning.increment();
                    setTimeout(() => {
                        currentlyRunning.decrement();
                        resolve(undefined);
                    }, 50);
                })
        );

        const queue = new TaskQueue()
            .task('first', fn)
            .task('second', fn)
            .task('third', fn);

        expect(await queue.run({ concurrency: 3 })).toStrictEqual({
            first: {
                status: 'fulfilled',
                value: undefined,
            },
            second: {
                status: 'fulfilled',
                value: undefined,
            },
            third: {
                status: 'fulfilled',
                value: undefined,
            },
        });
        expect(currentlyRunning.value).toBe(0);
        expect(maxCurrentlyRunning).toBe(3);
    });

    it('should run task in parallel, but not more that concurrency', async () => {
        let maxCurrentlyRunning = 0;
        let currentlyRunning = {
            value: 0,
            increment: () => {
                ++currentlyRunning.value;
                if (currentlyRunning.value > maxCurrentlyRunning) {
                    maxCurrentlyRunning = currentlyRunning.value;
                }
            },
            decrement: () => {
                --currentlyRunning.value;
            },
        };

        const fn = jest.fn(
            () =>
                new Promise((resolve) => {
                    currentlyRunning.increment();
                    setTimeout(() => {
                        currentlyRunning.decrement();
                        resolve(undefined);
                    }, 50);
                })
        );

        const queue = new TaskQueue()
            .task('first', fn)
            .task('second', fn)
            .task('third', fn);

        expect(await queue.run({ concurrency: 2 })).toStrictEqual({
            first: {
                status: 'fulfilled',
                value: undefined,
            },
            second: {
                status: 'fulfilled',
                value: undefined,
            },
            third: {
                status: 'fulfilled',
                value: undefined,
            },
        });
        expect(currentlyRunning.value).toBe(0);
        expect(maxCurrentlyRunning).toBe(2);
    });

    it('should work with rejecting promises', async () => {
        let maxCurrentlyRunning = 0;
        let currentlyRunning = {
            value: 0,
            increment: () => {
                ++currentlyRunning.value;
                if (currentlyRunning.value > maxCurrentlyRunning) {
                    maxCurrentlyRunning = currentlyRunning.value;
                }
            },
            decrement: () => {
                --currentlyRunning.value;
            },
        };

        const fn = jest.fn(
            () =>
                new Promise((resolve) => {
                    currentlyRunning.increment();
                    setTimeout(() => {
                        currentlyRunning.decrement();
                        resolve(undefined);
                    }, 50);
                })
        );

        const fn2 = jest.fn(
            () =>
                new Promise((_, reject) => {
                    currentlyRunning.increment();
                    setTimeout(() => {
                        currentlyRunning.decrement();
                        reject(undefined);
                    }, 50);
                })
        );

        const queue = new TaskQueue()
            .task('first', fn)
            .task('second', fn2)
            .task('third', fn2);

        expect(await queue.run({ concurrency: 3 })).toStrictEqual({
            first: {
                status: 'fulfilled',
                value: undefined,
            },
            second: {
                status: 'rejected',
                reason: undefined,
            },
            third: {
                status: 'rejected',
                reason: undefined,
            },
        });
        expect(currentlyRunning.value).toBe(0);
        expect(maxCurrentlyRunning).toBe(3);
    });

    it('should respect dependencies', async () => {
        const fn = (value) => {
            const mockFn = jest.fn(
                (args: object) =>
                    new Promise((resolve) => {
                        setTimeout(() => resolve(value), 50);
                    })
            );

            const output = function (args: object) {
                return mockFn({ ...args });
            };

            output.jestMock = mockFn;
            return output;
        };

        const firstCb = fn('hello');
        const secondCb = fn('world');
        const thirdCb = fn('!');

        const queue = new TaskQueue()
            .task('first', firstCb)
            .task('second', secondCb, {
                dependsOn: {
                    first: 'settled',
                },
            })
            .task('third', thirdCb, {
                dependsOn: {
                    second: 'settled',
                },
            });

        expect(await queue.run({ concurrency: 3 })).toStrictEqual({
            first: {
                status: 'fulfilled',
                value: 'hello',
            },
            second: {
                status: 'fulfilled',
                value: 'world',
            },
            third: {
                status: 'fulfilled',
                value: '!',
            },
        });
        expect(firstCb.jestMock).toBeCalledWith({});
        expect(secondCb.jestMock).toBeCalledWith({
            first: {
                status: 'fulfilled',
                value: 'hello',
            },
        });
        expect(thirdCb.jestMock).toBeCalledWith({
            first: {
                status: 'fulfilled',
                value: 'hello',
            },
            second: {
                status: 'fulfilled',
                value: 'world',
            },
        });
    });

    it('should skip tasks if dependency types are not valid', async () => {
        const fn = (value) =>
            jest.fn(
                () =>
                    new Promise((resolve) => {
                        setTimeout(() => resolve(value), 50);
                    })
            );

        const fn2 = (value) =>
            jest.fn(
                () =>
                    new Promise((_, reject) => {
                        setTimeout(() => reject(value), 50);
                    })
            );

        const firstCb = fn2('hello');
        const secondCb = fn('world');
        const thirdCb = fn('!');

        const queue = new TaskQueue()
            .task('first', firstCb)
            .task('second', secondCb, {
                dependsOn: {
                    first: 'fulfilled',
                },
            })
            .task('third', thirdCb, {
                dependsOn: {
                    first: 'rejected',
                },
            });

        expect(await queue.run({ concurrency: 3 })).toStrictEqual({
            first: {
                status: 'rejected',
                reason: 'hello',
            },
            third: {
                status: 'fulfilled',
                value: '!',
            },
        });
    });

    it('should throw error if dependency is invalid', () => {
        expect(() =>
            new TaskQueue().task('first', () => Promise.resolve(0), {
                dependsOn: {
                    hello: 'fulfilled',
                },
            })
        ).toThrow();
    });
});

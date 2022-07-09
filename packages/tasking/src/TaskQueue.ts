import {
    Task,
    GenericTaskDependencies,
    TaskArgsFromDependencies,
    TaskOptions,
    DependencyType,
    TaskQueueRunOptions,
} from './types';

const isNullish = (value: unknown): value is null | undefined =>
    value === null || value === undefined;

export class TaskQueue<TState = {}> {
    private taskRegistry: Record<string, Task>;

    public constructor() {
        this.taskRegistry = {};
    }

    public task = <
        TKey extends string,
        TReturnValue,
        TDependencies extends GenericTaskDependencies<TState>
    >(
        key: TKey,
        execute: (
            args: TaskArgsFromDependencies<TState, TDependencies>
        ) => Promise<TReturnValue>,
        options?: TaskOptions<TDependencies>
    ): TaskQueue<TState & Record<TKey, PromiseSettledResult<TReturnValue>>> => {
        if (!options) {
            options = { dependsOn: {} } as TaskOptions<TDependencies>;
        }

        const task: Task = {
            key,
            exec: execute as (args: unknown) => Promise<unknown>,
            children: [],
            dependencies: Object.entries(options.dependsOn)
                .filter(([_, value]) => !isNullish(value))
                .map(([key, type]) => {
                    const parentTask = this.taskRegistry[key];

                    if (!parentTask) {
                        throw new Error(
                            `Cannot depend on task "${key}", as it does not exist.`
                        );
                    }

                    return {
                        task: parentTask,
                        type: type as DependencyType,
                    };
                }),
        };

        this.taskRegistry[key] = task;

        task.dependencies.forEach(({ task: parentTask }) =>
            parentTask.children.push(task)
        );

        return this as unknown as TaskQueue<
            TState & Record<TKey, PromiseSettledResult<TReturnValue>>
        >;
    };

    public run = async (options: TaskQueueRunOptions): Promise<TState> => {
        const queue = Object.values(this.taskRegistry).filter(
            ({ dependencies }) => dependencies.length === 0
        );
        const state: Record<string, PromiseSettledResult<unknown>> = {};
        const taskRunStatus: Record<string, 'queued' | 'finished'> =
            Object.fromEntries(
                Object.keys(this.taskRegistry).map((key) => [key, 'queued'])
            );

        type RunningTask = [task: Task, value: PromiseSettledResult<unknown>];
        const running: Array<[key: string, value: Promise<RunningTask>]> = [];

        while (queue.length > 0 || running.length > 0) {
            if (running.length < options.concurrency && queue.length > 0) {
                const task = queue.shift()!;

                running.push([
                    task.key,
                    task
                        .exec(state)
                        .then((value) => [
                            task,
                            {
                                status: 'fulfilled',
                                value,
                            },
                        ])
                        .catch((reason) => [
                            task,
                            {
                                status: 'rejected',
                                reason,
                            },
                        ]) as Promise<RunningTask>,
                ]);
            } else {
                const [task, result] = await Promise.race(
                    running.map(([_, value]) => value)
                );
                running.splice(
                    running.findIndex(([key]) => key === task.key),
                    1
                );
                state[task.key] = result;
                taskRunStatus[task.key] = 'finished';

                const newCandidates = task.children.filter((task) => {
                    return task.dependencies.every(
                        ({ task, type }) =>
                            taskRunStatus[task.key] === 'finished' &&
                            (type === 'settled' ||
                                type === state[task.key].status)
                    );
                });

                queue.push(...newCandidates);
            }
        }

        return state as unknown as TState;
    };
}

export type TaskDependency = {
    task: Task;
    type: DependencyType;
};
export type TaskQueueRunOptions = {
    concurrency: number;
};

export type Task = {
    key: string;
    exec: (args: unknown) => Promise<unknown>;
    children: Task[];
    dependencies: TaskDependency[];
};

export type DependencyType = 'fulfilled' | 'rejected' | 'settled';

export type GenericTaskDependencies<TCurrentState> = Partial<
    Record<keyof TCurrentState, DependencyType>
>;

export type TaskOptions<TDependencies> = {
    dependsOn: TDependencies;
};

export type TaskArgsFromDependencies<
    TState,
    TDependencies extends GenericTaskDependencies<TState>
> = {
    [TKey in keyof TState]: TDependencies[TKey] extends 'fulfilled'
        ? PromiseFulfilledResult<TState[TKey]>
        : TDependencies[TKey] extends 'rejected'
        ? PromiseRejectedResult
        : TDependencies[TKey] extends 'settled'
        ? PromiseSettledResult<TState[TKey]>
        : never;
};

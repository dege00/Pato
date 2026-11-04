export type StateTree = Record<string, any>;
export interface ActionContext {
    name: string;
    args: any[];
    after(callback: (result: any) => void): void;
    onError(callback: (error: unknown) => void): void;
}
export interface Store {
    $id: string;
    $state: StateTree;
    $patch(partial: Partial<StateTree> | ((state: StateTree) => void)): void;
    $reset(): void;
    $subscribe(callback: (state: StateTree, prevState: StateTree) => void): () => void;
    $onAction(callback: (context: ActionContext) => void): () => void;
    $dispose(): void;
    [key: string]: any;
}
export interface StoreOptions<S extends StateTree = StateTree> {
    state?: () => S;
    getters?: Record<string, (this: Store, state: S) => any>;
    actions?: Record<string, (this: Store, ...args: any[]) => any>;
}
export type SetupStore = () => Record<string, any>;
export type StoreDefinition<S extends StateTree = StateTree> = (pato?: Pato) => Store & S;
export interface PatoPluginContext {
    pato: Pato;
    store: Store;
}
export type PatoPlugin = (context: PatoPluginContext) => void;
export interface Pato {
    _s: Map<string, Store>;
    _p: PatoPlugin[];
    use(plugin: PatoPlugin): this;
    install(app?: unknown): void;
}
//# sourceMappingURL=types.d.ts.map
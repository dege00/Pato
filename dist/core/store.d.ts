import type { Pato, SetupStore, StateTree, Store, StoreDefinition, StoreOptions } from './types';
export declare function defineStore<S extends StateTree>(id: string, opcoes: StoreOptions<S> & {
    state: () => S;
}): StoreDefinition<S>;
export declare function defineStore(id: string, inicializador: SetupStore): StoreDefinition;
export declare function defineStore(id: string, origem: SetupStore | StoreOptions): StoreDefinition;
export declare function createStore(id: string, origem: SetupStore | StoreOptions, pato: Pato): Store;
//# sourceMappingURL=store.d.ts.map
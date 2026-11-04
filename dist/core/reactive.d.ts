export type Efeito = {
    (): void;
    ativo: boolean;
    dependencias: Set<Efeito>[];
};
export declare function effect(executar: () => void): () => void;
export declare function untrack<T>(executar: () => T): T;
export declare function ehObjeto(valor: unknown): valor is object;
export declare function isReactive(valor: unknown): boolean;
export declare function reactive<T extends object>(alvo: T): T;
export interface Ref<T = unknown> {
    value: T;
}
export type ComputedRef<T = unknown> = {
    readonly value: T;
    readonly stop: () => void;
};
export declare function ref<T>(valor: T): Ref<T>;
export declare function isRef(valor: unknown): valor is Ref;
export declare function isComputed(valor: unknown): valor is ComputedRef;
export declare function computed<T>(calcular: () => T): ComputedRef<T>;
//# sourceMappingURL=reactive.d.ts.map
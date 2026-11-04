import type { PatoPlugin } from '../core/types';
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}
export interface PersistOptions {
    key?: string;
    storage?: StorageLike;
}
export declare function persist(opcoes?: PersistOptions): PatoPlugin;
//# sourceMappingURL=index.d.ts.map
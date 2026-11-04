import type { PatoPlugin } from '../core/types'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface PersistOptions {
  key?: string
  storage?: StorageLike
}

export function persist(opcoes: PersistOptions = {}): PatoPlugin {
  return ({ store: loja }) => {
    const armazenamento = opcoes.storage ?? (globalThis as any).localStorage
    if (!armazenamento) return

    const chave = opcoes.key ?? `pato:${loja.$id}`

    try {
      const salvo = armazenamento.getItem(chave)
      if (salvo) loja.$patch(JSON.parse(salvo))
    } catch {}

    loja.$subscribe((estado) => {
      try {
        armazenamento.setItem(chave, JSON.stringify(estado))
      } catch {}
    })
  }
}

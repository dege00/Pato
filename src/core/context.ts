import type { Pato } from './types'

let patoAtivo: Pato | undefined

export function setActivePato(pato: Pato | undefined): void {
  patoAtivo = pato
}

export function getActivePato(): Pato | undefined {
  return patoAtivo
}

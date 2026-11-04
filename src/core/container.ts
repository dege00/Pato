import type { Pato, Store } from './types'
import { setActivePato } from './context'

export function createPato(): Pato {
  const pato: Pato = {
    _s: new Map<string, Store>(),
    _p: [],
    use(plugin) {
      this._p.push(plugin)
      return this
    },
    install(app) {
      const propriedadesGlobais = (app as any)?.config?.globalProperties
      if (propriedadesGlobais) propriedadesGlobais.$pato = pato
    }
  }

  setActivePato(pato)
  return pato
}

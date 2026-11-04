import {
  computed,
  effect,
  isComputed,
  isRef,
  reactive,
  ref,
  untrack,
  type ComputedRef,
  type Ref
} from './reactive'
import { getActivePato } from './context'
import type {
  ActionContext,
  Pato,
  SetupStore,
  StateTree,
  Store,
  StoreDefinition,
  StoreOptions
} from './types'

export function defineStore<S extends StateTree>(
  id: string,
  opcoes: StoreOptions<S> & { state: () => S }
): StoreDefinition<S>
export function defineStore(id: string, inicializador: SetupStore): StoreDefinition
export function defineStore(id: string, origem: SetupStore | StoreOptions): StoreDefinition
export function defineStore(
  id: string,
  origem: SetupStore | StoreOptions
): StoreDefinition {
  return function usarLoja(pato?: Pato): Store {
    const container = pato ?? getActivePato()
    if (!container) {
      throw new Error(
        '[pato] Nenhum Pato ativo. Chame createPato() ou passe o container para useStore().'
      )
    }

    const existente = container._s.get(id)
    if (existente) return existente

    const loja = createStore(id, origem, container)

    container._s.set(id, loja)
    for (const plugin of container._p) plugin({ pato: container, store: loja })

    return loja
  }
}

function ehObjetoSimples(valor: unknown): valor is StateTree {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function clonar<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map((item) => clonar(item)) as unknown as T

  if (ehObjetoSimples(valor)) {
    const resultado: StateTree = {}
    for (const chave of Object.keys(valor)) resultado[chave] = clonar(valor[chave])
    return resultado as T
  }

  return valor
}

function mesclarObjeto(alvo: StateTree, parcial: StateTree): void {
  for (const chave of Object.keys(parcial)) {
    const valor = parcial[chave]
    const atual = alvo[chave]

    if (ehObjetoSimples(valor) && ehObjetoSimples(atual)) {
      mesclarObjeto(atual, valor)
    } else {
      alvo[chave] = valor
    }
  }
}

function manipuladoresDaLoja(estado: StateTree): ProxyHandler<Record<PropertyKey, any>> {
  return {
    get(alvo, chave, receptor) {
      if (Reflect.has(alvo, chave)) return Reflect.get(alvo, chave, receptor)
      if (typeof chave === 'string' && chave in estado) return estado[chave]
      return undefined
    },

    set(alvo, chave, valor, receptor) {
      if (Reflect.has(alvo, chave)) return Reflect.set(alvo, chave, valor, receptor)

      if (typeof chave === 'string' && chave in estado) {
        estado[chave] = valor
        return true
      }

      return Reflect.set(alvo, chave, valor, receptor)
    },

    has(alvo, chave) {
      return Reflect.has(alvo, chave) || (typeof chave === 'string' && chave in estado)
    },

    ownKeys(alvo) {
      return [...new Set([...Reflect.ownKeys(alvo), ...Object.keys(estado)])]
    },

    getOwnPropertyDescriptor(alvo, chave) {
      const descritor = Reflect.getOwnPropertyDescriptor(alvo, chave)
      if (descritor) return descritor

      if (typeof chave === 'string' && chave in estado) {
        return { enumerable: true, configurable: true, get: () => estado[chave] }
      }

      return undefined
    }
  }
}

export function createStore(
  id: string,
  origem: SetupStore | StoreOptions,
  pato: Pato
): Store {
  const inicializador = typeof origem === 'function' ? (origem as SetupStore) : undefined
  const opcoes = (inicializador ? {} : origem) as StoreOptions

  const alvo: Record<PropertyKey, any> = {}
  const paradasDeCalculados: Array<() => void> = []
  const assinantesDeAcoes = new Set<(contexto: ActionContext) => void>()
  const paradasDeInscricoes = new Set<() => void>()

  let estado: StateTree
  let estadoInicial: StateTree | undefined
  const acoesDoSetup: Array<[string, (...args: any[]) => any]> = []
  let loja: Store

  if (inicializador) {
    const resultadoDoSetup = inicializador()
    const referencias = new Map<string, Ref>()
    const calculados: Array<[string, ComputedRef]> = []

    for (const [chave, valor] of Object.entries(resultadoDoSetup)) {
      if (isComputed(valor)) {
        calculados.push([chave, valor])
        paradasDeCalculados.push(valor.stop)
      } else if (isRef(valor)) {
        referencias.set(chave, valor)
      } else if (typeof valor === 'function') {
        acoesDoSetup.push([chave, valor as (...args: any[]) => any])
      } else {
        referencias.set(chave, ref(valor))
      }
    }

    estado = {}

    for (const [chave, referencia] of referencias) {
      Object.defineProperty(estado, chave, {
        enumerable: true,
        configurable: true,
        get: () => referencia.value,
        set: (proximo) => {
          referencia.value = proximo
        }
      })
    }

    for (const [chave, calculado] of calculados) {
      Object.defineProperty(alvo, chave, {
        enumerable: true,
        configurable: true,
        get: () => calculado.value
      })
    }
  } else {
    const bruto = opcoes.state ? opcoes.state() : {}
    estadoInicial = clonar(bruto)
    estado = reactive(bruto) as StateTree
  }

  alvo.$id = id
  alvo.$state = estado

  loja = new Proxy(alvo, manipuladoresDaLoja(estado)) as Store

  const executarAcao = (
    nome: string,
    acao: (...args: any[]) => any,
    argumentos: any[]
  ): any => {
    const callbacksDepois: Array<(resultado: any) => void> = []
    const callbacksDeErro: Array<(erro: unknown) => void> = []

    const contexto: ActionContext = {
      name: nome,
      args: argumentos,
      after: (callback) => callbacksDepois.push(callback),
      onError: (callback) => callbacksDeErro.push(callback)
    }

    for (const assinante of assinantesDeAcoes) assinante(contexto)

    try {
      const resultado = acao.apply(loja, argumentos)

      if (resultado instanceof Promise) {
        return resultado.then(
          (valor) => {
            for (const callback of callbacksDepois) callback(valor)
            return valor
          },
          (erro) => {
            for (const callback of callbacksDeErro) callback(erro)
            throw erro
          }
        )
      }

      for (const callback of callbacksDepois) callback(resultado)
      return resultado
    } catch (erro) {
      for (const callback of callbacksDeErro) callback(erro)
      throw erro
    }
  }

  const definirAcao = (nome: string, acao: (...args: any[]) => any) => {
    Object.defineProperty(alvo, nome, {
      enumerable: true,
      configurable: true,
      value: (...argumentos: any[]) => executarAcao(nome, acao, argumentos)
    })
  }

  alvo.$patch = (parcial: Partial<StateTree> | ((estado: StateTree) => void)) => {
    if (typeof parcial === 'function') parcial(estado)
    else mesclarObjeto(estado, parcial as StateTree)
  }

  alvo.$reset = () => {
    if (!estadoInicial) {
      throw new Error(`[pato] $reset nao e suportado em setup stores ("${id}").`)
    }

    mesclarObjeto(estado, clonar(estadoInicial))

    for (const chave of Object.keys(estado)) {
      if (!(chave in estadoInicial)) delete estado[chave]
    }
  }

  alvo.$subscribe = (
    callback: (estado: StateTree, estadoAnterior: StateTree) => void
  ) => {
    let anterior = clonar(estado)
    let primeiro = true

    const parar = effect(() => {
      const proximo = clonar(estado)

      if (primeiro) {
        primeiro = false
        anterior = proximo
        return
      }

      untrack(() => callback(proximo, anterior))
      anterior = proximo
    })

    const descartar = () => {
      parar()
      paradasDeInscricoes.delete(descartar)
    }

    paradasDeInscricoes.add(descartar)
    return descartar
  }

  alvo.$onAction = (callback: (contexto: ActionContext) => void) => {
    assinantesDeAcoes.add(callback)
    return () => {
      assinantesDeAcoes.delete(callback)
    }
  }

  alvo.$dispose = () => {
    pato._s.delete(id)

    for (const parar of paradasDeCalculados) parar()
    for (const parar of paradasDeInscricoes) parar()

    paradasDeInscricoes.clear()
    assinantesDeAcoes.clear()
  }

  if (inicializador) {
    for (const [chave, acao] of acoesDoSetup) definirAcao(chave, acao)
  } else {
    for (const [chave, obterGetter] of Object.entries(opcoes.getters ?? {})) {
      const calculado = computed(() => obterGetter.call(loja, loja.$state))
      paradasDeCalculados.push(calculado.stop)

      Object.defineProperty(alvo, chave, {
        enumerable: true,
        configurable: true,
        get: () => calculado.value
      })
    }

    for (const [chave, acao] of Object.entries(opcoes.actions ?? {})) {
      definirAcao(chave, acao as (...args: any[]) => any)
    }
  }

  return loja
}

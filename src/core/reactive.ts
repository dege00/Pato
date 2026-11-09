export type Efeito = {
  (): void
  ativo: boolean
  dependencias: Set<Efeito>[]
}

const CHAVE_ITERACAO = Symbol('pato.iterate')
const MARCA_REF = Symbol('pato.ref')
const MARCA_CALCULADO = Symbol('pato.computed')
const MARCA_BRUTO = Symbol('pato.raw')

const mapaDeAlvos = new WeakMap<object, Map<PropertyKey, Set<Efeito>>>()
const mapaDeReativos = new WeakMap<object, object>()

let efeitoAtivo: Efeito | undefined

function limparDependencias(efeito: Efeito) {
  for (const dependencia of efeito.dependencias) dependencia.delete(efeito)
  efeito.dependencias = []
}

function rastrear(alvo: object, chave: PropertyKey) {
  if (!efeitoAtivo) return

  let mapaDeChaves = mapaDeAlvos.get(alvo)
  if (!mapaDeChaves) {
    mapaDeChaves = new Map()
    mapaDeAlvos.set(alvo, mapaDeChaves)
  }

  let dependencia = mapaDeChaves.get(chave)
  if (!dependencia) {
    dependencia = new Set()
    mapaDeChaves.set(chave, dependencia)
  }

  if (!dependencia.has(efeitoAtivo)) {
    dependencia.add(efeitoAtivo)
    efeitoAtivo.dependencias.push(dependencia)
  }
}

function disparar(alvo: object, chave: PropertyKey) {
  const mapaDeChaves = mapaDeAlvos.get(alvo)
  if (!mapaDeChaves) return

  const efeitos = new Set<Efeito>()

  const dependenciaDaChave = mapaDeChaves.get(chave)
  if (dependenciaDaChave) {
    for (const efeito of dependenciaDaChave) efeitos.add(efeito)
  }

  const dependenciaDaIteracao = mapaDeChaves.get(CHAVE_ITERACAO)
  if (dependenciaDaIteracao) {
    for (const efeito of dependenciaDaIteracao) efeitos.add(efeito)
  }

  for (const efeito of efeitos) {
    if (efeito.ativo) efeito()
  }
}

export function effect(executar: () => void): () => void {
  const executor = (() => {
    if (!executor.ativo) return
    limparDependencias(executor)
    const anterior = efeitoAtivo
    efeitoAtivo = executor
    try {
      executar()
    } finally {
      efeitoAtivo = anterior
    }
  }) as Efeito

  executor.ativo = true
  executor.dependencias = []
  executor()

  return () => {
    executor.ativo = false
    limparDependencias(executor)
  }
}

export function untrack<T>(executar: () => T): T {
  const anterior = efeitoAtivo
  efeitoAtivo = undefined
  try {
    return executar()
  } finally {
    efeitoAtivo = anterior
  }
}

export function ehObjeto(valor: unknown): valor is object {
  return typeof valor === 'object' && valor !== null
}

export function isReactive(valor: unknown): boolean {
  return ehObjeto(valor) && (valor as Record<PropertyKey, unknown>)[MARCA_BRUTO] === true
}

function criarManipuladoresReativos(): ProxyHandler<object> {
  return {
    get(alvo, chave, receptor) {
      if (chave === MARCA_BRUTO) return true

      const resultado = Reflect.get(alvo, chave, receptor)
      if (typeof chave === 'symbol') return resultado

      rastrear(alvo, chave)

      if (ehObjeto(resultado) && !isReactive(resultado)) {
        return reactive(resultado)
      }
      return resultado
    },

    set(alvo, chave, valor, receptor) {
      const tinhaChave = Object.prototype.hasOwnProperty.call(alvo, chave)
      const valorAnterior = Reflect.get(alvo, chave, receptor)
      const resultado = Reflect.set(alvo, chave, valor, receptor)

      if (!Object.is(valorAnterior, valor)) {
        disparar(alvo, chave)
        if (!tinhaChave) disparar(alvo, CHAVE_ITERACAO)
      }
      return resultado
    },

    deleteProperty(alvo, chave) {
      const tinhaChave = Object.prototype.hasOwnProperty.call(alvo, chave)
      const resultado = Reflect.deleteProperty(alvo, chave)

      if (tinhaChave) {
        disparar(alvo, chave)
        disparar(alvo, CHAVE_ITERACAO)
      }
      return resultado
    },

    has(alvo, chave) {
      const resultado = Reflect.has(alvo, chave)
      if (typeof chave !== 'symbol') rastrear(alvo, chave)
      return resultado
    },

    ownKeys(alvo) {
      rastrear(alvo, CHAVE_ITERACAO)
      return Reflect.ownKeys(alvo)
    }
  }
}

const manipuladores = criarManipuladoresReativos()

export function reactive<T extends object>(alvo: T): T {
  if (!ehObjeto(alvo)) return alvo
  if (isReactive(alvo)) return alvo

  const emCache = mapaDeReativos.get(alvo)
  if (emCache) return emCache as T

  const proxy = new Proxy(alvo, manipuladores)
  mapaDeReativos.set(alvo, proxy)
  return proxy as T
}

export interface Ref<T = unknown> {
  value: T
}

export type ComputedRef<T = unknown> = {
  readonly value: T
  readonly stop: () => void
}

export function ref<T>(valor: T): Ref<T> {
  const alvo = { value: valor }
  Object.defineProperty(alvo, MARCA_REF, { value: true })
  return reactive(alvo) as Ref<T>
}

export function isRef(valor: unknown): valor is Ref {
  return ehObjeto(valor) && (valor as Record<PropertyKey, unknown>)[MARCA_REF] === true
}

export function isComputed(valor: unknown): valor is ComputedRef {
  return ehObjeto(valor) && (valor as Record<PropertyKey, unknown>)[MARCA_CALCULADO] === true
}

export function computed<T>(calcular: () => T): ComputedRef<T> {
  let valor!: T
  let desatualizado = true
  let temValor = false
  let ativo = true

  const assinantes = new Set<Efeito>()

  const executor = (() => {
    if (!ativo) return

    desatualizado = true
    if (temValor) recalcular()

    for (const assinante of [...assinantes]) {
      if (assinante.ativo) assinante()
    }
  }) as Efeito

  executor.ativo = true
  executor.dependencias = []

  function recalcular() {
    limparDependencias(executor)

    const anterior = efeitoAtivo
    efeitoAtivo = executor

    try {
      valor = calcular()
      desatualizado = false
      temValor = true
    } finally {
      efeitoAtivo = anterior
    }
  }

  const resultado = {
    get value() {
      if (!ativo) return valor

      if (efeitoAtivo && !assinantes.has(efeitoAtivo)) {
        assinantes.add(efeitoAtivo)
        efeitoAtivo.dependencias.push(assinantes)
      }

      if (desatualizado) recalcular()
      return valor
    },

    stop() {
      ativo = false
      limparDependencias(executor)
      assinantes.clear()
    }
  }

  Object.defineProperty(resultado, MARCA_REF, { value: true })
  Object.defineProperty(resultado, MARCA_CALCULADO, { value: true })

  return resultado as ComputedRef<T>
}

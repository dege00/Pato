import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createPato, defineStore, effect, ref } from '../src'

describe('pato', () => {
  beforeEach(() => {
    createPato()
  })

  it('cria loja com estado, getters e acoes', () => {
    const usarContador = defineStore('contador', {
      state: () => ({ quantidade: 0 }),
      getters: {
        dobro: (estado) => estado.quantidade * 2
      },
      actions: {
        incrementar() {
          this.quantidade++
        }
      }
    })

    const loja = usarContador()

    expect(loja.quantidade).toBe(0)
    expect(loja.dobro).toBe(0)

    loja.incrementar()

    expect(loja.quantidade).toBe(1)
    expect(loja.dobro).toBe(2)
  })

  it('reutiliza a mesma loja por id', () => {
    const usarLoja = defineStore('mesma', { state: () => ({ numero: 1 }) })

    expect(usarLoja()).toBe(usarLoja())
  })

  it('funciona com setup store', () => {
    const usarLoja = defineStore('setup', () => {
      const quantidade = ref(0)
      const dobro = computed(() => quantidade.value * 2)

      function incrementar() {
        quantidade.value++
      }

      return { quantidade, dobro, incrementar }
    })

    const loja = usarLoja()
    loja.incrementar()

    expect(loja.quantidade).toBe(1)
    expect(loja.dobro).toBe(2)
  })

  it('reage a mudancas de estado em getters', () => {
    const usarLoja = defineStore('getter-reativo', {
      state: () => ({ valor: 1 }),
      getters: { dobro: (estado) => estado.valor * 2 }
    })

    const loja = usarLoja()
    const espiar = vi.fn()

    effect(() => espiar(loja.dobro))

    expect(espiar).toHaveBeenLastCalledWith(2)

    loja.valor = 5

    expect(espiar).toHaveBeenLastCalledWith(10)
  })

  it('aplica $patch e $reset', () => {
    const usarLoja = defineStore('patch', {
      state: () => ({ numero: 1, aninhado: { valor: 2 } })
    })

    const loja = usarLoja()
    loja.$patch({ numero: 5, aninhado: { valor: 9 } })

    expect(loja.numero).toBe(5)
    expect(loja.aninhado.valor).toBe(9)

    loja.$reset()

    expect(loja.numero).toBe(1)
    expect(loja.aninhado.valor).toBe(2)
  })

  it('notifica $subscribe nas mudancas', () => {
    const usarLoja = defineStore('inscricao', { state: () => ({ quantidade: 0 }) })
    const loja = usarLoja()
    const espiar = vi.fn()

    loja.$subscribe(espiar)
    loja.quantidade = 2

    expect(espiar).toHaveBeenCalledTimes(1)
    expect(espiar.mock.calls[0][0]).toEqual({ quantidade: 2 })
    expect(espiar.mock.calls[0][1]).toEqual({ quantidade: 0 })
  })

  it('avisa $onAction antes e depois da acao', () => {
    const usarLoja = defineStore('acao', {
      state: () => ({ quantidade: 0 }),
      actions: {
        somar(valor: number) {
          this.quantidade += valor
          return this.quantidade
        }
      }
    })

    const loja = usarLoja()
    const antes = vi.fn()
    const depois = vi.fn()

    loja.$onAction((contexto) => {
      antes(contexto.name, contexto.args)
      contexto.after(depois)
    })

    expect(loja.somar(3)).toBe(3)
    expect(antes).toHaveBeenCalledWith('somar', [3])
    expect(depois).toHaveBeenCalledWith(3)
  })
})

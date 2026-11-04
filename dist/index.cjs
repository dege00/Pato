"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  computed: () => computed,
  createPato: () => createPato,
  createStore: () => createStore,
  defineStore: () => defineStore,
  effect: () => effect,
  getActivePato: () => getActivePato,
  isComputed: () => isComputed,
  isReactive: () => isReactive,
  isRef: () => isRef,
  persist: () => persist,
  reactive: () => reactive,
  ref: () => ref,
  setActivePato: () => setActivePato,
  untrack: () => untrack
});
module.exports = __toCommonJS(index_exports);

// src/core/context.ts
var patoAtivo;
function setActivePato(pato) {
  patoAtivo = pato;
}
function getActivePato() {
  return patoAtivo;
}

// src/core/container.ts
function createPato() {
  const pato = {
    _s: /* @__PURE__ */ new Map(),
    _p: [],
    use(plugin) {
      this._p.push(plugin);
      return this;
    },
    install(app) {
      const propriedadesGlobais = app?.config?.globalProperties;
      if (propriedadesGlobais) propriedadesGlobais.$pato = pato;
    }
  };
  setActivePato(pato);
  return pato;
}

// src/core/reactive.ts
var CHAVE_ITERACAO = /* @__PURE__ */ Symbol("pato.iterate");
var MARCA_REF = /* @__PURE__ */ Symbol("pato.ref");
var MARCA_CALCULADO = /* @__PURE__ */ Symbol("pato.computed");
var MARCA_BRUTO = /* @__PURE__ */ Symbol("pato.raw");
var mapaDeAlvos = /* @__PURE__ */ new WeakMap();
var mapaDeReativos = /* @__PURE__ */ new WeakMap();
var efeitoAtivo;
function limparDependencias(efeito) {
  for (const dependencia of efeito.dependencias) dependencia.delete(efeito);
  efeito.dependencias = [];
}
function rastrear(alvo, chave) {
  if (!efeitoAtivo) return;
  let mapaDeChaves = mapaDeAlvos.get(alvo);
  if (!mapaDeChaves) {
    mapaDeChaves = /* @__PURE__ */ new Map();
    mapaDeAlvos.set(alvo, mapaDeChaves);
  }
  let dependencia = mapaDeChaves.get(chave);
  if (!dependencia) {
    dependencia = /* @__PURE__ */ new Set();
    mapaDeChaves.set(chave, dependencia);
  }
  if (!dependencia.has(efeitoAtivo)) {
    dependencia.add(efeitoAtivo);
    efeitoAtivo.dependencias.push(dependencia);
  }
}
function disparar(alvo, chave) {
  const mapaDeChaves = mapaDeAlvos.get(alvo);
  if (!mapaDeChaves) return;
  const efeitos = /* @__PURE__ */ new Set();
  const dependenciaDaChave = mapaDeChaves.get(chave);
  if (dependenciaDaChave) {
    for (const efeito of dependenciaDaChave) efeitos.add(efeito);
  }
  const dependenciaDaIteracao = mapaDeChaves.get(CHAVE_ITERACAO);
  if (dependenciaDaIteracao) {
    for (const efeito of dependenciaDaIteracao) efeitos.add(efeito);
  }
  for (const efeito of efeitos) {
    if (efeito.ativo) efeito();
  }
}
function effect(executar) {
  const executor = (() => {
    if (!executor.ativo) return;
    limparDependencias(executor);
    const anterior = efeitoAtivo;
    efeitoAtivo = executor;
    try {
      executar();
    } finally {
      efeitoAtivo = anterior;
    }
  });
  executor.ativo = true;
  executor.dependencias = [];
  executor();
  return () => {
    executor.ativo = false;
    limparDependencias(executor);
  };
}
function untrack(executar) {
  const anterior = efeitoAtivo;
  efeitoAtivo = void 0;
  try {
    return executar();
  } finally {
    efeitoAtivo = anterior;
  }
}
function ehObjeto(valor) {
  return typeof valor === "object" && valor !== null;
}
function isReactive(valor) {
  return ehObjeto(valor) && valor[MARCA_BRUTO] === true;
}
function criarManipuladoresReativos() {
  return {
    get(alvo, chave, receptor) {
      if (chave === MARCA_BRUTO) return true;
      const resultado = Reflect.get(alvo, chave, receptor);
      if (typeof chave === "symbol") return resultado;
      rastrear(alvo, chave);
      if (ehObjeto(resultado) && !isReactive(resultado)) {
        return reactive(resultado);
      }
      return resultado;
    },
    set(alvo, chave, valor, receptor) {
      const valorAnterior = Reflect.get(alvo, chave, receptor);
      const resultado = Reflect.set(alvo, chave, valor, receptor);
      if (!Object.is(valorAnterior, valor)) disparar(alvo, chave);
      return resultado;
    },
    deleteProperty(alvo, chave) {
      const tinhaChave = Object.prototype.hasOwnProperty.call(alvo, chave);
      const resultado = Reflect.deleteProperty(alvo, chave);
      if (tinhaChave) disparar(alvo, chave);
      return resultado;
    },
    has(alvo, chave) {
      const resultado = Reflect.has(alvo, chave);
      if (typeof chave !== "symbol") rastrear(alvo, chave);
      return resultado;
    },
    ownKeys(alvo) {
      rastrear(alvo, CHAVE_ITERACAO);
      return Reflect.ownKeys(alvo);
    }
  };
}
var manipuladores = criarManipuladoresReativos();
function reactive(alvo) {
  if (!ehObjeto(alvo)) return alvo;
  if (isReactive(alvo)) return alvo;
  const emCache = mapaDeReativos.get(alvo);
  if (emCache) return emCache;
  const proxy = new Proxy(alvo, manipuladores);
  mapaDeReativos.set(alvo, proxy);
  return proxy;
}
function ref(valor) {
  const alvo = { value: valor };
  Object.defineProperty(alvo, MARCA_REF, { value: true });
  return reactive(alvo);
}
function isRef(valor) {
  return ehObjeto(valor) && valor[MARCA_REF] === true;
}
function isComputed(valor) {
  return ehObjeto(valor) && valor[MARCA_CALCULADO] === true;
}
function computed(calcular) {
  let valor;
  let desatualizado = true;
  let temValor = false;
  let ativo = true;
  const assinantes = /* @__PURE__ */ new Set();
  const executor = (() => {
    if (!ativo) return;
    desatualizado = true;
    if (temValor) recalcular();
    for (const assinante of [...assinantes]) {
      if (assinante.ativo) assinante();
    }
  });
  executor.ativo = true;
  executor.dependencias = [];
  function recalcular() {
    limparDependencias(executor);
    const anterior = efeitoAtivo;
    efeitoAtivo = executor;
    try {
      valor = calcular();
      desatualizado = false;
      temValor = true;
    } finally {
      efeitoAtivo = anterior;
    }
  }
  const resultado = {
    get value() {
      if (!ativo) return valor;
      if (efeitoAtivo && !assinantes.has(efeitoAtivo)) {
        assinantes.add(efeitoAtivo);
        efeitoAtivo.dependencias.push(assinantes);
      }
      if (desatualizado) recalcular();
      return valor;
    },
    stop() {
      ativo = false;
      limparDependencias(executor);
      assinantes.clear();
    }
  };
  Object.defineProperty(resultado, MARCA_REF, { value: true });
  Object.defineProperty(resultado, MARCA_CALCULADO, { value: true });
  return resultado;
}

// src/core/store.ts
function defineStore(id, origem) {
  return function usarLoja(pato) {
    const container = pato ?? getActivePato();
    if (!container) {
      throw new Error(
        "[pato] Nenhum Pato ativo. Chame createPato() ou passe o container para useStore()."
      );
    }
    const existente = container._s.get(id);
    if (existente) return existente;
    const loja = createStore(id, origem, container);
    container._s.set(id, loja);
    for (const plugin of container._p) plugin({ pato: container, store: loja });
    return loja;
  };
}
function ehObjetoSimples(valor) {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}
function clonar(valor) {
  if (Array.isArray(valor)) return valor.map((item) => clonar(item));
  if (ehObjetoSimples(valor)) {
    const resultado = {};
    for (const chave of Object.keys(valor)) resultado[chave] = clonar(valor[chave]);
    return resultado;
  }
  return valor;
}
function mesclarObjeto(alvo, parcial) {
  for (const chave of Object.keys(parcial)) {
    const valor = parcial[chave];
    const atual = alvo[chave];
    if (ehObjetoSimples(valor) && ehObjetoSimples(atual)) {
      mesclarObjeto(atual, valor);
    } else {
      alvo[chave] = valor;
    }
  }
}
function manipuladoresDaLoja(estado) {
  return {
    get(alvo, chave, receptor) {
      if (Reflect.has(alvo, chave)) return Reflect.get(alvo, chave, receptor);
      if (typeof chave === "string" && chave in estado) return estado[chave];
      return void 0;
    },
    set(alvo, chave, valor, receptor) {
      if (Reflect.has(alvo, chave)) return Reflect.set(alvo, chave, valor, receptor);
      if (typeof chave === "string" && chave in estado) {
        estado[chave] = valor;
        return true;
      }
      return Reflect.set(alvo, chave, valor, receptor);
    },
    has(alvo, chave) {
      return Reflect.has(alvo, chave) || typeof chave === "string" && chave in estado;
    },
    ownKeys(alvo) {
      return [.../* @__PURE__ */ new Set([...Reflect.ownKeys(alvo), ...Object.keys(estado)])];
    },
    getOwnPropertyDescriptor(alvo, chave) {
      const descritor = Reflect.getOwnPropertyDescriptor(alvo, chave);
      if (descritor) return descritor;
      if (typeof chave === "string" && chave in estado) {
        return { enumerable: true, configurable: true, get: () => estado[chave] };
      }
      return void 0;
    }
  };
}
function createStore(id, origem, pato) {
  const inicializador = typeof origem === "function" ? origem : void 0;
  const opcoes = inicializador ? {} : origem;
  const alvo = {};
  const paradasDeCalculados = [];
  const assinantesDeAcoes = /* @__PURE__ */ new Set();
  const paradasDeInscricoes = /* @__PURE__ */ new Set();
  let estado;
  let estadoInicial;
  const acoesDoSetup = [];
  let loja;
  if (inicializador) {
    const resultadoDoSetup = inicializador();
    const referencias = /* @__PURE__ */ new Map();
    const calculados = [];
    for (const [chave, valor] of Object.entries(resultadoDoSetup)) {
      if (isComputed(valor)) {
        calculados.push([chave, valor]);
        paradasDeCalculados.push(valor.stop);
      } else if (isRef(valor)) {
        referencias.set(chave, valor);
      } else if (typeof valor === "function") {
        acoesDoSetup.push([chave, valor]);
      } else {
        referencias.set(chave, ref(valor));
      }
    }
    estado = {};
    for (const [chave, referencia] of referencias) {
      Object.defineProperty(estado, chave, {
        enumerable: true,
        configurable: true,
        get: () => referencia.value,
        set: (proximo) => {
          referencia.value = proximo;
        }
      });
    }
    for (const [chave, calculado] of calculados) {
      Object.defineProperty(alvo, chave, {
        enumerable: true,
        configurable: true,
        get: () => calculado.value
      });
    }
  } else {
    const bruto = opcoes.state ? opcoes.state() : {};
    estadoInicial = clonar(bruto);
    estado = reactive(bruto);
  }
  alvo.$id = id;
  alvo.$state = estado;
  loja = new Proxy(alvo, manipuladoresDaLoja(estado));
  const executarAcao = (nome, acao, argumentos) => {
    const callbacksDepois = [];
    const callbacksDeErro = [];
    const contexto = {
      name: nome,
      args: argumentos,
      after: (callback) => callbacksDepois.push(callback),
      onError: (callback) => callbacksDeErro.push(callback)
    };
    for (const assinante of assinantesDeAcoes) assinante(contexto);
    try {
      const resultado = acao.apply(loja, argumentos);
      if (resultado instanceof Promise) {
        return resultado.then(
          (valor) => {
            for (const callback of callbacksDepois) callback(valor);
            return valor;
          },
          (erro) => {
            for (const callback of callbacksDeErro) callback(erro);
            throw erro;
          }
        );
      }
      for (const callback of callbacksDepois) callback(resultado);
      return resultado;
    } catch (erro) {
      for (const callback of callbacksDeErro) callback(erro);
      throw erro;
    }
  };
  const definirAcao = (nome, acao) => {
    Object.defineProperty(alvo, nome, {
      enumerable: true,
      configurable: true,
      value: (...argumentos) => executarAcao(nome, acao, argumentos)
    });
  };
  alvo.$patch = (parcial) => {
    if (typeof parcial === "function") parcial(estado);
    else mesclarObjeto(estado, parcial);
  };
  alvo.$reset = () => {
    if (!estadoInicial) {
      throw new Error(`[pato] $reset nao e suportado em setup stores ("${id}").`);
    }
    mesclarObjeto(estado, clonar(estadoInicial));
    for (const chave of Object.keys(estado)) {
      if (!(chave in estadoInicial)) delete estado[chave];
    }
  };
  alvo.$subscribe = (callback) => {
    let anterior = clonar(estado);
    let primeiro = true;
    const parar = effect(() => {
      const proximo = clonar(estado);
      if (primeiro) {
        primeiro = false;
        anterior = proximo;
        return;
      }
      untrack(() => callback(proximo, anterior));
      anterior = proximo;
    });
    const descartar = () => {
      parar();
      paradasDeInscricoes.delete(descartar);
    };
    paradasDeInscricoes.add(descartar);
    return descartar;
  };
  alvo.$onAction = (callback) => {
    assinantesDeAcoes.add(callback);
    return () => {
      assinantesDeAcoes.delete(callback);
    };
  };
  alvo.$dispose = () => {
    pato._s.delete(id);
    for (const parar of paradasDeCalculados) parar();
    for (const parar of paradasDeInscricoes) parar();
    paradasDeInscricoes.clear();
    assinantesDeAcoes.clear();
  };
  if (inicializador) {
    for (const [chave, acao] of acoesDoSetup) definirAcao(chave, acao);
  } else {
    for (const [chave, obterGetter] of Object.entries(opcoes.getters ?? {})) {
      const calculado = computed(() => obterGetter.call(loja, loja.$state));
      paradasDeCalculados.push(calculado.stop);
      Object.defineProperty(alvo, chave, {
        enumerable: true,
        configurable: true,
        get: () => calculado.value
      });
    }
    for (const [chave, acao] of Object.entries(opcoes.actions ?? {})) {
      definirAcao(chave, acao);
    }
  }
  return loja;
}

// src/plugins/index.ts
function persist(opcoes = {}) {
  return ({ store: loja }) => {
    const armazenamento = opcoes.storage ?? globalThis.localStorage;
    if (!armazenamento) return;
    const chave = opcoes.key ?? `pato:${loja.$id}`;
    try {
      const salvo = armazenamento.getItem(chave);
      if (salvo) loja.$patch(JSON.parse(salvo));
    } catch {
    }
    loja.$subscribe((estado) => {
      try {
        armazenamento.setItem(chave, JSON.stringify(estado));
      } catch {
      }
    });
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  computed,
  createPato,
  createStore,
  defineStore,
  effect,
  getActivePato,
  isComputed,
  isReactive,
  isRef,
  persist,
  reactive,
  ref,
  setActivePato,
  untrack
});

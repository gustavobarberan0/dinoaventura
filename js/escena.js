/* =====================================================================
   ESCENA 3D · DINOAVENTURA
   Un valle continuo con cuatro campamentos del Mesozoico. El jeep viaja
   por un camino de tierra y la cámara encuadra cada diorama.
   La interfaz NO se dibuja acá: esta clase solo avisa por callbacks.
   ===================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
    configurarCalidad,
    texturaSuelo,
    texturaCamino,
    texturaPasto,
    texturaParticula
} from './texturas.js';
import {
    crearBipedo,
    crearSauropodo,
    crearEstegosaurio,
    crearTriceratops,
    crearAnquilosaurio,
    crearAve,
    crearPterosaurio,
    crearConifera,
    crearHelecho,
    crearCicada,
    crearPalmera,
    crearRoca,
    crearFlor,
    crearTroncoMuerto,
    material
} from './vida.js';

const UP = new THREE.Vector3(0, 1, 0);

// Punto del camino donde arranca el jeep en la intro. Se usa tanto para
// colocarlo como para sembrar los obstáculos que tiene que esquivar.
const U_INTRO_INICIO = 0.025;

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}

function siguienteFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

// Pseudoaleatorio con semilla: la vegetación sale igual en cada visita.
function aleatorioSembrado(semilla) {
    let s = semilla >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

/* ------------------------------------------------------------- PALETAS */
// Cada parada tiene su luz, su cielo y su niebla. Al viajar se mezclan
// suavemente para que el cambio de era se sienta como un atardecer.
const PALETAS = {
    triasico: {
        arriba: '#8fb6d8', abajo: '#f4d3a2', niebla: '#e3c69c',
        sol: '#fff0cc', intensidad: 2.8,
        cieloHemi: '#e2f0ff', sueloHemi: '#b58a5e',
        suelo: '#c8a070',
        nube: '#f7e6cd', cobertura: 0.36
    },
    jurasico: {
        arriba: '#5a9bd8', abajo: '#d8eec0', niebla: '#b6d4a0',
        sol: '#fff6d8', intensidad: 2.9,
        cieloHemi: '#e2f4ff', sueloHemi: '#5a7a45',
        suelo: '#6f9c52',
        nube: '#fbfdff', cobertura: 0.52
    },
    cretacico: {
        arriba: '#5e93c4', abajo: '#f4dbaa', niebla: '#d8c298',
        sol: '#fff0c4', intensidad: 2.8,
        cieloHemi: '#fff0d8', sueloHemi: '#8a7a4c',
        suelo: '#a8ae66',
        nube: '#f9ecd6', cobertura: 0.44
    },
    extincion: {
        arriba: '#2e2540', abajo: '#8a4a3e', niebla: '#57403f',
        sol: '#ff9a6a', intensidad: 1.15,
        cieloHemi: '#96747f', sueloHemi: '#463830',
        suelo: '#786660',
        nube: '#7a4e46', cobertura: 0.82
    }
};

// Encuadre de cada parada: distancia horizontal, altura y punto al que mira.
const ENCUADRE = {
    triasico: { dist: 30, alto: 11, mira: 3.0 },
    jurasico: { dist: 50, alto: 19, mira: 6.6 },
    cretacico: { dist: 34, alto: 12.5, mira: 4.0 },
    extincion: { dist: 29, alto: 10.5, mira: 2.8 }
};

export class Recorrido {
    constructor(contenedor, opciones = {}) {
        this.contenedor = contenedor;
        this.opciones = {
            calidadAlta: true,
            alIniciarVuelo: () => {},
            alCambiarParada: () => {},
            alLlegar: () => {},
            alSaltarIntro: () => {},
            ...opciones
        };

        this.cuerpos = [];
        this.paradas = {};
        this.criaturas = [];
        this.pajaros = [];
        this.humos = [];
        this.agua = null;
        this.motes = [];
        this.volcanes = [];
        this.modelos = { volcan: null, montanas: null, montanas2: null };
        this.jeep = null;
        this.ruedas = [];
        // Modelos animados (T. rex, estegosaurio, triceratops...) y mixers.
        this.dinos = [];
        this.mixers = [];
        this.manadas = [];
        this.vuelo = null;
        this.contadorVuelos = 0;
        this.destinoActual = 0;
        this.jeepU = 0;
        this.autoTour = false;
        this.temporizadorTour = null;
        this.introActiva = false;
        this.calidadAlta = this.opciones.calidadAlta;
        this.mezcla = {
            arriba: new THREE.Color(PALETAS.triasico.arriba),
            abajo: new THREE.Color(PALETAS.triasico.abajo),
            niebla: new THREE.Color(PALETAS.triasico.niebla),
            sol: new THREE.Color(PALETAS.triasico.sol),
            cieloHemi: new THREE.Color(PALETAS.triasico.cieloHemi),
            sueloHemi: new THREE.Color(PALETAS.triasico.sueloHemi),
            nube: new THREE.Color(PALETAS.triasico.nube)
        };
        this.paletaDestino = PALETAS.triasico;
        this.intensidadDestino = PALETAS.triasico.intensidad;
        this.coberturaDestino = PALETAS.triasico.cobertura;

        configurarCalidad(this.calidadAlta);
        this._construirBase();
    }

    /* ------------------------------------------------------------ BASE */
    _construirBase() {
        const ancho = window.innerWidth;
        const alto = window.innerHeight;

        this.escena = new THREE.Scene();
        this.escena.background = this.mezcla.niebla.clone();
        this.escena.fog = new THREE.FogExp2(this.mezcla.niebla.clone(), 0.0052);

        this.reloj = new THREE.Clock();
        this.camara = new THREE.PerspectiveCamera(58, ancho / alto, 0.1, 2200);
        this.camara.position.set(21, 13, 29);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(ancho, alto);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.calidadAlta ? 2 : 1.25));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = this.calidadAlta;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.contenedor.appendChild(this.renderer.domElement);

        this.controles = new OrbitControls(this.camara, this.renderer.domElement);
        this.controles.enableDamping = true;
        this.controles.dampingFactor = 0.06;
        this.controles.minDistance = 8;
        this.controles.maxDistance = 130;
        this.controles.maxPolarAngle = Math.PI * 0.49;
        this.controles.enablePan = false;
        this.controles.rotateSpeed = 0.45;
        this.controles.zoomSpeed = 0.7;

        this.escena.add(new THREE.AmbientLight(0xbfd4e8, 0.45));
        this.hemi = new THREE.HemisphereLight(
            this.mezcla.cieloHemi, this.mezcla.sueloHemi, 1.15
        );
        this.escena.add(this.hemi);

        this.luzSol = new THREE.DirectionalLight(this.mezcla.sol, 2.3);
        this.luzSol.position.set(60, 90, 45);
        this.luzSol.castShadow = this.calidadAlta;
        this.luzSol.shadow.mapSize.set(
            this.calidadAlta ? 2048 : 1024,
            this.calidadAlta ? 2048 : 1024
        );
        this.luzSol.shadow.camera.left = -55;
        this.luzSol.shadow.camera.right = 55;
        this.luzSol.shadow.camera.top = 55;
        this.luzSol.shadow.camera.bottom = -55;
        this.luzSol.shadow.camera.near = 1;
        this.luzSol.shadow.camera.far = 240;
        this.luzSol.shadow.bias = -0.0004;
        this.luzSol.shadow.normalBias = 0.22;
        this.escena.add(this.luzSol);
        this.escena.add(this.luzSol.target);

        this._crearCielo();
        this._crearPolvo();
        this._crearPost();

        window.addEventListener('resize', () => this.actualizarTamano());
        this.actualizarTamano();
        this.animar();
    }

    /* ------------------------------------------------------------- POST */
    // Capa final sobre el render: viñeta suave y grano de película. No toca el
    // color de la escena (los materiales ya traen su tone mapping), así el
    // aspecto no cambia: solo se apoya la imagen.
    _crearPost() {
        this.postEscena = new THREE.Scene();
        this.postCamara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.postUniformes = {
            resolucion: { value: new THREE.Vector2(1, 1) },
            tiempo: { value: 0 },
            vineta: { value: 0.26 },
            grano: { value: 0.05 },
            calidez: { value: 0.018 }
        };

        const geometria = new THREE.PlaneGeometry(2, 2);
        const vertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }
        `;

        const matPost = new THREE.ShaderMaterial({
            uniforms: this.postUniformes,
            vertexShader,
            fragmentShader: `
                uniform float vineta;
                uniform float grano;
                uniform float tiempo;
                uniform float calidez;
                uniform vec2 resolucion;
                varying vec2 vUv;

                float ruido(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }

                void main() {
                    // Viñeta en el alfa y grano cálido en el color: con
                    // blendSrc = One y blendDst = OneMinusSrcAlpha se resuelve
                    // en un solo pase.
                    vec2 centro = vUv - 0.5;
                    float dist = length(centro * vec2(1.0, 0.92));
                    float a = vineta * smoothstep(0.36, 0.90, dist);

                    float g = (ruido(vUv * resolucion + tiempo * 60.0) - 0.5) * grano;
                    vec3 calido = vec3(calidez, calidez * 0.6, 0.0);
                    gl_FragColor = vec4(max(vec3(g) + calido, 0.0), a);
                }
            `,
            transparent: true,
            blending: THREE.CustomBlending,
            blendEquation: THREE.AddEquation,
            blendSrc: THREE.OneFactor,
            blendDst: THREE.OneMinusSrcAlphaFactor,
            depthTest: false,
            depthWrite: false
        });

        this.postEscena.add(new THREE.Mesh(geometria, matPost));
        this.postUniformes.resolucion.value.set(window.innerWidth, window.innerHeight);
    }

    /* ------------------------------------------------------------- CIELO */
    _crearCielo() {
        this.uniformesCielo = {
            arriba: { value: this.mezcla.arriba.clone() },
            abajo: { value: this.mezcla.abajo.clone() },
            nube: { value: this.mezcla.nube.clone() },
            sol: { value: this.mezcla.sol.clone() },
            dirSol: { value: new THREE.Vector3(55, 95, 42).normalize() },
            cobertura: { value: 0.45 },
            tiempo: { value: 0 },
            octavas: { value: this.calidadAlta ? 4 : 2 },
            exponente: { value: 0.72 }
        };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniformesCielo,
            vertexShader: `
                varying vec3 vDir;
                void main() {
                    vec4 mundo = modelMatrix * vec4(position, 1.0);
                    vDir = normalize(mundo.xyz - cameraPosition);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 arriba;
                uniform vec3 abajo;
                uniform vec3 nube;
                uniform vec3 sol;
                uniform vec3 dirSol;
                uniform float cobertura;
                uniform float tiempo;
                uniform float octavas;
                uniform float exponente;
                varying vec3 vDir;

                float hash21(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }

                float ruido(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    float a = hash21(i);
                    float b = hash21(i + vec2(1.0, 0.0));
                    float c = hash21(i + vec2(0.0, 1.0));
                    float d = hash21(i + vec2(1.0, 1.0));
                    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                }

                float fbm(vec2 p) {
                    float valor = 0.0;
                    float amp = 0.5;
                    for (int i = 0; i < 4; i++) {
                        if (float(i) >= octavas) break;
                        valor += amp * ruido(p);
                        p *= 2.03;
                        amp *= 0.5;
                    }
                    return valor;
                }

                void main() {
                    vec3 dir = normalize(vDir);
                    float h = pow(max(dir.y, 0.0), exponente);
                    vec3 color = mix(abajo, arriba, h);

                    // Nubes: capa plana proyectada sobre el cielo, con viento lento.
                    float sobreHorizonte = smoothstep(0.004, 0.10, dir.y);
                    vec2 plano = dir.xz / (dir.y + 0.18) * 0.5
                        + vec2(tiempo * 0.0045, tiempo * 0.0018);
                    float n = fbm(plano * 5.0);
                    float umbral = mix(0.74, 0.32, cobertura);
                    float nubes = smoothstep(umbral, umbral + 0.20, n) * sobreHorizonte;

                    // Las nubes se encienden del lado del sol.
                    float haciaSol = pow(max(dot(dir, dirSol), 0.0), 4.0);
                    vec3 colorNube = mix(nube * 0.82, nube, 0.25 + 0.75 * haciaSol);
                    color = mix(color, colorNube, nubes * 0.88);

                    // Sol: disco, halo cercano y bruma amplia.
                    float d = max(dot(dir, dirSol), 0.0);
                    color += sol * pow(d, 1400.0) * 1.7;
                    color += sol * pow(d, 26.0) * 0.10;
                    color += sol * pow(d, 6.0) * 0.035;

                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false,
            fog: false
        });
        const cielo = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 20), mat);
        cielo.position.set(180, 0, 0);
        cielo.frustumCulled = false;
        this.escena.add(cielo);
    }

    /* ------------------------------------------------------------ TERRENO */
    _crearTerreno() {
        const ancho = 620;
        const fondo = 300;
        const geo = new THREE.PlaneGeometry(ancho, fondo, this.calidadAlta ? 150 : 90, this.calidadAlta ? 84 : 50);
        geo.rotateX(-Math.PI / 2);
        geo.translate(180, 0, 0);

        const pos = geo.attributes.position;
        const colores = new Float32Array(pos.count * 3);
        const centros = [0, 120, 240, 360];
        const coloresZona = centros.map((x, i) => new THREE.Color(PALETAS[this.cuerpos[i] ? this.cuerpos[i].id : 'triasico'].suelo));
        const aux = new THREE.Color();

        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);

            // Valle plano junto al camino y lomadas hacia los costados.
            const borde = THREE.MathUtils.smoothstep(Math.abs(z), 15, 52);
            const ruido =
                Math.sin(x * 0.055 + z * 0.07) * 1.7 +
                Math.sin(x * 0.13 - z * 0.045) * 0.65 +
                Math.cos(x * 0.031 + z * 0.10) * 2.1;
            const lejano = Math.max(0, (Math.abs(z) - 95) / 45) * 9;
            const y = borde * (3.1 + ruido) + lejano + Math.sin(x * 0.4) * 0.06;
            pos.setY(i, y);

            // Color del bioma según la zona.
            let color;
            if (x <= centros[0]) color = coloresZona[0];
            else if (x >= centros[3]) color = coloresZona[3];
            else {
                let j = 0;
                while (j < centros.length - 2 && x > centros[j + 1]) j++;
                const t = THREE.MathUtils.smoothstep((x - centros[j]) / (centros[j + 1] - centros[j]), 0, 1);
                aux.copy(coloresZona[j]).lerp(coloresZona[j + 1], t);
                color = aux;
            }
            const variacion = 0.86 + (Math.sin(x * 0.21 + z * 0.17) * 0.5 + 0.5) * 0.22;
            colores[i * 3] = color.r * variacion;
            colores[i * 3 + 1] = color.g * variacion;
            colores[i * 3 + 2] = color.b * variacion;
        }

        geo.setAttribute('color', new THREE.BufferAttribute(colores, 3));
        geo.computeVertexNormals();

        const suelo = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
            map: texturaSuelo(),
            vertexColors: true,
            roughness: 1,
            metalness: 0
        }));
        suelo.receiveShadow = true;
        this.escena.add(suelo);
        this.suelo = suelo;
    }

    /* ------------------------------------------------------------- CAMINO */
    _crearCamino() {
        this.anclas = this.cuerpos.map((_, i) => this._anclaJeep(i));
        const puntos = [];
        puntos.push(new THREE.Vector3(this.anclas[0].x - 95, 0, this.anclas[0].z + 3));
        this.anclas.forEach((ancla, i) => {
            puntos.push(ancla.clone());
            if (i < this.anclas.length - 1) {
                const medio = ancla.clone().lerp(this.anclas[i + 1], 0.5);
                medio.z -= 6.5;
                medio.x += 2;
                puntos.push(medio);
            }
        });
        puntos.push(new THREE.Vector3(this.anclas[this.anclas.length - 1].x + 70, 0, this.anclas[this.anclas.length - 1].z + 4));

        this.curva = new THREE.CatmullRomCurve3(puntos, false, 'catmullrom', 0.35);
        this.caminoMuestras = this.curva.getSpacedPoints(500);
        this.uParada = this.anclas.map((ancla) => this._uMasCercana(ancla));

        // Cinta plana que sigue la curva.
        const cantidad = 260;
        const ancho = 5.6;
        const vertices = new Float32Array(cantidad * 2 * 3);
        const uvs = new Float32Array(cantidad * 2 * 2);
        const indices = [];
        for (let i = 0; i < cantidad; i++) {
            const t = i / (cantidad - 1);
            const p = this.curva.getPointAt(t);
            const tangente = this.curva.getTangentAt(t).setY(0).normalize();
            const lateral = new THREE.Vector3().crossVectors(tangente, UP).normalize().multiplyScalar(ancho / 2);
            const a = p.clone().add(lateral);
            const b = p.clone().sub(lateral);
            const o = i * 6;
            vertices[o] = a.x; vertices[o + 1] = 0.07; vertices[o + 2] = a.z;
            vertices[o + 3] = b.x; vertices[o + 4] = 0.07; vertices[o + 5] = b.z;
            const u = i * 2;
            uvs[u] = 0; uvs[u + 1] = t * 34;
            uvs[u + 2] = 1; uvs[u + 3] = t * 34;
            if (i < cantidad - 1) {
                const v = i * 2;
                indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const camino = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
            map: texturaCamino(),
            roughness: 1,
            metalness: 0,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        }));
        camino.receiveShadow = true;
        this.escena.add(camino);
        this.camino = camino;
    }

    _uMasCercana(punto) {
        let mejor = 0;
        let distancia = Infinity;
        this.caminoMuestras.forEach((muestra, i) => {
            const d = (muestra.x - punto.x) ** 2 + (muestra.z - punto.z) ** 2;
            if (d < distancia) {
                distancia = d;
                mejor = i;
            }
        });
        return mejor / (this.caminoMuestras.length - 1);
    }

    _puntoCamino(u) {
        const t = clamp01(u);
        const idx = t * (this.caminoMuestras.length - 1);
        const i = Math.floor(idx);
        const j = Math.min(this.caminoMuestras.length - 1, i + 1);
        return this.caminoMuestras[i].clone().lerp(this.caminoMuestras[j], idx - i);
    }

    // Tangente y lateral del camino en un punto. El lateral es siempre
    // perpendicular a la marcha y paralelo al suelo.
    _marcoCamino(u) {
        const punto = this._puntoCamino(u);
        const adelante = this._puntoCamino(Math.min(1, u + 0.004))
            .sub(punto).setY(0).normalize();
        const lateral = new THREE.Vector3().crossVectors(adelante, UP).normalize();
        return { punto, adelante, lateral };
    }

    /* -------------------------------------------------- OBSTÁCULOS DE ENTRADA */
    // Rocas y un tronco sobre el camino, justo en el tramo que recorre el
    // jeep durante la intro. El volantazo de la intro los esquiva.
    _crearObstaculosIntro() {
        this.obstaculosIntro = [];
        const inicio = U_INTRO_INICIO;
        const fin = this.uParada[0];
        const lados = [-1, 1, -1];

        for (let i = 0; i < 3; i++) {
            // Mismo mapeo que usa la intro: e (0..1) → u del camino.
            const e = (i + 0.5) / 3;
            const u = inicio + (fin - inicio) * e;
            const { punto, lateral } = this._marcoCamino(u);
            const centro = punto.clone().addScaledVector(lateral, lados[i] * 2.45);
            centro.y = 0;

            let objeto;
            if (i === 1) {
                // Tronco caído atravesado en el borde del camino.
                objeto = new THREE.Group();
                const palo = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.42, 0.55, 4.6, 7),
                    material('#5a4636')
                );
                palo.rotation.z = Math.PI / 2;
                palo.position.y = 0.55;
                palo.castShadow = true;
                objeto.add(palo);
                objeto.rotation.y = Math.atan2(-lateral.z, lateral.x);
            } else {
                objeto = crearRoca(1.35 + i * 0.35, i === 0 ? '#8a8175' : '#7d7468');
                objeto.rotation.y = i * 1.7;
            }

            objeto.position.copy(centro);
            this.escena.add(objeto);
            this.obstaculosIntro.push(objeto);
        }
    }

    /* ------------------------------------------------------------- PARADAS */
    async construir(cuerpos, alProgreso = () => {}) {
        this.cuerpos = cuerpos;
        alProgreso('Preparando el valle', 0.05);
        await siguienteFrame();
        this._crearTerreno();

        alProgreso('Trazando el camino del safari', 0.09);
        await siguienteFrame();
        this._crearCamino();
        this._crearObstaculosIntro();

        alProgreso('Levantando montañas y volcanes', 0.12);
        await siguienteFrame();
        await this._cargarRelieve();

        for (let i = 0; i < cuerpos.length; i++) {
            const cuerpo = cuerpos[i];
            alProgreso(`Armando el campamento: ${cuerpo.nombre}`, 0.14 + (i / cuerpos.length) * 0.66);
            await siguienteFrame();
            this._crearParada(cuerpo, i);
        }

        alProgreso('Cerrando el horizonte', 0.83);
        await siguienteFrame();
        this._crearCordilleras();

        alProgreso('Ajustando la luz del Mesozoico', 0.86);
        await siguienteFrame();
        this._aplicarPaleta(0, true);

        alProgreso('Preparando el jeep', 0.94);
        await siguienteFrame();
    }

    _crearParada(cuerpo, i) {
        const grupo = new THREE.Group();
        grupo.position.set(cuerpo.pos.x, 0, 0);
        this.escena.add(grupo);
        this.paradas[cuerpo.id] = grupo;
        cuerpo.grupoParada = grupo;

        const agregar = (objeto, x, z, giro = 0) => {
            objeto.position.set(x, this._alturaTerreno(grupo.position.x + x, z), z);
            objeto.rotation.y = giro;
            grupo.add(objeto);
            return objeto;
        };

        const registrarCriatura = (objeto) => {
            if (objeto.userData.animar) this.criaturas.push(objeto);
            return objeto;
        };

        if (cuerpo.id === 'triasico') {
            // Plateosaurus: el gigante del Triásico
            registrarCriatura(agregar(crearBipedo({
                largo: 8, alto: 3.6, color: '#8a7a58', vientre: '#cdbb90', fase: 0.4
            }), -7, 8, -0.55));

            // Herrerasaurus al acecho
            registrarCriatura(agregar(crearBipedo({
                largo: 5.4, alto: 2.2, color: '#6f5a44', vientre: '#c2a878', fase: 2.1
            }), 11, -7, 2.5));

            // Eoraptor, pequeño y veloz
            registrarCriatura(agregar(crearBipedo({
                largo: 1.3, alto: 0.75, color: '#9a8050', vientre: '#d8c79c', brazos: false, fase: 4.2
            }), 7, 6, -1.1));

            agregar(crearConifera(13, '#3d5a35'), -19, -14, 0.4);
            agregar(crearConifera(9, '#46643a'), 18, -19, 1.2);
            agregar(crearCicada(2.4), 15, 5, 0.8);
            agregar(crearCicada(1.8), -11, 9, 2.2);
            agregar(crearHelecho(1.4), -13, -4, 0.2);
            agregar(crearHelecho(1.1), 3, 10, 1.5);
            agregar(crearHelecho(1.2), 20, 2, 0.6);
            agregar(crearRoca(1.6, '#9a8a74'), -8, -9, 0.4);
            agregar(crearRoca(1.1, '#8b7c68'), 13, 9, 1.2);
            agregar(crearRoca(0.8, '#a3947e'), -16, 6, 2.3);
            agregar(crearTroncoMuerto(5), 17, -3, 0.9);

            this._crearVolcan(grupo, -28, -78, 1.25, 'triasico');
        }

        if (cuerpo.id === 'jurasico') {
            // Brachiosaurus, el gigante estrella de la parada
            const brachio = registrarCriatura(agregar(crearSauropodo({
                largo: 24, alto: 12.5, color: '#6f7f52', vientre: '#bcc08c', fase: 1.1
            }), -3, -9, 2.5));

            // El estegosaurio animado lo agrega cargarVehiculo en (14, 9).
            registrarCriatura(agregar(crearBipedo({
                largo: 9, alto: 3.8, color: '#6b5a4a', vientre: '#c9b48a', cresta: '#a04a3c', fase: 5.2
            }), -17, 8, 1.1));

            // Laguna
            const barro = new THREE.Mesh(
                new THREE.CircleGeometry(10.6, 40),
                new THREE.MeshStandardMaterial({ color: '#4a4030', roughness: 1 })
            );
            barro.rotation.x = -Math.PI / 2;
            barro.position.set(3, 0.03, 16);
            barro.receiveShadow = true;
            grupo.add(barro);

            // Orilla húmeda: anillo oscuro entre el barro y el agua.
            const orilla = new THREE.Mesh(
                new THREE.RingGeometry(8.7, 10.6, 40),
                new THREE.MeshStandardMaterial({ color: '#4b4031', roughness: 1 })
            );
            orilla.rotation.x = -Math.PI / 2;
            orilla.position.set(3, 0.05, 16);
            orilla.receiveShadow = true;
            grupo.add(orilla);

            // Agua por shader: ondas, reflejo del cielo, brillo del sol y
            // espuma en la orilla. Sin texturas ni mallas extra.
            this.aguaUniformes = {
                tiempo: { value: 0 },
                agua: { value: new THREE.Color('#3f8f97') },
                cielo: { value: new THREE.Color('#cfe9ec') },
                espuma: { value: new THREE.Color('#eef6ee') },
                sol: { value: new THREE.Color('#fff6d8') },
                dirSol: { value: new THREE.Vector3(55, 95, 42).normalize() }
            };
            const matAgua = new THREE.ShaderMaterial({
                uniforms: this.aguaUniformes,
                vertexShader: `
                    varying vec2 vUv;
                    varying vec3 vMundo;
                    void main() {
                        vUv = uv;
                        vec4 mundo = modelMatrix * vec4(position, 1.0);
                        vMundo = mundo.xyz;
                        gl_Position = projectionMatrix * viewMatrix * mundo;
                    }
                `,
                fragmentShader: `
                    uniform float tiempo;
                    uniform vec3 agua;
                    uniform vec3 cielo;
                    uniform vec3 espuma;
                    uniform vec3 sol;
                    uniform vec3 dirSol;
                    varying vec2 vUv;
                    varying vec3 vMundo;
                    void main() {
                        float borde = length(vUv - 0.5) * 2.0;
                        vec2 p = vUv * 14.0;

                        // Dos trenes de ondas cruzados, lentos y de poca altura.
                        float o1 = sin(p.x * 1.7 + tiempo * 1.1);
                        float o2 = sin(p.y * 2.3 - tiempo * 0.9);
                        float o3 = sin((p.x + p.y) * 3.1 + tiempo * 1.7);
                        float ola = o1 * 0.4 + o2 * 0.35 + o3 * 0.25;

                        vec3 n = normalize(vec3(
                            cos(p.x * 1.7 + tiempo * 1.1) * 0.16 + cos((p.x + p.y) * 3.1 + tiempo * 1.7) * 0.08,
                            1.0,
                            cos(p.y * 2.3 - tiempo * 0.9) * 0.16 - cos((p.x + p.y) * 3.1 + tiempo * 1.7) * 0.08
                        ));

                        vec3 vista = normalize(cameraPosition - vMundo);
                        float fresnel = pow(1.0 - max(dot(n, vista), 0.0), 3.0);
                        vec3 color = mix(agua, cielo, 0.30 + fresnel * 0.50);

                        // Destello del sol sobre las crestas.
                        vec3 medio = normalize(dirSol + vista);
                        float brillo = pow(max(dot(n, medio), 0.0), 90.0);
                        color += sol * brillo * 1.1;

                        // Espuma: anillo irregular que respira con las olas.
                        float espumaBorde = smoothstep(0.86, 0.995, borde + ola * 0.04);
                        float ruidoEspuma = 0.5 + 0.5 * sin(borde * 46.0 - tiempo * 2.2 + ola * 4.0);
                        color = mix(color, espuma, espumaBorde * (0.25 + 0.55 * ruidoEspuma));

                        gl_FragColor = vec4(color, 0.93);
                    }
                `,
                transparent: true
            });
            const agua = new THREE.Mesh(new THREE.CircleGeometry(9, 64), matAgua);
            agua.rotation.x = -Math.PI / 2;
            agua.position.set(3, 0.08, 16);
            agua.receiveShadow = true;
            grupo.add(agua);
            this.agua = agua;

            // Juncos y plantas de la orilla
            for (let j = 0; j < 7; j++) {
                const ang = (j / 7) * Math.PI * 2;
                const helecho = crearHelecho(0.9 + (j % 3) * 0.2, '#4c7a3c');
                agregar(helecho, 3 + Math.cos(ang) * 9.6, 16 + Math.sin(ang) * 9.6, ang);
            }

            agregar(crearConifera(17, '#37552f'), -25, -22, 0.3);
            agregar(crearConifera(14, '#3f6034'), 24, -16, 1.7);
            agregar(crearConifera(11, '#456a38'), 8, -26, 2.4);
            agregar(crearCicada(2.8), -9, 12, 1.4);
            agregar(crearCicada(2.2), 20, 8, 0.5);
            agregar(crearHelecho(1.8), -20, -6, 0.7);
            agregar(crearHelecho(1.5), 6, -4, 2.0);
            agregar(crearRoca(2.1, '#7d7568'), -12, -13, 0.9);
            agregar(crearRoca(1.3, '#8c8474'), 18, -7, 2.7);

            this._crearPterosaurios(grupo, 3, 18);
        }

        if (cuerpo.id === 'cretacico') {
            // T. rex, triceratops, parasaurolophus y la manada de
            // velocirraptores llegan como modelos animados (cargarVehiculo).
            registrarCriatura(agregar(crearAnquilosaurio({
                largo: 8, alto: 2.3, color: '#6f6350', blindaje: '#8d7a5e', fase: 2.9
            }), 9, 8, -0.4));

            agregar(crearPalmera(9, '#4f7f4a'), -22, 6, 0.6);
            agregar(crearPalmera(7.5, '#588a4e'), 20, -14, 1.9);
            agregar(crearPalmera(6.5, '#4a7a46'), 2, 14, 0.2);
            agregar(crearConifera(12, '#3c5a34'), -26, -16, 1.2);

            for (let j = 0; j < 16; j++) {
                const flor = crearFlor(j % 3 === 0 ? '#d95f4a' : (j % 3 === 1 ? '#e0c84a' : '#c47ab0'));
                const ang = j * 1.9;
                const radio = 6 + (j % 5) * 2.2;
                agregar(flor, Math.cos(ang) * radio + 4, Math.sin(ang) * radio - 1, ang);
            }

            agregar(crearRoca(1.8, '#8a8175'), -9, 7, 0.3);
            agregar(crearRoca(1.2, '#7d7468'), 22, 4, 1.8);

            this._crearVolcan(grupo, 34, -82, 1.45, 'cretacico');
            this._crearPterosaurios(grupo, 2, 22);
        }

        if (cuerpo.id === 'extincion') {
            // Árboles muertos y un nido que sobrevivió
            agregar(crearTroncoMuerto(9, '#4f4038'), -18, -6, 0.4);
            agregar(crearTroncoMuerto(7, '#463a34'), 16, -10, 2.1);
            agregar(crearTroncoMuerto(5.5, '#52423a'), 6, -17, 1.2);
            agregar(crearRoca(2.4, '#6a5f58'), -8, 4, 0.8);
            agregar(crearRoca(1.6, '#75695f'), 11, 7, 2.4);
            agregar(crearRoca(1.2, '#5f554e'), -14, 8, 1.6);

            // Nido con huevos
            const nido = new THREE.Group();
            nido.position.set(2, 0, 6);
            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(1.5, 1.1, 0.4, 12),
                material('#6b5136')
            );
            base.position.y = 0.2;
            base.receiveShadow = true;
            nido.add(base);
            for (let j = 0; j < 3; j++) {
                const huevo = new THREE.Mesh(
                    new THREE.SphereGeometry(0.34, 10, 8),
                    material('#e2d3ae')
                );
                huevo.scale.y = 1.35;
                huevo.position.set(Math.cos(j * 2.1) * 0.45, 0.62, Math.sin(j * 2.1) * 0.45);
                huevo.castShadow = true;
                nido.add(huevo);
            }
            grupo.add(nido);

            // Archaeopteryx posado en una roca
            const ave = crearAve({ escala: 1.4, color: '#3d4a5c', fase: 1.4 });
            ave.position.set(-7, 2.6, 3);
            ave.rotation.y = 2.2;
            grupo.add(ave);
            this.criaturas.push(ave);

            this._crearPajaros(grupo, 5, 3);
            this._crearAsteroide(grupo);
            this._crearCeniza(grupo);
        }

        // Relleno vegetal: reparte plantas alrededor del campamento para que
        // el diorama no se vea vacío. Se mantiene lejos del camino (z ≈ 0).
        this._sembrarVegetacion(grupo, cuerpo.id);
        this._crearPasto(grupo, cuerpo.id);
        this._crearDetalleSuelo(grupo, cuerpo.id);
        this._crearMotes(grupo, cuerpo.id);

        // Sombras solo en calidad alta.
        if (!this.calidadAlta) {
            grupo.traverse((hijo) => { if (hijo.isMesh) hijo.castShadow = false; });
        }
    }

    /* -------------------------------------------------- RELLENO VEGETAL */
    // Misma fórmula que usa el terreno: sirve para apoyar las plantas en las
    // lomadas en vez de dejarlas flotando o enterradas.
    _alturaTerreno(x, z) {
        const borde = THREE.MathUtils.smoothstep(Math.abs(z), 15, 52);
        const ruido =
            Math.sin(x * 0.055 + z * 0.07) * 1.7 +
            Math.sin(x * 0.13 - z * 0.045) * 0.65 +
            Math.cos(x * 0.031 + z * 0.10) * 2.1;
        const lejano = Math.max(0, (Math.abs(z) - 95) / 45) * 9;
        return borde * (3.1 + ruido) + lejano + Math.sin(x * 0.4) * 0.06;
    }

    _sembrarVegetacion(grupo, bioma) {
        const rand = aleatorioSembrado(4211 + bioma.length * 97);
        const cantidad = this.calidadAlta ? 26 : 14;
        const centroX = grupo.position.x;
        const paletas = {
            triasico: { conifera: ['#3f5c36', '#48653c'], helecho: '#5c7a44', cicada: '#4c6f42' },
            jurasico: { conifera: ['#33552c', '#3f6634'], helecho: '#4f7f3c', cicada: '#457a40' },
            cretacico: { conifera: ['#3c5a34', '#47693a'], helecho: '#578c44', cicada: '#4d8046' },
            extincion: { conifera: ['#4a4038', '#544840'], helecho: '#5a5a44', cicada: '#4c483c' }
        };
        const pal = paletas[bioma] || paletas.triasico;
        const cfg = ENCUADRE[bioma] || ENCUADRE.triasico;
        const camX = cfg.dist * 0.60;
        const camZ = cfg.dist * 0.80;
        // El jeep se estaciona en el borde del camino: nada de árboles ahí.
        const jeepX = cfg.dist * 0.288;
        const jeepZ = cfg.dist * 0.034;

        for (let i = 0; i < cantidad; i++) {
            const ang = rand() * Math.PI * 2;
            const radio = 12 + rand() * 26;
            const x = Math.cos(ang) * radio;
            const z = Math.sin(ang) * radio;
            if (Math.abs(z) < 8) continue; // deja libre el camino
            // No tapa la cámara con un árbol gigante en primer plano.
            if (Math.hypot(x - camX, z - camZ) < 16) continue;
            // Tampoco tapa el jeep ni la línea de visión hacia él.
            if (Math.hypot(x - jeepX, z - jeepZ) < 10) continue;
            const dx = camX - jeepX;
            const dz = camZ - jeepZ;
            const largo2 = dx * dx + dz * dz;
            const t = Math.max(0, Math.min(1, ((x - jeepX) * dx + (z - jeepZ) * dz) / largo2));
            if (Math.hypot(x - (jeepX + dx * t), z - (jeepZ + dz * t)) < 6.5) continue;

            const tirada = rand();
            let planta;
            if (bioma === 'extincion') {
                if (tirada < 0.55) planta = crearRoca(0.6 + rand() * 1.2, '#6a5f58');
                else if (tirada < 0.85) planta = crearTroncoMuerto(3 + rand() * 5, '#4f4038');
                else planta = crearHelecho(0.7 + rand() * 0.6, pal.helecho);
            } else if (tirada < 0.30) {
                planta = crearConifera(6 + rand() * 9, pal.conifera[i % 2]);
            } else if (tirada < 0.58) {
                planta = crearHelecho(0.8 + rand() * 0.9, pal.helecho);
            } else if (tirada < 0.78) {
                planta = crearCicada(1.4 + rand() * 1.6, pal.cicada);
            } else if (tirada < 0.88 && bioma === 'cretacico') {
                planta = crearPalmera(5 + rand() * 5, '#4f7f4a');
            } else if (tirada < 0.92 && bioma === 'cretacico') {
                planta = crearFlor(rand() > 0.5 ? '#d95f4a' : '#e0c84a');
            } else {
                planta = crearRoca(0.5 + rand() * 1.1, '#8a8175');
            }

            planta.position.set(x, this._alturaTerreno(centroX + x, z), z);
            planta.rotation.y = rand() * Math.PI * 2;
            grupo.add(planta);
        }
    }

    /* -------------------------------------------------------------- PASTO */
    // Matas instanciadas: una sola llamada de dibujo por parada. Dan silueta
    // al suelo sin sumar peso ni mallas sueltas.
    _crearPasto(grupo, bioma) {
        const colores = {
            triasico: ['#d8cfa4', '#cdc294', '#e2d9b0'],
            jurasico: ['#cfe0a8', '#bcd49a', '#dbe8b8'],
            cretacico: ['#cfe0a0', '#c2d894', '#dce8b0'],
            extincion: ['#b8ae90', '#a89e82', '#c4b89a']
        };
        const paleta = colores[bioma] || colores.triasico;
        const densidad = bioma === 'extincion' ? 0.55 : 1;
        const cantidad = Math.round((this.calidadAlta ? 1800 : 620) * densidad);
        const rand = aleatorioSembrado(9137 + bioma.length * 131);
        const centroX = grupo.position.x;

        if (!this._pastoGeo) {
            const plano = new THREE.PlaneGeometry(1, 1);
            plano.translate(0, 0.5, 0);
            const cruz = [0, Math.PI / 2].map((giro) => {
                const copia = plano.clone();
                copia.rotateY(giro);
                return copia;
            });
            this._pastoGeo = mergeGeometries(cruz);
            // Las tarjetas de pasto se iluminan como el suelo: si conservan la
            // normal horizontal quedan casi negras con el sol cenital.
            const normales = this._pastoGeo.attributes.normal;
            for (let i = 0; i < normales.count; i++) normales.setXYZ(i, 0, 1, 0);
            normales.needsUpdate = true;
            this._pastoMat = new THREE.MeshStandardMaterial({
                map: texturaPasto(),
                alphaTest: 0.42,
                side: THREE.DoubleSide,
                roughness: 1,
                metalness: 0
            });
        }

        const malla = new THREE.InstancedMesh(this._pastoGeo, this._pastoMat, cantidad);
        const matriz = new THREE.Matrix4();
        const posicion = new THREE.Vector3();
        const giro = new THREE.Quaternion();
        const escala = new THREE.Vector3();
        const color = new THREE.Color();
        const centroLaguna = bioma === 'jurasico' ? { x: 3, z: 16, r: 10.6 } : null;

        let puestas = 0;
        let intentos = 0;
        while (puestas < cantidad && intentos < cantidad * 8) {
            intentos++;
            const ang = rand() * Math.PI * 2;
            const radio = 2.5 + Math.sqrt(rand()) * 36;
            const x = Math.cos(ang) * radio;
            const z = Math.sin(ang) * radio;

            if (Math.abs(z) < 6) continue; // camino y banquina
            if (centroLaguna && Math.hypot(x - centroLaguna.x, z - centroLaguna.z) < centroLaguna.r) continue;

            // Manchas de pasto: más tupido en unas zonas que en otras.
            const mancha = 0.5 + 0.5 * Math.sin(x * 0.33) * Math.cos(z * 0.29);
            if (rand() > 0.30 + mancha * 0.85) continue;

            const alto = 0.30 + rand() * 0.34;
            posicion.set(x, this._alturaTerreno(centroX + x, z) - 0.02, z);
            giro.setFromAxisAngle(UP, rand() * Math.PI);
            const anchoMata = alto * (1.5 + rand() * 1.1);
            escala.set(anchoMata, alto, anchoMata);
            matriz.compose(posicion, giro, escala);
            malla.setMatrixAt(puestas, matriz);

            color.set(paleta[Math.floor(rand() * paleta.length)]);
            malla.setColorAt(puestas, color);
            puestas++;
        }

        malla.count = puestas;
        malla.instanceMatrix.needsUpdate = true;
        if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
        malla.receiveShadow = true;
        malla.frustumCulled = false;
        grupo.add(malla);
    }

    /* -------------------------------------------------- DETALLE DEL SUELO */
    // Piedritas y hojas secas instanciadas: el suelo deja de ser una sábana
    // lisa y gana escala. Dos llamadas de dibujo por parada, cero peso.
    _crearDetalleSuelo(grupo, bioma) {
        const centroX = grupo.position.x;
        const rand = aleatorioSembrado(4471 + bioma.length * 37);
        const centroLaguna = bioma === 'jurasico' ? { x: 3, z: 16, r: 10.2 } : null;
        const matriz = new THREE.Matrix4();
        const posicion = new THREE.Vector3();
        const giro = new THREE.Quaternion();
        const escala = new THREE.Vector3();
        const color = new THREE.Color();
        const rocas = {
            triasico: ['#8a6f50', '#7a6046', '#94795a', '#6b5540'],
            jurasico: ['#6a705c', '#787e6a', '#5c6352', '#828876'],
            cretacico: ['#7d7358', '#8b8166', '#6e654c', '#968c70'],
            extincion: ['#5c534c', '#6a5f57', '#4e4640', '#776b62']
        }[bioma] || ['#8a6f50'];
        const hojas = {
            triasico: ['#a8894e', '#8f7340', '#b79a5c'],
            jurasico: ['#6f8f3c', '#8aa64e', '#5f7a34'],
            cretacico: ['#b08a3e', '#c9a24c', '#8f6f30'],
            extincion: ['#6b5646', '#7a6450', '#584738']
        }[bioma] || ['#a8894e'];

        const colocar = (malla, cantidad, min, max, paleta, plano) => {
            let puestas = 0;
            let intentos = 0;
            while (puestas < cantidad && intentos < cantidad * 10) {
                intentos++;
                const ang = rand() * Math.PI * 2;
                const radio = 2.0 + Math.sqrt(rand()) * 34;
                const x = Math.cos(ang) * radio;
                const z = Math.sin(ang) * radio;
                if (Math.abs(z) < 4.6) continue;
                if (centroLaguna && Math.hypot(x - centroLaguna.x, z - centroLaguna.z) < centroLaguna.r) continue;

                const tam = min + rand() * (max - min);
                posicion.set(x, this._alturaTerreno(centroX + x, z) + (plano ? 0.015 : tam * 0.32), z);
                giro.setFromAxisAngle(UP, rand() * Math.PI * 2);
                if (plano) escala.set(tam, tam, tam);
                else escala.set(tam, tam * (0.55 + rand() * 0.5), tam * (0.8 + rand() * 0.4));
                matriz.compose(posicion, giro, escala);
                malla.setMatrixAt(puestas, matriz);
                color.set(paleta[Math.floor(rand() * paleta.length)]);
                malla.setColorAt(puestas, color);
                puestas++;
            }
            malla.count = puestas;
            malla.instanceMatrix.needsUpdate = true;
            if (malla.instanceColor) malla.instanceColor.needsUpdate = true;
            malla.receiveShadow = true;
            malla.castShadow = false;
            malla.frustumCulled = false;
            grupo.add(malla);
        };

        const cantidadRocas = Math.round((this.calidadAlta ? 150 : 70) * (bioma === 'extincion' ? 1.6 : 1));
        const geoRoca = new THREE.DodecahedronGeometry(1, 0);
        const matRoca = new THREE.MeshStandardMaterial({
            roughness: 1, metalness: 0, flatShading: true
        });
        colocar(new THREE.InstancedMesh(geoRoca, matRoca, cantidadRocas),
            cantidadRocas, 0.05, 0.18, rocas, false);

        const cantidadHojas = Math.round((this.calidadAlta ? 300 : 120) * (bioma === 'extincion' ? 0.5 : 1));
        const geoHoja = new THREE.CircleGeometry(1, 5);
        geoHoja.rotateX(-Math.PI / 2);
        const matHoja = new THREE.MeshStandardMaterial({
            roughness: 1, metalness: 0, side: THREE.DoubleSide
        });
        colocar(new THREE.InstancedMesh(geoHoja, matHoja, cantidadHojas),
            cantidadHojas, 0.05, 0.13, hojas, true);
    }

    /* ------------------------------------------------------------- MOTAS */
    // Polen y polvillo suspendido: da profundidad al aire y hace que la luz
    // se sienta volumétrica sin post-proceso.
    _crearMotes(grupo, bioma) {
        const cantidad = this.calidadAlta ? 260 : 110;
        const tonos = {
            triasico: ['#ffe6b0', '#f7d79a'],
            jurasico: ['#eaffc0', '#d8f2a8'],
            cretacico: ['#ffe9b8', '#f5d79c'],
            extincion: ['#d8b79a', '#c49a86']
        }[bioma] || ['#ffe6b0'];
        const rand = aleatorioSembrado(7717 + bioma.length * 53);
        const centroX = grupo.position.x;
        const geo = new THREE.BufferGeometry();
        const posiciones = new Float32Array(cantidad * 3);
        const datos = [];
        for (let i = 0; i < cantidad; i++) {
            const ang = rand() * Math.PI * 2;
            const radio = Math.sqrt(rand()) * 30;
            const x = Math.cos(ang) * radio;
            const z = Math.sin(ang) * radio;
            const y = 0.6 + rand() * 12;
            posiciones[i * 3] = x;
            posiciones[i * 3 + 1] = y;
            posiciones[i * 3 + 2] = z;
            datos.push({ x, y, z, fase: rand() * Math.PI * 2, vel: 0.25 + rand() * 0.5 });
        }
        geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
        const puntos = new THREE.Points(geo, new THREE.PointsMaterial({
            map: texturaParticula(tonos[0], 'rgba(255,255,255,0)'),
            color: tonos[1] || tonos[0],
            size: bioma === 'extincion' ? 0.24 : 0.17,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            sizeAttenuation: true
        }));
        puntos.frustumCulled = false;
        grupo.add(puntos);
        this.motes.push({ puntos, datos, centroX });
    }

    _actualizarMotes(tiempo) {
        for (const mota of this.motes) {
            const arr = mota.puntos.geometry.attributes.position.array;
            mota.datos.forEach((d, i) => {
                arr[i * 3] = d.x + Math.sin(tiempo * 0.22 + d.fase) * 1.6;
                arr[i * 3 + 1] = d.y + Math.sin(tiempo * 0.31 + d.fase * 1.7) * 0.7;
                arr[i * 3 + 2] = d.z + Math.cos(tiempo * 0.18 + d.fase * 0.6) * 1.4;
            });
            mota.puntos.geometry.attributes.position.needsUpdate = true;
        }
    }

    /* ------------------------------------------------------------ RELIEVE */
    // Montañas y volcán llegan como GLB (ver créditos). Se cargan antes de
    // armar las paradas para poder clonarlos; si fallan, queda el respaldo
    // procedural de cada pieza.
    async _cargarRelieve() {
        const loader = new GLTFLoader();
        const cargas = [
            ['volcan', './models/volcan.glb'],
            ['montanas', './models/montanas.glb'],
            ['montanas2', './models/montanas2.glb']
        ];
        await Promise.all(cargas.map(async ([clave, archivo]) => {
            try {
                const gltf = await loader.loadAsync(archivo);
                gltf.scene.traverse((hijo) => {
                    if (!hijo.isMesh) return;
                    hijo.castShadow = false;
                    hijo.receiveShadow = false;
                    const mats = Array.isArray(hijo.material) ? hijo.material : [hijo.material];
                    for (const mat of mats) {
                        if (!mat) continue;
                        // Vienen de FBX: demasiado metálicos, con brillo plástico
                        // y colores lavados que no combinan con el valle.
                        mat.metalness = 0;
                        mat.roughness = 1;
                        if (!mat.color) continue;
                        if (clave === 'volcan') {
                            mat.color.set('#8d7d6e');
                        } else if (/snow/i.test(mat.name)) {
                            mat.color.set('#6f6653');
                        } else if (/dirt/i.test(mat.name)) {
                            mat.color.set('#332619');
                        } else {
                            mat.color.set('#5b5244');
                        }
                    }
                });
                this.modelos[clave] = gltf.scene;
            } catch (error) {
                console.warn(`No se pudo cargar ${archivo}, se usa la versión procedural.`, error);
            }
        }));
    }

    // Clona un GLB y lo deja apoyado en y = 0, centrado en x/z y con el alto pedido.
    _instancia(modelo, alto) {
        const copia = modelo.clone(true);
        copia.updateWorldMatrix(true, true);
        const tam = new THREE.Box3().setFromObject(copia).getSize(new THREE.Vector3());
        copia.scale.multiplyScalar(alto / Math.max(tam.y, 0.0001));
        copia.updateWorldMatrix(true, true);
        const caja = new THREE.Box3().setFromObject(copia);
        const centro = caja.getCenter(new THREE.Vector3());
        copia.position.x -= centro.x;
        copia.position.z -= centro.z;
        copia.position.y -= caja.min.y;
        return copia;
    }

    // Cordilleras de fondo: los grupos de montañas se encadenan en dos frentes
    // para formar una pared continua de picos detrás del valle.
    _crearCordilleras() {
        const modelos = [this.modelos.montanas, this.modelos.montanas2].filter(Boolean);
        if (!modelos.length) return;

        const azar = aleatorioSembrado(0x51e11a);
        const centro = new THREE.Vector3();
        const volcanes = this.volcanes.map((volcan) => {
            volcan.grupo.getWorldPosition(centro);
            return { x: centro.x, z: centro.z };
        });

        const paso = this.calidadAlta ? 40 : 56;
        let puestas = 0;
        for (let base = -150; base < 520; base += paso) {
            for (const lado of [-1, 1]) {
                if (azar() < 0.22) continue;
                const x = base + (azar() - 0.5) * 26;
                const z = lado * (112 + azar() * 30);
                const alto = 20 + Math.pow(azar(), 1.4) * 26;
                if (volcanes.some((p) => Math.hypot(x - p.x, z - p.z) < 54)) continue;

                const copia = this._instancia(modelos[puestas % modelos.length], alto);

                // Cada macizo con su propio tono para que no se note el clonado.
                const tono = 0.82 + azar() * 0.26;
                copia.traverse((hijo) => {
                    if (!hijo.isMesh) return;
                    const mats = Array.isArray(hijo.material) ? hijo.material : [hijo.material];
                    const propios = mats.map((mat) => {
                        const propio = mat.clone();
                        if (propio.color) propio.color.multiplyScalar(tono);
                        return propio;
                    });
                    hijo.material = propios.length === 1 ? propios[0] : propios;
                });

                copia.rotation.y = azar() * Math.PI * 2;
                copia.position.set(x, this._alturaTerreno(x, z) - alto * 0.22, z);
                this.escena.add(copia);
                puestas++;
            }
        }
    }

    /* ------------------------------------------------------------- VOLCAN */
    // Cono volcánico low-poly (Poly by Google, CC-BY) con la lava, el
    // resplandor y el humo animados por código. Si el GLB no está, se arma
    // un cono procedural para que la escena nunca quede sin volcán.
    _crearVolcan(grupo, x, z, escala, tipo) {
        const volcan = new THREE.Group();
        const alto = 22 * escala;
        const modelo = this.modelos.volcan;

        volcan.position.set(
            x,
            this._alturaTerreno(grupo.position.x + x, z) - 0.6 * escala,
            z
        );

        const radioCima = 2.9 * escala;

        if (modelo) {
            const copia = this._instancia(modelo, alto);
            copia.traverse((hijo) => {
                if (!hijo.isMesh) return;
                hijo.castShadow = false;
                hijo.receiveShadow = false;
            });
            volcan.add(copia);
        } else {
            const radioBase = 19 * escala;
            const lados = 11;

            const cuerpo = new THREE.Mesh(
                new THREE.CylinderGeometry(radioCima, radioBase, alto, lados, 3),
                material('#4a3a34')
            );
            cuerpo.position.y = alto / 2;
            cuerpo.castShadow = true;
            cuerpo.receiveShadow = true;
            volcan.add(cuerpo);

            const estrato = new THREE.Mesh(
                new THREE.CylinderGeometry(radioCima * 0.62, radioBase * 0.72, alto * 0.58, lados, 1),
                material('#5a463d')
            );
            estrato.position.y = alto * 0.71;
            estrato.castShadow = true;
            volcan.add(estrato);

            const crater = new THREE.Mesh(
                new THREE.CylinderGeometry(radioCima * 0.98, radioCima * 0.45, 1.6 * escala, lados, 1, true),
                material('#2b211d', { side: THREE.DoubleSide })
            );
            crater.position.y = alto - 0.8 * escala;
            volcan.add(crater);

            const labio = new THREE.Mesh(
                new THREE.TorusGeometry(radioCima * 0.99, 0.55 * escala, 5, lados),
                material('#3a2d27')
            );
            labio.rotation.x = Math.PI / 2;
            labio.position.y = alto;
            volcan.add(labio);
        }

        // Lava líquida en el cráter. En el GLB la cima es una meseta plana:
        // la laguna se apoya arriba para que se vea desde el camino.
        const lava = new THREE.Mesh(
            new THREE.CircleGeometry(modelo ? alto * 0.15 : radioCima * 0.55, 18),
            new THREE.MeshBasicMaterial({ color: tipo === 'extincion' ? '#ff5a2a' : '#ff7a30' })
        );
        lava.rotation.x = -Math.PI / 2;
        lava.position.y = modelo ? alto * 1.002 : alto * 0.955;
        volcan.add(lava);

        const resplandor = new THREE.PointLight(0xff6a2a, 22 * escala, 95 * escala, 2);
        resplandor.position.y = alto * 1.05;
        volcan.add(resplandor);

        // Halo aditivo en la boca del cráter: se ve desde lejos.
        const brillo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: texturaParticula('rgba(255,186,110,0.95)', 'rgba(255,92,24,0)'),
            color: '#ffb066',
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            opacity: 0.5
        }));
        brillo.scale.setScalar(alto * 0.42);
        brillo.userData.base = alto * 0.42;
        brillo.position.y = alto * 1.06;
        volcan.add(brillo);

        grupo.add(volcan);
        this.volcanes.push({ grupo: volcan, lava, resplandor, brillo, fase: Math.random() * 6 });

        // Humo que sube desde el cráter
        this._crearHumo(volcan, 0, alto * 1.01, 0, 34, '#8a7a72');
    }

    _crearHumo(padre, x, y, z, cantidad, color) {
        const textura = texturaParticula('rgba(220,210,200,0.75)', 'rgba(200,190,180,0)');
        const geo = new THREE.BufferGeometry();
        const posiciones = new Float32Array(cantidad * 3);
        const datos = [];
        for (let i = 0; i < cantidad; i++) {
            datos.push({
                x: x + (Math.random() - 0.5) * 3,
                y: y + Math.random() * 4,
                z: z + (Math.random() - 0.5) * 3,
                vel: 1.2 + Math.random() * 1.8,
                desvio: (Math.random() - 0.5) * 0.6,
                escala: 4 + Math.random() * 6
            });
        }
        geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
        const puntos = new THREE.Points(geo, new THREE.PointsMaterial({
            map: textura,
            color,
            size: 9,
            transparent: true,
            opacity: 0.32,
            depthWrite: false,
            sizeAttenuation: true,
            fog: true
        }));
        puntos.frustumCulled = false;
        padre.add(puntos);
        this.humos.push({ puntos, datos, base: y, altura: 26 });
    }

    _crearCeniza(grupo) {
        const cantidad = this.calidadAlta ? 220 : 110;
        const textura = texturaParticula('rgba(255,190,150,0.9)', 'rgba(255,120,80,0)');
        const geo = new THREE.BufferGeometry();
        const posiciones = new Float32Array(cantidad * 3);
        const datos = [];
        for (let i = 0; i < cantidad; i++) {
            datos.push({
                x: (Math.random() - 0.5) * 60,
                y: Math.random() * 24,
                z: (Math.random() - 0.5) * 50,
                vel: 0.3 + Math.random() * 0.9,
                fase: Math.random() * 6.28
            });
        }
        geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
        const puntos = new THREE.Points(geo, new THREE.PointsMaterial({
            map: textura,
            color: '#ffb28a',
            size: 0.55,
            transparent: true,
            opacity: 0.65,
            depthWrite: false,
            sizeAttenuation: true
        }));
        puntos.frustumCulled = false;
        grupo.add(puntos);
        this.ceniza = { puntos, datos };
    }

    _crearAsteroide(grupo) {
        const asteroide = new THREE.Group();
        asteroide.position.set(26, 52, -46);

        const roca = new THREE.Mesh(
            new THREE.DodecahedronGeometry(2.6, 1),
            new THREE.MeshStandardMaterial({
                color: '#6b5a52', emissive: '#ff5a2a', emissiveIntensity: 0.55,
                roughness: 0.9, flatShading: true
            })
        );
        asteroide.add(roca);

        const estela = new THREE.Mesh(
            new THREE.ConeGeometry(2.1, 26, 8, 1, true),
            new THREE.MeshBasicMaterial({
                color: '#ff7a3a', transparent: true, opacity: 0.5,
                side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
            })
        );
        estela.position.set(-5, 12, 5);
        estela.rotation.z = 0.6;
        estela.rotation.x = -0.5;
        asteroide.add(estela);

        const luz = new THREE.PointLight(0xff6a3a, 30, 160, 2);
        asteroide.add(luz);

        grupo.add(asteroide);
        this.asteroide = { grupo: asteroide, roca, estela, luz };
    }

    _crearPterosaurios(grupo, cantidad, altura) {
        for (let i = 0; i < cantidad; i++) {
            const ptero = crearPterosaurio({
                envergadura: 5 + Math.random() * 2,
                color: i % 2 ? '#8a7460' : '#7c6852',
                fase: Math.random() * 6.28
            });
            ptero.position.set((Math.random() - 0.5) * 20, altura + Math.random() * 8, (Math.random() - 0.5) * 20);
            grupo.add(ptero);
            this.pajaros.push({
                grupo: ptero,
                centro: new THREE.Vector3((Math.random() - 0.5) * 10, altura + Math.random() * 5, 0),
                radio: 16 + Math.random() * 14,
                altura: altura + Math.random() * 6,
                velocidad: 0.08 + Math.random() * 0.06,
                fase: Math.random() * 6.28,
                aleteo: 1
            });
        }
    }

    _crearPajaros(grupo, cantidad) {
        for (let i = 0; i < cantidad; i++) {
            const ave = crearAve({
                escala: 0.9 + Math.random() * 0.6,
                color: i % 2 ? '#3d4a5c' : '#4a4038',
                fase: Math.random() * 6.28
            });
            grupo.add(ave);
            this.pajaros.push({
                grupo: ave,
                centro: new THREE.Vector3(0, 0, 0),
                radio: 12 + Math.random() * 16,
                altura: 9 + Math.random() * 9,
                velocidad: 0.14 + Math.random() * 0.1,
                fase: Math.random() * 6.28,
                aleteo: 1
            });
        }
    }

    /* --------------------------------------------------------------- JEEP */
    _crearJeep() {
        const grupo = new THREE.Group();
        const verde = '#5d6b3a';
        const verdeOscuro = '#414d2b';
        const negro = '#262622';
        const metal = '#8c8c80';

        const chasis = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.45, 2.0), material(verde));
        chasis.position.y = 1.0;
        chasis.castShadow = true;
        grupo.add(chasis);

        const capo = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 1.9), material(verde));
        capo.position.set(1.45, 1.28, 0);
        capo.castShadow = true;
        grupo.add(capo);

        const cabina = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.95, 1.85), material(verdeOscuro));
        cabina.position.set(-0.45, 1.68, 0);
        cabina.castShadow = true;
        grupo.add(cabina);

        const techo = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.12, 2.0), material(verdeOscuro));
        techo.position.set(-0.5, 2.2, 0);
        techo.castShadow = true;
        grupo.add(techo);

        const parabrisas = new THREE.Mesh(
            new THREE.BoxGeometry(0.07, 0.78, 1.72),
            new THREE.MeshStandardMaterial({
                color: '#a8d8e0', transparent: true, opacity: 0.42,
                roughness: 0.15, metalness: 0.2
            })
        );
        parabrisas.position.set(0.52, 1.78, 0);
        grupo.add(parabrisas);

        const parrilla = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 1.7), material('#2f2f2a'));
        parrilla.position.set(2.2, 1.12, 0);
        grupo.add(parrilla);

        for (const z of [-0.62, 0.62]) {
            const faro = new THREE.Mesh(
                new THREE.CircleGeometry(0.20, 12),
                new THREE.MeshStandardMaterial({ color: '#fff3c8', emissive: '#ffe9a8', emissiveIntensity: 1.6 })
            );
            faro.position.set(2.23, 1.30, z);
            faro.rotation.y = Math.PI / 2;
            grupo.add(faro);
        }

        // Ruedas
        this.ruedas = [];
        for (const x of [-1.45, 1.45]) {
            for (const z of [-1.05, 1.05]) {
                const rueda = new THREE.Group();
                rueda.position.set(x, 0.56, z);
                const cubierta = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.56, 0.56, 0.44, 14),
                    material(negro)
                );
                cubierta.rotation.x = Math.PI / 2;
                cubierta.castShadow = true;
                rueda.add(cubierta);
                const rin = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.28, 0.28, 0.46, 10),
                    material(metal)
                );
                rin.rotation.x = Math.PI / 2;
                rueda.add(rin);
                grupo.add(rueda);
                this.ruedas.push(rueda);
            }
        }

        // Defensa y roll bar
        const defensa = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 2.1), material(metal));
        defensa.position.set(2.32, 0.9, 0);
        grupo.add(defensa);
        for (const z of [-0.7, 0.7]) {
            const barra = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), material(metal));
            barra.position.set(-1.35, 2.6, z);
            grupo.add(barra);
        }
        const barraSup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), material(metal));
        barraSup.rotation.x = Math.PI / 2;
        barraSup.position.set(-1.35, 3.3, 0);
        grupo.add(barraSup);

        // Antena con banderín
        const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 2.2, 5), material(negro));
        antena.position.set(-1.9, 2.6, 0.85);
        grupo.add(antena);
        const banderin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.04), material('#e08a3c'));
        banderin.position.set(-1.6, 3.5, 0.85);
        grupo.add(banderin);

        // Rueda de repuesto
        const repuesto = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.36, 14), material(negro));
        repuesto.rotation.x = Math.PI / 2;
        repuesto.position.set(-2.18, 1.45, 0);
        grupo.add(repuesto);

        // Faros que iluminan apenas el pasto
        const luzFaros = new THREE.PointLight(0xffe2a8, 6, 18, 2);
        luzFaros.position.set(3.2, 1.2, 0);
        grupo.add(luzFaros);

        grupo.position.copy(this._anclaJeep(0));
        grupo.rotation.y = this._giroHacia(grupo.position, this._objetivo(0));
        this.escena.add(grupo);
        this.jeep = grupo;
    }

    _giroHacia(desde, hasta) {
        return Math.atan2(hasta.z - desde.z, hasta.x - desde.x);
    }

    // Jeep GLB (Zsky, CC-BY). Si no carga, se arma uno procedural.
    async _cargarJeepGLB(alProgreso) {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync('./models/jeep.glb', (xhr) => {
            if (xhr.total) alProgreso(Math.round((xhr.loaded / xhr.total) * 40));
        });
        const modelo = gltf.scene;

        modelo.traverse((hijo) => {
            if (!hijo.isMesh) return;
            hijo.castShadow = this.calidadAlta;
            hijo.receiveShadow = false;
            hijo.frustumCulled = false;
            // El verde del modelo es muy oscuro: lo aclaramos un poco para
            // que se lea con la luz cálida del Mesozoico.
            const mats = Array.isArray(hijo.material) ? hijo.material : [hijo.material];
            for (const mat of mats) {
                if (mat && mat.color && mat.name && /green|gas/i.test(mat.name)) {
                    mat.color.multiplyScalar(1.55);
                }
                if (mat) mat.roughness = Math.min(1, (mat.roughness ?? 1) * 0.95);
            }
        });

        // Centrar en el origen y apoyar las ruedas en y = 0.
        const caja = new THREE.Box3().setFromObject(modelo);
        const centro = caja.getCenter(new THREE.Vector3());
        modelo.position.x -= centro.x;
        modelo.position.z -= centro.z;
        modelo.position.y -= caja.min.y;

        // El modelo mira hacia +Z; el resto del código espera +X.
        const alineado = new THREE.Group();
        alineado.add(modelo);
        alineado.rotation.y = Math.PI / 2;

        const grupo = new THREE.Group();
        grupo.add(alineado);

        // Faros: una luz cálida que apenas ilumina el pasto.
        const luzFaros = new THREE.PointLight(0xffe2a8, 6, 18, 2);
        luzFaros.position.set(3.2, 1.2, 0);
        grupo.add(luzFaros);

        grupo.position.copy(this._anclaJeep(0));
        grupo.rotation.y = this._giroHacia(grupo.position, this._objetivo(0));
        this.escena.add(grupo);
        this.jeep = grupo;
        this.jeepGLB = true;
        this.jeepCuerpo = alineado;
        this.ruedas = [];
    }

    async cargarVehiculo(alProgreso = () => {}) {
        try {
            await this._cargarJeepGLB(alProgreso);
        } catch (error) {
            console.warn('No se pudo cargar jeep.glb, se usa el jeep procedural.', error);
            this._crearJeep();
        }

        // Dinosaurios animados (Quaternius, CC0). El jeep ocupa 0-40 % del
        // progreso y los modelos se reparten el resto. Si alguno falla, esa
        // parada sigue funcionando con su versión procedural.
        const dinos = this._listaDinos();
        const desde = 40;
        const tramo = 60 / dinos.length;

        for (let i = 0; i < dinos.length; i++) {
            const dino = dinos[i];
            const base = desde + i * tramo;
            try {
                const loader = new GLTFLoader();
                const gltf = await loader.loadAsync(dino.archivo, (xhr) => {
                    if (xhr.total) {
                        alProgreso(Math.round(base + (xhr.loaded / xhr.total) * tramo));
                    }
                });
                this._colocarDino(dino, gltf);
            } catch (error) {
                console.warn(`No se pudo cargar ${dino.archivo}, se usa la versión procedural.`, error);
                this._colocarRespaldo(dino);
            }
        }

        alProgreso(100);
        return true;
    }

    // Catálogo de modelos animados. "giro" ya incluye el -90° que necesita
    // el pack (los modelos miran hacia +Z y la escena hacia +X). "puestos"
    // permite repetir el mismo GLB clonándolo, sin sumar peso.
    _listaDinos() {
        const lado = -Math.PI / 2;
        return [
            {
                clave: 'trex',
                archivo: './models/trex.glb',
                parada: 'cretacico',
                largo: 12,
                animacion: 'idle',
                puestos: [{ x: -2, z: -6, giro: lado + 0.35 }],
                respaldo: () => crearBipedo({
                    largo: 12, alto: 4.6, color: '#6a5a48', vientre: '#c2ad84',
                    cresta: '#8a3f33', fase: 0.8
                })
            },
            {
                clave: 'estegosaurio',
                archivo: './models/stegosaurus.glb',
                parada: 'jurasico',
                largo: 9,
                animacion: 'idle',
                puestos: [{ x: 14, z: 9, giro: lado + 0.48 }],
                respaldo: () => crearEstegosaurio({
                    largo: 9, alto: 3.4, color: '#7a7a4e', placas: '#b05f3c', fase: 3.3
                })
            },
            {
                clave: 'triceratops',
                archivo: './models/triceratops.glb',
                parada: 'cretacico',
                largo: 9,
                animacion: 'idle',
                puestos: [{ x: 6, z: -12, giro: lado + 0.45 }],
                respaldo: () => crearTriceratops({
                    largo: 9, alto: 3.3, color: '#8a7350', escudo: '#ab8a5e', fase: 0.7
                })
            },
            {
                clave: 'parasaurolophus',
                archivo: './models/parasaurolophus.glb',
                parada: 'cretacico',
                largo: 9.5,
                animacion: 'idle',
                puestos: [{ x: -8, z: 2, giro: lado + 0.65 }],
                respaldo: () => crearBipedo({
                    largo: 10, alto: 4.4, color: '#5f7a6a', vientre: '#bcc9a8',
                    cresta: '#c4553c', fase: 4.4
                })
            },
            {
                // Manada: un GLB y tres clones. Patrullan en círculos lentos
                // para que la parada no se vea congelada.
                clave: 'velociraptor',
                archivo: './models/velociraptor.glb',
                parada: 'cretacico',
                largo: 2.2,
                animacion: 'walk',
                puestos: [
                    { x: -2, z: 8, giro: lado + 0.4, patrulla: { radio: 1.4, velocidad: 0.22, fase: 0 } },
                    { x: -5, z: 10.5, giro: lado - 1.1, patrulla: { radio: 1.5, velocidad: 0.26, fase: 2.4 } },
                    { x: 1, z: 11, giro: lado + 1.9, patrulla: { radio: 1.2, velocidad: 0.19, fase: 4.1 } }
                ],
                respaldo: () => crearBipedo({
                    largo: 2.6, alto: 1.3, color: '#7c5b42', vientre: '#c9b48a', fase: 1.7
                })
            }
        ];
    }

    // Normaliza un GLB del pack: escala al largo pedido, lo apoya en el
    // suelo y corrige los materiales. Vienen con skinning, así que Box3
    // necesita "precise" o mide el hueso en bind pose y deja todo diminuto.
    _prepararDino(modelo, largo) {
        const medir = () => {
            modelo.updateMatrixWorld(true);
            return new THREE.Box3().setFromObject(modelo, true);
        };

        const tamano = medir().getSize(new THREE.Vector3());
        modelo.scale.multiplyScalar(largo / Math.max(tamano.x, tamano.z));

        const caja = medir();
        const centro = caja.getCenter(new THREE.Vector3());
        modelo.position.x -= centro.x;
        modelo.position.z -= centro.z;
        modelo.position.y -= caja.min.y;

        modelo.traverse((hijo) => {
            if (!hijo.isMesh) return;
            hijo.castShadow = this.calidadAlta;
            hijo.frustumCulled = false;
            // El GLB trae metalness 0.4 y sin entorno se ve casi negro.
            const mats = Array.isArray(hijo.material) ? hijo.material : [hijo.material];
            for (const mat of mats) {
                if (!mat) continue;
                mat.metalness = 0;
                mat.roughness = 0.85;
            }
        });

        return modelo;
    }

    _colocarDino(dino, gltf) {
        const grupo = this.paradas[dino.parada];
        if (!grupo) return;

        dino.puestos.forEach((puesto, indice) => {
            // Siempre se clona el original intacto: así el segundo puesto no
            // hereda la escala ni el desplazamiento del primero.
            const modelo = this._prepararDino(clonarEsqueleto(gltf.scene), dino.largo);

            const contenedor = new THREE.Group();
            contenedor.position.set(
                puesto.x,
                this._alturaTerreno(grupo.position.x + puesto.x, puesto.z),
                puesto.z
            );
            contenedor.rotation.y = puesto.giro;
            contenedor.add(modelo);
            grupo.add(contenedor);

            // Desfasa el ciclo de cada copia para que no se muevan al unísono.
            this._animarDino(gltf, modelo, dino.animacion, indice * 0.37);

            if (puesto.patrulla) {
                this.manadas.push({
                    objeto: contenedor,
                    centro: contenedor.position.clone(),
                    baseX: grupo.position.x,
                    ...puesto.patrulla
                });
            }

            this.dinos.push({ clave: dino.clave, objeto: contenedor });
        });
    }

    _animarDino(gltf, modelo, nombre = 'idle', desfase = 0) {
        if (!gltf.animations.length) return null;
        const mixer = new THREE.AnimationMixer(modelo);
        const clip = gltf.animations.find((a) => new RegExp(nombre, 'i').test(a.name))
            || gltf.animations[0];
        const accion = mixer.clipAction(clip);
        accion.play();
        accion.time = (desfase + Math.random() * 0.5) * clip.duration;
        this.mixers.push(mixer);
        return { mixer, accion };
    }

    _colocarRespaldo(dino) {
        const grupo = this.paradas[dino.parada];
        if (!grupo || !dino.respaldo) return;
        for (const puesto of dino.puestos) {
            const objeto = dino.respaldo();
            objeto.position.set(
                puesto.x,
                this._alturaTerreno(grupo.position.x + puesto.x, puesto.z),
                puesto.z
            );
            // Las criaturas procedurales miran hacia +X: se les resta el
            // cuarto de vuelta que sí necesitan los GLB.
            objeto.rotation.y = puesto.giro + Math.PI / 2;
            grupo.add(objeto);
            if (objeto.userData.animar) this.criaturas.push(objeto);
        }
    }

    /* --------------------------------------------------------- ENCUADRE */
    _camaraPara(idx) {
        const cuerpo = this.cuerpos[idx];
        const cfg = ENCUADRE[cuerpo ? cuerpo.id : 'triasico'] || ENCUADRE.triasico;
        return new THREE.Vector3(
            cuerpo.pos.x + cfg.dist * 0.60,
            cfg.alto,
            cfg.dist * 0.80
        );
    }

    _objetivo(idx) {
        const cuerpo = this.cuerpos[idx];
        const cfg = ENCUADRE[cuerpo ? cuerpo.id : 'triasico'] || ENCUADRE.triasico;
        return new THREE.Vector3(cuerpo.pos.x, cfg.mira, 0);
    }

    _anclaJeep(idx) {
        const cuerpo = this.cuerpos[idx] || this.cuerpos[0];
        const cfg = ENCUADRE[cuerpo.id] || ENCUADRE.triasico;
        const objetivo = new THREE.Vector3(cuerpo.pos.x, 0, 0);
        const camara = new THREE.Vector3(cuerpo.pos.x + cfg.dist * 0.60, 0, cfg.dist * 0.80);
        const adelante = objetivo.clone().sub(camara).normalize();
        const derecha = new THREE.Vector3().crossVectors(adelante, UP).normalize();
        const punto = objetivo
            .addScaledVector(derecha, cfg.dist * 0.21)
            .addScaledVector(adelante, -cfg.dist * 0.20);
        punto.y = 0;
        return punto;
    }

    /* ---------------------------------------------------------- PALETAS */
    _aplicarPaleta(idx, instantaneo = false) {
        const cuerpo = this.cuerpos[idx];
        const paleta = PALETAS[cuerpo ? cuerpo.id : 'triasico'] || PALETAS.triasico;
        this.paletaDestino = paleta;
        this.intensidadDestino = paleta.intensidad;
        this.coberturaDestino = paleta.cobertura;

        // El asteroide solo se ve en la parada de la extinción: a lo lejos su
        // estela aditiva se ve como una raya blanca sobre el cielo.
        if (this.asteroide) {
            this.asteroide.grupo.visible = cuerpo ? cuerpo.id === 'extincion' : false;
        }

        if (instantaneo) {
            this.mezcla.arriba.set(paleta.arriba);
            this.mezcla.abajo.set(paleta.abajo);
            this.mezcla.niebla.set(paleta.niebla);
            this.mezcla.sol.set(paleta.sol);
            this.mezcla.cieloHemi.set(paleta.cieloHemi);
            this.mezcla.sueloHemi.set(paleta.sueloHemi);
            this.mezcla.nube.set(paleta.nube);
            this.uniformesCielo.cobertura.value = paleta.cobertura;
            this._volcarPaleta();
        }

        // La luz de sombras acompaña a la parada para no perder resolución.
        const objetivo = this._objetivo(idx);
        this.luzSol.target.position.copy(objetivo);
        this.luzSol.position.set(objetivo.x + 55, 95, objetivo.z + 42);
    }

    _volcarPaleta() {
        this.escena.background.copy(this.mezcla.niebla);
        this.escena.fog.color.copy(this.mezcla.niebla);
        this.uniformesCielo.arriba.value.copy(this.mezcla.arriba);
        this.uniformesCielo.abajo.value.copy(this.mezcla.abajo);
        this.uniformesCielo.nube.value.copy(this.mezcla.nube);
        this.uniformesCielo.sol.value.copy(this.mezcla.sol);
        this.luzSol.color.copy(this.mezcla.sol);
        this.hemi.color.copy(this.mezcla.cieloHemi);
        this.hemi.groundColor.copy(this.mezcla.sueloHemi);
    }

    _actualizarPaleta(delta) {
        const paleta = this.paletaDestino;
        const k = Math.min(1, delta * 2.2);
        this.mezcla.arriba.lerp(new THREE.Color(paleta.arriba), k);
        this.mezcla.abajo.lerp(new THREE.Color(paleta.abajo), k);
        this.mezcla.niebla.lerp(new THREE.Color(paleta.niebla), k);
        this.mezcla.sol.lerp(new THREE.Color(paleta.sol), k);
        this.mezcla.cieloHemi.lerp(new THREE.Color(paleta.cieloHemi), k);
        this.mezcla.sueloHemi.lerp(new THREE.Color(paleta.sueloHemi), k);
        this.mezcla.nube.lerp(new THREE.Color(paleta.nube), k);
        this.uniformesCielo.cobertura.value +=
            (this.coberturaDestino - this.uniformesCielo.cobertura.value) * k;
        this.luzSol.intensity += (this.intensidadDestino - this.luzSol.intensity) * k;
        this._volcarPaleta();
    }

    /* ---------------------------------------------------------------- POLVO */
    _crearPolvo() {
        const cantidad = this.calidadAlta ? 90 : 45;
        const textura = texturaParticula('rgba(214,186,148,0.85)', 'rgba(214,186,148,0)');
        const geo = new THREE.BufferGeometry();
        const posiciones = new Float32Array(cantidad * 3);
        for (let i = 0; i < cantidad; i++) posiciones[i * 3 + 1] = -999;
        geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
        const puntos = new THREE.Points(geo, new THREE.PointsMaterial({
            map: textura,
            color: '#d6ba94',
            size: 1.6,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            sizeAttenuation: true
        }));
        puntos.frustumCulled = false;
        this.escena.add(puntos);
        this.polvo = {
            puntos,
            datos: Array.from({ length: cantidad }, () => ({ vida: 0, vx: 0, vy: 0, vz: 0 })),
            cursor: 0
        };
    }

    _emitirPolvo(cantidad) {
        if (!this.jeep || !this.polvo) return;
        const arr = this.polvo.puntos.geometry.attributes.position.array;
        for (let i = 0; i < cantidad; i++) {
            const idx = this.polvo.cursor;
            this.polvo.cursor = (this.polvo.cursor + 1) % this.polvo.datos.length;
            const d = this.polvo.datos[idx];
            d.vida = 1.1 + Math.random() * 0.6;
            d.vx = (Math.random() - 0.5) * 2.4;
            d.vy = 0.9 + Math.random() * 1.2;
            d.vz = (Math.random() - 0.5) * 2.4;
            const atras = new THREE.Vector3(Math.cos(this.jeep.rotation.y), 0, -Math.sin(this.jeep.rotation.y));
            arr[idx * 3] = this.jeep.position.x - atras.x * 2.4 + (Math.random() - 0.5);
            arr[idx * 3 + 1] = 0.35;
            arr[idx * 3 + 2] = this.jeep.position.z - atras.z * 2.4 + (Math.random() - 0.5);
        }
        this.polvo.puntos.geometry.attributes.position.needsUpdate = true;
    }

    _actualizarPolvo(delta) {
        const arr = this.polvo.puntos.geometry.attributes.position.array;
        this.polvo.datos.forEach((d, i) => {
            if (d.vida <= 0) return;
            d.vida -= delta;
            arr[i * 3] += d.vx * delta;
            arr[i * 3 + 1] += d.vy * delta;
            arr[i * 3 + 2] += d.vz * delta;
            if (d.vida <= 0) arr[i * 3 + 1] = -999;
        });
        this.polvo.puntos.geometry.attributes.position.needsUpdate = true;
    }

    /* -------------------------------------------------------------- VIAJES */
    irA(idx, { duracion = 2.8, intro = false } = {}) {
        if (!this.cuerpos.length) return;
        idx = Math.max(0, Math.min(this.cuerpos.length - 1, idx));
        const destinoCam = this._camaraPara(idx);
        const destinoObjetivo = this._objetivo(idx);
        const destinoAncla = this._anclaJeep(idx);
        const destinoU = this.uParada ? this.uParada[idx] : 0;

        let origenCam = this.camara.position.clone();
        let origenObjetivo = this.controles.target.clone();
        let origenU = this.jeepU;
        let dur = duracion;
        let tipo = 'normal';

        if (intro) {
            // El jeep arranca fuera del campamento y entra por el camino.
            const inicio = this._puntoCamino(U_INTRO_INICIO);
            const dir = this._marcoCamino(U_INTRO_INICIO).adelante;
            const derecha = this._marcoCamino(U_INTRO_INICIO).lateral;
            origenU = U_INTRO_INICIO;
            this.jeepU = U_INTRO_INICIO;
            if (this.jeep) {
                this.jeep.position.copy(inicio);
                this.jeep.rotation.y = Math.atan2(dir.z, dir.x);
            }
            origenCam = inicio.clone()
                .addScaledVector(dir, -16.5)
                .addScaledVector(derecha, 2.6)
                .add(new THREE.Vector3(0, 6.4, 0));
            origenObjetivo = inicio.clone().addScaledVector(dir, 13).add(new THREE.Vector3(0, 2.4, 0));
            this.camara.position.copy(origenCam);
            this.controles.target.copy(origenObjetivo);
            tipo = 'intro';
            dur = 9.5;
        } else {
            // Cuanto más lejos el destino, más dura el viaje.
            dur = Math.max(dur, 2.4 + Math.abs(idx - this.destinoActual) * 0.35);
        }

        this.contadorVuelos++;
        this.vuelo = {
            id: this.contadorVuelos,
            t0: performance.now(),
            dur: Math.max(0.001, dur),
            origenCam,
            destinoCam,
            origenObjetivo,
            destinoObjetivo,
            origenU,
            destinoU,
            destinoAncla,
            intro,
            tipo
        };
        this.destinoActual = idx;
        this.controles.enabled = false;
        if (intro) this.introActiva = true;
        this._aplicarPaleta(idx);
        this.opciones.alCambiarParada(idx);
        this.opciones.alIniciarVuelo(idx, intro);
    }

    saltarIntro() {
        if (!this.introActiva) return;
        this.vuelo = null;
        this.introActiva = false;
        const cuerpo = this.cuerpos[this.destinoActual];
        this.camara.position.copy(this._camaraPara(this.destinoActual));
        this.controles.target.copy(this._objetivo(this.destinoActual));
        this.controles.enabled = true;
        if (this.jeep) {
            this.jeep.position.copy(this._anclaJeep(this.destinoActual));
            this.jeep.rotation.y = this._giroHacia(this.jeep.position, this._objetivo(this.destinoActual));
        }
        this.jeepU = this.uParada[this.destinoActual];
        this._aplicarPaleta(this.destinoActual, true);
        this.opciones.alSaltarIntro();
        this.opciones.alLlegar(this.destinoActual);
    }

    _actualizarVuelo(ahora, delta) {
        const v = this.vuelo;
        if (!v) {
                return;
        }
        const k = clamp01((ahora - v.t0) / (v.dur * 1000));

        if (v.tipo === 'intro') {
            // Fase 1 (0 → 0.70): el jeep entra al valle y esquiva obstáculos.
            // Fase 2 (0.70 → 1): la cámara se abre y encuadra el campamento.
            const e = easeInOutCubic(clamp01((k - 0.02) / 0.68));
            const u = v.origenU + (v.destinoU - v.origenU) * e;
            this.jeepU = u;

            const { punto, lateral } = this._marcoCamino(u);

            // Tres volantazos suaves. El seno vale +1, -1 y +1 en 1/6, 1/2 y
            // 5/6 del recorrido: justo donde están las rocas y el tronco.
            const volantazo = Math.sin(e * Math.PI * 3) * 2.1;
            const posicion = punto.clone().addScaledVector(lateral, volantazo);

            // Dirección real de avance: tangente + deriva del volantazo.
            const eAhead = Math.min(1, e + 0.012);
            const uAhead = v.origenU + (v.destinoU - v.origenU) * eAhead;
            const marcoAhead = this._marcoCamino(uAhead);
            const posAhead = marcoAhead.punto.clone()
                .addScaledVector(marcoAhead.lateral, Math.sin(eAhead * Math.PI * 3) * 2.1);
            const direccion = posAhead.sub(posicion).setY(0).normalize();

            // Al final se acomoda en el anclaje del campamento.
            const asentar = easeInOutCubic(clamp01((k - 0.66) / 0.30));
            posicion.lerp(v.destinoAncla, asentar);
            const dirFinal = v.destinoObjetivo.clone().sub(v.destinoAncla).setY(0).normalize();
            const dirMezcla = direccion.clone().lerp(dirFinal, asentar).normalize();

            if (this.jeep) {
                this.jeep.position.copy(posicion);
                this.jeep.rotation.y = Math.atan2(dirMezcla.z, dirMezcla.x);
            }

            // Tierra levantada por las ruedas durante la entrada.
            if (k < 0.78) this._emitirPolvo(2);
    
            // Cámara persecución baja, con un pequeño traqueteo de safari.
            const sacudida = Math.sin(u * 9.5) * 0.09 + Math.sin(u * 21) * 0.04;
            const camPersecucion = posicion.clone()
                .addScaledVector(direccion, -16.5)
                .addScaledVector(lateral, 2.6)
                .add(new THREE.Vector3(0, 6.4 + sacudida, 0));
            const objPersecucion = posicion.clone()
                .addScaledVector(direccion, 13)
                .add(new THREE.Vector3(0, 2.4, 0));

            const mezcla = easeInOutCubic(clamp01((k - 0.70) / 0.26));
            this.camara.position.lerpVectors(camPersecucion, v.destinoCam, mezcla);
            this.controles.target.lerpVectors(objPersecucion, v.destinoObjetivo, mezcla);

            if (k >= 1) {
                this._terminarVuelo(v);
            } else {
                this.introActiva = true;
            }
            return;
        }

        const e = easeInOutCubic(k);

        this.camara.position.lerpVectors(v.origenCam, v.destinoCam, e);
        this.camara.position.y += Math.sin(Math.PI * k) * 5.5;
        this.controles.target.lerpVectors(v.origenObjetivo, v.destinoObjetivo, e);

        if (this.jeep) {
            const u = v.origenU + (v.destinoU - v.origenU) * e;
            this.jeepU = u;
            const punto = this._puntoCamino(u);
            const adelante = this._puntoCamino(Math.min(1, u + 0.006)).sub(punto).setY(0).normalize();
            const atras = v.destinoU < v.origenU;
            this.jeep.position.copy(punto);
            this.jeep.rotation.y = Math.atan2(adelante.z, adelante.x) + (atras ? Math.PI : 0);
            if (k < 0.96) this._emitirPolvo(2);
        }

        if (k >= 1) this._terminarVuelo(v);
    }

    _terminarVuelo(v) {
        this.vuelo = null;
        this.introActiva = false;
        if (this.jeep) {
            this.jeep.position.copy(v.destinoAncla);
            this.jeep.rotation.y = this._giroHacia(v.destinoAncla, v.destinoObjetivo);
        }
        this.jeepU = v.destinoU;
        this.camara.position.copy(v.destinoCam);
        this.controles.target.copy(v.destinoObjetivo);
        this.controles.enabled = true;
        this.opciones.alLlegar(this.destinoActual);
    }

    /* ---------------------------------------------------------------- TOUR */
    activarTour(activo, intervalo = 9000) {
        this.autoTour = activo;
        clearTimeout(this.temporizadorTour);
        if (!activo) return;
        const paso = () => {
            if (!this.autoTour) return;
            const siguiente = (this.destinoActual + 1) % this.cuerpos.length;
            this.irA(siguiente);
            this.temporizadorTour = setTimeout(paso, intervalo);
        };
        this.temporizadorTour = setTimeout(paso, intervalo);
    }

    /* --------------------------------------------------------- ENCUADRE UI */
    actualizarTamano() {
        const ancho = window.innerWidth;
        const alto = window.innerHeight;
        this.camara.aspect = ancho / alto;

        const panel = document.getElementById('panel');
        const rect = panel ? panel.getBoundingClientRect() : null;
        const panelAbajo = rect ? rect.top > alto * 0.3 : ancho < 900;

        let desplazarX = 0;
        let desplazarY = 0;
        if (!panelAbajo && rect) {
            desplazarX = Math.min(ancho * 0.22, (rect.width + 48) * 0.5);
        } else {
            const altoPanel = rect ? rect.height : alto * 0.4;
            desplazarY = Math.min(alto * 0.2, altoPanel * 0.5);
        }

        if (desplazarX || desplazarY) {
            this.camara.setViewOffset(ancho, alto, -desplazarX, desplazarY, ancho, alto);
        } else {
            this.camara.clearViewOffset();
        }
        this.camara.updateProjectionMatrix();
        this.renderer.setSize(ancho, alto);

        if (this.postUniformes) {
            this.postUniformes.resolucion.value.set(ancho, alto);
        }
    }

    /* ------------------------------------------------------------- ANIMAR */
    animar() {
        requestAnimationFrame(() => this.animar());
        const delta = Math.min(this.reloj.getDelta(), 0.05);
        const tiempo = this.reloj.elapsedTime;
        if (document.hidden) return;

        this._actualizarVuelo(performance.now(), delta);
        this._actualizarPaleta(delta);
        this._actualizarPolvo(delta);
        this._actualizarMotes(tiempo);
        this.uniformesCielo.tiempo.value = tiempo;

        if (this.mixers.length) {
            for (const mixer of this.mixers) mixer.update(delta);
        }

        // La manada de velocirraptores patrulla en círculos lentos.
        for (const manada of this.manadas) {
            const ang = tiempo * manada.velocidad + manada.fase;
            manada.objeto.position.x = manada.centro.x + Math.cos(ang) * manada.radio;
            manada.objeto.position.z = manada.centro.z + Math.sin(ang) * manada.radio;
            manada.objeto.position.y = this._alturaTerreno(
                manada.baseX + manada.objeto.position.x,
                manada.objeto.position.z
            );
            // Mira hacia donde camina (tangente de la circunferencia).
            manada.objeto.rotation.y = -ang;
        }

        for (const criatura of this.criaturas) {
            if (criatura.userData.animar) criatura.userData.animar(tiempo);
        }

        for (const pajaro of this.pajaros) {
            const ang = tiempo * pajaro.velocidad + pajaro.fase;
            pajaro.grupo.position.set(
                pajaro.centro.x + Math.cos(ang) * pajaro.radio,
                pajaro.altura + Math.sin(ang * 2.1) * 1.4,
                pajaro.centro.z + Math.sin(ang) * pajaro.radio
            );
            pajaro.grupo.rotation.y = -ang - Math.PI / 2;
            if (pajaro.grupo.userData.animar) pajaro.grupo.userData.animar(tiempo);
        }

        for (const humo of this.humos) {
            const arr = humo.puntos.geometry.attributes.position.array;
            humo.datos.forEach((d, i) => {
                d.y += d.vel * delta;
                d.x += d.desvio * delta;
                if (d.y > humo.base + humo.altura) {
                    d.y = humo.base;
                    d.x = (Math.random() - 0.5) * 3;
                    d.z = (Math.random() - 0.5) * 3;
                }
                arr[i * 3] = d.x;
                arr[i * 3 + 1] = d.y;
                arr[i * 3 + 2] = d.z;
            });
            humo.puntos.geometry.attributes.position.needsUpdate = true;
        }

        if (this.ceniza) {
            const arr = this.ceniza.puntos.geometry.attributes.position.array;
            this.ceniza.datos.forEach((d, i) => {
                d.y -= d.vel * delta;
                d.x += Math.sin(tiempo * 0.4 + d.fase) * delta * 0.6;
                if (d.y < 0.2) {
                    d.y = 22 + Math.random() * 6;
                    d.x = (Math.random() - 0.5) * 60;
                }
                arr[i * 3] = d.x;
                arr[i * 3 + 1] = d.y;
                arr[i * 3 + 2] = d.z;
            });
            this.ceniza.puntos.geometry.attributes.position.needsUpdate = true;
        }

        if (this.aguaUniformes) {
            this.aguaUniformes.tiempo.value = tiempo;
            this.aguaUniformes.cielo.value.copy(this.mezcla.arriba);
            this.aguaUniformes.sol.value.copy(this.mezcla.sol);
        }

        for (const volcan of this.volcanes) {
            const pulso = 0.85 + Math.sin(tiempo * 1.3 + volcan.fase) * 0.15;
            volcan.resplandor.intensity = 22 * pulso;
            volcan.lava.scale.setScalar(1 + Math.sin(tiempo * 0.9 + volcan.fase) * 0.03);
            if (volcan.brillo) {
                volcan.brillo.material.opacity = 0.34 + pulso * 0.24;
                volcan.brillo.scale.setScalar(volcan.brillo.userData.base * (0.92 + pulso * 0.12));
            }
        }

        if (this.asteroide) {
            const pulso = 0.7 + Math.sin(tiempo * 1.6) * 0.3;
            this.asteroide.estela.material.opacity = 0.35 + pulso * 0.25;
            this.asteroide.luz.intensity = 22 + pulso * 14;
        }

        if (this.ruedas.length) {
            const girando = !!this.vuelo;
            const vel = girando ? (this.vuelo.tipo === 'intro' ? 12 : 7) : 0;
            for (const rueda of this.ruedas) rueda.rotation.z -= vel * delta;
        } else if (this.jeepCuerpo) {
            // El jeep GLB es una sola malla: simulamos el traqueteo del
            // motor con un balanceo suave de la carrocería en movimiento.
            const vel = this.vuelo ? (this.vuelo.tipo === 'intro' ? 1 : 0.6) : 0;
            const t = tiempo * 11;
            this.jeepCuerpo.position.y = Math.sin(t) * 0.05 * vel;
            this.jeepCuerpo.rotation.x = Math.sin(t * 0.5) * 0.015 * vel;
        }

        this.controles.update();
        this.renderer.render(this.escena, this.camara);
        if (this.postActivo !== false) {
            this.renderer.autoClear = false;
            this.postUniformes.tiempo.value = tiempo;
            this.renderer.render(this.postEscena, this.postCamara);
            this.renderer.autoClear = true;
        }
    }
}

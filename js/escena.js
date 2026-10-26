/* =====================================================================
   ESCENA 3D · DINOAVENTURA
   Un valle continuo con cuatro campamentos del Mesozoico. El jeep viaja
   por un camino de tierra y la cámara encuadra cada diorama.
   La interfaz NO se dibuja acá: esta clase solo avisa por callbacks.
   ===================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    configurarCalidad,
    texturaSuelo,
    texturaCamino,
    texturaAgua,
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
        suelo: '#c8a070'
    },
    jurasico: {
        arriba: '#5a9bd8', abajo: '#d8eec0', niebla: '#b6d4a0',
        sol: '#fff6d8', intensidad: 2.9,
        cieloHemi: '#e2f4ff', sueloHemi: '#5a7a45',
        suelo: '#6f9c52'
    },
    cretacico: {
        arriba: '#5e93c4', abajo: '#f4dbaa', niebla: '#d8c298',
        sol: '#fff0c4', intensidad: 2.8,
        cieloHemi: '#fff0d8', sueloHemi: '#8a7a4c',
        suelo: '#a8ae66'
    },
    extincion: {
        arriba: '#2e2540', abajo: '#8a4a3e', niebla: '#57403f',
        sol: '#ff9a6a', intensidad: 1.15,
        cieloHemi: '#96747f', sueloHemi: '#463830',
        suelo: '#786660'
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
        this.volcanes = [];
        this.jeep = null;
        this.ruedas = [];
        this.trex = null;
        this.mixer = null;
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
            sueloHemi: new THREE.Color(PALETAS.triasico.sueloHemi)
        };
        this.paletaDestino = PALETAS.triasico;
        this.intensidadDestino = PALETAS.triasico.intensidad;

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
        this.luzSol.shadow.bias = -0.0006;
        this.luzSol.shadow.normalBias = 0.6;
        this.escena.add(this.luzSol);
        this.escena.add(this.luzSol.target);

        this._crearCielo();
        this._crearPolvo();

        window.addEventListener('resize', () => this.actualizarTamano());
        this.actualizarTamano();
        this.animar();
    }

    /* ------------------------------------------------------------- CIELO */
    _crearCielo() {
        this.uniformesCielo = {
            arriba: { value: this.mezcla.arriba.clone() },
            abajo: { value: this.mezcla.abajo.clone() },
            offset: { value: 30 },
            exponente: { value: 0.72 }
        };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.uniformesCielo,
            vertexShader: `
                varying vec3 vPosicion;
                void main() {
                    vec4 mundo = modelMatrix * vec4(position, 1.0);
                    vPosicion = mundo.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 arriba;
                uniform vec3 abajo;
                uniform float offset;
                uniform float exponente;
                varying vec3 vPosicion;
                void main() {
                    float h = normalize(vPosicion + vec3(0.0, offset, 0.0)).y;
                    float mezcla = pow(max(h, 0.0), exponente);
                    gl_FragColor = vec4(mix(abajo, arriba, mezcla), 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false,
            fog: false
        });
        const cielo = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), mat);
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

        for (let i = 0; i < cuerpos.length; i++) {
            const cuerpo = cuerpos[i];
            alProgreso(`Armando el campamento: ${cuerpo.nombre}`, 0.14 + (i / cuerpos.length) * 0.66);
            await siguienteFrame();
            this._crearParada(cuerpo, i);
        }

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

            registrarCriatura(agregar(crearEstegosaurio({
                largo: 9, alto: 3.4, color: '#7a7a4e', placas: '#b05f3c', fase: 3.3
            }), 14, 9, -0.9));

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

            const agua = new THREE.Mesh(
                new THREE.CircleGeometry(9, 40),
                new THREE.MeshStandardMaterial({
                    map: texturaAgua(),
                    color: '#8fcbd2',
                    transparent: true,
                    opacity: 0.92,
                    roughness: 0.22,
                    metalness: 0.05
                })
            );
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
            // El T. rex llega como modelo animado; acá queda el anclaje.
            this.anclaTrex = new THREE.Vector3(-2, 0, -6);
            this.grupoTrex = grupo;

            registrarCriatura(agregar(crearTriceratops({
                largo: 9, alto: 3.3, color: '#8a7350', escudo: '#ab8a5e', fase: 0.7
            }), 14, -5, -1.4));

            registrarCriatura(agregar(crearAnquilosaurio({
                largo: 8, alto: 2.3, color: '#6f6350', blindaje: '#8d7a5e', fase: 2.9
            }), 9, 8, -0.4));

            registrarCriatura(agregar(crearBipedo({
                largo: 10, alto: 4.4, color: '#5f7a6a', vientre: '#bcc9a8',
                cresta: '#c4553c', fase: 4.4
            }), -16, 7, 0.8));

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

    /* ------------------------------------------------------------- VOLCAN */
    // Cono truncado: la cima queda abierta y el cráter se apoya adentro,
    // así no aparece ningún anillo flotando sobre la montaña.
    _crearVolcan(grupo, x, z, escala, tipo) {
        const volcan = new THREE.Group();
        volcan.position.set(x, 0, z);

        const alto = 24 * escala;
        const radioBase = 19 * escala;
        const radioCima = 2.9 * escala;
        const lados = 11;

        // Falda del volcán: cilindro con la base ancha y la cima angosta.
        const cuerpo = new THREE.Mesh(
            new THREE.CylinderGeometry(radioCima, radioBase, alto, lados, 3),
            material('#4a3a34')
        );
        cuerpo.position.y = alto / 2;
        cuerpo.castShadow = true;
        cuerpo.receiveShadow = true;
        volcan.add(cuerpo);

        // Segunda capa más clara para dar estratos y volumen.
        const estrato = new THREE.Mesh(
            new THREE.CylinderGeometry(radioCima * 0.62, radioBase * 0.72, alto * 0.58, lados, 1),
            material('#5a463d')
        );
        estrato.position.y = alto * 0.71;
        estrato.castShadow = true;
        volcan.add(estrato);

        // Cráter: embudo hundido, apoyado en la cima del cono.
        const crater = new THREE.Mesh(
            new THREE.CylinderGeometry(radioCima * 0.98, radioCima * 0.45, 1.6 * escala, lados, 1, true),
            material('#2b211d', { side: THREE.DoubleSide })
        );
        crater.position.y = alto - 0.8 * escala;
        volcan.add(crater);

        // Labio del cráter: marca el borde y evita que la cima parezca una mesa.
        const labio = new THREE.Mesh(
            new THREE.TorusGeometry(radioCima * 0.99, 0.55 * escala, 5, lados),
            material('#3a2d27')
        );
        labio.rotation.x = Math.PI / 2;
        labio.position.y = alto;
        volcan.add(labio);

        // Lava líquida en el fondo del cráter.
        const lava = new THREE.Mesh(
            new THREE.CircleGeometry(radioCima * 0.50, 18),
            new THREE.MeshBasicMaterial({ color: tipo === 'extincion' ? '#ff5a2a' : '#ff7a30' })
        );
        lava.rotation.x = -Math.PI / 2;
        lava.position.y = alto - 1.5 * escala;
        volcan.add(lava);

        // Un chorro de lava que baja por la ladera.
        const colada = new THREE.Mesh(
            new THREE.ConeGeometry(1.5 * escala, alto * 0.72, 5, 1, true),
            new THREE.MeshBasicMaterial({
                color: '#ff6a2a',
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        colada.position.set(radioCima * 0.4, alto * 0.58, radioCima * 0.5);
        colada.rotation.z = 0.30;
        colada.rotation.x = -0.12;
        volcan.add(colada);

        const resplandor = new THREE.PointLight(0xff6a2a, 14 * escala, 95 * escala, 2);
        resplandor.position.y = alto + 1.2 * escala;
        volcan.add(resplandor);

        grupo.add(volcan);
        this.volcanes.push({ grupo: volcan, lava, colada, resplandor, fase: Math.random() * 6 });

        // Humo que sube desde el cráter
        this._crearHumo(volcan, 0, alto + 0.6 * escala, 0, 34, '#8a7a72');
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
            if (xhr.total) alProgreso(Math.round((xhr.loaded / xhr.total) * 48));
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

        // T. rex animado (Quaternius, CC0). Si falla, la parada sigue
        // funcionando con un tiranosaurio procedural.
        try {
            const loader = new GLTFLoader();
            const gltf = await loader.loadAsync('./models/trex.glb', (xhr) => {
                if (xhr.total) alProgreso(48 + Math.round((xhr.loaded / xhr.total) * 52));
            });
            const modelo = gltf.scene;

            // El T. rex viene con skinning: Box3 tiene que medirlo con
            // "precise" o toma la caja del hueso en bind pose y lo deja
            // diminuto. Normalizamos a 12 m de largo y apoyado en el suelo.
            const medir = () => {
                modelo.updateMatrixWorld(true);
                return new THREE.Box3().setFromObject(modelo, true);
            };

            let caja = medir();
            const tamano = caja.getSize(new THREE.Vector3());
            const escala = 12 / Math.max(tamano.x, tamano.z);
            modelo.scale.multiplyScalar(escala);

            caja = medir();
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

            const contenedor = new THREE.Group();
            contenedor.position.copy(this.anclaTrex);
            // El modelo mira hacia +Z; lo giramos para verlo de perfil.
            contenedor.rotation.y = -Math.PI / 2 + 0.35;
            contenedor.add(modelo);
            this.grupoTrex.add(contenedor);
            this.trex = contenedor;

            if (gltf.animations.length) {
                this.mixer = new THREE.AnimationMixer(modelo);
                const idle = gltf.animations.find((a) => /idle/i.test(a.name)) || gltf.animations[0];
                const accion = this.mixer.clipAction(idle);
                accion.play();
                this.accionTrex = accion;
            }
        } catch (error) {
            console.warn('No se pudo cargar trex.glb, se usa un T. rex procedural.', error);
            const reemplazo = crearBipedo({
                largo: 12, alto: 4.6, color: '#6a5a48', vientre: '#c2ad84',
                cresta: '#8a3f33', fase: 0.8
            });
            reemplazo.position.copy(this.anclaTrex);
            reemplazo.rotation.y = -0.4;
            this.grupoTrex.add(reemplazo);
            this.trex = reemplazo;
            this.criaturas.push(reemplazo);
        }
        return true;
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

        if (this.mixer) this.mixer.update(delta);

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

        if (this.agua) {
            this.agua.material.map.offset.x = tiempo * 0.006;
            this.agua.material.map.offset.y = tiempo * 0.004;
        }

        for (const volcan of this.volcanes) {
            const pulso = 0.85 + Math.sin(tiempo * 1.3 + volcan.fase) * 0.15;
            volcan.resplandor.intensity = 10 * pulso;
            volcan.lava.scale.setScalar(1 + Math.sin(tiempo * 0.9 + volcan.fase) * 0.03);
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
    }
}

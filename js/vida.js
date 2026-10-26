/* =====================================================================
   VIDA DEL MESOZOICO
   Dinosaurios y plantas armados con primitivas (low-poly estilizado).
   Cada criatura expone userData.animar(t) para respirar, mover la cola
   o aletear sin necesidad de animaciones externas.
   ===================================================================== */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------- MATERIALES */
const cacheMateriales = new Map();

export function material(color, opciones = {}) {
    const clave = color + '|' + JSON.stringify(opciones);
    if (cacheMateriales.has(clave)) return cacheMateriales.get(clave);
    const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.92,
        metalness: 0,
        flatShading: true,
        ...opciones
    });
    cacheMateriales.set(clave, mat);
    return mat;
}

function malla(geo, color, opciones) {
    const m = new THREE.Mesh(geo, material(color, opciones));
    m.castShadow = true;
    m.receiveShadow = false;
    return m;
}

function esfera(rx, ry, rz, color, seg = 10) {
    const m = malla(new THREE.SphereGeometry(1, seg, Math.max(5, Math.round(seg * 0.65))), color);
    m.scale.set(rx, ry, rz);
    return m;
}

function caja(w, h, d, color) {
    return malla(new THREE.BoxGeometry(w, h, d), color);
}

function cono(radio, alto, color, seg = 7) {
    return malla(new THREE.ConeGeometry(radio, alto, seg), color);
}

function cilindro(rArriba, rAbajo, alto, color, seg = 8) {
    return malla(new THREE.CylinderGeometry(rArriba, rAbajo, alto, seg), color);
}

function cilindroEntre(a, b, r1, r2, color, seg = 8) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const largo = dir.length() || 0.001;
    const m = malla(new THREE.CylinderGeometry(r2, r1, largo, seg), color);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return m;
}

function ojos(grupo, x, y, z, radio, separacion) {
    const color = '#20180f';
    for (const lado of [-1, 1]) {
        const ojo = esfera(radio, radio, radio * 0.8, color, 8);
        ojo.position.set(x, y, z + lado * separacion);
        grupo.add(ojo);
    }
}

/* -------------------------------------------------------------- FUSIÓN */
// Convierte un grupo de mallas estáticas (plantas, rocas, troncos) en una
// sola malla con colores por vértice. Mismo aspecto, muchas menos llamadas
// de dibujo: la escena tenía más de 500 y casi todas eran hojas y troncos.
const materialFusionado = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    flatShading: true
});

export function fusionar(grupo) {
    grupo.updateMatrixWorld(true);
    const partes = [];

    grupo.traverse((hijo) => {
        if (!hijo.isMesh || !hijo.geometry) return;
        const geo = hijo.geometry.clone();
        geo.applyMatrix4(hijo.matrixWorld);

        for (const nombre of Object.keys(geo.attributes)) {
            if (nombre !== 'position' && nombre !== 'normal' && nombre !== 'uv') {
                geo.deleteAttribute(nombre);
            }
        }
        if (!geo.attributes.uv) {
            const cantidad = geo.attributes.position.count;
            geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cantidad * 2), 2));
        }

        const color = hijo.material && hijo.material.color
            ? hijo.material.color
            : new THREE.Color(1, 1, 1);
        const cantidad = geo.attributes.position.count;
        const colores = new Float32Array(cantidad * 3);
        for (let i = 0; i < cantidad; i++) {
            colores[i * 3] = color.r;
            colores[i * 3 + 1] = color.g;
            colores[i * 3 + 2] = color.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colores, 3));
        partes.push(geo);
    });

    if (!partes.length) return grupo;
    const fusionada = mergeGeometries(partes, false);
    if (!fusionada) return grupo;

    const mallaUnica = new THREE.Mesh(fusionada, materialFusionado);
    mallaUnica.castShadow = true;
    mallaUnica.receiveShadow = false;

    const salida = new THREE.Group();
    salida.add(mallaUnica);
    return salida;
}

/* =====================================================================
   BÍPEDOS
   Cuerpo alargado, cola larga, patas traseras fuertes y brazos cortos.
   ===================================================================== */
export function crearBipedo({
    largo = 6,
    alto = 2.4,
    color = '#7d6b4f',
    vientre = '#c7b189',
    cabezaColor = null,
    cresta = null,
    dientes = true,
    brazos = true,
    fase = Math.random() * 6.28
} = {}) {
    const grupo = new THREE.Group();
    const L = largo;
    const H = alto;

    const cuerpo = esfera(L * 0.22, H * 0.30, H * 0.24, color);
    cuerpo.position.set(0, H * 0.88, 0);
    grupo.add(cuerpo);

    const panza = esfera(L * 0.19, H * 0.20, H * 0.20, vientre);
    panza.position.set(L * 0.02, H * 0.72, 0);
    grupo.add(panza);

    const cadera = esfera(L * 0.11, H * 0.18, H * 0.20, color);
    cadera.position.set(-L * 0.14, H * 0.80, 0);
    grupo.add(cadera);

    // Cuello y cabeza
    const baseCuello = new THREE.Vector3(L * 0.14, H * 0.98, 0);
    const finCuello = new THREE.Vector3(L * 0.26, H * 1.28, 0);
    grupo.add(cilindroEntre(baseCuello, finCuello, H * 0.15, H * 0.10, color, 8));

    const cabeza = new THREE.Group();
    cabeza.position.copy(finCuello);
    const craneo = esfera(H * 0.19, H * 0.16, H * 0.14, cabezaColor || color, 9);
    cabeza.add(craneo);
    const hocico = caja(H * 0.22, H * 0.11, H * 0.16, cabezaColor || color);
    hocico.position.set(H * 0.14, -H * 0.02, 0);
    cabeza.add(hocico);
    const mandibula = caja(H * 0.20, H * 0.06, H * 0.14, vientre);
    mandibula.position.set(H * 0.13, -H * 0.10, 0);
    cabeza.add(mandibula);
    ojos(cabeza, H * 0.06, H * 0.06, 0, H * 0.028, H * 0.105);

    if (dientes) {
        for (let i = 0; i < 4; i++) {
            const diente = cono(H * 0.018, H * 0.055, '#f3ead2', 5);
            diente.rotation.z = Math.PI;
            diente.position.set(H * (0.06 + i * 0.045), -H * 0.075, 0);
            cabeza.add(diente);
        }
    }

    if (cresta) {
        const c = cono(H * 0.055, H * 0.16, cresta, 6);
        c.position.set(-H * 0.02, H * 0.15, 0);
        c.rotation.z = -0.25;
        cabeza.add(c);
    }

    grupo.add(cabeza);

    // Cola en tres tramos
    const cola = new THREE.Group();
    cola.position.set(-L * 0.18, H * 0.92, 0);
    let x = 0;
    let y = 0;
    const tramos = [];
    const largos = [L * 0.20, L * 0.17, L * 0.15];
    const radios = [H * 0.16, H * 0.10, H * 0.05];
    for (let i = 0; i < 3; i++) {
        const tramo = new THREE.Group();
        tramo.position.set(x, y, 0);
        const seg = cono(radios[i], largos[i], i === 2 ? vientre : color, 7);
        seg.rotation.z = Math.PI / 2;
        seg.position.x = -largos[i] / 2;
        tramo.add(seg);
        cola.add(tramo);
        tramos.push(tramo);
        x -= largos[i];
        y -= largos[i] * 0.10;
    }
    grupo.add(cola);

    // Patas traseras
    const patas = [];
    for (const lado of [-1, 1]) {
        const pata = new THREE.Group();
        pata.position.set(-L * 0.06, H * 0.72, lado * H * 0.17);

        const muslo = esfera(H * 0.13, H * 0.26, H * 0.13, color);
        muslo.position.set(0, -H * 0.10, 0);
        pata.add(muslo);

        const espinilla = cilindroEntre(
            new THREE.Vector3(0, -H * 0.24, 0),
            new THREE.Vector3(H * 0.05, -H * 0.58, 0),
            H * 0.075, H * 0.055, color
        );
        pata.add(espinilla);

        const pie = caja(H * 0.22, H * 0.07, H * 0.12, color);
        pie.position.set(H * 0.09, -H * 0.62, 0);
        pata.add(pie);

        grupo.add(pata);
        patas.push(pata);
    }

    // Brazos cortos
    if (brazos) {
        for (const lado of [-1, 1]) {
            const brazo = cilindroEntre(
                new THREE.Vector3(L * 0.13, H * 0.95, lado * H * 0.16),
                new THREE.Vector3(L * 0.21, H * 0.72, lado * H * 0.18),
                H * 0.045, H * 0.03, color, 6
            );
            grupo.add(brazo);
            const garra = cono(H * 0.02, H * 0.07, '#e9dcc0', 5);
            garra.position.set(L * 0.21, H * 0.68, lado * H * 0.18);
            garra.rotation.z = Math.PI * 0.85;
            grupo.add(garra);
        }
    }

    grupo.userData.animar = (t) => {
        const s = Math.sin(t * 1.5 + fase);
        cuerpo.scale.y = H * 0.30 * (1 + s * 0.018);
        cabeza.position.y = finCuello.y + s * H * 0.012;
        cabeza.rotation.y = Math.sin(t * 0.5 + fase) * 0.16;
        cabeza.rotation.z = Math.sin(t * 0.8 + fase) * 0.03;
        tramos.forEach((tramo, i) => {
            tramo.rotation.y = Math.sin(t * 1.1 + fase - i * 0.5) * 0.07;
        });
        patas.forEach((pata, i) => {
            pata.rotation.x = Math.sin(t * 0.9 + fase + i * Math.PI) * 0.02;
        });
    };

    return grupo;
}

/* =====================================================================
   SAURÓPODOS
   Cuello larguísimo, cuatro patas, cuerpo enorme y cola como un látigo.
   ===================================================================== */
export function crearSauropodo({
    largo = 22,
    alto = 11,
    color = '#6f7f52',
    vientre = '#b8bd8a',
    fase = Math.random() * 6.28
} = {}) {
    const grupo = new THREE.Group();
    const L = largo;
    const H = alto;

    const cuerpo = esfera(L * 0.20, H * 0.16, H * 0.13, color);
    cuerpo.position.set(0, H * 0.52, 0);
    grupo.add(cuerpo);

    const panza = esfera(L * 0.16, H * 0.10, H * 0.11, vientre);
    panza.position.set(L * 0.01, H * 0.45, 0);
    grupo.add(panza);

    // Patas: dos delanteras más largas que las traseras (como la jirafa)
    for (const x of [-L * 0.12, L * 0.13]) {
        for (const z of [-1, 1]) {
            const alturaPata = x > 0 ? H * 0.52 : H * 0.48;
            const pata = cilindroEntre(
                new THREE.Vector3(x, H * 0.50, z * H * 0.09),
                new THREE.Vector3(x, H * 0.035, z * H * 0.10),
                H * 0.045, H * 0.055, color, 7
            );
            grupo.add(pata);
            const pie = cilindro(H * 0.07, H * 0.075, H * 0.035, color, 7);
            pie.position.set(x, H * 0.018, z * H * 0.10);
            grupo.add(pie);
            pata.userData.altura = alturaPata;
        }
    }

    // Cuello de tres tramos hacia arriba y adelante
    const cuello = new THREE.Group();
    const base = new THREE.Vector3(L * 0.14, H * 0.60, 0);
    cuello.position.copy(base);
    const puntos = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(L * 0.05, H * 0.28, 0),
        new THREE.Vector3(L * 0.10, H * 0.56, 0),
        new THREE.Vector3(L * 0.14, H * 0.82, 0)
    ];
    const radios = [H * 0.075, H * 0.055, H * 0.040, H * 0.030];
    for (let i = 0; i < 3; i++) {
        cuello.add(cilindroEntre(puntos[i], puntos[i + 1], radios[i], radios[i + 1], color, 7));
    }

    const cabeza = new THREE.Group();
    cabeza.position.copy(puntos[3]);
    const craneo = esfera(H * 0.055, H * 0.045, H * 0.04, color, 8);
    cabeza.add(craneo);
    const hocico = caja(H * 0.075, H * 0.035, H * 0.045, vientre);
    hocico.position.set(H * 0.055, -H * 0.005, 0);
    cabeza.add(hocico);
    ojos(cabeza, H * 0.01, H * 0.015, 0, H * 0.009, H * 0.035);
    cuello.add(cabeza);
    grupo.add(cuello);

    // Cola larga y fina
    const cola = new THREE.Group();
    cola.position.set(-L * 0.18, H * 0.52, 0);
    let x = 0;
    let y = 0;
    const tramos = [];
    const largos = [L * 0.16, L * 0.14, L * 0.12, L * 0.10];
    const rads = [H * 0.075, H * 0.055, H * 0.038, H * 0.022];
    for (let i = 0; i < 4; i++) {
        const tramo = new THREE.Group();
        tramo.position.set(x, y, 0);
        const seg = cono(rads[i], largos[i], color, 6);
        seg.rotation.z = Math.PI / 2;
        seg.position.x = -largos[i] / 2;
        tramo.add(seg);
        cola.add(tramo);
        tramos.push(tramo);
        x -= largos[i];
        y -= largos[i] * 0.05;
    }
    grupo.add(cola);

    grupo.userData.animar = (t) => {
        const s = Math.sin(t * 0.55 + fase);
        cuello.rotation.z = s * 0.025;
        cuello.rotation.y = Math.sin(t * 0.35 + fase) * 0.05;
        cabeza.rotation.z = Math.sin(t * 0.7 + fase) * 0.05;
        tramos.forEach((tramo, i) => {
            tramo.rotation.y = Math.sin(t * 0.6 + fase - i * 0.55) * 0.055;
        });
        cuerpo.scale.y = H * 0.16 * (1 + s * 0.012);
    };

    return grupo;
}

/* =====================================================================
   ESTEGOSAURIO
   Lomo arqueado, dos filas de placas y púas en la cola.
   ===================================================================== */
export function crearEstegosaurio({
    largo = 9,
    alto = 3.4,
    color = '#7a7a4e',
    placas = '#b05f3c',
    fase = Math.random() * 6.28
} = {}) {
    const grupo = new THREE.Group();
    const L = largo;
    const H = alto;

    const cuerpo = esfera(L * 0.24, H * 0.22, H * 0.18, color);
    cuerpo.position.set(0, H * 0.55, 0);
    cuerpo.rotation.z = 0.08;
    grupo.add(cuerpo);

    const grupa = esfera(L * 0.13, H * 0.24, H * 0.17, color);
    grupa.position.set(-L * 0.18, H * 0.62, 0);
    grupo.add(grupa);

    const panza = esfera(L * 0.18, H * 0.12, H * 0.15, '#b5ab74');
    panza.position.set(0, H * 0.42, 0);
    grupo.add(panza);

    for (const x of [-L * 0.14, L * 0.16]) {
        for (const z of [-1, 1]) {
            grupo.add(cilindroEntre(
                new THREE.Vector3(x, H * 0.45, z * H * 0.11),
                new THREE.Vector3(x, H * 0.03, z * H * 0.12),
                H * 0.05, H * 0.06, color, 7
            ));
            const pie = cilindro(H * 0.075, H * 0.08, H * 0.03, color, 7);
            pie.position.set(x, H * 0.015, z * H * 0.12);
            grupo.add(pie);
        }
    }

    // Cuello corto y cabeza pequeña
    grupo.add(cilindroEntre(
        new THREE.Vector3(L * 0.20, H * 0.58, 0),
        new THREE.Vector3(L * 0.30, H * 0.50, 0),
        H * 0.055, H * 0.04, color, 7
    ));
    const cabeza = esfera(H * 0.07, H * 0.055, H * 0.05, color, 8);
    cabeza.position.set(L * 0.33, H * 0.48, 0);
    grupo.add(cabeza);
    const hocico = caja(H * 0.08, H * 0.035, H * 0.045, '#b5ab74');
    hocico.position.set(L * 0.38, H * 0.46, 0);
    grupo.add(hocico);

    // Placas: dos filas alternadas
    for (let i = 0; i < 7; i++) {
        const x = -L * 0.26 + i * L * 0.075;
        const altura = Math.sin((i / 6) * Math.PI) * H * 0.30 + H * 0.06;
        for (const z of [-1, 1]) {
            const placa = cono(H * 0.055, altura, placas, 4);
            placa.scale.z = 0.28;
            placa.position.set(x, H * 0.70 + altura * 0.35, z * H * 0.055);
            placa.rotation.x = z * 0.12;
            grupo.add(placa);
        }
    }

    // Cola con púas
    const cola = new THREE.Group();
    cola.position.set(-L * 0.28, H * 0.62, 0);
    const seg1 = cono(H * 0.09, L * 0.16, color, 6);
    seg1.rotation.z = Math.PI / 2;
    seg1.position.x = -L * 0.08;
    cola.add(seg1);
    const seg2 = cono(H * 0.055, L * 0.14, color, 6);
    seg2.rotation.z = Math.PI / 2;
    seg2.position.x = -L * 0.20;
    cola.add(seg2);
    for (const z of [-1, 1]) {
        const pua = cono(H * 0.035, H * 0.28, '#d9c9a0', 5);
        pua.position.set(-L * 0.26, H * 0.08, z * H * 0.05);
        pua.rotation.z = 0.85;
        pua.rotation.x = z * 0.35;
        cola.add(pua);
    }
    grupo.add(cola);

    grupo.userData.animar = (t) => {
        const s = Math.sin(t * 0.9 + fase);
        cabeza.rotation.y = s * 0.18;
        cola.rotation.y = Math.sin(t * 0.8 + fase) * 0.08;
        cuerpo.scale.y = H * 0.22 * (1 + s * 0.01);
    };

    return grupo;
}

/* =====================================================================
   TRICERATOPS
   Cuerpo macizo, escudo óseo y tres cuernos.
   ===================================================================== */
export function crearTriceratops({
    largo = 9,
    alto = 3.2,
    color = '#8a7350',
    escudo = '#a8865c',
    fase = Math.random() * 6.28
} = {}) {
    const grupo = new THREE.Group();
    const L = largo;
    const H = alto;

    const cuerpo = esfera(L * 0.24, H * 0.24, H * 0.20, color);
    cuerpo.position.set(-L * 0.02, H * 0.55, 0);
    grupo.add(cuerpo);

    const panza = esfera(L * 0.19, H * 0.14, H * 0.17, '#c4ad80');
    panza.position.set(0, H * 0.42, 0);
    grupo.add(panza);

    for (const x of [-L * 0.16, L * 0.15]) {
        for (const z of [-1, 1]) {
            grupo.add(cilindroEntre(
                new THREE.Vector3(x, H * 0.46, z * H * 0.13),
                new THREE.Vector3(x, H * 0.03, z * H * 0.14),
                H * 0.055, H * 0.065, color, 7
            ));
            const pie = cilindro(H * 0.08, H * 0.085, H * 0.035, color, 7);
            pie.position.set(x, H * 0.018, z * H * 0.14);
            grupo.add(pie);
        }
    }

    const cabeza = new THREE.Group();
    cabeza.position.set(L * 0.22, H * 0.62, 0);

    const craneo = esfera(H * 0.12, H * 0.10, H * 0.10, color, 8);
    cabeza.add(craneo);

    // Escudo: disco achatado detrás de la cabeza
    const disco = malla(new THREE.CylinderGeometry(H * 0.17, H * 0.20, H * 0.035, 16), escudo);
    disco.rotation.z = Math.PI / 2;
    disco.position.set(-H * 0.10, H * 0.03, 0);
    disco.scale.x = 1.15;
    cabeza.add(disco);

    // Pico
    const pico = cono(H * 0.055, H * 0.14, '#d8c8a2', 5);
    pico.rotation.z = -Math.PI / 2;
    pico.position.set(H * 0.15, -H * 0.035, 0);
    cabeza.add(pico);

    // Dos cuernos largos y uno corto en la nariz
    for (const z of [-1, 1]) {
        const cuerno = cono(H * 0.026, H * 0.26, '#efe3c8', 6);
        cuerno.position.set(H * 0.06, H * 0.14, z * H * 0.055);
        cuerno.rotation.z = -0.45;
        cuerno.rotation.x = z * 0.25;
        cabeza.add(cuerno);
    }
    const cuernoNariz = cono(H * 0.02, H * 0.10, '#efe3c8', 6);
    cuernoNariz.position.set(H * 0.13, H * 0.03, 0);
    cuernoNariz.rotation.z = -1.1;
    cabeza.add(cuernoNariz);

    ojos(cabeza, H * 0.03, H * 0.05, 0, H * 0.017, H * 0.085);
    grupo.add(cabeza);

    const cola = new THREE.Group();
    cola.position.set(-L * 0.26, H * 0.55, 0);
    const seg = cono(H * 0.10, L * 0.14, color, 6);
    seg.rotation.z = Math.PI / 2;
    seg.position.x = -L * 0.07;
    cola.add(seg);
    grupo.add(cola);

    grupo.userData.animar = (t) => {
        const s = Math.sin(t * 0.8 + fase);
        cabeza.rotation.y = s * 0.12;
        cabeza.rotation.x = Math.sin(t * 0.5 + fase) * 0.03;
        cola.rotation.y = Math.sin(t * 0.7 + fase) * 0.07;
    };

    return grupo;
}

/* =====================================================================
   ANQUILOSAURIO
   Blindaje de placas y mazo en la cola.
   ===================================================================== */
export function crearAnquilosaurio({
    largo = 8,
    alto = 2.3,
    color = '#6f6350',
    blindaje = '#8d7a5e',
    fase = Math.random() * 6.28
} = {}) {
    const grupo = new THREE.Group();
    const L = largo;
    const H = alto;

    const cuerpo = esfera(L * 0.25, H * 0.20, H * 0.24, color);
    cuerpo.position.set(0, H * 0.48, 0);
    grupo.add(cuerpo);

    for (const x of [-L * 0.15, L * 0.14]) {
        for (const z of [-1, 1]) {
            grupo.add(cilindroEntre(
                new THREE.Vector3(x, H * 0.38, z * H * 0.14),
                new THREE.Vector3(x, H * 0.025, z * H * 0.15),
                H * 0.06, H * 0.07, color, 7
            ));
            const pie = cilindro(H * 0.085, H * 0.09, H * 0.03, color, 7);
            pie.position.set(x, H * 0.015, z * H * 0.15);
            grupo.add(pie);
        }
    }

    // Placas de blindaje
    for (let fila = 0; fila < 2; fila++) {
        for (let i = 0; i < 6; i++) {
            const x = -L * 0.20 + i * L * 0.075;
            const placa = esfera(H * 0.055, H * 0.035, H * 0.045, blindaje, 6);
            placa.position.set(x, H * 0.66, (fila ? 1 : -1) * H * 0.10);
            grupo.add(placa);
        }
    }

    const cabeza = esfera(H * 0.10, H * 0.075, H * 0.09, color, 8);
    cabeza.position.set(L * 0.26, H * 0.38, 0);
    grupo.add(cabeza);
    const hocico = caja(H * 0.10, H * 0.05, H * 0.08, blindaje);
    hocico.position.set(L * 0.32, H * 0.35, 0);
    grupo.add(hocico);
    ojos(grupo, L * 0.27, H * 0.42, 0, H * 0.014, H * 0.06);

    const cola = new THREE.Group();
    cola.position.set(-L * 0.24, H * 0.48, 0);
    const seg = cono(H * 0.08, L * 0.18, color, 6);
    seg.rotation.z = Math.PI / 2;
    seg.position.x = -L * 0.09;
    cola.add(seg);
    const mazo = esfera(H * 0.13, H * 0.11, H * 0.13, blindaje, 7);
    mazo.position.set(-L * 0.21, 0, 0);
    cola.add(mazo);
    for (let i = 0; i < 4; i++) {
        const pincho = cono(H * 0.02, H * 0.07, '#d8c8a2', 4);
        pincho.position.set(-L * 0.21, H * 0.10, 0);
        pincho.rotation.z = (i / 4) * Math.PI * 2;
        pincho.rotation.x = 0.6;
        cola.add(pincho);
    }
    grupo.add(cola);

    grupo.userData.animar = (t) => {
        const s = Math.sin(t * 0.9 + fase);
        cabeza.rotation.y = s * 0.15;
        cola.rotation.y = Math.sin(t * 0.75 + fase) * 0.10;
    };

    return grupo;
}

/* =====================================================================
   AVES Y PTEROSAURIOS
   ===================================================================== */
export function crearAve({
    escala = 1,
    color = '#3d4a5c',
    pico = '#d9a441',
    fase = Math.random() * 6.28
} = {}) {
    const grupo = new THREE.Group();
    const S = escala;

    const cuerpo = esfera(0.30 * S, 0.18 * S, 0.20 * S, color, 8);
    grupo.add(cuerpo);

    const cabeza = esfera(0.13 * S, 0.12 * S, 0.11 * S, color, 8);
    cabeza.position.set(0.28 * S, 0.10 * S, 0);
    grupo.add(cabeza);
    const picoM = cono(0.05 * S, 0.16 * S, pico, 5);
    picoM.rotation.z = -Math.PI / 2;
    picoM.position.set(0.42 * S, 0.09 * S, 0);
    grupo.add(picoM);

    const alas = [];
    for (const lado of [-1, 1]) {
        const ala = new THREE.Group();
        ala.position.set(0.02 * S, 0.06 * S, lado * 0.12 * S);
        const pluma = esfera(0.30 * S, 0.03 * S, 0.34 * S, color, 6);
        pluma.position.set(0, 0, lado * 0.30 * S);
        ala.add(pluma);
        const borde = esfera(0.18 * S, 0.02 * S, 0.18 * S, '#55657a', 6);
        borde.position.set(-0.08 * S, 0.01 * S, lado * 0.50 * S);
        ala.add(borde);
        grupo.add(ala);
        alas.push({ ala, lado });
    }

    const cola = esfera(0.24 * S, 0.025 * S, 0.12 * S, '#55657a', 6);
    cola.position.set(-0.38 * S, 0.02 * S, 0);
    grupo.add(cola);

    grupo.userData.animar = (t) => {
        const aleteo = Math.sin(t * 7 + fase);
        alas.forEach(({ ala, lado }) => {
            ala.rotation.x = lado * aleteo * 0.55;
        });
        cabeza.rotation.y = Math.sin(t * 0.8 + fase) * 0.2;
    };

    return grupo;
}

export function crearPterosaurio({
    envergadura = 6,
    color = '#6b5a48',
    cresta = '#a84a3c',
    fase = Math.random() * 6.28
} = {}) {
    const grupo = new THREE.Group();
    const E = envergadura;

    const cuerpo = esfera(E * 0.09, E * 0.055, E * 0.05, color, 7);
    grupo.add(cuerpo);

    const cuello = cilindroEntre(
        new THREE.Vector3(E * 0.06, E * 0.02, 0),
        new THREE.Vector3(E * 0.16, E * 0.06, 0),
        E * 0.028, E * 0.022, color, 6
    );
    grupo.add(cuello);

    const cabeza = esfera(E * 0.045, E * 0.035, E * 0.03, color, 7);
    cabeza.position.set(E * 0.17, E * 0.06, 0);
    grupo.add(cabeza);
    const picoM = cono(E * 0.018, E * 0.14, '#d9c9a0', 5);
    picoM.rotation.z = -Math.PI / 2;
    picoM.position.set(E * 0.25, E * 0.05, 0);
    grupo.add(picoM);
    const crestaM = cono(E * 0.02, E * 0.10, cresta, 5);
    crestaM.position.set(E * 0.16, E * 0.11, 0);
    crestaM.rotation.z = 0.55;
    grupo.add(crestaM);

    const alas = [];
    for (const lado of [-1, 1]) {
        const ala = new THREE.Group();
        ala.position.set(0, E * 0.02, lado * E * 0.04);
        const membrana = esfera(E * 0.16, E * 0.02, E * 0.42, color, 6);
        membrana.position.set(-E * 0.02, 0, lado * E * 0.42);
        ala.add(membrana);
        const dedo = cilindroEntre(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(E * 0.02, 0, lado * E * 0.80),
            E * 0.012, E * 0.006, '#4f4235', 5
        );
        ala.add(dedo);
        grupo.add(ala);
        alas.push({ ala, lado });
    }

    grupo.userData.animar = (t) => {
        const aleteo = Math.sin(t * 2.2 + fase);
        alas.forEach(({ ala, lado }) => {
            ala.rotation.x = lado * (0.12 + aleteo * 0.22);
        });
        grupo.rotation.z = Math.sin(t * 0.6 + fase) * 0.05;
    };

    return grupo;
}

/* =====================================================================
   VEGETACIÓN
   ===================================================================== */
export function crearConifera(alto = 12, color = '#3f5f38') {
    const grupo = new THREE.Group();
    const tronco = cilindro(alto * 0.016, alto * 0.042, alto * 0.60, '#5a4230', 6);
    tronco.position.y = alto * 0.30;
    grupo.add(tronco);

    // Seis capas con radios y giros irregulares: la silueta deja de ser un
    // cono perfecto apilado y se parece más a una conífera.
    const capas = 6;
    const base = new THREE.Color(color);
    for (let i = 0; i < capas; i++) {
        const f = i / (capas - 1);
        const jitter = 0.92 + ((i * 37) % 11) / 60;
        const radio = alto * (0.21 - f * 0.15) * jitter;
        const alturaCapa = alto * (0.22 + f * 0.06);
        const tono = base.clone().multiplyScalar(0.86 + f * 0.30);
        const copa = cono(radio, alturaCapa, `#${tono.getHexString()}`, 8);
        copa.position.y = alto * (0.34 + f * 0.50);
        copa.rotation.y = i * 0.9;
        grupo.add(copa);
    }
    return fusionar(grupo);
}

export function crearHelecho(escala = 1, color = '#4f7a3f') {
    const grupo = new THREE.Group();
    for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        const hoja = esfera(0.55 * escala, 0.06 * escala, 0.16 * escala, color, 5);
        hoja.position.set(Math.cos(ang) * 0.45 * escala, 0.30 * escala, Math.sin(ang) * 0.45 * escala);
        hoja.rotation.y = -ang;
        hoja.rotation.z = 0.45;
        grupo.add(hoja);
    }
    return fusionar(grupo);
}

export function crearCicada(alto = 2.2, color = '#4c7a44') {
    const grupo = new THREE.Group();
    const tronco = cilindro(alto * 0.06, alto * 0.09, alto * 0.55, '#6b4a33', 6);
    tronco.position.y = alto * 0.275;
    grupo.add(tronco);
    for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const hoja = esfera(alto * 0.45, alto * 0.03, alto * 0.10, color, 5);
        hoja.position.set(Math.cos(ang) * alto * 0.28, alto * 0.62, Math.sin(ang) * alto * 0.28);
        hoja.rotation.y = -ang;
        hoja.rotation.z = 0.35;
        grupo.add(hoja);
    }
    return fusionar(grupo);
}

export function crearPalmera(alto = 8, color = '#4f7f4a') {
    const grupo = new THREE.Group();
    let x = 0;
    for (let i = 0; i < 3; i++) {
        const seg = cilindro(alto * 0.025, alto * 0.035, alto * 0.28, '#7a5a3c', 6);
        seg.position.set(x, alto * (0.14 + i * 0.26), 0);
        seg.rotation.z = -0.10 * i;
        grupo.add(seg);
        x += alto * 0.028 * i;
    }
    const copa = new THREE.Group();
    copa.position.set(x, alto * 0.80, 0);
    for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const hoja = esfera(alto * 0.28, alto * 0.025, alto * 0.075, color, 5);
        hoja.position.set(Math.cos(ang) * alto * 0.17, 0, Math.sin(ang) * alto * 0.17);
        hoja.rotation.y = -ang;
        hoja.rotation.z = -0.30;
        copa.add(hoja);
    }
    grupo.add(copa);
    return fusionar(grupo);
}

export function crearRoca(escala = 1, color = '#8a8175') {
    const m = malla(new THREE.DodecahedronGeometry(escala, 0), color);
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    m.scale.set(1, 0.7 + Math.random() * 0.5, 0.9 + Math.random() * 0.4);
    return m;
}

export function crearFlor(color = '#e0c84a') {
    const grupo = new THREE.Group();
    const tallo = cilindro(0.012, 0.018, 0.42, '#5f8a3f', 4);
    tallo.position.y = 0.21;
    grupo.add(tallo);
    const centro = esfera(0.045, 0.035, 0.045, '#f2d76a', 6);
    centro.position.y = 0.44;
    grupo.add(centro);
    for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const petalo = esfera(0.055, 0.018, 0.035, color, 5);
        petalo.position.set(Math.cos(ang) * 0.06, 0.45, Math.sin(ang) * 0.06);
        petalo.rotation.y = -ang;
        grupo.add(petalo);
    }
    return fusionar(grupo);
}

export function crearTroncoMuerto(alto = 6, color = '#5a4a3c') {
    const grupo = new THREE.Group();
    const tronco = cilindro(alto * 0.035, alto * 0.07, alto, color, 6);
    tronco.position.y = alto / 2;
    tronco.rotation.z = 0.12;
    grupo.add(tronco);
    const rama = cilindroEntre(
        new THREE.Vector3(0, alto * 0.55, 0),
        new THREE.Vector3(alto * 0.22, alto * 0.78, 0),
        alto * 0.03, alto * 0.015, color, 5
    );
    grupo.add(rama);
    return fusionar(grupo);
}

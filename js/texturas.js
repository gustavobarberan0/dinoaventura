/* =====================================================================
   TEXTURAS PROCEDURALES
   Todo se dibuja en canvas al iniciar: no hay imágenes externas.
   ===================================================================== */

import * as THREE from 'three';

let calidadAlta = true;

export function configurarCalidad(alta) {
    calidadAlta = !!alta;
}

export function esCalidadAlta() {
    return calidadAlta;
}

/* --------------------------------------------------------------- UTILES */
function lienzo(ancho, alto) {
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    return canvas;
}

// Generador pseudoaleatorio con semilla: las texturas salen iguales en
// cada visita y no cambian de una recarga a otra.
function sembrado(semilla) {
    let s = semilla >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function aTextura(canvas, repeticion = 1) {
    const textura = new THREE.CanvasTexture(canvas);
    textura.wrapS = THREE.RepeatWrapping;
    textura.wrapT = THREE.RepeatWrapping;
    textura.repeat.set(repeticion, repeticion);
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = calidadAlta ? 8 : 2;
    return textura;
}

/* --------------------------------------------------------- SUELO / TIERRA */
// Textura en escala de grises: el color real lo aportan los vértices del
// terreno, que cambian de bioma a lo largo del recorrido.
export function texturaSuelo() {
    const lado = calidadAlta ? 512 : 256;
    const canvas = lienzo(lado, lado);
    const ctx = canvas.getContext('2d');
    const rand = sembrado(20240607);

    ctx.fillStyle = '#b8b8b8';
    ctx.fillRect(0, 0, lado, lado);

    // Manchas grandes
    for (let i = 0; i < 120; i++) {
        const x = rand() * lado;
        const y = rand() * lado;
        const r = (0.03 + rand() * 0.11) * lado;
        const claro = rand() > 0.5;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, claro ? 'rgba(255,255,255,0.22)' : 'rgba(52,52,52,0.28)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // Granos y piedritas
    const granos = calidadAlta ? 6500 : 2600;
    for (let i = 0; i < granos; i++) {
        const x = rand() * lado;
        const y = rand() * lado;
        const r = 0.4 + rand() * 1.8;
        const tono = 90 + Math.floor(rand() * 130);
        ctx.fillStyle = `rgba(${tono},${tono},${tono},${0.18 + rand() * 0.34})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    return aTextura(canvas, 46);
}

export function texturaCamino() {
    const lado = calidadAlta ? 256 : 128;
    const canvas = lienzo(lado, lado);
    const ctx = canvas.getContext('2d');
    const rand = sembrado(778811);

    ctx.fillStyle = '#a98a63';
    ctx.fillRect(0, 0, lado, lado);
    for (let i = 0; i < 1400; i++) {
        const x = rand() * lado;
        const y = rand() * lado;
        const r = 0.5 + rand() * 2.2;
        const tono = 90 + Math.floor(rand() * 110);
        ctx.fillStyle = `rgba(${tono},${Math.floor(tono * 0.82)},${Math.floor(tono * 0.62)},${0.15 + rand() * 0.35})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    return aTextura(canvas, 12);
}

/* ------------------------------------------------------------------ AGUA */
export function texturaAgua() {
    const lado = calidadAlta ? 256 : 128;
    const canvas = lienzo(lado, lado);
    const ctx = canvas.getContext('2d');
    const rand = sembrado(4321);

    const grad = ctx.createLinearGradient(0, 0, lado, lado);
    grad.addColorStop(0, '#3c7f8c');
    grad.addColorStop(0.5, '#4f9fae');
    grad.addColorStop(1, '#2f6a78');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, lado, lado);

    ctx.strokeStyle = 'rgba(220,255,255,0.22)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 60; i++) {
        const y = rand() * lado;
        const x = rand() * lado;
        const ancho = 10 + rand() * 50;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + ancho / 2, y - 3, x + ancho, y);
        ctx.stroke();
    }
    return aTextura(canvas, 6);
}

/* -------------------------------------------------------------- PARTICULAS */
export function texturaParticula(interior = 'rgba(255,255,255,0.95)', exterior = 'rgba(255,255,255,0)') {
    const lado = 64;
    const canvas = lienzo(lado, lado);
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(lado / 2, lado / 2, 0, lado / 2, lado / 2, lado / 2);
    grad.addColorStop(0, interior);
    grad.addColorStop(0.45, interior.replace(/[\d.]+\)$/, '0.45)'));
    grad.addColorStop(1, exterior);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, lado, lado);
    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;
    return textura;
}

/* --------------------------------------------------------------- CORTEZA */
export function texturaCorteza() {
    const lado = 128;
    const canvas = lienzo(lado, lado);
    const ctx = canvas.getContext('2d');
    const rand = sembrado(99123);

    ctx.fillStyle = '#6b4a33';
    ctx.fillRect(0, 0, lado, lado);
    for (let i = 0; i < 90; i++) {
        const x = rand() * lado;
        ctx.strokeStyle = `rgba(40,26,18,${0.15 + rand() * 0.3})`;
        ctx.lineWidth = 1 + rand() * 3;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 6, lado * 0.35, x - 6, lado * 0.7, x + 3, lado);
        ctx.stroke();
    }
    return aTextura(canvas, 3);
}

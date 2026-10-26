#!/usr/bin/env node
/* Control de peso antes de desplegar.
   Cloudflare Pages (plan Free) permite 25 MiB por archivo y 20.000 archivos
   por deploy. Este script avisa si algo se acerca a esos límites.

   Uso:  node scripts/peso.mjs
*/

import { readdir, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));

const LIMITE_ARCHIVO = 25 * 1024 * 1024; // 25 MiB
const LIMITE_ARCHIVOS = 20000;
const AVISO_TOTAL = 8 * 1024 * 1024; // presupuesto propio: 8 MB
const IGNORAR = new Set(['.git', 'node_modules', '.wrangler']);

const KB = 1024;
const MB = 1024 * 1024;

function peso(bytes) {
    if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
    if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
    return `${bytes} B`;
}

async function recorrer(dir, archivos = []) {
    const entradas = await readdir(dir, { withFileTypes: true });
    for (const entrada of entradas) {
        if (IGNORAR.has(entrada.name)) continue;
        const ruta = join(dir, entrada.name);
        if (entrada.isDirectory()) {
            await recorrer(ruta, archivos);
        } else if (entrada.isFile()) {
            const info = await stat(ruta);
            archivos.push({
                ruta: relative(RAIZ, ruta).split(sep).join('/'),
                bytes: info.size
            });
        }
    }
    return archivos;
}

const archivos = await recorrer(RAIZ);
archivos.sort((a, b) => b.bytes - a.bytes);

const total = archivos.reduce((suma, a) => suma + a.bytes, 0);
const masGrande = archivos[0];

console.log(`\nDinoaventura · control de peso`);
console.log(`Archivos: ${archivos.length} / ${LIMITE_ARCHIVOS} permitidos`);
console.log(`Total:    ${peso(total)} (presupuesto propio: ${peso(AVISO_TOTAL)})`);
console.log(`Más grande: ${masGrande.ruta} (${peso(masGrande.bytes)})`);

console.log('\nLos cinco más pesados:');
for (const archivo of archivos.slice(0, 5)) {
    console.log(`  ${peso(archivo.bytes).padStart(9)}  ${archivo.ruta}`);
}

const porCarpeta = new Map();
for (const archivo of archivos) {
    const carpeta = archivo.ruta.includes('/') ? archivo.ruta.split('/')[0] : '(raíz)';
    porCarpeta.set(carpeta, (porCarpeta.get(carpeta) || 0) + archivo.bytes);
}
console.log('\nPor carpeta:');
for (const [carpeta, bytes] of [...porCarpeta].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${peso(bytes).padStart(9)}  ${carpeta}`);
}

let problemas = 0;
if (archivos.length > LIMITE_ARCHIVOS) {
    console.error(`\n✗ Hay más de ${LIMITE_ARCHIVOS} archivos: el deploy va a fallar.`);
    problemas++;
}
const pesados = archivos.filter((a) => a.bytes > LIMITE_ARCHIVO);
for (const archivo of pesados) {
    console.error(`\n✗ ${archivo.ruta} supera los 25 MiB: Cloudflare lo rechaza.`);
    problemas++;
}
if (total > AVISO_TOTAL) {
    console.warn(`\n! El total pasa el presupuesto de ${peso(AVISO_TOTAL)}. Revisá si vale la pena.`);
}

if (!problemas) {
    console.log('\n✓ Todo dentro de los límites de Cloudflare Pages.');
}
process.exit(problemas ? 1 : 0);

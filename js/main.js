/* =====================================================================
   ARRANQUE
   Detecta la calidad, arma la escena, carga la interfaz y lanza la intro.
   ===================================================================== */

import { CUERPOS } from './datos.js';
import { Recorrido } from './escena.js';
import { Interfaz } from './interfaz.js';

const parametros = new URLSearchParams(window.location.search);
const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function detectarCalidad() {
    const forzada = parametros.get('calidad');
    if (forzada === 'baja') return false;
    if (forzada === 'alta') return true;
    const memoria = navigator.deviceMemory || 8;
    const nucleos = navigator.hardwareConcurrency || 8;
    const pantallaChica = window.innerWidth < 820;
    return !(pantallaChica || nucleos <= 4 || memoria <= 4);
}

function nivelGuardado() {
    try {
        const guardado = localStorage.getItem('dinoaventura-nivel');
        if (guardado === 'exploradores' || guardado === 'cientificos') return guardado;
    } catch { /* modo privado */ }
    return 'exploradores';
}

// Enlaces directos: #cretacico o ?parada=cretacico abren ese campamento.
function paradaDeUrl() {
    const hash = decodeURIComponent(window.location.hash.replace(/^#\/?/, '')).toLowerCase();
    const consulta = (parametros.get('parada') || '').toLowerCase();
    // La app escribe la parada actual en el hash para que se pueda compartir.
    // Ese hash propio no es un enlace directo: si contara, al recargar la
    // página nunca más aparecería la intro.
    const estado = history.state || {};
    const navegacion = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    // Las URLs que quedaron con hash en versiones anteriores no tienen marca:
    // si la página se está recargando, se asume que el hash lo puso la app.
    const recargaVieja = navegacion && navegacion.type === 'reload' && estado.dinoAuto !== true;
    const hashPropio = estado.dinoDirecto !== true && (estado.dinoAuto === true || recargaVieja);
    const buscado = consulta || (hashPropio ? '' : hash);
    if (!buscado) return null;
    const idx = CUERPOS.findIndex((c) => c.id === buscado);
    return idx >= 0 ? idx : null;
}

// Recuerda que la visita llegó por un enlace directo, para que recargar
// mantenga esa parada en vez de volver a la intro.
function marcarEnlaceDirecto() {
    try {
        history.replaceState({ ...(history.state || {}), dinoDirecto: true }, '');
    } catch { /* algunos navegadores bloquean history en file:// */ }
}

function mostrarError(mensaje) {
    const status = document.getElementById('loadStatus');
    const progreso = document.getElementById('loadProgress');
    if (status) status.textContent = mensaje;
    if (progreso) {
        progreso.style.width = '100%';
        progreso.style.background = '#ff7d7d';
    }
    document.body.classList.remove('cargando');
}

async function arrancar() {
    document.body.classList.add('cargando');
    const contenedor = document.getElementById('canvas-container');

    let interfaz = null;
    let recorrido = null;
    const paradaUrl = paradaDeUrl();
    const inicio = paradaUrl ?? 0;
    const enlaceDirecto = paradaUrl !== null;
    if (enlaceDirecto) marcarEnlaceDirecto();

    try {
        recorrido = new Recorrido(contenedor, {
            calidadAlta: detectarCalidad(),
            alCambiarParada: (idx) => {
                if (interfaz) interfaz.render(idx);
            },
            alIniciarVuelo: (idx, intro) => {
                if (intro && interfaz) interfaz.mostrarIntro();
            },
            alLlegar: () => {
                if (interfaz) interfaz.ocultarIntro();
            },
            alSaltarIntro: () => {
                if (interfaz) interfaz.ocultarIntro();
            }
        });
    } catch (error) {
        console.error(error);
        mostrarError('No se pudo iniciar WebGL. Probá con otro navegador o activá la aceleración por hardware.');
        return;
    }

    interfaz = new Interfaz({ recorrido, nivel: nivelGuardado(), paradaInicial: inicio });
    if (parametros.get('debug') === '1') window.__recorrido = recorrido;
    interfaz.progreso(0.02, 'Preparando el viaje al Mesozoico');

    try {
        await recorrido.construir(CUERPOS, (texto, fraccion) => {
            interfaz.progreso(fraccion, texto);
        });

        // La tarjeta ya puede mostrar la parada elegida (o la primera).
        interfaz.render(inicio);

        interfaz.progreso(0.9, 'Cargando el jeep y los dinosaurios');
        await recorrido.cargarVehiculo((pct) => {
            interfaz.progreso(0.9 + (pct / 100) * 0.08, `Cargando dinosaurios: ${pct}%`);
        });

        interfaz.progreso(1, '¡Todo listo!');
    } catch (error) {
        console.error(error);
        mostrarError('Hubo un problema al cargar el recorrido. Recargá la página para intentar de nuevo.');
        return;
    }

    setTimeout(() => {
        interfaz.ocultarCarga();

        const sinIntro = reducido || enlaceDirecto || parametros.get('intro') === '0';
        if (sinIntro) {
            recorrido.irA(inicio, { duracion: 1.2 });
        } else {
            interfaz.mostrarIntro();
            // Pequeña pausa para que el fundido de la carga termine antes
            // de que arranque el viaje del jeep.
            setTimeout(() => recorrido.irA(0, { intro: true }), 550);
        }
    }, 450);
}

arrancar();

/* =====================================================================
   INTERFAZ
   Todo lo que no es 3D: tarjeta, pestañas, ruta, quiz, glosario,
   guía docente, desafío, narración y ficha imprimible.
   ===================================================================== */

import { CUERPOS, NIVELES, GLOSARIO, todasLasPreguntas } from './datos.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function normalizar(texto) {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function escaparHtml(texto) {
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function mezclar(lista) {
    const copia = lista.slice();
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}

export class Interfaz {
    constructor({ recorrido, nivel = 'exploradores' }) {
        this.recorrido = recorrido;
        this.nivel = NIVELES[nivel] ? nivel : 'exploradores';
        this.idx = 0;
        this.auto = false;
        this.hablando = false;
        this.panelPlegado = false;
        this.modalAbierto = null;
        this.ultimoFoco = null;
        this.quiz = { idx: -1, i: 0, aciertos: 0, respondida: false, terminado: false };
        this.desafio = { preguntas: [], i: 0, aciertos: 0, respondida: false, terminado: false };
        this._cachear();
        this._crearRegionAnuncios();
        this._construirRuta();
        this._eventos();
        this._observarPanel();
        this.render(0);
        this._configurarVoz();
    }

    /* ------------------------------------------------------------ DOM */
    _cachear() {
        this.el = {
            panel: $('#panel'),
            panelBody: $('#panelBody'),
            btnPanelToggle: $('#btnPanelToggle'),
            badge: $('#badge'),
            badgeEmoji: $('#badgeEmoji'),
            eyebrow: $('#pEyebrow'),
            nombre: $('#pNombre'),
            tagline: $('#pTagline'),
            desc: $('#pDesc'),
            sabias: $('#pSabias'),
            comparacion: $('#pComparacion'),
            glosario: $('#pGlosario'),
            datos: $('#pDatos'),
            curiosidades: $('#pCuriosidades'),
            quiz: $('#pQuiz'),
            ruta: $('#routeTrack'),
            btnPrev: $('#btnPrev'),
            btnNext: $('#btnNext'),
            btnEscuchar: $('#btnEscuchar'),
            btnImprimir: $('#btnImprimir'),
            btnAuto: $('#btnAuto'),
            intro: $('#introOverlay'),
            introMeter: $('#introMeter'),
            loading: $('#loading'),
            loadProgress: $('#loadProgress'),
            loadStatus: $('#loadStatus'),
            toast: $('#toast'),
            modalGlosario: $('#modalGlosario'),
            modalGuia: $('#modalGuia'),
            modalDesafio: $('#modalDesafio'),
            glosarioLista: $('#glosarioLista'),
            glosarioBuscar: $('#glosarioBuscar'),
            desafioCuerpo: $('#desafioCuerpo')
        };
    }

    _crearRegionAnuncios() {
        const p = document.createElement('p');
        p.className = 'sr-only';
        p.setAttribute('aria-live', 'polite');
        p.id = 'anuncio';
        document.body.appendChild(p);
        this.anuncio = p;
    }

    /* --------------------------------------------------------- EVENTOS */
    _eventos() {
        this.el.btnPrev.addEventListener('click', () => this.ir(this.idx - 1, { manual: true }));
        this.el.btnNext.addEventListener('click', () => this.ir(this.idx + 1, { manual: true }));

        this.el.ruta.addEventListener('click', (e) => {
            const pill = e.target.closest('[data-idx]');
            if (!pill) return;
            this.ir(Number(pill.dataset.idx), { manual: true });
        });

        // Pestañas
        $$('.tabs [role="tab"]').forEach((tab) => {
            tab.addEventListener('click', () => this._activarTab(tab.dataset.tab));
            tab.addEventListener('keydown', (e) => {
                const tabs = $$('.tabs [role="tab"]');
                const i = tabs.indexOf(tab);
                let destino = null;
                if (e.key === 'ArrowRight') destino = tabs[(i + 1) % tabs.length];
                if (e.key === 'ArrowLeft') destino = tabs[(i - 1 + tabs.length) % tabs.length];
                if (e.key === 'Home') destino = tabs[0];
                if (e.key === 'End') destino = tabs[tabs.length - 1];
                if (!destino) return;
                e.preventDefault();
                destino.focus();
                this._activarTab(destino.dataset.tab);
            });
        });

        // Plegar la ficha (solo móvil/tablet vertical)
        if (this.el.btnPanelToggle) {
            this.el.btnPanelToggle.addEventListener('click', () => this.alternarPanel());
            const plegable = window.matchMedia('(max-width: 900px) and (min-height: 521px)');
            const alCambiarPlegable = () => {
                if (!plegable.matches && this.panelPlegado) this.alternarPanel(false);
            };
            if (plegable.addEventListener) plegable.addEventListener('change', alCambiarPlegable);
            else if (plegable.addListener) plegable.addListener(alCambiarPlegable);
        }

        // Nivel
        $$('.nivel-switch [data-nivel]').forEach((btn) => {
            btn.addEventListener('click', () => this.setNivel(btn.dataset.nivel));
        });

        this.el.btnAuto.addEventListener('click', () => this.toggleAuto());
        $('#btnFullscreen').addEventListener('click', () => this.togglePantallaCompleta());
        $('#btnGuia').addEventListener('click', () => this.abrirModal('guia'));
        $('#btnGlosario').addEventListener('click', () => this.abrirModal('glosario'));
        $('#btnDesafio').addEventListener('click', () => this.abrirDesafio());

        this.el.btnImprimir.addEventListener('click', () => this.imprimirFicha());
        $('#btnSkipIntro').addEventListener('click', () => this.saltarIntro());
        const btnRepetirIntro = $('#btnRepetirIntro');
        if (btnRepetirIntro) btnRepetirIntro.addEventListener('click', () => this.repetirIntro());

        // Chips de glosario (delegación)
        this.el.glosario.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-glosario]');
            if (!chip) return;
            this.abrirGlosario(chip.dataset.glosario);
        });

        // Quiz de la ficha (delegación)
        this.el.quiz.addEventListener('click', (e) => {
            const opt = e.target.closest('[data-opcion]');
            if (opt) {
                this._responderQuiz(Number(opt.dataset.opcion));
                return;
            }
            if (e.target.closest('[data-quiz-siguiente]')) this._siguienteQuiz();
            if (e.target.closest('[data-quiz-reiniciar]')) this._reiniciarQuiz();
        });

        // Desafío
        this.el.desafioCuerpo.addEventListener('click', (e) => {
            const opt = e.target.closest('[data-opcion]');
            if (opt) {
                this._responderDesafio(Number(opt.dataset.opcion));
                return;
            }
            if (e.target.closest('[data-desafio-siguiente]')) this._siguienteDesafio();
            if (e.target.closest('[data-desafio-reiniciar]')) this._iniciarDesafio();
        });

        // Buscador del glosario
        this.el.glosarioBuscar.addEventListener('input', () => this._filtrarGlosario());

        // Modales
        $$('.modal').forEach((modal) => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.closest('[data-close]')) this.cerrarModal();
            });
        });

        // Teclado global
        document.addEventListener('keydown', (e) => this._teclado(e));

        // Pantalla completa
        document.addEventListener('fullscreenchange', () => {
            const btn = $('#btnFullscreen');
            btn.setAttribute('aria-pressed', String(!!document.fullscreenElement));
        });
    }

    _observarPanel() {
        if (!('ResizeObserver' in window)) return;
        this._rafEncuadre = null;
        const ro = new ResizeObserver(() => {
            if (this._rafEncuadre) return;
            this._rafEncuadre = requestAnimationFrame(() => {
                this._rafEncuadre = null;
                this.recorrido.actualizarTamano();
            });
        });
        ro.observe(this.el.panel);
    }

    /* ------------------------------------------------------------ RUTA */
    _construirRuta() {
        this.el.ruta.innerHTML = '';
        CUERPOS.forEach((cuerpo, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'route-pill';
            btn.dataset.idx = String(i);
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-label', `Parada ${i + 1}: ${cuerpo.nombre}`);
            btn.innerHTML = `<span class="rp-emoji" aria-hidden="true">${cuerpo.emoji}</span>
                <span class="rp-name">${cuerpo.nombre}</span>
                <span class="rp-num">${i + 1}</span>`;
            this.el.ruta.appendChild(btn);
        });
        this.pills = $$('.route-pill');
    }

    _marcarRuta() {
        this.pills.forEach((pill, i) => {
            if (i === this.idx) pill.setAttribute('aria-current', 'true');
            else pill.removeAttribute('aria-current');
        });
        const activa = this.pills[this.idx];
        if (activa) {
            const izquierda = activa.offsetLeft - this.el.ruta.clientWidth / 2 + activa.offsetWidth / 2;
            this.el.ruta.scrollTo({ left: Math.max(0, izquierda), behavior: 'smooth' });
        }
    }

    /* ------------------------------------------------------------ RENDER */
    render(idx) {
        const cuerpo = CUERPOS[idx];
        if (!cuerpo) return;
        this.idx = idx;
        const nivel = NIVELES[this.nivel];

        this.el.eyebrow.innerHTML = `Parada ${idx + 1} de ${CUERPOS.length}<span class="eyebrow-tipo"> · ${escaparHtml(cuerpo.tipo)}</span>`;
        this.el.nombre.textContent = cuerpo.nombre;
        this.el.tagline.textContent = cuerpo.resumen;
        this.el.desc.textContent = cuerpo.descripcion[this.nivel];

        if (cuerpo.miniatura) {
            this.el.badge.style.backgroundImage = `url(${cuerpo.miniatura})`;
            this.el.badge.classList.add('has-image');
        } else {
            this.el.badge.style.backgroundImage = '';
            this.el.badge.classList.remove('has-image');
            this.el.badgeEmoji.textContent = cuerpo.emoji;
        }

        const cur = cuerpo.curiosidades[0];
        this.el.sabias.innerHTML = `<b>¿Sabías que…?</b> ${escaparHtml(cur.texto)}`;
        this.el.comparacion.innerHTML = `<span class="comp-icon" aria-hidden="true">📏</span><span>${escaparHtml(cuerpo.comparacion)}</span>`;

        this.el.glosario.innerHTML = cuerpo.glosario
            .map((id) => GLOSARIO.find((g) => g.id === id))
            .filter(Boolean)
            .map((g) => `<button type="button" class="chip" data-glosario="${g.id}">${escaparHtml(g.termino)}</button>`)
            .join('');

        this.el.datos.innerHTML = cuerpo.datos.map((d) => `
            <div class="dato">
                <dt>${escaparHtml(d.etiqueta)}</dt>
                <dd>${escaparHtml(d.valor)}${d.nota ? `<small>${escaparHtml(d.nota)}</small>` : ''}</dd>
            </div>`).join('');

        this.el.curiosidades.innerHTML = cuerpo.curiosidades.map((c) => `
            <article class="curiosidad">
                <span class="cur-icon" aria-hidden="true">${c.icono}</span>
                <div><h4>${escaparHtml(c.titulo)}</h4><p>${escaparHtml(c.texto)}</p></div>
            </article>`).join('');

        this._reiniciarQuiz();
        this._marcarRuta();
        this.anuncio.textContent = `Parada ${idx + 1}: ${cuerpo.nombre}. ${cuerpo.resumen}`;
        this.el.panelBody.scrollTop = 0;

        // El nivel cambia el texto: refrescamos también el botón de escucha.
        this._actualizarBotonVoz();
        this.el.eyebrow.title = `Nivel ${nivel.nombre} (${nivel.edades})`;
    }

    setNivel(nivel) {
        if (!NIVELES[nivel] || nivel === this.nivel) return;
        this.nivel = nivel;
        $$('.nivel-switch [data-nivel]').forEach((btn) => {
            const activo = btn.dataset.nivel === nivel;
            btn.classList.toggle('active', activo);
            btn.setAttribute('aria-pressed', String(activo));
        });
        try { localStorage.setItem('dinoaventura-nivel', nivel); } catch { /* modo privado */ }
        this._detenerVoz();
        this.render(this.idx);
        this.notificar(`Nivel ${NIVELES[nivel].nombre} activado (${NIVELES[nivel].edades})`);
    }

    /* ------------------------------------------------------------- IR */
    ir(idx, { manual = false } = {}) {
        const total = CUERPOS.length;
        idx = ((idx % total) + total) % total;
        if (manual && this.auto) this.toggleAuto(false);
        this._detenerVoz();
        this.recorrido.irA(idx);
    }

    /* ----------------------------------------------------------- PESTAÑAS */
    _activarTab(nombre, enfocar = false) {
        $$('.tabs [role="tab"]').forEach((tab) => {
            const activo = tab.dataset.tab === nombre;
            tab.setAttribute('aria-selected', String(activo));
            tab.tabIndex = activo ? 0 : -1;
            if (activo && enfocar) tab.focus();
        });
        $$('.tab-panel').forEach((panel) => {
            const activo = panel.dataset.panel === nombre;
            panel.classList.toggle('active', activo);
            panel.hidden = !activo;
        });
        this.el.panelBody.scrollTop = 0;
        if (nombre === 'quiz') this._renderQuiz();
        this.recorrido.actualizarTamano();
    }

    /* --------------------------------------------------- PLEGAR LA FICHA */
    alternarPanel(force) {
        const plegar = typeof force === 'boolean' ? force : !this.panelPlegado;
        if (plegar === this.panelPlegado) return;
        this.panelPlegado = plegar;
        this.el.panel.classList.toggle('minimizado', plegar);

        const btn = this.el.btnPanelToggle;
        if (btn) {
            btn.setAttribute('aria-expanded', String(!plegar));
            btn.setAttribute('aria-label', plegar
                ? 'Mostrar la ficha del dinosaurio'
                : 'Minimizar la ficha para ver mejor la escena');
            btn.title = plegar ? 'Mostrar la ficha' : 'Minimizar la ficha';
            const icono = btn.querySelector('.pt-icon');
            const texto = btn.querySelector('.pt-text');
            if (icono) icono.textContent = plegar ? '▴' : '▾';
            if (texto) texto.textContent = plegar ? 'Ver ficha' : 'Minimizar';
        }

        if (plegar) {
            // Si el foco estaba dentro de la ficha, lo pasamos al botón
            // antes de ocultarla para no perderlo.
            const activo = document.activeElement;
            if (btn && activo && activo !== btn && this.el.panel.contains(activo)) btn.focus();
            this.anuncio.textContent = 'Ficha minimizada. Usá el botón Ver ficha para abrirla.';
        } else {
            this.el.panelBody.scrollTop = 0;
            this.anuncio.textContent = 'Ficha abierta.';
        }

        // La cámara reencuadra la escena en el espacio libre que queda.
        this.recorrido.actualizarTamano();
    }

    /* -------------------------------------------------------------- QUIZ */
    _reiniciarQuiz() {
        this.quiz = { idx: this.idx, i: 0, aciertos: 0, respondida: false, terminado: false };
        this._renderQuiz();
    }

    _renderQuiz() {
        const cuerpo = CUERPOS[this.idx];
        if (!cuerpo || !cuerpo.quiz.length) {
            this.el.quiz.innerHTML = '<p class="desc">Esta parada no tiene preguntas.</p>';
            return;
        }
        if (this.quiz.idx !== this.idx) {
            this.quiz = { idx: this.idx, i: 0, aciertos: 0, respondida: false, terminado: false };
        }
        const q = this.quiz;

        if (q.terminado) {
            const total = cuerpo.quiz.length;
            const perfecto = q.aciertos === total;
            this.el.quiz.innerHTML = `
                <p class="quiz-progress">Resultado</p>
                <p class="quiz-q">${perfecto ? '¡Perfecto! 🎉' : '¡Buen trabajo!'}</p>
                <p class="desc">Acertaste <b>${q.aciertos} de ${total}</b> preguntas de ${escaparHtml(cuerpo.nombre)}.</p>
                <div class="quiz-foot">
                    <button type="button" class="btn btn-primary" data-quiz-reiniciar>↻ Intentar de nuevo</button>
                    <button type="button" class="btn btn-soft" data-tab-ir="datos">Ver datos</button>
                </div>`;
            const verDatos = this.el.quiz.querySelector('[data-tab-ir="datos"]');
            if (verDatos) verDatos.addEventListener('click', () => this._activarTab('datos'));
            return;
        }

        const pregunta = cuerpo.quiz[q.i];
        const letras = ['A', 'B', 'C', 'D'];
        this.el.quiz.innerHTML = `
            <p class="quiz-progress">Pregunta ${q.i + 1} de ${cuerpo.quiz.length} · ${escaparHtml(cuerpo.nombre)}</p>
            <p class="quiz-q">${escaparHtml(pregunta.pregunta)}</p>
            <div class="quiz-opts">
                ${pregunta.opciones.map((op, i) => {
                    let clase = 'quiz-opt';
                    if (q.respondida) {
                        if (i === pregunta.correcta) clase += ' correcta';
                        else if (i === q.elegida) clase += ' incorrecta';
                    }
                    return `<button type="button" class="${clase}" data-opcion="${i}" ${q.respondida ? 'disabled' : ''}>
                        <b>${letras[i]}.</b> ${escaparHtml(op)}
                    </button>`;
                }).join('')}
            </div>
            ${q.respondida ? `<p class="quiz-fb ${q.elegida === pregunta.correcta ? 'ok' : 'bad'}">
                ${q.elegida === pregunta.correcta ? '✅ ¡Correcto!' : '❌ Casi. La respuesta correcta era <b>' + escaparHtml(pregunta.opciones[pregunta.correcta]) + '</b>.'}
                ${escaparHtml(pregunta.explicacion)}
            </p>` : ''}
            ${q.respondida ? `<div class="quiz-foot">
                <button type="button" class="btn btn-primary" data-quiz-siguiente>
                    ${q.i + 1 < cuerpo.quiz.length ? 'Siguiente pregunta →' : 'Ver resultado →'}
                </button>
            </div>` : ''}`;
    }

    _responderQuiz(opcion) {
        const q = this.quiz;
        if (q.respondida || q.terminado) return;
        const cuerpo = CUERPOS[this.idx];
        const pregunta = cuerpo.quiz[q.i];
        q.respondida = true;
        q.elegida = opcion;
        if (opcion === pregunta.correcta) q.aciertos++;
        this._renderQuiz();
    }

    _siguienteQuiz() {
        const q = this.quiz;
        const total = CUERPOS[this.idx].quiz.length;
        if (q.i + 1 >= total) {
            q.terminado = true;
        } else {
            q.i++;
            q.respondida = false;
            q.elegida = null;
        }
        this._renderQuiz();
    }

    /* ------------------------------------------------------------ DESAFÍO */
    abrirDesafio() {
        this._detenerVoz();
        if (this.auto) this.toggleAuto(false);
        this._iniciarDesafio();
        this.abrirModal('desafio');
    }

    _iniciarDesafio() {
        const todas = todasLasPreguntas();
        this.desafio = {
            preguntas: mezclar(todas).slice(0, 8),
            i: 0,
            aciertos: 0,
            respondida: false,
            terminado: false
        };
        this._renderDesafio();
    }

    _renderDesafio() {
        const d = this.desafio;
        const total = d.preguntas.length;

        if (d.terminado) {
            let record = 0;
            try { record = Number(localStorage.getItem('recorrido-desafio-record') || 0); } catch { /* privado */ }
            if (d.aciertos > record) {
                record = d.aciertos;
                try { localStorage.setItem('recorrido-desafio-record', String(record)); } catch { /* privado */ }
            }
            const estrellas = d.aciertos >= 7 ? 3 : d.aciertos >= 5 ? 2 : d.aciertos >= 3 ? 1 : 0;
            const mensaje = d.aciertos >= 7
                ? '¡Sos un experto en dinosaurios!'
                : d.aciertos >= 5
                    ? '¡Muy bien! Ya conocés bastante del espacio.'
                    : 'Buen intento. Recorré las paradas y volvé a probar.';
            this.el.desafioCuerpo.innerHTML = `
                <div class="desafio-resultado">
                    <p class="quiz-progress">Desafío completado</p>
                    <div class="estrellas" aria-hidden="true">${'★'.repeat(estrellas)}${'☆'.repeat(3 - estrellas)}</div>
                    <div class="puntaje">${d.aciertos} / ${total}</div>
                    <p>${mensaje}</p>
                    <p>Récord de este navegador: <b>${record} / ${total}</b></p>
                    <div class="quiz-foot" style="justify-content:center">
                        <button type="button" class="btn btn-primary" data-desafio-reiniciar>↻ Jugar otra vez</button>
                        <button type="button" class="btn btn-soft" data-close>Volver al recorrido</button>
                    </div>
                </div>`;
            return;
        }

        const q = d.preguntas[d.i];
        const letras = ['A', 'B', 'C', 'D'];
        const pct = Math.round((d.i / total) * 100);
        this.el.desafioCuerpo.innerHTML = `
            <div class="desafio-top">
                <span>Pregunta ${d.i + 1} de ${total}</span>
                <span>${d.aciertos} acierto${d.aciertos === 1 ? '' : 's'} · ${escaparHtml(q.origen)}</span>
            </div>
            <div class="desafio-barra"><span style="width:${pct}%"></span></div>
            <p class="quiz-q">${escaparHtml(q.pregunta)}</p>
            <div class="quiz-opts">
                ${q.opciones.map((op, i) => {
                    let clase = 'quiz-opt';
                    if (d.respondida) {
                        if (i === q.correcta) clase += ' correcta';
                        else if (i === d.elegida) clase += ' incorrecta';
                    }
                    return `<button type="button" class="${clase}" data-opcion="${i}" ${d.respondida ? 'disabled' : ''}>
                        <b>${letras[i]}.</b> ${escaparHtml(op)}
                    </button>`;
                }).join('')}
            </div>
            ${d.respondida ? `<p class="quiz-fb ${d.elegida === q.correcta ? 'ok' : 'bad'}">
                ${d.elegida === q.correcta ? '✅ ¡Correcto!' : '❌ La respuesta correcta era <b>' + escaparHtml(q.opciones[q.correcta]) + '</b>.'}
                ${escaparHtml(q.explicacion)}
            </p>
            <div class="quiz-foot">
                <button type="button" class="btn btn-primary" data-desafio-siguiente>
                    ${d.i + 1 < total ? 'Siguiente →' : 'Ver resultado →'}
                </button>
            </div>` : ''}`;
    }

    _responderDesafio(opcion) {
        const d = this.desafio;
        if (d.respondida || d.terminado) return;
        const q = d.preguntas[d.i];
        d.respondida = true;
        d.elegida = opcion;
        if (opcion === q.correcta) d.aciertos++;
        this._renderDesafio();
    }

    _siguienteDesafio() {
        const d = this.desafio;
        if (d.i + 1 >= d.preguntas.length) d.terminado = true;
        else {
            d.i++;
            d.respondida = false;
            d.elegida = null;
        }
        this._renderDesafio();
    }

    /* ---------------------------------------------------------- GLOSARIO */
    _renderGlosario(filtro = '') {
        const f = normalizar(filtro.trim());
        const lista = GLOSARIO.filter((g) => !f || normalizar(g.termino).includes(f) || normalizar(g.def).includes(f));
        if (!lista.length) {
            this.el.glosarioLista.innerHTML = '<p class="glosario-vacio">No encontramos esa palabra. Probá con otra.</p>';
            return;
        }
        this.el.glosarioLista.innerHTML = lista.map((g) => `
            <dl class="glosario-item" id="glos-${g.id}">
                <dt>${escaparHtml(g.termino)}</dt>
                <dd>${escaparHtml(g.def)}</dd>
            </dl>`).join('');
    }

    _filtrarGlosario() {
        this._renderGlosario(this.el.glosarioBuscar.value);
    }

    abrirGlosario(terminoId = null) {
        this._renderGlosario('');
        this.el.glosarioBuscar.value = '';
        this.abrirModal('glosario');
        if (terminoId) {
            const item = document.getElementById(`glos-${terminoId}`);
            if (item) {
                setTimeout(() => {
                    item.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    item.classList.add('resaltado');
                    setTimeout(() => item.classList.remove('resaltado'), 1900);
                }, 120);
            }
        }
    }

    /* ----------------------------------------------------------- MODALES */
    abrirModal(nombre) {
        const mapa = {
            glosario: this.el.modalGlosario,
            guia: this.el.modalGuia,
            desafio: this.el.modalDesafio
        };
        const modal = mapa[nombre];
        if (!modal) return;
        this.ultimoFoco = document.activeElement;
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        this.modalAbierto = modal;
        const cerrar = modal.querySelector('.modal-close');
        if (cerrar) setTimeout(() => cerrar.focus(), 30);
    }

    cerrarModal() {
        if (!this.modalAbierto) return;
        this.modalAbierto.classList.add('hidden');
        this.modalAbierto.setAttribute('aria-hidden', 'true');
        this.modalAbierto = null;
        if (this.ultimoFoco && this.ultimoFoco.focus) this.ultimoFoco.focus();
    }

    _trampaFoco(e) {
        if (!this.modalAbierto || e.key !== 'Tab') return;
        const focos = Array.from(this.modalAbierto.querySelectorAll(
            'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter((el) => el.offsetParent !== null);
        if (!focos.length) return;
        const primero = focos[0];
        const ultimo = focos[focos.length - 1];
        if (e.shiftKey && document.activeElement === primero) {
            e.preventDefault();
            ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
            e.preventDefault();
            primero.focus();
        }
    }

    /* -------------------------------------------------------------- VOZ */
    _configurarVoz() {
        if (!('speechSynthesis' in window)) {
            this.el.btnEscuchar.disabled = true;
            this.el.btnEscuchar.title = 'Este navegador no tiene lectura en voz alta.';
            return;
        }
        this.el.btnEscuchar.addEventListener('click', () => this.alternarVoz());
    }

    _actualizarBotonVoz() {
        if (!('speechSynthesis' in window)) return;
        this.el.btnEscuchar.textContent = this.hablando ? '⏹ Detener' : '🔊 Escuchar';
        this.el.btnEscuchar.setAttribute('aria-pressed', String(this.hablando));
    }

    alternarVoz() {
        if (!('speechSynthesis' in window)) {
            this.notificar('Este navegador no tiene lectura en voz alta.');
            return;
        }
        if (this.hablando) {
            this._detenerVoz();
            return;
        }
        const cuerpo = CUERPOS[this.idx];
        const nivel = NIVELES[this.nivel];
        const curiosidad = cuerpo.curiosidades[0];
        const texto = `${cuerpo.nombre}. ${cuerpo.descripcion[this.nivel]} ¿Sabías que ${curiosidad.texto}`;
        const utt = new SpeechSynthesisUtterance(texto);
        utt.lang = 'es-AR';
        utt.rate = nivel.voz.rate;
        utt.pitch = nivel.voz.pitch;
        const voces = speechSynthesis.getVoices();
        const enEspanol = voces.find((v) => v.lang && v.lang.toLowerCase().startsWith('es'));
        if (enEspanol) utt.voice = enEspanol;
        utt.onend = () => {
            this.hablando = false;
            this._actualizarBotonVoz();
        };
        utt.onerror = () => {
            this.hablando = false;
            this._actualizarBotonVoz();
        };
        speechSynthesis.cancel();
        speechSynthesis.speak(utt);
        this.hablando = true;
        this._actualizarBotonVoz();
    }

    _detenerVoz() {
        if (!('speechSynthesis' in window)) return;
        if (this.hablando) {
            speechSynthesis.cancel();
            this.hablando = false;
            this._actualizarBotonVoz();
        }
    }

    /* ------------------------------------------------------ IMPRIMIR */
    imprimirFicha() {
        const cuerpo = CUERPOS[this.idx];
        const nivel = NIVELES[this.nivel];
        const hoy = new Date().toLocaleDateString('es-AR');
        const filas = cuerpo.datos.map((d) => `<tr><th>${escaparHtml(d.etiqueta)}</th><td>${escaparHtml(d.valor)}${d.nota ? ` <small>(${escaparHtml(d.nota)})</small>` : ''}</td></tr>`).join('');
        const curiosidades = cuerpo.curiosidades.map((c) => `<li><b>${escaparHtml(c.titulo)}:</b> ${escaparHtml(c.texto)}</li>`).join('');
        const preguntas = cuerpo.quiz.map((q, i) => `
            <div class="preg">
                <p><b>${i + 1}.</b> ${escaparHtml(q.pregunta)}</p>
                <ol type="a">${q.opciones.map((op, j) => `<li>${escaparHtml(op)}${j === q.correcta ? ' <span class="ok">(correcta)</span>' : ''}</li>`).join('')}</ol>
            </div>`).join('');

        const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>Ficha · ${escaparHtml(cuerpo.nombre)}</title>
<style>
    @page { margin: 18mm; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #16202e; line-height: 1.5; font-size: 12pt; }
    header { border-bottom: 3px solid #1f8fc4; padding-bottom: 10px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
    header h1 { font-size: 24pt; margin: 0; letter-spacing: .02em; }
    header p { margin: 2px 0 0; color: #5b6b80; font-size: 10pt; }
    .emoji { font-size: 30pt; }
    h2 { font-size: 13pt; color: #1f8fc4; margin: 20px 0 6px; text-transform: uppercase; letter-spacing: .06em; }
    p { margin: 0 0 8px; }
    .lead { font-size: 13pt; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #d8e2ec; vertical-align: top; }
    th { width: 38%; color: #40536b; font-weight: 600; }
    ul { margin: 0; padding-left: 20px; }
    li { margin-bottom: 5px; }
    .quiz { page-break-inside: avoid; }
    .preg { margin-bottom: 12px; }
    .preg ol { margin: 4px 0 0; padding-left: 22px; }
    .ok { color: #1a7f4b; font-weight: 700; }
    footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #d8e2ec; font-size: 9pt; color: #6a7a8d; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; background: #e8f4fb; color: #1f8fc4; font-size: 9pt; }
</style></head>
<body>
    <header>
        <div>
            <h1>${escaparHtml(cuerpo.nombre)}</h1>
            <p>${escaparHtml(cuerpo.tipo)} · ${escaparHtml(cuerpo.resumen)}</p>
        </div>
        <div class="emoji">${cuerpo.emoji}</div>
    </header>
    <p><span class="badge">Nivel ${escaparHtml(nivel.nombre)} · ${escaparHtml(nivel.edades)}</span> &nbsp; Fecha: ${hoy}</p>
    <h2>Descripción</h2>
    <p class="lead">${escaparHtml(cuerpo.descripcion[this.nivel])}</p>
    <h2>Datos</h2>
    <table>${filas}</table>
    <h2>Curiosidades</h2>
    <ul>${curiosidades}</ul>
    <h2>Comparación</h2>
    <p>${escaparHtml(cuerpo.comparacion)}</p>
    <h2 class="quiz">Quiz</h2>
    <div class="quiz">${preguntas}</div>
    <footer>Dinoaventura · Dinosaurios para escuelas primarias · Ficha generada desde el recorrido interactivo.</footer>
</body></html>`;

        const ventana = window.open('', '_blank');
        if (!ventana) {
            this.notificar('El navegador bloqueó la ventana de impresión. Permití las ventanas emergentes.');
            return;
        }
        ventana.document.open();
        ventana.document.write(html);
        ventana.document.close();
        setTimeout(() => {
            ventana.focus();
            ventana.print();
        }, 450);
    }

    /* ------------------------------------------------------------ CARGA */
    progreso(pct, texto) {
        const valor = Math.max(0, Math.min(100, Math.round(pct * 100)));
        this.el.loadProgress.style.width = `${valor}%`;
        if (texto) this.el.loadStatus.textContent = texto;
    }

    ocultarCarga() {
        this.el.loading.classList.add('oculto');
        document.body.classList.remove('cargando');
    }

    /* ------------------------------------------------------------ INTRO */
    mostrarIntro() {
        document.body.classList.add('intro-activa');
        this.el.intro.classList.remove('hidden');
        this.el.intro.setAttribute('aria-hidden', 'false');
        // Reinicia la barra de progreso de la intro.
        this.el.introMeter.style.animation = 'none';
        void this.el.introMeter.offsetWidth;
        this.el.introMeter.style.animation = '';
    }

    ocultarIntro() {
        this.el.intro.classList.add('hidden');
        this.el.intro.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('intro-activa');
    }

    saltarIntro() {
        this.recorrido.saltarIntro();
        this.ocultarIntro();
    }

    repetirIntro() {
        if (this.modalAbierto) this.cerrarModal();
        this._detenerVoz();
        this.recorrido.irA(this.recorrido.destinoActual, { intro: true });
    }

    /* ------------------------------------------------------------- AUTO */
    toggleAuto(forzar = null) {
        this.auto = forzar === null ? !this.auto : forzar;
        this.el.btnAuto.setAttribute('aria-pressed', String(this.auto));
        const icono = this.el.btnAuto.querySelector('span');
        if (icono) icono.textContent = this.auto ? '⏸' : '▶';
        if (this.auto) {
            this.recorrido.activarTour(true, 9000);
            this.notificar('Recorrido automático activado · 9 segundos por parada');
        } else {
            this.recorrido.activarTour(false);
        }
    }

    /* ----------------------------------------------------- PANTALLA COMPLETA */
    async togglePantallaCompleta() {
        try {
            if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
            else await document.exitFullscreen();
        } catch {
            this.notificar('Este navegador no permitió la pantalla completa.');
        }
    }

    /* ------------------------------------------------------------- TECLADO */
    _teclado(e) {
        if (e.key === 'Escape') {
            if (this.modalAbierto) {
                this.cerrarModal();
                return;
            }
            if (this.hablando) {
                this._detenerVoz();
                return;
            }
        }
        if (this.modalAbierto) {
            this._trampaFoco(e);
            return;
        }
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.ir(this.idx + 1, { manual: true });
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.ir(this.idx - 1, { manual: true });
        } else if (e.key === 'Home') {
            e.preventDefault();
            this.ir(0, { manual: true });
        } else if (e.key === 'End') {
            e.preventDefault();
            this.ir(CUERPOS.length - 1, { manual: true });
        } else if (e.key.toLowerCase() === 'p') {
            e.preventDefault();
            this.toggleAuto();
        } else if (e.key.toLowerCase() === 'm') {
            // Solo cuando el botón está visible (móvil/tablet vertical).
            if (this.el.btnPanelToggle && this.el.btnPanelToggle.offsetParent !== null) {
                e.preventDefault();
                this.alternarPanel();
            }
        } else if (e.key.toLowerCase() === 'i') {
            e.preventDefault();
            this.repetirIntro();
        }
    }

    /* --------------------------------------------------------------- TOAST */
    notificar(texto, ms = 3000) {
        clearTimeout(this._toastTimer);
        this.el.toast.textContent = texto;
        this.el.toast.classList.add('visible');
        this._toastTimer = setTimeout(() => this.el.toast.classList.remove('visible'), ms);
    }
}

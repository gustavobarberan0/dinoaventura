/* =====================================================================
   DATOS DE DINOAVENTURA
   Todo el contenido educativo vive acá. Para agregar o editar una parada
   no hace falta tocar la escena 3D ni la interfaz.
   ===================================================================== */

export const NIVELES = {
    exploradores: {
        id: 'exploradores',
        nombre: 'Exploradores',
        edades: '6 a 9 años',
        emoji: '🔭',
        voz: { rate: 0.9, pitch: 1.05 }
    },
    cientificos: {
        id: 'cientificos',
        nombre: 'Científicos',
        edades: '10 a 12 años',
        emoji: '🥽',
        voz: { rate: 1.0, pitch: 1.0 }
    }
};

// Cada parada es un campamento del safari. La x separa los dioramas en el
// mundo 3D; el resto de la información es contenido para la ficha.
export const CUERPOS = [
    /* ------------------------------------------------------------- TRIÁSICO */
    {
        id: 'triasico',
        nombre: 'Triásico',
        emoji: '🌋',
        tipo: 'Período',
        color: '#d98a4a',
        pos: { x: 0, y: 0, z: 0 },
        resumen: 'Donde aparecieron los primeros dinosaurios.',
        descripcion: {
            exploradores: 'Hace unos 230 millones de años todos los continentes estaban pegados en uno solo, llamado Pangea. El clima era cálido y seco. Allí aparecieron los primeros dinosaurios: animales pequeños, rápidos y con las patas debajo del cuerpo, no hacia los costados como los cocodrilos.',
            cientificos: 'El Triásico se extendió entre 252 y 201 millones de años atrás. Después de la extinción del Pérmico-Triásico, los arcosaurios se diversificaron. Los primeros dinosaurios conocidos (Eoraptor, Herrerasaurus y Plateosaurus) aparecieron hace unos 233 millones de años en el sur de Pangea. Su postura erecta, con las patas bajo el cuerpo, y rasgos del cráneo y de la cadera los diferencian de otros reptiles.'
        },
        datos: [
            { etiqueta: 'Cuándo', valor: 'Hace 252 a 201 millones de años' },
            { etiqueta: 'Duración', valor: 'unos 51 millones de años' },
            { etiqueta: 'Continentes', valor: 'Pangea, un solo bloque' },
            { etiqueta: 'Clima', valor: 'Cálido y seco, con estaciones' },
            { etiqueta: 'Primeros dinosaurios', valor: 'hace unos 233 millones de años' },
            { etiqueta: 'Ejemplos', valor: 'Eoraptor, Herrerasaurus, Plateosaurus' },
            { etiqueta: 'Plantas', valor: 'Coníferas, helechos y cícadas' },
            { etiqueta: 'Cómo termina', valor: 'Extinción del Triásico-Jurásico' }
        ],
        curiosidades: [
            { icono: '🐊', titulo: 'No eran los dueños', texto: 'Al principio los dinosaurios eran minoría. Cocodrilos primitivos y otros reptiles eran más grandes y abundantes.' },
            { icono: '🧩', titulo: 'Un solo continente', texto: 'En Pangea se podía caminar desde el polo norte hasta el polo sur sin cruzar ningún océano.' },
            { icono: '🦵', titulo: 'Patas bajo el cuerpo', texto: 'Esa postura les permitía correr más rápido y gastar menos energía que los reptiles con patas abiertas.' }
        ],
        comparacion: 'El Eoraptor medía 1 metro de largo: como un perro mediano. El Plateosaurus llegaba a 8 metros: como un colectivo.',
        glosario: ['triasico', 'pangea', 'arcosaurio', 'dinosaurio', 'bipedo', 'fosil'],
        quiz: [
            { pregunta: '¿Cómo se llamaba el supercontinente del Triásico?', opciones: ['Gondwana', 'Pangea', 'Laurasia'], correcta: 1, explicacion: 'Hace unos 250 millones de años casi todas las tierras emergidas formaban un único continente: Pangea.' },
            { pregunta: '¿Qué tenía de especial la postura de los primeros dinosaurios?', opciones: ['Caminaban en dos patas siempre', 'Tenían las patas debajo del cuerpo', 'Se arrastraban como las serpientes'], correcta: 1, explicacion: 'Sus patas estaban bajo el cuerpo, no abiertas hacia los costados. Eso les permitía correr con más eficiencia.' }
        ]
    },

    /* -------------------------------------------------------------- JURÁSICO */
    {
        id: 'jurasico',
        nombre: 'Jurásico',
        emoji: '🌿',
        tipo: 'Período',
        color: '#4f9d5d',
        pos: { x: 120, y: 0, z: 0 },
        resumen: 'La edad de los gigantes de cuello largo.',
        descripcion: {
            exploradores: 'Pangea se partió y aparecieron mares entre los continentes. El clima se volvió más húmedo y crecieron selvas enormes. Los saurópodos, como el Brachiosaurus, se hicieron gigantes: comían hojas de las copas altas y tenían estómagos enormes para procesar tanta comida.',
            cientificos: 'Entre 201 y 145 millones de años atrás, la ruptura de Pangea abrió el océano Atlántico central. El clima cálido y húmedo favoreció coníferas, helechos y cícadas. Los saurópodos alcanzaron tamaños extremos: Brachiosaurus medía unos 22 metros de largo y 12 de alto. Terópodos como Allosaurus eran sus depredadores, y Stegosaurus desarrolló placas óseas y púas en la cola.'
        },
        datos: [
            { etiqueta: 'Cuándo', valor: 'Hace 201 a 145 millones de años' },
            { etiqueta: 'Duración', valor: 'unos 56 millones de años' },
            { etiqueta: 'Continentes', valor: 'Pangea se separa en dos' },
            { etiqueta: 'Clima', valor: 'Cálido y húmedo' },
            { etiqueta: 'Brachiosaurus', valor: '22 m de largo y 12 m de alto' },
            { etiqueta: 'Allosaurus', valor: '9 m de largo, depredador' },
            { etiqueta: 'Stegosaurus', valor: '9 m de largo, con placas' },
            { etiqueta: 'Plantas', valor: 'Coníferas, helechos y cícadas' }
        ],
        curiosidades: [
            { icono: '🫧', titulo: 'Huesos con aire', texto: 'Los saurópodos tenían cámaras de aire dentro de los huesos, como las aves. Así aligeraban un cuerpo enorme.' },
            { icono: '🛡️', titulo: 'Placas misteriosas', texto: 'Las placas del Stegosaurus quizá servían para exhibirse o regular la temperatura. No eran una armadura completa.' },
            { icono: '🪶', titulo: 'La primera pluma', texto: 'Al final del Jurásico vivió Archaeopteryx, un dinosaurio con plumas y alas. Es una pieza clave para entender el origen de las aves.' }
        ],
        comparacion: 'Un Brachiosaurus medía 12 metros de alto: como un edificio de 4 pisos. Una persona de 1,70 m apenas le llegaría al tobillo.',
        glosario: ['jurasico', 'sauropodo', 'teropodo', 'pluma', 'ave', 'pangea'],
        quiz: [
            { pregunta: '¿Qué dinosaurio del Jurásico tenía placas en la espalda?', opciones: ['Brachiosaurus', 'Stegosaurus', 'Allosaurus'], correcta: 1, explicacion: 'El Stegosaurus tenía dos filas de placas óseas y púas en la cola, pero no una armadura completa.' },
            { pregunta: '¿Qué comían los saurópodos como el Brachiosaurus?', opciones: ['Carne', 'Plantas', 'Insectos'], correcta: 1, explicacion: 'Eran herbívoros. Con su cuello largo alcanzaban hojas que otros animales no podían comer.' }
        ]
    },

    /* ------------------------------------------------------------ CRETÁCICO */
    {
        id: 'cretacico',
        nombre: 'Cretácico',
        emoji: '🦖',
        tipo: 'Período',
        color: '#c9a24a',
        pos: { x: 240, y: 0, z: 0 },
        resumen: 'T. rex, cuernos y las primeras flores.',
        descripcion: {
            exploradores: 'Los continentes se separaron y tomaron formas parecidas a las de hoy. Aparecieron las primeras flores. En tierra mandaban el T. rex, con dientes del tamaño de un plátano, y el Triceratops, con tres cuernos y un gran escudo de hueso en la cabeza.',
            cientificos: 'Entre 145 y 66 millones de años atrás, la fragmentación continental y el aumento del nivel del mar crearon mares epicontinentales. Las angiospermas se diversificaron rápidamente. Tyrannosaurus rex vivió hace 68 a 66 millones de años en Norteamérica: medía unos 12 metros y pesaba entre 8 y 9 toneladas. Triceratops y Ankylosaurus compartieron su ecosistema. Las aves, dinosaurios avianos, ya estaban presentes.'
        },
        datos: [
            { etiqueta: 'Cuándo', valor: 'Hace 145 a 66 millones de años' },
            { etiqueta: 'Duración', valor: 'unos 79 millones de años' },
            { etiqueta: 'T. rex', valor: '12 m de largo y 4 m de alto' },
            { etiqueta: 'Peso del T. rex', valor: '8 a 9 toneladas' },
            { etiqueta: 'Mordida', valor: 'una de las más fuertes de la historia' },
            { etiqueta: 'Triceratops', valor: '9 m de largo, tres cuernos' },
            { etiqueta: 'Ankylosaurus', valor: '8 m, blindado y con mazo en la cola' },
            { etiqueta: 'Plantas nuevas', valor: 'las primeras flores (angiospermas)' }
        ],
        curiosidades: [
            { icono: '🪶', titulo: '¿Un rey con plumas?', texto: 'Sus parientes cercanos tenían plumas. Es probable que el T. rex tuviera plumón en algunas zonas, sobre todo de joven.' },
            { icono: '🦷', titulo: 'Dientes de repuesto', texto: 'El T. rex cambiaba los dientes durante toda su vida. Tenía alrededor de 60 dientes, algunos de 20 cm.' },
            { icono: '🌸', titulo: 'Flores entre dinosaurios', texto: 'Las primeras flores aparecieron en el Cretácico. Muchas plantas que conocemos hoy nacieron en esa época.' }
        ],
        comparacion: 'Un T. rex medía 12 metros de largo: como un colectivo. Pesaba 8 toneladas: como cinco autos juntos.',
        glosario: ['cretacico', 'teropodo', 'ornitisquio', 'angiosperma', 'pluma', 'bipedo'],
        quiz: [
            { pregunta: '¿Cuánto medía aproximadamente un T. rex de largo?', opciones: ['4 metros', '12 metros', '30 metros'], correcta: 1, explicacion: 'El T. rex medía unos 12 metros de largo y 4 metros de alto. ¡Como un colectivo!' },
            { pregunta: '¿Qué novedad vegetal apareció en el Cretácico?', opciones: ['Las primeras flores', 'Los primeros helechos', 'Las primeras algas'], correcta: 0, explicacion: 'Las angiospermas, las plantas con flores, se diversificaron durante el Cretácico.' }
        ]
    },

    /* ------------------------------------------------- EXTINCIÓN Y AVES */
    {
        id: 'extincion',
        nombre: 'Extinción y aves',
        emoji: '☄️',
        tipo: 'El gran cambio',
        color: '#8f8ad1',
        pos: { x: 360, y: 0, z: 0 },
        resumen: 'El impacto que terminó una era… y las aves que siguieron.',
        descripcion: {
            exploradores: 'Hace 66 millones de años cayó un asteroide de unos 10 kilómetros en lo que hoy es México. Levantó tanto polvo que el cielo quedó oscuro durante meses. Sin luz, muchas plantas murieron y los dinosaurios grandes no encontraron comida. Pero algunos dinosaurios pequeños con plumas sobrevivieron: son las aves.',
            cientificos: 'La extinción del Cretácico-Paleógeno (K-Pg) ocurrió hace 66 millones de años. El impacto de Chicxulub, en la península de Yucatán, liberó polvo y aerosoles de sulfato que bloquearon la fotosíntesis durante meses o años. Se extinguieron los dinosaurios no avianos, los pterosaurios y los grandes reptiles marinos. Las aves y los mamíferos pequeños sobrevivieron y se diversificaron.'
        },
        datos: [
            { etiqueta: 'Cuándo', valor: 'hace 66 millones de años' },
            { etiqueta: 'Asteroide', valor: 'unos 10 km de diámetro' },
            { etiqueta: 'Cráter', valor: 'Chicxulub, 180 km de ancho' },
            { etiqueta: 'Dónde cayó', valor: 'península de Yucatán, México' },
            { etiqueta: 'Especies perdidas', valor: 'alrededor del 75 %' },
            { etiqueta: 'Dinosaurios no avianos', valor: 'se extinguieron todos' },
            { etiqueta: 'Sobrevivientes', valor: 'aves, mamíferos, cocodrilos' },
            { etiqueta: 'Recuperación', valor: 'los ecosistemas tardaron millones de años' }
        ],
        curiosidades: [
            { icono: '🐦', titulo: 'Las aves son dinosaurios', texto: 'No descienden de ellos: son un grupo de dinosaurios que sigue vivo. Mirar un gorrión es mirar a un pariente del T. rex.' },
            { icono: '🐬', titulo: 'No todos eran dinosaurios', texto: 'Los pterosaurios que volaban y los reptiles marinos como el Mosasaurus no eran dinosaurios. Eran otros reptiles.' },
            { icono: '🕳️', titulo: 'El cráter todavía está', texto: 'Chicxulub mide 180 km y está enterrado bajo la península de Yucatán. Se descubrió estudiando el terreno y las capas de roca.' }
        ],
        comparacion: 'El asteroide medía 10 km: como una ciudad. El cráter mide 180 km: como 1.800 canchas de fútbol puestas en fila.',
        glosario: ['extincion-masiva', 'asteroide', 'crater', 'ave', 'dinosaurio', 'pterosaurio', 'reptil-marino'],
        quiz: [
            { pregunta: '¿Dónde cayó el asteroide que terminó con los dinosaurios no avianos?', opciones: ['En Yucatán, México', 'En el Sahara', 'En la Antártida'], correcta: 0, explicacion: 'El cráter se llama Chicxulub y está en la península de Yucatán. Tiene unos 180 km de diámetro.' },
            { pregunta: '¿Qué grupo de dinosaurios sobrevivió hasta hoy?', opciones: ['Los saurópodos', 'Las aves', 'Los tiranosaurios'], correcta: 1, explicacion: 'Las aves son dinosaurios avianos: sobrevivieron al impacto y hoy son más de 10.000 especies.' }
        ]
    }
];

/* ------------------------------------------------------------------ GLOSARIO */
export const GLOSARIO = [
    { id: 'dinosaurio', termino: 'Dinosaurio', def: 'Grupo de reptiles que vivió en la era Mesozoica. Se caracterizan por tener las patas bajo el cuerpo. Las aves son sus descendientes directos.' },
    { id: 'fosil', termino: 'Fósil', def: 'Resto o huella de un ser vivo conservado en roca durante miles o millones de años. Los fósiles nos cuentan cómo eran los dinosaurios.' },
    { id: 'paleontologia', termino: 'Paleontología', def: 'Ciencia que estudia los fósiles para reconstruir la vida del pasado. Los paleontólogos excavan, comparan huesos y proponen hipótesis.' },
    { id: 'mesozoico', termino: 'Mesozoico', def: 'Era geológica de 252 a 66 millones de años atrás. Incluye tres períodos: Triásico, Jurásico y Cretácico. Es la era de los dinosaurios.' },
    { id: 'triasico', termino: 'Triásico', def: 'Primer período del Mesozoico, entre 252 y 201 millones de años atrás. En él aparecieron los primeros dinosaurios y todo el planeta era Pangea.' },
    { id: 'jurasico', termino: 'Jurásico', def: 'Período entre 201 y 145 millones de años atrás. Se caracterizó por selvas húmedas y por saurópodos gigantes como el Brachiosaurus.' },
    { id: 'cretacico', termino: 'Cretácico', def: 'Último período del Mesozoico, entre 145 y 66 millones de años atrás. Aparecieron las flores y vivieron el T. rex y el Triceratops.' },
    { id: 'pangea', termino: 'Pangea', def: 'Supercontinente que reunió casi todas las tierras emergidas durante el Triásico. Se fue separando hasta formar los continentes actuales.' },
    { id: 'arcosaurio', termino: 'Arcosaurio', def: 'Grupo de reptiles que incluye a los dinosaurios, los cocodrilos y los pterosaurios. Comparten características del cráneo y de las patas.' },
    { id: 'sauropodo', termino: 'Saurópodo', def: 'Dinosaurio herbívoro de cuello largo, cabeza pequeña y cuatro patas. El Brachiosaurus y el Apatosaurus son ejemplos.' },
    { id: 'teropodo', termino: 'Terópodo', def: 'Dinosaurio bípedo y en general carnívoro, con dientes afilados y garras. El T. rex y el Velociraptor pertenecen a este grupo.' },
    { id: 'ornitisquio', termino: 'Ornitisquio', def: 'Dinosaurio con la cadera parecida a la de un ave, aunque no sea un ave. Muchos eran herbívoros: Triceratops, Stegosaurus y Ankylosaurus.' },
    { id: 'pluma', termino: 'Pluma', def: 'Estructura liviana y aislante que cubre el cuerpo de las aves. Muchos dinosaurios también tenían plumas o plumón.' },
    { id: 'ave', termino: 'Ave', def: 'Dinosaurios avianos con plumas, pico y alas. Son el único grupo de dinosaurios que sobrevivió a la extinción de hace 66 millones de años.' },
    { id: 'pterosaurio', termino: 'Pterosaurio', def: 'Reptil volador del Mesozoico, pariente de los dinosaurios pero NO un dinosaurio. El Pteranodon es uno de los más conocidos.' },
    { id: 'reptil-marino', termino: 'Reptil marino', def: 'Reptil adaptado al mar, como el Mosasaurus o el Plesiosaurus. Tampoco era un dinosaurio: son grupos distintos.' },
    { id: 'extincion-masiva', termino: 'Extinción masiva', def: 'Desaparición de una gran parte de las especies en poco tiempo geológico. La del final del Cretácico eliminó a los dinosaurios no avianos.' },
    { id: 'asteroide', termino: 'Asteroide', def: 'Roca espacial que orbita alrededor del Sol. Uno de unos 10 km de ancho impactó la Tierra hace 66 millones de años.' },
    { id: 'crater', termino: 'Cráter', def: 'Depresión en la superficie producida por el impacto de un cuerpo rocoso. El cráter de Chicxulub mide unos 180 km.' },
    { id: 'angiosperma', termino: 'Angiosperma', def: 'Planta con flores y frutos. Aparecieron en el Cretácico y hoy son la mayoría de las plantas terrestres.' },
    { id: 'bipedo', termino: 'Bípedo', def: 'Animal que camina sobre dos patas. Muchos dinosaurios carnívoros, como el T. rex, eran bípedos.' },
    { id: 'coprolito', termino: 'Coprolito', def: 'Excremento fosilizado. Sirve para saber qué comían los animales del pasado, incluso qué dinosaurios.' },
    { id: 'cuadrupedo', termino: 'Cuadrúpedo', def: 'Animal que camina sobre cuatro patas. Los saurópodos y los Triceratops eran cuadrúpedos.' }
];

/* ------------------------------------------------- PREGUNTAS DEL DESAFÍO */
export const DESAFIO = [
    { pregunta: '¿Cuántos períodos tiene la era Mesozoica?', opciones: ['Dos', 'Tres', 'Cinco'], correcta: 1, explicacion: 'Tres: Triásico, Jurásico y Cretácico.' },
    { pregunta: '¿Qué significa que un animal sea bípedo?', opciones: ['Que camina en cuatro patas', 'Que camina en dos patas', 'Que vuela'], correcta: 1, explicacion: 'Bípedo significa que camina sobre dos patas, como el T. rex o el Velociraptor.' },
    { pregunta: '¿Qué eran los pterosaurios?', opciones: ['Dinosaurios voladores', 'Reptiles voladores, no dinosaurios', 'Aves prehistóricas'], correcta: 1, explicacion: 'Los pterosaurios eran reptiles voladores emparentados con los dinosaurios, pero no eran dinosaurios.' },
    { pregunta: '¿Cuál de estos era un dinosaurio?', opciones: ['Mosasaurus', 'Pteranodon', 'Triceratops'], correcta: 2, explicacion: 'El Triceratops era un dinosaurio. El Mosasaurus era un reptil marino y el Pteranodon, un pterosaurio.' },
    { pregunta: '¿Qué grupo de animales actuales desciende de los dinosaurios?', opciones: ['Los cocodrilos', 'Las aves', 'Los lagartos'], correcta: 1, explicacion: 'Las aves son dinosaurios avianos: el único linaje de dinosaurios que sobrevivió.' },
    { pregunta: '¿Qué comían los saurópodos?', opciones: ['Plantas', 'Peces', 'Otros dinosaurios'], correcta: 0, explicacion: 'Eran herbívoros y usaban su cuello largo para alcanzar hojas altas.' },
    { pregunta: '¿Hace cuánto ocurrió la extinción de los dinosaurios no avianos?', opciones: ['66 millones de años', '2 millones de años', '500 millones de años'], correcta: 0, explicacion: 'Ocurrió hace 66 millones de años, al final del Cretácico.' },
    { pregunta: '¿Qué evidencia indica que muchos dinosaurios tenían plumas?', opciones: ['Fósiles con impresiones de plumas', 'Pinturas rupestres', 'Sus huellas'], correcta: 0, explicacion: 'Se han encontrado fósiles excepcionales con plumas conservadas, sobre todo de dinosaurios pequeños.' },
    { pregunta: '¿Qué es un fósil?', opciones: ['Un hueso de animal vivo', 'Un resto conservado en roca', 'Una piedra volcánica'], correcta: 1, explicacion: 'Un fósil es un resto o una huella de un ser vivo conservado en roca durante mucho tiempo.' },
    { pregunta: '¿Cómo se llamaba el supercontinente del Triásico?', opciones: ['Pangea', 'Atlántida', 'Gondwana'], correcta: 0, explicacion: 'Pangea reunió casi todas las tierras emergidas hace unos 250 millones de años.' },
    { pregunta: '¿Cuál era el dinosaurio con tres cuernos y un escudo óseo?', opciones: ['Ankylosaurus', 'Triceratops', 'Stegosaurus'], correcta: 1, explicacion: 'El Triceratops tenía tres cuernos y un gran escudo óseo en la cabeza.' },
    { pregunta: '¿Dónde está el cráter del impacto que cambió el Mesozoico?', opciones: ['En Yucatán, México', 'En Australia', 'En Islandia'], correcta: 0, explicacion: 'El cráter de Chicxulub está en la península de Yucatán y mide unos 180 km.' }
];

/* Utilidades de datos */
export function buscarGlosario(id) {
    return GLOSARIO.find((g) => g.id === id) || null;
}

export function datosDeCuerpo(id) {
    return CUERPOS.find((c) => c.id === id) || null;
}

export function todasLasPreguntas() {
    const propias = CUERPOS.flatMap((c) => c.quiz.map((q) => ({ ...q, origen: c.nombre })));
    return [...DESAFIO.map((q) => ({ ...q, origen: 'General' })), ...propias];
}

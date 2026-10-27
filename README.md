# Dinoaventura · Safari por el Mesozoico

Recorrido 3D interactivo por la era Mesozoica para escuelas primarias. Cuatro
paradas (Triásico, Jurásico, Cretácico y Extinción/aves) sobre un valle continuo
que se recorre en jeep.

- **Sin internet**: Three.js y el modelo del T. rex viajan dentro del proyecto.
- **Dos niveles de lectura**: Exploradores (6-9) y Científicos (10-12).
- **Materiales para el aula**: ficha imprimible, quiz, glosario y guía docente.
- **Rigor científico**: pterosaurios y reptiles marinos no son dinosaurios; las
  aves sí son dinosaurios; la extinción K-Pg se explica con el impacto de
  Chicxulub.
- **Entorno con atmósfera**: cielo por shader (sol, halo y nubes en movimiento),
  pasto, piedritas y hojas instanciados, laguna con ondas y espuma, y polen
  suspendido en cada era. Todo procedural: no suma archivos.
- **Acabado de imagen**: viñeta y grano de película en un pase propio, sin
  dependencias externas.

## Cómo abrirlo

Es un sitio estático sin build. Alcanza con servirlo por HTTP (los módulos ES no
funcionan con `file://`):

```bash
python -m http.server 8130
```

Luego abrir `http://localhost:8130/`.

Parámetros útiles para probar:

| Parámetro | Efecto |
| --- | --- |
| `?calidad=baja` | Menos vegetación, sombras y partículas (equipos modestos) |
| `?intro=0` | Saltea la intro de 9,5 s |
| `?debug=1` | Expone `window.__recorrido` para inspeccionar la escena |

## Estructura

```
index.html          Estructura de la interfaz, intro y guía docente
css/styles.css      Estilos responsive (paleta verde/ámbar)
js/datos.js         Las 4 paradas, glosario y banco de preguntas
js/escena.js        Valle, camino, jeep, dinosaurios animados, paletas y cámara
js/vida.js          Dinosaurios y vegetación low-poly procedurales
js/texturas.js      Texturas dibujadas en canvas
js/interfaz.js      Ficha, ruta, quiz, voz, glosario, guía e impresión
js/main.js          Arranque, calidad y progreso de carga
models/trex.glb     T. rex animado (Quaternius, CC0)
models/triceratops.glb      Triceratops animado (Quaternius, CC0)
models/stegosaurus.glb      Stegosaurus animado (Quaternius, CC0)
models/velociraptor.glb     Velociraptor animado (Quaternius, CC0)
models/parasaurolophus.glb  Parasaurolophus animado (Quaternius, CC0)
models/jeep.glb     Jeep safari (Zsky, CC-BY)
models/volcan.glb   Cono volcánico (Poly by Google, CC-BY)
models/montanas.glb Cordillera A (Quaternius, CC0)
models/montanas2.glb Cordillera B (Quaternius, CC0)
vendor/three/       Three.js r160 + GLTFLoader, OrbitControls y SkeletonUtils
scripts/peso.mjs    Control de peso antes de desplegar
```

## Créditos

- **Dinosaurios animados** (T. rex, Triceratops, Stegosaurus, Parasaurolophus y
  Velociraptor): [Quaternius](https://quaternius.com/) vía Poly Pizza, licencia
  CC0.
  - [T. rex](https://poly.pizza/m/UYtneO5FpF) ·
    [Triceratops](https://poly.pizza/m/IGvrUqGrRM) ·
    [Stegosaurus](https://poly.pizza/m/eFcNbOlpvl) ·
    [Velociraptor](https://poly.pizza/m/cnlGH2UcDd) ·
    [Parasaurolophus](https://poly.pizza/m/KeeQrrouRK)
- **Jeep safari**: [Zsky](https://poly.pizza/u/Zsky) vía
  [Poly Pizza](https://poly.pizza/m/AcSdGGrgYP), licencia CC-BY (atribución
  requerida; se acredita acá y en la guía docente del sitio).
- **Montañas**: [Quaternius](https://quaternius.com/) vía Poly Pizza, licencia
  CC0.
  - [Mountains](https://poly.pizza/m/w9VBrh7Nz0) ·
    [Mountain Group](https://poly.pizza/m/a52gSEEq8X)
- **Volcán**: [Poly by Google](https://poly.pizza/u/Poly by Google) vía
  [Poly Pizza](https://poly.pizza/m/dwSigTeSMCo), licencia CC-BY (atribución
  requerida). La lava, el resplandor y el humo se animan por código.
- **Three.js**: MIT.
- Resto de los modelos (dinosaurios, plantas, rocas, nido, laguna) generados
  por código en `js/vida.js` y `js/escena.js`.

## Despliegue

Cloudflare Pages conectado a este repositorio:

- Comando de build: *(vacío)*
- Directorio de salida: `/`

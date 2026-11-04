# Sistema de diseño Flu3nce

Flu3nce usa la **alternativa C, «sobria con corriente»**: superficies planas, grises fríos y un solo azul de marca. Lo fluido no viene de efectos, sino de tres cosas: la **línea** (el hilo de actividad), la **forma** (radios amplios y píldoras) y el **movimiento** (la corriente del compositor). No hay desenfoque, cristal ni transparencias.

Este documento es la referencia de las reglas. Los valores viven en el código y este documento los explica:

| Qué | Dónde |
| --- | --- |
| Escalas de color, modo oscuro, radios, tipografía y animaciones `flow-*` | `src/styles/theme.css` |
| Tokens de superficie `--fl-*` (claro y oscuro), ola, logo según el tema y animaciones compartidas | `src/styles/globals.css` |
| Chat, paneles, visor de entregables, directorio y diálogos | `src/pages/flu-chats.css` |

El lienzo donde se diseñó (marca, color, tipografía, componentes, modo oscuro y las tres alternativas) está en claude.ai: <https://claude.ai/artifact/KWpjdJHwpnAT9SNBj5LUJp>. Es privado; quien no tenga acceso debe guiarse por este documento.

---

## 1. Principios

1. **La conversación es la interfaz.** Todo empieza en el compositor. Navegación, archivos y versiones rodean al chat; nunca compiten con él.
2. **El azul tiene intención.** Marca la acción principal, la selección y la voz de Flu3nce. Ocupa cerca del 10 % de la pantalla y solo hay **una acción azul sólida por vista**.
3. **El documento es el protagonista.** Cada entregable muestra tipo, versión, formatos reales y de qué fuentes nació. Los documentos se leen en papel blanco y serif.
4. **Actividad honesta.** Se muestran las etapas reales del trabajo y su tiempo transcurrido. Nunca porcentajes ni tiempos estimados que el backend no dio.
5. **Calma corporativa.** Blanco, grises fríos y un solo azul. Sin degradados, sin cristal, sin emojis decorativos.

## 2. Color

### 2.1 Azul Flu3nce (`brand-*` en `theme.css`)

| Paso | Hex | Uso |
| --- | --- | --- |
| 50 | `#EEF3FF` | Selección, chat activo, fondos sutiles |
| 100 | `#DCE6FF` | Hover suave, avatar |
| 200 | `#BCCEFF` | Hilo de corriente, bordes de selección |
| 300 | `#8EABFF` | Anillo de foco; texto y enlaces en modo oscuro |
| 400 | `#5A80FA` | Gráficas, foco en oscuro |
| 500 | `#3461F0` | Botón primario en modo oscuro |
| **600** | **`#1F4BD8`** | **Color de marca.** Botón primario, enlaces, enviar. Blanco encima: 6.9:1 |
| 700 | `#1A3CB0` | Hover del primario, texto azul sobre fondos claros |
| 800 | `#19338C` | Presionado |
| 900 | `#172C6E` | Titulares azules sobre claro |
| 950 | `#0F1C45` | Fondo profundo |

### 2.2 Tinta: neutros fríos (`gray-*`)

| Paso | Hex | Uso |
| --- | --- | --- |
| 0 | `#FFFFFF` | Lienzo |
| 50 | `#F4F6F9` | Superficie: barra lateral, burbuja del usuario |
| 100 | `#ECEFF4` | Divisores, buscador |
| 200 | `#DDE2EA` | Bordes de tarjetas y botones secundarios |
| 300 | `#C3CAD6` | Borde fuerte, campos de texto |
| 400 | `#929BAB` | Solo íconos inactivos y bordes: **no alcanza contraste para texto** |
| 500 | `#677184` | Texto terciario: metadatos, fechas (4.9:1) |
| 600 | `#4B5466` | Texto secundario (7.6:1) |
| 700 | `#353C4B` | Texto de apoyo fuerte, íconos activos |
| 900 | `#141923` | Texto principal (17.6:1) |

### 2.3 Estados

| Estado | Color | Fondo | Texto | Uso |
| --- | --- | --- | --- | --- |
| Éxito | `#12805C` | `#E7F5EF` | `#0B5C42` | Material procesado, objetivo conseguido |
| Advertencia | `#B25E09` | `#FDF1E3` | `#7F4204` | Espera una respuesta, permisos pendientes |
| Error | `#C8322B` | `#FCEBEA` | `#8F1F1A` | Fallido; siempre con causa y cómo seguir |
| Información | `#1F4BD8` | `#EEF3FF` | `#1A3CB0` | En curso |

Los objetivos de una solicitud tienen seis estados: **pendiente, en curso, esperando respuesta, conseguido, fallido y cancelado**. El estado se muestra con un punto **y** un texto: el color nunca va solo.

### 2.4 Tokens de superficie (`--fl-*` en `globals.css`)

Son los que se usan en las hojas y componentes de la app. Cambian solos en modo oscuro.

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `--fl-bg` | `#FFFFFF` | `#0B0F17` | Fondo de la conversación, tarjetas, diálogos |
| `--fl-bg-subtle` | `#F4F6F9` | `#10151E` | Barra lateral, burbuja del usuario |
| `--fl-surface-2` | `#FAFBFC` | `#10151E` | Pies de tarjeta, bloques de código, resúmenes |
| `--fl-hover` | `#F4F6F9` | `#161C27` | Hover de filas y botones neutros |
| `--fl-hover-strong` | `#ECEFF4` | `#1C2330` | Hover sobre la barra lateral, buscador |
| `--fl-border` | `#DDE2EA` | `#262E3C` | Bordes de tarjetas, botones secundarios |
| `--fl-border-strong` | `#C3CAD6` | `#343D4E` | Campos de texto, bordes punteados |
| `--fl-divider` | `#ECEFF4` | `#1C2330` | Separadores, bordes de rieles |
| `--fl-text` | `#141923` | `#E9EDF3` | Texto principal |
| `--fl-text-2` | `#353C4B` | `#C9D0DB` | Texto de botones y etiquetas |
| `--fl-text-3` | `#4B5466` | `#A9B2C1` | Texto secundario |
| `--fl-text-4` | `#677184` | `#8590A2` | Metadatos, fechas, ayudas |
| `--fl-icon-muted` | `#929BAB` | `#5A6578` | Íconos inactivos (nunca texto) |
| `--fl-primary` | `#1F4BD8` | `#3461F0` | Acción principal, foco, hilo en curso |
| `--fl-primary-hover` | `#1A3CB0` | `#1F4BD8` | Hover del primario |
| `--fl-primary-text` | `#1A3CB0` | `#BCCEFF` | Texto azul sobre `--fl-primary-subtle` |
| `--fl-primary-subtle` | `#EEF3FF` | `#16224A` | Selección, chat activo, insignias de versión |
| `--fl-primary-subtle-2` | `#DCE6FF` | `#1E2E64` | Avatar, etiquetas de adjunto |
| `--fl-primary-line` | `#BCCEFF` | `#2A3F80` | Hilo de corriente terminado |
| `--fl-link` | `#1F4BD8` | `#8EABFF` | Enlaces |
| `--fl-success` / `-bg` / `-text` | ver 2.3 | `#37C88D` / `#0F2A22` / `#5FD9A6` | Estados |
| `--fl-warning` / `-bg` / `-text` | ver 2.3 | `#F0A14A` / `#2E2112` / `#F5B76A` | Estados |
| `--fl-error` / `-bg` / `-text` / `-border` | ver 2.3 | `#F07068` / `#331A1B` / `#F59B94` / `#5A2A2A` | Estados |
| `--fl-overlay` | negro 42 % | negro 55 % | Fondo de diálogos y menús móviles |
| `--fl-shadow-xs` / `-menu` / `-float` | | | Elevación (ver 4.3) |
| `--fl-paper` / `-paper-text` / `-paper-border` | blanco | blanco | Documentos: siempre papel blanco |
| `--fl-wave` | azul 50/100 + línea 600 | azul marino + línea 400 | Ola de los estados vacíos |

### 2.5 Proporción

Aproximadamente **70 % lienzo blanco, 20 % superficie gris y 10 % azul**. El resto del azul es tenue (50–100) para estados seleccionados.

## 3. Tipografía

| Familia | Uso | Token |
| --- | --- | --- |
| **Geist** (400–700) | Interfaz: botones, navegación, mensajes | `--fl-font`, `font-body` |
| **Source Serif 4** (400, 600) | Documentos: vista previa de políticas, entendimientos, minutas | `--fl-serif`, `font-serif` |
| **Geist Mono** (400, 500) | Datos: versiones, formatos, fechas, IDs y etiquetas de sección | `--fl-mono`, `font-mono` |

Se cargan desde Google Fonts en `index.html`.

| Estilo | Tamaño / interlínea | Peso | Ejemplo |
| --- | --- | --- | --- |
| Display | 48 / 56, −3 % | 600 | «¿Qué quieres construir hoy?» |
| Título 1 | 32 / 40, −2 % | 600 | Título de página o diálogo grande |
| Título 2 | 22–24 / 32, −2 % | 600 | Título de diálogo |
| Título 3 | 18 / 26 | 600 | Encabezado de panel |
| Mensaje | 16 / 26 | 400 | Texto del chat |
| Documento | Serif 15–17 / 28 | 400 | Cuerpo de un entregable |
| Cuerpo | 14 / 20 | 400–500 | Listas, botones, campos |
| Etiqueta | 13 / 18 | 500 | Botones pequeños, chips, metadatos |
| Dato | Mono 11–12 / 16 | 400–500 | `v2 · DOCX · PDF · 03-nov-2026 18:42` |

Reglas:

- Mínimo 12 px. Los 11 px solo se permiten en etiquetas mono en mayúsculas (por ejemplo `CONTEXTO DEL CHAT`).
- Las mayúsculas sostenidas solo van en mono, con 0.04 em de espaciado.
- No más de tres tamaños en una misma tarjeta.
- Los títulos llevan espaciado negativo (−1 % a −3 %); el cuerpo no.

## 4. Espaciado, forma y elevación

### 4.1 Espaciado

Base de **4 px**: 4, 8, 12, 16, 20, 24, 32, 48, 64. Los grupos hermanos se separan con `gap`, no con márgenes sueltos.

### 4.2 Radios

| Radio | Uso |
| --- | --- |
| 6–8 px | Insignias pequeñas, código en línea |
| 12 px | Campos de texto, filas de listas, enlaces del menú |
| 14–16 px | Alertas, bloques internos, lotes de subida |
| 20 px | Tarjetas de entregable y de actividad, menús |
| 24–28 px | Compositor y diálogos |
| `999px` | Botones, chips, píldoras, avatares y botones de ícono |

### 4.3 Elevación

| Nivel | Token | Dónde |
| --- | --- | --- |
| Plano + borde | `--fl-border` | Tarjetas, listas, la mayoría de las superficies |
| Menú | `--fl-shadow-menu` | Menú de cuenta, rieles superpuestos en tableta, botón «ir al final» |
| Flotante | `--fl-shadow-float` | Compositor, tarjeta del login, páginas de documento |

Las sombras solo van en lo que flota. Nada que se desplace en una lista lleva sombra.

## 5. Lo fluido: línea, forma y movimiento

### 5.1 La línea de corriente

Es el **único ornamento** del sistema y **nunca va detrás de un texto**.

- **Hilo de actividad.** Las respuestas de Flu3nce, la actividad y los trabajos en segundo plano corren sobre una línea vertical de 2 px a la izquierda. La línea es continua (`--fl-primary-line`) cuando el trabajo terminó, y discontinua y en movimiento (`--fl-primary`) mientras está en curso.
- **Chats de un proyecto.** Cuelgan de una línea gris de 1.5 px.
- **La ola.** Bandas de azul 50 y 100 en color sólido, rematadas con una línea de corriente (`--fl-wave`). Solo va en cabeceras de estados vacíos: la bienvenida del chat y el login.

### 5.2 La forma

Los radios son amplios, los botones y chips son píldoras y los íconos de entregables van en círculos. Sin esquinas duras en elementos interactivos.

### 5.3 El movimiento

| Animación | Qué hace | Propiedad |
| --- | --- | --- |
| `fl-current` | Una corriente recorre el borde del compositor mientras Flu3nce trabaja (`.flu-chat-composer.is-working`) | `transform` |
| `fl-flow-down` | El hilo de la actividad en curso fluye hacia abajo | `background-position` |
| `fl-pulse` | Pulso del indicador de la actividad en curso y del punto de respuesta nueva | `box-shadow` |
| `flu-appear` | Entrada de mensajes y tarjetas: sube 4 px y aparece | `transform`, `opacity` |

- La curva es `cubic-bezier(0.2, 0.8, 0.2, 1)` (`--fl-ease`, `ease-flow`) y la duración, de 200 a 300 ms.
- Solo se anima `transform`, `opacity`, `background-position` o, en el pulso, `box-shadow`. Nunca `backdrop-filter`, `filter` ni dimensiones en bucle.
- Con «reducir movimiento» del sistema se apagan todas las animaciones (reglas al final de `flu-chats.css` y de `globals.css`).

## 6. Componentes

Las clases viven en `src/pages/flu-chats.css`.

| Componente | Clase | Reglas |
| --- | --- | --- |
| **Botón primario** | `.flu-chat-composer-send`, botones de confirmar | Azul sólido, píldora o círculo, texto blanco. **Uno por vista.** |
| **Botón secundario** | `.flu-primary` («Nuevo chat»), acciones de archivo | Fondo `--fl-bg`, borde `--fl-border`, píldora. |
| **Botón de ícono** | `.flu-icon-button`, cerrar paneles | Círculo de 34–40 px con `aria-label`. |
| **Compositor** | `.flu-chat-composer` | Radio 28 y sombra flotante. Al enfocar: borde azul y anillo de 4 px `--fl-primary-subtle`. Los adjuntos van arriba, en el orden en que se agregaron. Enter envía y Shift + Enter hace salto de línea. Mientras Flu3nce trabaja lleva la clase `.is-working` y enviar se vuelve «Detener», una píldora neutra. |
| **Sugerencias** | `.flu-suggestions`, `.flu-chat-suggestions` | Píldoras neutras. Escriben en el compositor o responden; nunca ejecutan algo destructivo. |
| **Mensaje del usuario** | `.flu-message.flu-user` | Burbuja `--fl-bg-subtle`, radio 22 / 22 / 6 / 22, máximo 560 px. |
| **Respuesta de Flu3nce** | `.flu-message.flu-assistant` | Sin burbuja; corre sobre el hilo de corriente. Texto 16 / 26. |
| **Actividad** | `.flu-chat-activity` | Resumen en píldora expandible («Ver actividad · 3 pasos»). Al abrirse, la lista de etapas va sobre el hilo. En curso: indicador que pulsa e hilo que fluye. |
| **Tarjeta de entregable** | `.flu-message-part-deliverable`, `ConsultationDeliverableCard` | Borde, radio 20, ícono en círculo `--fl-primary-subtle`. Siempre visibles: tipo, versión (mono), formatos reales y procedencia. Una tarjeta vieja conserva su versión. |
| **Fuente citada** | `.flu-message-source-card` | Píldora con el formato en un círculo mono. |
| **Panel de contexto** | `.flu-context` | Riel blanco con borde. Las fuentes del usuario llevan un círculo gris con el formato; los entregables generados llevan fondo gris y un círculo azul sólido. |
| **Estado** | etiquetas de actividad y objetivos | Punto + texto con los colores de 2.3. |
| **Diálogo** | `.flu-move-dialog` | Radio 24, fondo `--fl-bg`, overlay `--fl-overlay` sin desenfoque. Etiqueta mono azul arriba del título. La acción principal va a la derecha y es la única azul. |
| **Campo de texto** | diálogos, login | Radio 12, borde `--fl-border-strong`. Al enfocar: borde `--fl-primary` y anillo `--fl-primary-subtle`. |
| **Alerta** | `.flu-chat-failure`, avisos | Fondo y texto del estado. Siempre dice la causa y qué hacer. |
| **Visor de documentos** | `.flu-document-page`, `.flu-pdf-*`, `.flu-source-preview-*` | Papel blanco y serif también en modo oscuro: así se imprime y se envía. |

## 7. Modo oscuro

- Se activa con la clase `.dark-mode` en `<html>`, que pone `ThemeProvider` (clave `ui-theme` en `localStorage`). `index.html` la aplica antes de pintar para que no haya destello. El usuario elige Claro, Oscuro o Sistema en el menú de su cuenta.
- **Sin negro puro.** La base es `#0B0F17`, con tinte azul.
- **La elevación aclara.** De noche las sombras no se ven: cada nivel sube un tono de superficie.
- **El azul se adapta.** Los botones usan el azul 500 y los textos y enlaces el 300. El azul 600 nunca va como texto sobre oscuro.
- **El documento sigue en papel.** Las vistas de documentos, PDF y diagramas se quedan en blanco.
- Si un componente usa tokens `--fl-*`, el modo oscuro funciona solo. Un color fijo lo rompe.

## 8. Logotipo

- Los archivos son `public/landing/img/logo-fluence.svg` (fondos claros) y `public/landing/img/logo-fluence-white.svg` (fondos oscuros).
- En la app se ponen los dos con las clases `fl-logo-light` y `fl-logo-dark`; `globals.css` muestra el que corresponde al tema. La segunda imagen lleva `alt=""` y `aria-hidden="true"`.
- No se recolorea, no se deforma, no se le ponen sombras ni efectos. El «3» azul es parte del logo.
- El ancho mínimo es de 120 px. Necesita aire alrededor: al menos la mitad de su altura.
- Los azules del logo (`#1A3E7F` y `#4895F4`) son un poco distintos del Azul Flu3nce de la interfaz (`#1F4BD8`). Conviven bien; no se deben usar los del logo en la interfaz.

## 9. Accesibilidad

- Contraste: texto normal ≥ 4.5:1 y texto grande (24 px o más) e íconos ≥ 3:1. Todos los pares de la sección 2 lo cumplen; `--fl-icon-muted` no es para texto.
- Foco visible siempre: contorno de 2 px `--fl-primary` con 2 px de separación, o borde azul con anillo en campos y compositor.
- Objetivos táctiles de al menos 40 px en móvil; 42–44 px en el compositor.
- El color nunca va solo: estado = punto + texto; selección = color + peso.
- Elementos reales: `<button>`, `<a href>`, `<input>` con `<label>`. Los botones de ícono llevan `aria-label`.
- Todo el texto de la interfaz va en español, en segunda persona y sin jerga técnica (no «job», «stream» ni «payload»).

## 10. Cómo aplicarlo en código

- **En CSS:** `color: var(--fl-text-3); border: 1px solid var(--fl-border);`
- **En clases de Tailwind:** `text-[color:var(--fl-text-3)]`, `bg-[color:var(--fl-bg)]`, `border-[color:var(--fl-border)]`. La pista `color:` evita que Tailwind lo interprete como tamaño o grosor.
- **En estilos en línea:** `style={{ color: "var(--fl-text)" }}`.
- **Escalas de Tailwind** (`bg-brand-600`, `text-gray-500`): solo cuando se necesite un paso concreto de la escala y se resuelva también en oscuro.
- Las hojas de la app no están dentro de capas de Tailwind. Por eso una regla de `flu-chats.css` gana sobre una utilidad del mismo elemento; mejor no mezclar ambas para la misma propiedad.

**No hacer:**

- Colores hexadecimales, `rgba(...)` de marca o degradados en componentes.
- `backdrop-filter`, `filter: blur`, cristal o transparencias sobre contenido.
- Fuentes distintas de Geist, Geist Mono y Source Serif 4.
- Botones con esquinas cuadradas, o más de un botón azul sólido en la misma vista.
- Sombras en elementos de listas que se desplazan.
- Emojis como íconos (usar SVG de trazo o `@untitledui/icons`).

**Antes de abrir un PR que toque la interfaz:**

- [ ] Se ve bien en claro y en oscuro.
- [ ] Se ve bien a 390 px de ancho, sin desplazamiento horizontal.
- [ ] No hay colores fijos nuevos (`grep -rn "#[0-9a-fA-F]\{6\}" src/pages src/components/custom`).
- [ ] El foco se ve con teclado y los botones de ícono tienen `aria-label`.
- [ ] Las animaciones nuevas respetan «reducir movimiento».

## 11. Pendientes conocidos

- La página pública `/landing` conserva su propio estilo (`src/components/custom/landing/landing.css`) y todavía no sigue este sistema.
- `src/styles/theme.css` conserva escalas de color del kit base de Untitled UI (moss, teal, rose, etc.) que la app no usa. Se pueden recortar con cuidado: las utilidades de Tailwind dependen de ellas.

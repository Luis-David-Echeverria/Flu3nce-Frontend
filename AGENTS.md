# Instrucciones para agentes

Este archivo es para agentes de código (Codex, Claude Code y otros) que trabajen en este repo. Antes de cambiar algo, lee [README.md](README.md), [docs/arquitectura.md](docs/arquitectura.md) y, si tocas la interfaz, [docs/diseno/README.md](docs/diseno/README.md).

## Preparación

```sh
git submodule update --init --recursive
npm ci
```

Sin el submódulo `contract` no corren `check:contract-pin`, `check:api-schema` ni `verify:production`.

## Reglas

1. **Verifica antes de entregar.** `npm run verify:production` tiene que pasar completo. Si no pasa, dilo con la salida; no lo marques como terminado.
2. **El contrato manda.** Usa solo rutas, campos y estados de `contract/openapi-v2.yaml` mediante `src/lib/api.ts` y `src/services/v2/*`. No edites `src/lib/api-schema.d.ts` a mano; regenéralo con `npm run gen:api`.
3. **Las maquetas no son el backend.** `src/mocks` solo sirve para `dev:mock` y pruebas. Que algo funcione en maqueta no prueba que funcione con el API real; dilo así.
4. **Diseño:** usa los tokens `--fl-*` (en Tailwind, `text-[color:var(--fl-text-3)]`). No uses colores fijos, `backdrop-filter`, degradados ni fuentes nuevas. Botones y chips son píldoras y hay una sola acción azul sólida por vista. Revisa siempre claro, oscuro y 390 px.
5. **Movimiento:** solo `transform`, `opacity` o `background-position`, y que se apague con `prefers-reduced-motion`.
6. **Texto de la interfaz:** en español, en segunda persona y sin jerga («trabajo», no «job»; «respuesta», no «stream»).
7. **Accesibilidad:** elementos reales (`button`, `a`, `label`), `aria-label` en botones de ícono, foco visible y contraste de al menos 4.5:1.
8. **Alcance:** cambia solo lo que se pidió. No reformatees archivos completos ni renombres clases o módulos sin que se pida.
9. **Git:** trabaja en una rama y abre PR hacia `main`; no hagas push directo a `main`. No incluyas credenciales, cookies ni datos de clientes en commits.

## Dónde está cada cosa

| Necesito… | Archivo |
| --- | --- |
| Cambiar colores, radios, tipografía o animaciones | `src/styles/theme.css`, `src/styles/globals.css` |
| Cambiar el aspecto del chat o los paneles | `src/pages/flu-chats.css` |
| La pantalla principal | `src/pages/flu-chats.tsx` (estado); piezas en `flu-chat-sidebar.tsx`, `flu-chat-message.tsx`, `flu-chat-context.tsx`, `flu-chat-dialogs.tsx` |
| El compositor y su borrador | `src/pages/chat-composer.tsx`, `src/hooks/use-chat-draft.ts` |
| Copiar respuestas y tablas | `src/pages/chat-copy-message.tsx`, `src/components/custom/chat-table.tsx`, `src/lib/table-export.ts` |
| Recorridos en navegador | `e2e/*.spec.ts`, `playwright.config.ts` |
| La actividad y los trabajos | `src/pages/chat-activity.tsx`, `chat-job-activity.tsx`, `chat-*-state.ts` |
| Tarjetas y visor de entregables | `src/components/custom/consultation-deliverable-card.tsx`, `deliverable-content-view.tsx` |
| Llamadas al API | `src/services/v2/*` |
| Datos de maqueta | `src/mocks/*` |

# Arquitectura del frontend

Flu3nce es una aplicación de una sola página: React 19, TypeScript, Vite 7 y Tailwind CSS 4. Habla con el backend únicamente a través del API v2, definida en el contrato compartido `flu3nce-contract`. El front no orquesta generaciones ni encadena pasos: pide al backend, representa lo que el backend informa y nunca declara un éxito por su cuenta.

```
navegador ──► /api/v2/… (cookie de sesión) ──► proxy ──► backend /v2/…
   ▲                                                        │
   └──────────── SSE: respuesta del turno y eventos ◄───────┘
```

## Capas

| Capa | Carpeta | Responsabilidad |
| --- | --- | --- |
| Rutas | `src/app-routes.tsx`, `src/components/routes/protected-route.tsx` | Rutas públicas (`/login`, `/reset-password`, `/landing`) y protegidas (`/flu`, editor de diagramas). Sin sesión, redirige a `/login`. |
| Sesión | `src/contexts/auth-context.tsx`, `src/services/auth-service.ts`, `src/lib/session-expiry.ts` | Consulta `/auth/me`. Un 401 en una ruta protegida marca la sesión como caducada una sola vez y lleva a `/login?sessionExpired=1`. |
| Capacidades | `src/lib/capabilities.ts` | Qué puede usar la cuenta (adjuntos múltiples, revisiones, controles de tareas, etc.). Un nombre de perfil nunca da acceso por sí mismo. |
| Pantallas | `src/pages/flu-*`, `src/pages/chat-*` | La interfaz de trabajo en `/flu`. `flu-chats.tsx` coordina el estado; las piezas viven aparte: barra lateral (`flu-chat-sidebar.tsx`), mensaje del historial (`flu-chat-message.tsx`), panel de contexto (`flu-chat-context.tsx`), diálogos (`flu-chat-dialogs.tsx`), copiar respuesta (`chat-copy-message.tsx`) y compositor (`chat-composer.tsx`). |
| Estado del chat | `src/pages/chat-stream-state.ts`, `chat-job-state.ts`, `chat-chain-state.ts`, `chat-timeline.ts` | Reductores puros que combinan mensajes guardados, eventos en vivo, trabajos y bloques de ejecución encadenada en una línea de tiempo ordenada. |
| Diseño y borradores | `src/hooks/use-chat-layout.ts`, `src/hooks/use-chat-draft.ts` | Anchos de paneles según la ventana. Borrador del compositor por cuenta y por chat en el navegador; se borra al cerrar sesión. |
| Eventos | `src/hooks/use-chat-events.ts`, `src/services/v2/sse.ts` | Lector SSE acotado con latidos, reconexión con `Last-Event-ID` y tiempo de inactividad. |
| Subidas | `src/hooks/upload-batch-manager.ts`, `src/hooks/use-upload-batches.ts`, `src/services/v2/upload-batches.ts` | Lotes de subida que sobreviven al cambio de chat. Se guarda la metadata, nunca el archivo; máximo 3 GB por archivo. |
| Servicios | `src/services/v2/*` | Un módulo por recurso del contrato: chats, proyectos, fuentes, entregables, trabajos, miembros, memoria, modelos, permisos y biblioteca. |
| Cliente tipado | `src/lib/api.ts`, `src/lib/api-schema.d.ts` | `openapi-fetch` con los tipos generados del OpenAPI. El compilador valida rutas, parámetros y respuestas. |
| Maquetas | `src/mocks/*`, `src/config/api-mode.ts` | Datos locales tipados para `npm run dev:mock`. Nunca entran al bundle de producción (`check:frontend -- --dist` lo comprueba). |
| Editor BPMN | `src/components/custom/bpmn-editor/*`, `src/pages/bpmn-editor.tsx` | Editor y visor con `bpmn-js`, importación, autoorganización (en un Web Worker), RCO, simbología y exportación a PDF o BPMN. |
| Estilos | `src/styles/*`, `src/pages/flu-chats.css` | Sistema de diseño: [docs/diseno](diseno/README.md). |

## El contrato

- `contract/` es un submódulo que fija una revisión de `flu3nce-contract`. El pin debe pertenecer a `main` del contrato; `npm run check:contract-pin` lo comprueba.
- `src/lib/api-schema.d.ts` se genera con `npm run gen:api` a partir de `contract/openapi-v2.yaml` y **no se edita a mano**. `npm run check:api-schema` comprueba que coincida.
- `src/services/v2/types.ts` solo da alias a los esquemas del contrato. Si el contrato cambia, el compilador marca qué parte del front se rompe.
- No se inventan rutas, campos ni estados fuera del OpenAPI. Si falta algo, primero se integra en el contrato.

## Cómo fluye un mensaje

1. **Envío.** `ChatComposer` llama a `streamChatMessage` (`services/v2/chats.ts`), que abre `POST …/messages-stream` y lee eventos SSE.
2. **Respuesta en vivo.** `reduceLiveTurn` y `reduceActivity` (`chat-stream-state.ts`) construyen el turno en curso: partes ordenadas, texto por bloques, actividad y tarjetas de entregable. `ChatStreamResponse` lo muestra.
3. **Trabajos en segundo plano.** Cuando la respuesta lanza un trabajo (job), `useChatEvents` escucha `…/events-stream`. El resultado puede llegar aunque el turno inicial ya haya terminado. `ChatJobActivity` y `ChainWorkActivity` muestran su avance real.
4. **Línea de tiempo.** `buildChatTimeline` (`chat-timeline.ts`) intercala mensajes, actividad y entregables en orden cronológico, sin duplicar eventos repetidos.
5. **Entregables.** Las tarjetas abren el visor lateral (`ConsultationDeliverableCard`), que consulta la vista previa y las versiones; la descarga usa el formato real que ofrece cada versión.
6. **Detener.** Si la cuenta tiene controles de tareas, el compositor ofrece «Detener», que cancela el turno o los trabajos activos y el backend confirma la cancelación.

Reglas que se mantienen:

- El fin del stream no significa que terminaron los trabajos.
- Los mensajes no se reenvían solos al perder la conexión: se consulta el estado y se informa.
- Una tarjeta vieja conserva su versión; publicar otra no la cambia.
- El modo real nunca cae a maquetas por un error del backend.

## Modos y configuración

| Modo | Comando | Qué usa |
| --- | --- | --- |
| Real | `npm run dev` | El proxy de Vite manda `/api/v2` a `FLUENCE_API_TARGET` (por defecto `https://agentes.bimcon.com.mx`) y ajusta las cookies para localhost. |
| Maqueta | `npm run dev:mock` | Los servicios leen datos locales de `src/mocks`. No llama al modelo. |
| Producción | `npm run build` | Bundle en `dist/`. El despliegue debe dirigir `/api/v2/` a `/v2/` del backend. |

`.env.example` documenta las variables `FLUENCE_*`. Son configuración del servidor de desarrollo, no se publican en el navegador, y el front no necesita claves de proveedores de modelos.

## Pruebas

- **Vitest + Testing Library** en `src/**/*.test.{ts,tsx}`, con jsdom (`vitest.config.ts`, `src/test/setup.ts`).
- Las pruebas usan dobles de los servicios. Sirven para estado, componentes y servicios; **no sustituyen** una prueba autenticada contra el backend real.
- **Playwright** en `e2e/*.spec.ts` (`npm run test:e2e`): recorridos en navegador real sobre `dev:mock`, en claro, oscuro y 390 px, con capturas. Como las maquetas, prueban la interfaz, no el backend.
- `npm run verify:production` corre todo: lint, chequeos del front, pin del contrato, esquema del API, pruebas, build y revisión del bundle (sin maquetas y dentro del presupuesto de peso).

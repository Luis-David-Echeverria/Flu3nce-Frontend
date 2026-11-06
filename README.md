# Flu3nce · Frontend

Interfaz de **Flu3nce**, la consultoría documental en lenguaje natural de **bimcon**. Se trabaja conversando: el chat reúne las fuentes, los entregables y sus versiones, y el proyecto agrupa conversaciones relacionadas. Incluye bandeja de archivos, selección de modelo, respuestas en Markdown, actividad real y cancelación de tareas, memoria, biblioteca, permisos, visor de documentos y editor de diagramas BPMN.

La interfaz de trabajo es una sola, en `/flu`. El estilo sigue el [sistema de diseño Flu3nce](docs/diseno/README.md), alternativa C «sobria con corriente».

## Documentación

| Documento | Para qué |
| --- | --- |
| [Sistema de diseño](docs/diseno/README.md) | Color, tipografía, forma, movimiento, componentes, modo oscuro, logo y accesibilidad |
| [Arquitectura](docs/arquitectura.md) | Capas, contrato del API, flujo de un mensaje, modos y pruebas |
| [Cómo contribuir](CONTRIBUTING.md) | Ramas, commits, PRs, verificación y actualización del contrato |
| [Instrucciones para agentes](AGENTS.md) | Reglas para Codex, Claude y otros agentes que trabajen en el repo |

## Requisitos

- Node.js 22.12 o posterior y npm.
- Acceso de lectura al repositorio del contrato, `Luis-David-Echeverria/flu3nce-contract`, que entra como submódulo.

## Preparación

```sh
git clone --recurse-submodules https://github.com/Luis-David-Echeverria/Flu3nce-Frontend.git
cd Flu3nce-Frontend
npm ci
```

Si ya lo clonaste sin submódulos:

```sh
git submodule update --init --recursive
```

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | Desarrollo contra el API real, en `http://localhost:5174`. |
| `npm run dev:mock` | Desarrollo con datos locales tipados; no llama al modelo. |
| `npm test -- --maxWorkers=1` | Pruebas de componentes, servicios y estado. |
| `npm run test:e2e` | Recorridos en navegador real (Playwright) sobre `dev:mock`: claro, oscuro y 390 px, con capturas en `test-results/`. La primera vez: `npx playwright install chromium`. |
| `npm run lint` | ESLint: errores de TypeScript y reglas de hooks de React. |
| `npm run check:frontend` | Detecta módulos sin uso, dependencias no declaradas y rutas retiradas. |
| `npm run check:contract-pin` | Comprueba que el submódulo apunte a un commit de `main` del contrato. |
| `npm run check:api-schema` | Comprueba que los tipos generados coinciden con el contrato. |
| `npm run gen:api` | Regenera `src/lib/api-schema.d.ts` desde `contract/openapi-v2.yaml`. |
| `npm run build` | Compila TypeScript y genera el bundle de producción en `dist/`. |
| `npm run verify:production` | Lint, chequeos, pruebas y build, más la revisión del bundle: sin datos de maqueta y dentro del presupuesto de peso (140 KB gzip lo inicial y 120 KB el chat). **Correrlo antes de cada PR y de publicar.** |

## Rutas

| Ruta | Función |
| --- | --- |
| `/flu` | Chat, directorio de conversaciones y proyectos, contexto y visor. |
| `/flu/diagrams/:deliverableId?project=…&chat=…&version=…` | Editor del diagrama y versión seleccionados; vuelve al chat de origen. |
| `/login` | Acceso con usuario y contraseña o SSO (Google, Microsoft). |
| `/reset-password` | Restablecimiento de contraseña. |
| `/landing` | Presentación pública del producto. |

La raíz redirige a `/flu`. Las rutas que no existen muestran la pantalla 404.

## Estructura

```
src/
  app-routes.tsx          rutas del producto
  pages/flu-*, chat-*     conversación, paneles y estado del chat
  pages/flu-chats.css     estilos del chat (sistema de diseño)
  components/custom/      tarjetas de entregable, preguntas, modales, editor BPMN, landing
  services/v2/            acceso al API v2 según el contrato
  lib/api.ts              cliente tipado (openapi-fetch)
  lib/api-schema.d.ts     tipos generados: no editar a mano
  mocks/, test/           datos locales para dev:mock y soporte de pruebas
  styles/                 tokens del sistema de diseño (theme.css, globals.css)
contract/                 submódulo flu3nce-contract (OpenAPI v2)
docs/                     diseño y arquitectura
scripts/                  controles de integridad y arranque del sitio publicado
```

## API y configuración

Todo el tráfico usa `/api/v2`, con la sesión en una cookie. En desarrollo, Vite hace de proxy; en producción, el servidor debe dirigir `/api/v2/` a `/v2/` del backend. Las variables `FLUENCE_*` de `.env.example` solo configuran ese proxy local y no llegan al navegador. El front no necesita claves de proveedores de modelos.

Las respuestas llegan por SSE, con reconexión mediante `Last-Event-ID`. Qué modelos, formatos y operaciones aparecen depende de lo que el backend habilite para cada cuenta. Detalles en [Arquitectura](docs/arquitectura.md).

## Verificación en GitHub

`.github/workflows/verify.yml` corre `npm run verify:production` en cada PR y en cada push a `main`, y en paralelo los recorridos en navegador (`npm run test:e2e`), que guardan sus capturas como artefacto. Como el contrato es privado, el workflow necesita el secreto **`CONTRACT_READ_SSH_KEY`**. Cómo crearlo: [CONTRIBUTING.md](CONTRIBUTING.md#verificación-en-github).

## Publicación

La fuente de producción y de las pruebas es **`Luis-David-Echeverria/Flu3nce-Frontend`, rama `main`**. El repositorio `Fluence` queda como historial.

Lo que se sirve es `dist/`, generado con `npm run build`. Ningún comando de verificación despliega.

`npm run deploy:production` es la entrada de publicación: exige este repositorio, rama `main` y una copia limpia; ejecuta `verify:production` completo y publica en Nginx solo si pasa. El despliegue guarda la procedencia en `/frontend-release.json` (repositorio, commit y pin del contrato).

- `deploy-local.ps1` compila y publica `dist/` en el Nginx local de Windows, con respaldo y reinicio validado. Se ejecuta en PowerShell como administrador; `-SkipBuild` publica el `dist/` existente.
- `scripts/Start-FluFront.ps1` solo levanta el sitio ya publicado; no compila ni despliega.

## Origen

Este repositorio parte del front de producción de `Luis-David-Echeverria/Fluence` (rama `codex/frontend-production-cleanup`, commit `3baeedf`), con el sistema de diseño ya aplicado. El historial anterior queda en ese repositorio.

## Componentes de terceros

Algunos componentes base provienen del starter de [Untitled UI React](https://www.untitledui.com/react), con licencia MIT. El editor de diagramas usa [bpmn-js](https://bpmn.io/); su licencia exige mostrar la marca de bpmn.io salvo que se adquiera una licencia comercial, y la app hoy la oculta (ver la nota en `src/styles/globals.css`). Las demás dependencias mantienen sus licencias.

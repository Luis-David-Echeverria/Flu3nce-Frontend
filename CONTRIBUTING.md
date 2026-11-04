# Cómo contribuir

## Flujo de trabajo

1. Parte de `main` actualizado y crea una rama con un nombre que diga qué cambia: `diseno/compositor-adjuntos`, `fix/stream-reconexion`, `feat/visor-pptx`.
2. Haz commits pequeños con el mensaje en español, en imperativo y explicando el porqué: «Mostrar la versión en las tarjetas antiguas para no confundirlas con la vigente».
3. Antes de abrir el PR, corre `npm run verify:production` y asegúrate de que pase completo.
4. Abre el PR hacia `main` y llena la plantilla. Si toca la interfaz, adjunta capturas en claro, en oscuro y a 390 px de ancho.
5. Se integra cuando la verificación de GitHub está en verde y alguien más lo revisó.

No se hace push directo a `main`.

## Reglas del código

- **API:** solo lo que define el contrato (`contract/openapi-v2.yaml`). No se inventan rutas, campos ni estados; si falta algo, se pide en `flu3nce-contract` primero.
- **Tipos:** `src/lib/api-schema.d.ts` se genera; nunca se edita a mano.
- **Diseño:** sigue el [sistema de diseño](docs/diseno/README.md). Usa tokens `--fl-*` en lugar de colores fijos, sin desenfoque ni degradados, con una sola acción azul por vista.
- **Texto de la interfaz:** en español, claro y sin jerga técnica.
- **Maquetas:** los datos de `src/mocks` solo se usan en `dev:mock` y en pruebas. El build de producción no debe contenerlos.
- **Formato:** el repo tiene `.prettierrc`, pero el formato actual es mixto. Formatea solo lo que cambias; no reformatees archivos completos en un PR de funcionalidad.
- **Pruebas:** si cambias estado, servicios o un componente con lógica, agrega o ajusta su prueba en el archivo `*.test.ts(x)` vecino.

## Actualizar el contrato

1. Integra primero el cambio en `main` de `flu3nce-contract`.
2. Mueve el submódulo a ese commit:

   ```sh
   git -C contract fetch origin main
   git -C contract checkout <commit-de-main>
   ```

3. Regenera los tipos y corrige lo que marque el compilador:

   ```sh
   npm run gen:api
   npx tsc -b
   ```

4. Haz un solo commit con el nuevo pin del submódulo, los tipos regenerados y los ajustes del front.
5. Corre `npm run verify:production`. `check:contract-pin` falla si el pin no pertenece a `main` del contrato.

## Verificación en GitHub

`.github/workflows/verify.yml` corre `npm run verify:production` en cada PR y en cada push a `main`. El contrato vive en un repo privado aparte, y el token automático de GitHub Actions no puede leerlo. Por eso el workflow usa el secreto **`CONTRACT_READ_TOKEN`**.

Para crearlo (una sola vez; lo hace quien administra el repo):

1. En GitHub, ve a **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. En **Repository access**, elige **Only select repositories** y selecciona `Luis-David-Echeverria/flu3nce-contract`.
3. En **Permissions → Repository permissions**, da **Contents: Read-only**. Metadata queda en solo lectura automáticamente.
4. Genera el token y cópialo.
5. En este repo, ve a **Settings → Secrets and variables → Actions → New repository secret**. Usa el nombre `CONTRACT_READ_TOKEN` y pega el token.

El token tiene fecha de vencimiento. Cuando venza, la verificación fallará en el paso «Traer el contrato» con el aviso correspondiente; basta con generar otro y reemplazar el secreto.

## Publicar

Ver la sección «Publicación» del [README](README.md#publicación). Antes de publicar, `main` debe estar en verde y `npm run verify:production` debe pasar en la máquina que publica.

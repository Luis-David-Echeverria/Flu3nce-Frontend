## Qué cambia

<!-- Dos o tres líneas: qué cambia y por qué. -->

## Cómo se probó

- [ ] `npm run verify:production` pasa completo
- [ ] `npm run test:e2e` pasa (si toca la interfaz)
- [ ] Probado en `npm run dev:mock` o contra el API real (indica cuál)

## Interfaz

<!-- Borra esta sección si el PR no toca la interfaz. -->

- [ ] Sigue el [sistema de diseño](https://github.com/Luis-David-Echeverria/Flu3nce-Frontend/blob/main/docs/diseno/README.md): tokens `--fl-*`, sin colores fijos, sin desenfoque, una sola acción azul por vista
- [ ] Revisado en claro, en oscuro y a 390 px
- [ ] Foco visible con teclado; los botones de ícono tienen `aria-label`

Capturas:

## Contrato

<!-- Borra esta sección si no cambia el submódulo `contract`. -->

- [ ] El pin apunta a un commit de `main` de `flu3nce-contract`
- [ ] `src/lib/api-schema.d.ts` regenerado con `npm run gen:api`

# Indesia: P&ID Blueprint Analyzer

Prototipo de equipo para cargar, visualizar y comparar planos P&ID, desarrollado para IndesIAhack 2025 con Svelte, Vite y PDF.js.

El código incluye carga de PDF, imágenes y ZIP, extracción de etiquetas mediante reglas, comparación de documentos y una integración opcional con Gemini. El análisis heurístico es un prototipo; no se ha validado para decisiones industriales.

## Ejecutar en local

Requiere Node.js 18 o posterior.

```sh
npm ci
npm run dev
```

Para generar el frontend:

```sh
npm run build
npm run preview
```

Los planos de prueba se aportan desde tu equipo. No se incluyen documentos industriales en este repositorio.

## Claves y datos

La aplicación funciona con análisis local sin una clave compartida. Gemini es opcional: cada usuario introduce su propia clave en los ajustes del navegador. Si activa esa integración, los documentos o mensajes enviados al servicio se transmiten a Google.

No se incluye ninguna clave ni se acepta una clave de Gemini mediante variables de compilación. Las variables `VITE_*` son públicas en un frontend; no deben contener secretos. `.env.example` contiene únicamente opciones de interfaz. Los archivos `.env`, dependencias y resultados de compilación están excluidos de Git.

La clave introducida por el usuario se conserva en el almacenamiento de su navegador. Usa esta modalidad solo en un equipo de confianza y bórrala desde el navegador cuando dejes de utilizarla.

## Comprobación de la frontera de credenciales

```sh
npm run test:security
```

Estas pruebas comprueban que una clave de compilación se ignora y que sigue funcionando la configuración por usuario. No realizan peticiones a Gemini.

// Genera les icones de l'app. Només cal tornar-lo a executar si canvia el disseny.
// Ús: NODE_PATH=<carpeta amb sharp> node tests/make-icons.mjs
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const art = (scale) => {
  const offset = (512 - 512 * scale) / 2;
  return `<g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M96 244 256 112l160 132" fill="none" stroke="#FFC857" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="196" cy="268" r="42" fill="#7DA7F5"/>
    <circle cx="316" cy="268" r="42" fill="#F2935C"/>
    <circle cx="196" cy="372" r="42" fill="#4FC4B6"/>
    <circle cx="316" cy="372" r="42" fill="#B79BF0"/>
  </g>`;
};

const svg = (radius, scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" rx="${radius}" fill="#14312B"/>${art(scale)}</svg>`;

const output = async (source, size, file) =>
  sharp(Buffer.from(source)).resize(size, size).png().toFile(`icons/${file}`);

await output(svg(96, 1), 192, 'icon-192.png');
await output(svg(96, 1), 512, 'icon-512.png');
await output(svg(0, 0.72), 512, 'icon-maskable-512.png');
await output(svg(0, 0.9), 180, 'apple-touch-icon.png');

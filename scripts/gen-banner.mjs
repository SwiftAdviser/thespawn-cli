// Generates docs/demos/pixel-banner.svg — pixel-art "SPAWNR" banner.
import { writeFileSync } from "node:fs";

const W = 800;
const H = 220;
const PX = 8;          // pixel size
const STRIDE = 10;     // pixel stride (8 + 2 gap)
const COLS = 7;        // letter grid width
const ROWS = 7;        // letter grid height
const LETTER_W = COLS * STRIDE - (STRIDE - PX); // 68
const GAP = 14;
const LETTER_STRIDE = LETTER_W + GAP; // 82

const LIME = "#E1FF7C";
const LIME_DIM = "#9bbf3f";
const BG = "#0C1220";
const TEXT_LIME = "#E1FF7C";
const TEXT_DIM = "#3a4566";

const letters = {
  S: [
    ".#####.",
    "##...##",
    "##.....",
    ".#####.",
    ".....##",
    "##...##",
    ".#####.",
  ],
  P: [
    "######.",
    "##...##",
    "##...##",
    "######.",
    "##.....",
    "##.....",
    "##.....",
  ],
  A: [
    ".#####.",
    "##...##",
    "##...##",
    "#######",
    "##...##",
    "##...##",
    "##...##",
  ],
  W: [
    "##...##",
    "##...##",
    "##...##",
    "##.#.##",
    "##.#.##",
    "#######",
    ".##.##.",
  ],
  N: [
    "##...##",
    "###..##",
    "####.##",
    "##.####",
    "##..###",
    "##...##",
    "##...##",
  ],
  R: [
    "######.",
    "##...##",
    "##...##",
    "######.",
    "##.##..",
    "##..##.",
    "##...##",
  ],
};

const word = "SPAWNR";
const totalWordW = word.length * LETTER_W + (word.length - 1) * GAP;
const startX = Math.round((W - totalWordW) / 2);
const startY = 48;

const rects = [];

// Letter pixels
word.split("").forEach((ch, li) => {
  const grid = letters[ch];
  const xOff = startX + li * LETTER_STRIDE;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === "#") {
        const x = xOff + c * STRIDE;
        const y = startY + r * STRIDE;
        const delay = (li * 0.08 + r * 0.02 + c * 0.01).toFixed(3);
        rects.push(
          `<rect x="${x}" y="${y}" width="${PX}" height="${PX}" rx="1" fill="${LIME}" class="lt" style="animation-delay:${delay}s"/>`
        );
      }
    }
  }
});

// Decorative scatter pixels (sparks around the word)
const scatterSeed = [
  [40, 40], [48, 56], [56, 90], [40, 110], [60, 130],
  [72, 30], [90, 20], [110, 50], [120, 130], [140, 30],
  [740, 40], [752, 60], [760, 100], [744, 130], [724, 28],
  [712, 130], [700, 22], [688, 128], [668, 26], [780, 90],
  [760, 130], [752, 30], [44, 80], [56, 22], [768, 120],
];
scatterSeed.forEach(([x, y], i) => {
  const delay = ((i % 8) * 0.18).toFixed(2);
  rects.push(
    `<rect x="${x}" y="${y}" width="${PX}" height="${PX}" rx="1" fill="${LIME_DIM}" class="spark" style="animation-delay:${delay}s"/>`
  );
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${LIME}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${LIME}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${LIME}" stop-opacity="0"/>
    </linearGradient>
    <style>
      @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
      @keyframes pulse { 0%,100% { opacity: 0.92; } 50% { opacity: 1; } }
      @keyframes spark { 0%,100% { opacity: 0.05; } 50% { opacity: 0.7; } }
      .cursor { animation: blink 1s step-end infinite; }
      .lt { animation: pulse 2.4s ease-in-out infinite; }
      .spark { opacity: 0.05; animation: spark 3.2s ease-in-out infinite; }
    </style>
  </defs>

  <rect width="${W}" height="${H}" rx="12" fill="${BG}"/>

  <g>
    ${rects.join("\n    ")}
  </g>

  <line x1="80" y1="148" x2="${W - 80}" y2="148" stroke="url(#line-grad)" stroke-width="1"/>

  <text x="${W / 2}" y="174" text-anchor="middle"
    font-family="'JetBrains Mono','Menlo','Cascadia Code','Fira Code',monospace"
    font-size="13" fill="${TEXT_LIME}" letter-spacing="0.3">Find, create or update reliable MCP servers for your AI agent<tspan class="cursor" fill="${LIME}">&#9612;</tspan></text>

  <text x="${W / 2}" y="196" text-anchor="middle"
    font-family="'JetBrains Mono','Menlo','Cascadia Code','Fira Code',monospace"
    font-size="11" fill="${TEXT_DIM}" letter-spacing="2">CLAUDE CODE  ·  CURSOR  ·  WINDSURF  ·  CODEX</text>
</svg>
`;

writeFileSync(new URL("../docs/demos/pixel-banner.svg", import.meta.url), svg);
console.log("wrote docs/demos/pixel-banner.svg");

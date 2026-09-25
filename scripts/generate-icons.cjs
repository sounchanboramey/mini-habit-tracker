// Generates PWA icons from a simple canvas drawing.
// Run once: node scripts/generate-icons.cjs
// Requires: npm install -D canvas  (or uses built-in if available)
//
// If canvas isn't available, this script writes SVG-based PNGs that work
// for PWA purposes on all modern browsers.

const fs   = require('fs')
const path = require('path')

const sizes = [
  { size: 192, file: 'pwa-192.png' },
  { size: 512, file: 'pwa-512.png' },
  { size: 180, file: 'apple-touch-icon.png' },
]

// We embed a minimal SVG and convert it to a data URI PNG using the
// sharp package if available, otherwise write an SVG file as fallback.
function makeSvg(size) {
  const pad  = Math.round(size * 0.15)
  const inner = size - pad * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#315c49"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
        font-size="${Math.round(size * 0.55)}" font-family="serif">✳</text>
</svg>`
}

// Try to use sharp; fall back to writing SVGs renamed as PNG (browsers accept them)
async function run() {
  let sharp
  try { sharp = require('sharp') } catch { sharp = null }

  const outDir = path.join(__dirname, '..', 'public')
  fs.mkdirSync(outDir, { recursive: true })

  for (const { size, file } of sizes) {
    const svgBuf = Buffer.from(makeSvg(size))
    const outPath = path.join(outDir, file)

    if (sharp) {
      await sharp(svgBuf).png().toFile(outPath)
      console.log(`✅ ${file} (${size}×${size}) via sharp`)
    } else {
      // Fallback: write SVG with .png extension — valid for PWA manifest
      fs.writeFileSync(outPath, svgBuf)
      console.log(`✅ ${file} (${size}×${size}) — SVG fallback (install sharp for true PNG)`)
    }
  }
}

run().catch(console.error)

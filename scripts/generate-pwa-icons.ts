#!/usr/bin/env npx tsx
/**
 * Generate PWA icons from the favicon SVG
 * Uses sharp for image processing
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const publicDir = join(projectRoot, 'public');
const iconsDir = join(publicDir, 'icons');
const sourceSvg = join(publicDir, 'favicon.svg');

// Ensure icons directory exists
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

// Read SVG content
const svgContent = readFileSync(sourceSvg);

// Icon sizes for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  console.log('Generating PWA icons from', sourceSvg);

  // Generate standard icons
  for (const size of sizes) {
    console.log(`  Creating ${size}x${size} icon...`);
    await sharp(svgContent)
      .resize(size, size)
      .png()
      .toFile(join(iconsDir, `icon-${size}x${size}.png`));
  }

  // Generate maskable icons (with background and padding for safe zone)
  // Maskable icons need 10% padding on each side (80% of icon is safe zone)
  const bgColor = { r: 31, g: 41, b: 55, alpha: 1 }; // #1f2937

  console.log('  Creating maskable 192x192 icon...');
  const maskable192 = await sharp(svgContent)
    .resize(144, 144) // 75% of 192 for safe zone
    .png()
    .toBuffer();
  await sharp({
    create: { width: 192, height: 192, channels: 4, background: bgColor }
  })
    .composite([{ input: maskable192, gravity: 'center' }])
    .png()
    .toFile(join(iconsDir, 'icon-maskable-192x192.png'));

  console.log('  Creating maskable 512x512 icon...');
  const maskable512 = await sharp(svgContent)
    .resize(384, 384) // 75% of 512 for safe zone
    .png()
    .toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: bgColor }
  })
    .composite([{ input: maskable512, gravity: 'center' }])
    .png()
    .toFile(join(iconsDir, 'icon-maskable-512x512.png'));

  // Create Apple touch icon
  console.log('  Creating Apple touch icon (180x180)...');
  const appleIcon = await sharp(svgContent)
    .resize(140, 140)
    .png()
    .toBuffer();
  await sharp({
    create: { width: 180, height: 180, channels: 4, background: bgColor }
  })
    .composite([{ input: appleIcon, gravity: 'center' }])
    .png()
    .toFile(join(iconsDir, 'apple-touch-icon.png'));

  console.log('Icons generated successfully in', iconsDir);
}

generateIcons().catch(console.error);


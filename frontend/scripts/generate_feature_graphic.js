const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generate() {
  const logoPath = path.join(__dirname, '../public/brand/logo.jpg');
  const outPath = path.join(__dirname, '../android/store-assets/feature-graphic-1024x500.png');

  // Convert logo to a 220x220 rounded PNG buffer
  const logoBuf = await sharp(logoPath)
    .resize(220, 220)
    .composite([{
      input: Buffer.from(
        '<svg><rect x="0" y="0" width="220" height="220" rx="40" ry="40"/></svg>'
      ),
      blend: 'dest-in'
    }])
    .png()
    .toBuffer();

  // SVG overlay for background gradient, typography, and badges
  const svgOverlay = `
  <svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#022c22"/>
        <stop offset="55%" stop-color="#064e3b"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
      <linearGradient id="pillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#065f46" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#047857" stop-opacity="0.9"/>
      </linearGradient>
    </defs>

    <!-- Background -->
    <rect width="1024" height="500" fill="url(#bgGrad)"/>

    <!-- Decorative Glow Elements -->
    <circle cx="950" cy="80" r="280" fill="#10b981" opacity="0.12"/>
    <circle cx="80" cy="420" r="220" fill="#059669" opacity="0.10"/>
    <circle cx="500" cy="520" r="300" fill="#34d399" opacity="0.08"/>

    <!-- Brand Logo Shadow Box -->
    <rect x="76" y="136" width="228" height="228" rx="44" fill="#011b15" opacity="0.3" filter="url(#shadow)"/>
    <rect x="78" y="138" width="224" height="224" rx="42" fill="none" stroke="#34d399" stroke-width="3" opacity="0.5"/>

    <!-- App Title & Branding -->
    <text x="350" y="175" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="52" font-weight="900" fill="#ffffff" letter-spacing="1">NIRAPOTTA</text>
    
    <!-- Subtitle (Bengali + English) -->
    <text x="352" y="215" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="20" font-weight="700" fill="#a7f3d0">নিরাপত্তা • Together for a Safer Bangladesh</text>
    
    <!-- Mission tagline -->
    <text x="352" y="248" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="500" fill="#d1fae5" opacity="0.9">Verified Civic Reporting • Emergency Blood Help • Missing Persons</text>

    <!-- Badge Pills - Row 1 -->
    <g transform="translate(352, 275)">
      <!-- Pill 1 -->
      <rect x="0" y="0" width="190" height="38" rx="19" fill="url(#pillGrad)" stroke="#34d399" stroke-width="1.2" stroke-opacity="0.5"/>
      <text x="18" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#ffffff">Civic Hazard Reports</text>

      <!-- Pill 2 -->
      <rect x="205" y="0" width="195" height="38" rx="19" fill="url(#pillGrad)" stroke="#34d399" stroke-width="1.2" stroke-opacity="0.5"/>
      <text x="225" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#ffffff">Verified Blood Help</text>
    </g>

    <!-- Badge Pills - Row 2 -->
    <g transform="translate(352, 325)">
      <!-- Pill 3 -->
      <rect x="0" y="0" width="190" height="38" rx="19" fill="url(#pillGrad)" stroke="#34d399" stroke-width="1.2" stroke-opacity="0.5"/>
      <text x="18" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#ffffff">Missing Persons Alert</text>

      <!-- Pill 4 -->
      <rect x="205" y="0" width="195" height="38" rx="19" fill="url(#pillGrad)" stroke="#34d399" stroke-width="1.2" stroke-opacity="0.5"/>
      <text x="225" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#ffffff">Trust &amp; Reputation</text>
    </g>

    <!-- Bottom Footer Trust Strip -->
    <rect x="0" y="445" width="1024" height="55" fill="#011b15" opacity="0.65"/>
    <text x="512" y="478" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#a7f3d0" letter-spacing="1.5">VERIFIED COMMUNITY PLATFORM • GOOGLE PLAY OFFICIAL RELEASE • BANGLADESH</text>
  </svg>
  `;

  // Composite SVG and logo onto base image
  await sharp(Buffer.from(svgOverlay))
    .composite([
      {
        input: logoBuf,
        top: 140,
        left: 80,
      }
    ])
    .removeAlpha() // Google Play feature graphic: 24-bit RGB (no alpha)
    .png()
    .toFile(outPath);

  console.log(`Successfully generated feature graphic at: ${outPath}`);
}

generate().catch(console.error);

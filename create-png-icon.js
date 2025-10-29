// Script pour créer une icône PNG à partir du SVG
const fs = require('fs');

// Créer une version Base64 du SVG pour test
const svgContent = `<svg width="60" height="60" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <g>
    <polygon fill="#669df6" points="11 2 11 22 21 14 11 2"/>
    <polygon fill="#4285f4" points="11 2 10.02 3.17 18.87 13.78 10.07 20.83 11.01 22 21 13.99 11 2"/>
    <path fill="#669df6" d="M11,2,7,6.75a3.11,3.11,0,0,1,1.11,1L11,4.34V2Z"/>
    <path fill="#669df6" d="M8.35,18a2.93,2.93,0,0,1-.92,1.19L11,22h0V20.08Z"/>
    <path fill="#aecbfa" d="M6,10A1,1,0,1,1,7,9a1,1,0,0,1-1,1M6,6A3,3,0,1,0,9,9,3,3,0,0,0,6,6"/>
    <path fill="#aecbfa" d="M6,18a1,1,0,1,1,1-1,1,1,0,0,1-1,1m0-4a3,3,0,1,0,3,3,3,3,0,0,0-3-3"/>
  </g>
</svg>`;

// Sauvegarder une version optimisée du SVG
fs.writeFileSync('/home/n8n-nodes-ad-admin/icons/activeDirectoryAdmin-optimized.svg', svgContent);
console.log('SVG optimisé créé');

// Créer une version data URL pour test
const base64 = Buffer.from(svgContent).toString('base64');
const dataUrl = `data:image/svg+xml;base64,${base64}`;
console.log('Data URL:', dataUrl.substring(0, 100) + '...');
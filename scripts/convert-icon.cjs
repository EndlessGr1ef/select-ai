const sharp = require('sharp');
const path = require('path');

async function convertIcon() {
  const svgPath = path.join(__dirname, '../public/icon.svg');
  const sizes = [16, 48, 128];

  for (const size of sizes) {
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, `../public/icon-${size}.png`));
    console.log(`Created icon-${size}.png`);
  }
}

convertIcon();

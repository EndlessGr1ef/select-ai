const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const outputZip = path.join(rootDir, 'select-ai.zip');

if (!fs.existsSync(distDir)) {
  console.error('[zip-dist] dist/ not found. Run build first.');
  process.exit(1);
}

for (const entry of fs.readdirSync(rootDir)) {
  if (entry === 'select-ai.zip' || /^select-ai-v.*\.zip$/.test(entry)) {
    fs.rmSync(path.join(rootDir, entry), { force: true });
  }
}

const output = fs.createWriteStream(outputZip);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`[zip-dist] Created ${path.basename(outputZip)} (${archive.pointer()} bytes)`);
});

archive.on('warning', (error) => {
  if (error.code === 'ENOENT') {
    console.warn('[zip-dist] Warning:', error.message);
    return;
  }
  throw error;
});

archive.on('error', (error) => {
  console.error('[zip-dist] Failed:', error.message || error);
  process.exit(1);
});

archive.pipe(output);
archive.directory(distDir, false);
archive.finalize();

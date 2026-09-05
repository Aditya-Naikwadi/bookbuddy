const fs = require('fs');
const path = require('path');

describe('ITEM 3 — Localize PDF.js Worker Bundle for Offline Operation', () => {
  test('3.1 pdf.worker.min.mjs exists in frontend/public and is non-empty (>500KB)', () => {
    let workerPublicPath = path.join(__dirname, '../../../frontend/public/pdf.worker.min.mjs');
    if (!fs.existsSync(workerPublicPath)) {
      workerPublicPath = path.join(__dirname, '../../../client/public/pdf.worker.min.mjs');
    }
    expect(fs.existsSync(workerPublicPath)).toBe(true);

    const stat = fs.statSync(workerPublicPath);
    expect(stat.size).toBeGreaterThan(500 * 1024); // Must be >500 KB
  });

  test('3.2 DigitalReaderModal.jsx uses local workerSrc path instead of external Cloudflare CDN', () => {
    let readerComponentPath = path.join(
      __dirname,
      '../../../frontend/src/components/general/DigitalReaderModal.jsx'
    );
    if (!fs.existsSync(readerComponentPath)) {
      readerComponentPath = path.join(
        __dirname,
        '../../../client/src/pages/dashboards/student/EbookReader.jsx'
      );
    }
    expect(fs.existsSync(readerComponentPath)).toBe(true);

    const content = fs.readFileSync(readerComponentPath, 'utf8');

    // Confirm workerSrc points to local path /pdf.worker.min.mjs
    expect(content).toContain('pdf.worker.min.mjs');
    expect(content).not.toContain('cdnjs.cloudflare.com/ajax/libs/pdf.js');
  });
});

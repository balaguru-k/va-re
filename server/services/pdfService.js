const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const sizeOf = require('image-size');

const MARGIN = 40;

const generateChecklistPDF = async (checklist, items, responses) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const contentWidth = doc.page.width - MARGIN * 2;
    const pageBottom = doc.page.height - MARGIN;
    const showScore = checklist.category_id !== 6;

    const ensureSpace = (needed) => {
      if (doc.y + needed > pageBottom) doc.addPage();
    };

    // ── Title ──
    doc.fontSize(18).fillColor('#1e3a8a').font('Helvetica-Bold')
      .text('Checklist NC Report', MARGIN, doc.y, { align: 'center', width: contentWidth });
    doc.moveDown(0.4);
    doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).strokeColor('#1e3a8a').lineWidth(1).stroke();
    doc.moveDown(0.6);

    // ── Meta info ──
    doc.fontSize(10).fillColor('#333');
    const cleanName = (checklist.checklist_name || '-').replace(/\s*-\s*\d{4}-\d{2}-\d{2}\s*-\s*User\d+$/i, '');
    const meta = [
      ['Checklist', cleanName],
      ['Location', checklist.location_name || '-'],
      ['Department', checklist.department_name || '-'],
      ['Status', checklist.status || '-']
    ];
    meta.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(value);
    });
    doc.moveDown(0.5);

    // ── Filter NC items ──
    const ncResponses = responses.filter(r => r.status === 'No');

    if (ncResponses.length === 0) {
      doc.moveDown(2).fontSize(12).fillColor('#666').text('No NC items found.', { align: 'center' });
      doc.end();
      return;
    }

    // NC count
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#dc2626')
      .text(`Total NCs: ${ncResponses.length}`);
    if (showScore) {
      const yesCount = responses.filter(r => r.status === 'Yes').length;
      const noCount = ncResponses.length;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#16a34a')
        .text(`Score Yes: ${yesCount * 10}`, { continued: true });
      doc.fillColor('#dc2626').text(`  |  Score No: ${noCount * 10}`);
    }
    doc.moveDown(0.4);

    doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).strokeColor('#ccc').lineWidth(0.5).stroke();
    doc.moveDown(0.6);

    const itemMap = {};
    items.forEach(i => { itemMap[i.id] = i; });

    for (let idx = 0; idx < ncResponses.length; idx++) {
      const resp = ncResponses[idx];
      const item = itemMap[resp.checklist_item_id] || {};

      if (idx > 0) doc.addPage();

      // ── Header bar ──
      const headerY = doc.y;
      const headerText = `${idx + 1}. ${item.activities || '-'}`;
      const headerHeight = doc.fontSize(10).font('Helvetica-Bold').heightOfString(headerText, { width: contentWidth - 16 }) + 10;

      doc.save();
      doc.roundedRect(MARGIN, headerY, contentWidth, headerHeight, 2).fillColor('#eef2ff').fill();
      doc.restore();

      doc.fontSize(10).fillColor('#1e3a8a').font('Helvetica-Bold')
        .text(headerText, MARGIN + 8, headerY + 5, { width: contentWidth - 16 });
      doc.y = headerY + headerHeight + 6;

      // ── Process ──
      doc.fontSize(9).fillColor('#1e3a8a').font('Helvetica-Bold')
        .text('Process: ', MARGIN + 8, doc.y, { continued: true });
      doc.fillColor('#333').font('Helvetica').text(item.process || '-');
      doc.moveDown(0.2);

      // ── Reason ──
      if (resp.reason) {
        doc.fontSize(9).fillColor('#1e3a8a').font('Helvetica-Bold')
          .text('Reason: ', MARGIN + 8, doc.y, { continued: true });
        doc.fillColor('#333').font('Helvetica').text(resp.reason, { width: contentWidth - 16 });
        doc.moveDown(0.2);
      }

      // ── Images ──
      const imageNames = resp.image_name ? resp.image_name.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (imageNames.length > 0) {
        doc.moveDown(0.2);
        doc.fontSize(9).fillColor('#1e3a8a').font('Helvetica-Bold')
          .text('Proof:', MARGIN + 8, doc.y);
        doc.moveDown(0.3);

        const maxImgWidth = contentWidth - 16;
        const maxImgHeight = 200;

        for (const imgName of imageNames) {
          const imgPath = path.join(__dirname, '../uploads/images', imgName);
          if (!fs.existsSync(imgPath)) {
            doc.fontSize(8).fillColor('#999').text(`[Image not found: ${imgName}]`, MARGIN + 8);
            doc.moveDown(0.2);
            continue;
          }

          try {
            // Get actual image dimensions to calculate proper height
            let imgW, imgH;
            try {
              const dimensions = sizeOf(imgPath);
              imgW = dimensions.width;
              imgH = dimensions.height;
            } catch {
              imgW = 1200;
              imgH = 500;
            }

            const ratio = imgH / imgW;
            let drawWidth = Math.min(maxImgWidth, imgW);
            let drawHeight = drawWidth * ratio;
            if (drawHeight > maxImgHeight) {
              drawHeight = maxImgHeight;
              drawWidth = drawHeight / ratio;
            }

            ensureSpace(drawHeight + 15);

            const imgX = MARGIN + 8;
            const imgY = doc.y;
            doc.image(imgPath, imgX, imgY, { width: drawWidth, height: drawHeight });

            // Manually set y past the image
            doc.y = imgY + drawHeight + 8;
            doc.x = MARGIN;
          } catch (e) {
            doc.fontSize(8).fillColor('#999').text(`[Cannot load image: ${imgName}]`, MARGIN + 8);
            doc.moveDown(0.2);
          }
        }
      }

      // ── Separator ──
      doc.moveDown(0.4);
      if (idx < ncResponses.length - 1) {
        doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).strokeColor('#ddd').lineWidth(0.3).stroke();
        doc.moveDown(0.6);
      }
    }

    doc.end();
  });
};

module.exports = { generateChecklistPDF };

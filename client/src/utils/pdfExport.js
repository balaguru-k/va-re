import { jsPDF } from 'jspdf';
import { buildImageUrl } from './checklistUtils';

const loadImageAsBase64 = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

export const exportChecklistPDF = async ({ checklistData, items, responses, id }) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPage = (needed) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('Checklist Status Report', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Checklist & Status
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.text('Checklist:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(checklistData?.checklist_name || `Checklist ID: ${id}`, margin + 25, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Status:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(checklistData?.status || '-', margin + 25, y);
  y += 7;

  // Score
  const yesCount = items.filter(item => responses[item.id]?.status === 'Yes').length;
  const noCount = items.filter(item => responses[item.id]?.status === 'No').length;
  const totalItems = yesCount + noCount;
  const pointPerItem = totalItems > 0 ? Math.round(100 / totalItems) : 0;
  const yesScore = yesCount * pointPerItem;
  const noScore = noCount * pointPerItem;

  doc.setFont('helvetica', 'bold');
  doc.text('Score:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 163, 74);
  doc.text(`Yes: ${yesScore}`, margin + 25, y);
  doc.setTextColor(220, 38, 38);
  doc.text(`No: ${noScore}`, margin + 50, y);
  doc.setTextColor(50, 50, 50);
  y += 10;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Only No items
  const noItems = items.filter(item => responses[item.id]?.status === 'No');

  if (noItems.length === 0) {
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('No NC items found.', pageWidth / 2, y, { align: 'center' });
  } else {
    for (let idx = 0; idx < noItems.length; idx++) {
      const item = noItems[idx];
      const response = responses[item.id];
      const images = response?.image_name?.split(',').filter(img => img) || [];

      checkPage(50);

      // Card header
      doc.setFillColor(248, 248, 248);
      doc.setDrawColor(220, 220, 220);
      doc.roundedRect(margin, y, contentWidth, 8, 1, 1, 'FD');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138);
      doc.text(`${idx + 1}. Activities:`, margin + 3, y + 5.5);
      y += 14;

      // Activity text
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(10);
      const activityLines = doc.splitTextToSize(item.activities || item.type || '-', contentWidth - 6);
      checkPage(activityLines.length * 5 + 5);
      doc.text(activityLines, margin + 3, y);
      y += activityLines.length * 5 + 3;

      // Reasons
      if (response?.reason) {
        checkPage(15);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 138);
        doc.setFontSize(10);
        doc.text('Reasons:', margin + 3, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        const reasonLines = doc.splitTextToSize(response.reason, contentWidth - 6);
        checkPage(reasonLines.length * 5 + 3);
        doc.text(reasonLines, margin + 3, y);
        y += reasonLines.length * 5 + 3;
      }

      // Proof images - full width, one by one
      if (images.length > 0) {
        checkPage(15);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 138);
        doc.setFontSize(10);
        doc.text('Proof:', margin + 3, y);
        y += 7;

        const maxImgHeight = 250 * 0.264583; // 250px max height (~66mm)

        for (let i = 0; i < images.length; i++) {
          try {
            const base64 = await loadImageAsBase64(buildImageUrl(images[i]));
            if (base64) {
              const imgEl = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = base64;
              });
              if (imgEl) {
                const ratio = imgEl.height / imgEl.width;
                let imgHeight = contentWidth * ratio;
                if (imgHeight > maxImgHeight) imgHeight = maxImgHeight;
                checkPage(imgHeight + 8);
                doc.addImage(base64, 'JPEG', margin, y, contentWidth, imgHeight);
                y += imgHeight + 5;
              }
            } else {
              checkPage(20);
              doc.setDrawColor(200, 200, 200);
              doc.rect(margin, y, contentWidth, 15);
              doc.setFontSize(8);
              doc.setTextColor(150, 150, 150);
              doc.text('Image not available', margin + contentWidth / 2, y + 8, { align: 'center' });
              y += 20;
            }
          } catch {
            checkPage(20);
            doc.setDrawColor(200, 200, 200);
            doc.rect(margin, y, contentWidth, 15);
            y += 20;
          }
        }
      }

      // Separator
      y += 5;
      if (idx < noItems.length - 1) {
        checkPage(5);
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
      }
    }
  }

  const fileName = (checklistData?.checklist_name || 'checklist').replace(/[^a-zA-Z0-9_\- ]/g, '_');
  doc.save(`${fileName}.pdf`);
};

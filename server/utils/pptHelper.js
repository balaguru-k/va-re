const PptxGenJS = require('pptxgenjs');

const createPaginatedPPT = (data, options = {}) => {
    const ppt = new PptxGenJS();
    const { rowsPerSlide = 15, title = 'Report' } = options;
    
    const chunks = [];
    for (let i = 0; i < data.length; i += rowsPerSlide) {
        chunks.push(data.slice(i, i + rowsPerSlide));
    }
    
    chunks.forEach((chunk, index) => {
        const slide = ppt.addSlide();
        slide.addText(`${title} (${index + 1}/${chunks.length})`, { x: 0.5, y: 0.3, fontSize: 18, bold: true });
        
        const tableData = chunk.map(row => Object.values(row));
        slide.addTable(tableData, { x: 0.5, y: 1, w: 9, fontSize: 10 });
    });
    
    return ppt;
};

module.exports = { createPaginatedPPT };

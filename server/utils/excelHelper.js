const ExcelJS = require('exceljs');

const HEADER_COLOR = 'FF538DD5';

/**
 * Styles the header row (row 1) of a given ExcelJS worksheet with background color #538DD5 and white bold font.
 */
const styleHeaderRow = (worksheet, rowNumber = 1) => {
    const headerRow = worksheet.getRow(rowNumber);
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
};

module.exports = { styleHeaderRow, HEADER_COLOR };

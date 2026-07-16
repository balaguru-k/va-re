const csv = require('csv-parser');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// Helper function to normalize row keys AND values (case-insensitive)
function normalizeRowKeys(row) {
  const normalized = {};
  const keyMap = {
    'type': 'Type',
    'process': 'PROCESS',
    'camera number': 'Camera number',
    'criticality': 'Criticality',
    'activities': 'ACTIVITIES',
    'who': 'Who',
    'when': 'When',
    'how': 'How',
    'frequency': 'Frequency'
  };
  
  Object.keys(row).forEach(key => {
    const lowerKey = key.toLowerCase().trim();
    const normalizedKey = keyMap[lowerKey] || key;
    
    // Preserve original value but store it with normalized key
    normalized[normalizedKey] = row[key];
  });
  
  return normalized;
}

class FileProcessorService {
  static async process(file) {
    if (!file) return { items: [], metadata: null };
    
    const processor = this.getProcessor(path.extname(file.originalname).toLowerCase());
    return processor ? await processor.handle(file) : { items: [], metadata: null };
  }

  static getProcessor(extension) {
    const processors = {
      '.csv': new CsvProcessor(),
      '.xlsx': new ExcelProcessor()
    };
    return processors[extension];
  }
}

class CsvProcessor {
  async handle(file) {
    const items = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(file.path)
        .pipe(csv())
        .on('data', (row) => {
          const normalizedRow = normalizeRowKeys(row);
          if (this.isValidRow(normalizedRow)) {
            items.push({ data: normalizedRow, sheet: null });
          }
        })
        .on('end', () => resolve({ items, metadata: { type: 'csv', count: items.length } }))
        .on('error', reject);
    });
  }

  isValidRow(row) {
    return row.Type && (row.PROCESS || row.ACTIVITIES);
  }
}

class ExcelProcessor {
  async handle(file) {
    const items = [];
    const workbook = xlsx.readFile(file.path);
    
    // Get only the first sheet (active sheet) instead of all sheets
    const firstSheetName = workbook.SheetNames[0];
    if (firstSheetName) {
      const worksheet = workbook.Sheets[firstSheetName];
      const sheetData = xlsx.utils.sheet_to_json(worksheet);
      
      sheetData.forEach(row => {
        const normalizedRow = normalizeRowKeys(row);
        items.push({ data: normalizedRow, sheet: firstSheetName });
      });
    }
    
    return { items, metadata: { type: 'excel', sheets: 1, count: items.length } };
  }
}

class BulkChecklistProcessor {
  static async processBulkCreation(items, baseData, userId) {
    const createdChecklists = [];
    const Category = require('../models/Category');
    const Location = require('../models/Location');
    const Department = require('../models/Department');
    const Name = require('../models/Name');
    const Checklist = require('../models/Checklist');
    const ChecklistItem = require('../models/ChecklistItem');
    
    for (const item of items) {
      const row = item.data;
      
      // Find or create related entities
      const category = await this.findOrCreateCategory(row.Category);
      const location = await Location.findOrCreate(row.Location);
      const department = row.Department ? await Department.findOrCreateWithLocation(row.Department, location.id) : null;
      const name = row.Name ? await Name.findOrCreateWithLocation(row.Name, location.id) : null;
      
      // Create checklist
      const checklistData = {
        category_id: category.id,
        location_id: location.id,
        department_id: department?.id || null,
        name_id: name?.id || null,
        checklist_name: row['Checklist Name'],
        frequency: baseData.frequency || 'Daily',
        audit_count: baseData.audit_count || 1,
        alert_time: baseData.alert_time,
        type: row['Checklist Name'] && row['Checklist Name'].toLowerCase().includes('sc') ? 'SC' : 'NORMAL',
        created_by: userId,
        updated_by: userId,
        checklist_file: baseData.checklist_file
      };
      
      const checklist = await Checklist.create(checklistData);
      
      // Create checklist item
      if (row.Type || row.PROCESS || row.ACTIVITIES) {
        await ChecklistItem.create({
          checklist_id: checklist.id,
          type: row.Type || '',
          process: row.PROCESS || '',
          camera_number: row['Camera number'] || '',
          criticality: row.Criticality || '',
          activities: row.ACTIVITIES || '',
          who: row.Who || '',
          when_field: row.When || '',
          how: row.How || '',
          frequency: row.Frequency || '',
          status: 0
        });
      }
      
      createdChecklists.push(checklist);
    }
    
    return createdChecklists;
  }

  static async findOrCreateCategory(categoryName) {
    const Category = require('../models/Category');
    let category = await Category.findByName(categoryName);
    
    if (!category) {
      category = await Category.create({
        name: categoryName,
        required_fields: JSON.stringify(['location', 'name', 'checklist'])
      });
    }
    
    return category;
  }

  static hasBulkColumns(items) {
    return items.length > 0 && 
           items[0].data['Checklist Name'] && 
           items[0].data.Category && 
           items[0].data.Location;
  }
}

module.exports = { FileProcessorService, BulkChecklistProcessor };
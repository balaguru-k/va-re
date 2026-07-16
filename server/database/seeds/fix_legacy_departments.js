/**
 * Map legacy departments (name_id IS NULL) to correct facility.
 * ONLY maps departments whose location is in the client data.
 * Uses exact facility IDs from the database.
 */

const knex = require('../../config/database');

// dept_id → name_id (facility) mapping
// Built from: location has specific facility, all depts under that location go to that facility
const MAPPING = {
  // Assam → Assam Plant (name_id: 3)
  5: 3,   // Assam_mfg Powder Hair Color

  // Bangalore → Depot (name_id: 23)
  14: 23,  // Depot
  36: 23,  // Depot_bangalore

  // Bhiwandi → split between Plant and Depot
  20: 13,   // Rm Store → Bhiwandi Plant (name_id: 13)
  185: 39,  // Depot - Bhiwandi → Bhiwandi Depot (name_id: 39)

  // Erode → split between Erode Dairy Plant (1) and Erode Dairy Plant SC (45)
  2: 1,    // Erode New Plant Production Cl → Erode Dairy Plant
  11: 1,   // Erode Pms  Process → Erode Dairy Plant
  51: 1,   // Erode Ehs → Erode Dairy Plant
  192: 45, // Erode Dairy Scs → Erode Dairy Plant SC

  // Ghaziabad → Ghaziabad Depot (name_id: 43)
  189: 43, // Depot-ghaziabad

  // Haridwar → Haridwar Plant (name_id: 2)
  56: 2,   // Haridwar Fg Store & Dispatch
  57: 2,   // Haridwar-mfg Shampoo/lotion
  58: 2,   // Haridwar-packing Shampoo
  59: 2,   // Haridwar_pkg Shampoo Bottle Line
  60: 2,   // Haridwar- Mfg Easy Hari Color
  61: 2,   // Haridwar_pkg Easy Hari Color
  62: 2,   // Haridwar- Mfg Talc
  64: 2,   // Haridwar- Etp & Utility
  193: 2,  // Haridwar Periphery

  // Hyderabad → Hyderabad Depot (name_id: 38)
  184: 38, // Depot - Hyderabad

  // Kolkata → Kolkata Depot (name_id: 41)
  187: 41, // Depot - Kolkata

  // Lucknow → Lucknow Depot (name_id: 44)
  190: 44, // Depot-lucknow

  // Nagpur → Nagpur Depot (name_id: 40)
  186: 40, // Depot - Nagpur

  // Pappireddipatti → Pappireddipatti RMCC (name_id: 18)
  12: 18,  // Rmcc

  // Periyampatti CC → Periyampatti Cc (name_id: 16)
  25: 16,  // Cc - Periyampatti

  // Pondy → Pondy Plant (name_id: 33)
  133: 33, // Pondy- Fg Stores & Dispatch
  134: 33, // Pondy- Etp & Utilities
  135: 33, // Pondy- Canteen
  136: 33, // Pondy - Laboratory
  137: 33, // Pondy- Mfg Deo
  138: 33, // Pondy-men Entry
  139: 33, // Pondy- Rm Dispensing
  140: 33, // Pondy- Pm Stores
  141: 33, // Pondy- Rm Stores
  142: 33, // Pondy- Security Periphery
  143: 33, // Pondy- Security Main Gate
  239: 33, // Pondy- Mfg Shampoo/lotion
  240: 33, // Pondy- Packing Shampoo Bottle Line

  // Rohit India → Rohit India Plant (name_id: 5)
  119: 5,  // Rohit India- Security Periphery
  120: 5,  // Rohit India- Men Entry
  121: 5,  // Rohit India- Canteen
  123: 5,  // Rohit India- Fg Store
  124: 5,  // Rohit India- Transformer Area
  125: 5,  // Rohit India- Fumigation Rooms
  126: 5,  // Rohit India- Perfume Storage Room
  127: 5,  // Rohit India- Rm Cleaning
  128: 5,  // Rohit India-pulverizer Area
  129: 5,  // Rohit India_batch Coding
  130: 5,  // Rohit India- Filling & Packing
  131: 5,  // Rohit India - Aoql Checking
  132: 5,  // Rohit India_lab

  // Thalaivasal → Thalaivasal RMCC (name_id: 31)
  21: 31,  // Rmcc
  89: 31,  // Rmcc Thalaivasal -  Manjani
  91: 31,  // Rmcc Thalaivasal -  Noothapur Valar Nagar
  95: 31,  // Rmcc Thalaivasal -  Noothapur
  97: 31,  // Rmcc Thalaivasal -  K Kadambur
  105: 31, // Rmcc Thalaivasal -  Kuduvapalli Nagar

  // Thimiri → Thimiri RMCC (name_id: 30)
  17: 30,  // Rmcc
  77: 30,  // Rmcc Thimiri - Somanthangal
  83: 30,  // Rmcc Thimiri -  Lalapettai
  84: 30,  // Rmcc Thimiri - Lakshmipuram

  // Uthangarai → Uthangarai Cc (name_id: 35)
  181: 35, // Cc - Uthangarai

  // Vellimedupettai → Vellimedupettai Cc (name_id: 36)
  182: 36, // Cc - Vellimedupettai
};

async function run() {
  console.log('Mapping legacy departments to facilities...\n');

  let updated = 0;
  const entries = Object.entries(MAPPING);

  for (const [deptId, nameId] of entries) {
    const result = await knex('departments')
      .where('id', parseInt(deptId))
      .whereNull('name_id')
      .update({ name_id: nameId });
    if (result > 0) updated++;
  }

  console.log(`Mapped: ${updated} / ${entries.length} departments`);

  const remaining = await knex('departments').whereNull('name_id').count('* as c').first();
  console.log(`Remaining null name_id: ${remaining.c}`);
  console.log('Done!');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });

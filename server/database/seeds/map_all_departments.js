const knex = require('../../config/database');

// Complete dept_id → name_id mapping for ALL departments in live DB
const MAPPING = {
  // === Assam → Assam Plant (3) ===
  167: 3, 168: 3, 166: 3, 169: 3, 155: 3, 156: 3, 163: 3, 160: 3,
  162: 3, 161: 3, 164: 3, 165: 3, 158: 3, 159: 3, 157: 3, 170: 3, 5: 3,

  // === Bangalore → Depot (23) ===
  14: 23, 36: 23,

  // === Bhiwandi → Plant (13) + Depot (39) ===
  173: 13, 171: 13, 172: 13, 20: 13, // Plant
  185: 39, // Depot

  // === Chennai ===
  217: 49, 216: 49,       // Bakery Ambattur / Bakery_ambattur → Ambattur (49)
  250: 70,                // Bakery_chengalpet → Chengalpet (70)
  39: 11,                 // Bakery_gopalapuram → Gopalapuram (11)
  233: 63,                // Bakery_kk Nagar → Kk Nagar (63)
  235: 65,                // Bakery_kolathur(balaji Nagar) → Kolathur(balaji Nagar) (65)
  251: 71,                // Bakery_madipakkam → Madipakkam (71)
  253: 73,                // Bakery_mannivakkam → Mannivakkam (73)
  238: 68,                // Bakery_minjur → Minjur (68)
  236: 66,                // Bakery_mkb Nagar → Mkb Nagar (66)
  230: 60,                // Bakery_mudichur → Mudichur (60)
  252: 72,                // Bakery_navalur → Navalur (72)
  234: 64,                // Bakery_neelangarai → Neelangarai (64)
  38: 12,                 // Bakery_pammal → Pammal (12)
  19: 24,                 // Ck Bakery → Ck Bakery (24)
  15: 42, 188: 42,        // Depot / Depot - Chennai → Chennai Depot (42)
  37: 8,                  // Depot Chennai Hub → Depot Chennai Hub (8)
  241: 27, 242: 27, 243: 27, 42: 27, // Estate → Estate Chennai (27)
  // 213: Bakery_ayapakkam - NO facility
  // 225: Bakery_madambakkam - NO facility
  // 221: Bakery_thiruvetriyur - NO facility
  // 215: Bakery_valasaravakkam - NO facility
  // 200: Incubation - NO facility
  // 211: LimeLite - NO facility
  // 199: Maintenance - NO facility

  // === Chennai Hub → Chennai Hub Depot (74) ===
  // (no departments under Chennai Hub location currently)

  // === Chethpet → Chethpet Rmcc (28) ===
  65: 28, // Rmcc Chethpet - Iyyampalayam Puthur

  // === Cuddalore ===
  41: 26, 196: 26, 201: 26, 195: 26, 198: 26, 197: 26, // Birdfarm (26)
  244: 69,                // Estate Securtiy & Garden → Estate Cuddalore (69)
  179: 34,                // Kitchen → Ck Kitchen (34)
  40: 25,                 // Moonbakes-cuddalore → Moonbakes (25)
  212: 48,                // Sales IT → Sales It (48)
  194: 46,                // Unavagam → Ck Unavagam (46)

  // === Dindugul → Dindugul Rmcc (29) ===
  67: 29, 70: 29, 69: 29, 68: 29, 71: 29, 66: 29,

  // === Erode → Erode Dairy Plant (1) + Erode Dairy Plant SC (45) ===
  46: 1, 51: 1, 47: 1, 1: 1, 49: 1, 18: 1, 2: 1, 50: 1, 11: 1, 48: 1, 45: 1, // Plant
  191: 45, 192: 45, 245: 45, 247: 45, 248: 45, 246: 45, // SC

  // === Ghaziabad → Ghaziabad Depot (43) ===
  189: 43,

  // === Haridwar → Haridwar Plant (2) ===
  63: 2, 56: 2, 4: 2, 13: 2, 53: 2, 193: 2, 55: 2, 29: 2, 54: 2, 52: 2, 3: 2,
  64: 2, 255: 2, 60: 2, 62: 2, 57: 2, 58: 2, 249: 2, 254: 2, 61: 2, 59: 2,

  // === Hyderabad → Hyderabad Depot (38) ===
  184: 38,

  // === Injambakkam → Redbelly (47) ===
  210: 47, 202: 47, 206: 47, 203: 47, 205: 47, 209: 47, 204: 47, 207: 47, 208: 47,

  // === Kanchipuram → Kanchipuram Plant (15) ===
  174: 15, 177: 15, 175: 15, 178: 15, 176: 15, 23: 15, 180: 15,

  // === Kilkodungalur → Kilkodungalur Cc (37) ===
  183: 37,

  // === Kolkata → Kolkata Depot (41) ===
  187: 41,

  // === Kralz → Kralz Plant (4) ===
  111: 4, 118: 4, 117: 4, 114: 4, 116: 4, 6: 4, 107: 4, 113: 4, 112: 4,
  109: 4, 108: 4, 110: 4, 7: 4, 106: 4, 115: 4,

  // === Krishnagiri → Krishangiri Cc (17) ===
  26: 17,

  // === Lucknow → Lucknow Depot (44) ===
  190: 44,

  // === Nagpur → Nagpur Depot (40) ===
  186: 40,

  // === Pappireddipatti → Pappireddipatti Rmcc (18) ===
  12: 18, 92: 18, 88: 18, 76: 18, 86: 18, 96: 18, 90: 18, 27: 18,
  98: 18, 31: 18, 74: 18, 79: 18, 80: 18, 72: 18, 100: 18, 94: 18, 35: 18,

  // === Periyampatti → Plant (9) + Rmcc (32) ===
  151: 9, 24: 9, 146: 9, 144: 9, 16: 9, 152: 9, 44: 9, 147: 9,
  153: 9, 154: 9, 149: 9, 148: 9, 43: 9, 150: 9, 145: 9, 22: 9, // Plant
  102: 32, 101: 32, // Rmcc

  // === Periyampatti CC → Periyampatti Cc (16) ===
  25: 16,

  // === Pollachi → Pollachi Rmcc (19) ===
  32: 19, 28: 19,

  // === Pondy → Pondy Plant (33) ===
  136: 33, 135: 33, 134: 33, 133: 33, 137: 33, 239: 33, 240: 33,
  140: 33, 139: 33, 141: 33, 143: 33, 142: 33, 138: 33,

  // === Rohit India → Rohit India Plant (5) ===
  131: 5, 10: 5, 9: 5, 122: 5, 8: 5, 121: 5, 123: 5, 130: 5,
  125: 5, 120: 5, 126: 5, 127: 5, 119: 5, 124: 5, 128: 5, 129: 5, 132: 5,

  // === Rotn → each bakery has its own facility ===
  219: 51, // Bakery_jayanagar → Jayanagar (51)
  224: 55, // Bakery_kanchipuram → Kanchipuram (55)
  223: 54, // Bakery_kovaipudur → Kovaipudur (54)
  222: 53, // Bakery_ondipudur → Ondipudur (53)
  232: 62, // Bakery_palladam → Palladam (62)
  237: 67, // Bakery_pondy Lenin Street → Pondy Lenin Street (67)
  228: 58, // Bakery_ponneri → Ponneri (58)
  218: 50, // Bakery_saibaba Colony → Saibaba Colony (50)
  227: 57, // Bakery_semmandalam → Semmandalam (57)
  220: 52, // Bakery_sundarapuram → Sundarapuram (52)
  226: 56, // Bakery_tennur → Tennur (56)
  231: 61, // Bakery_vadavalli → Vadavalli (61)
  214: 59, // Bakery_villupuram → Vinayagapuram (59)
  229: 59, // Bakery_vinayagapuram → Vinayagapuram (59)

  // === Thalaivasal → Thalaivasal Rmcc (31) ===
  21: 31, 97: 31, 105: 31, 89: 31, 95: 31, 91: 31, 33: 31,
  87: 31, 104: 31, 99: 31, 30: 31, 93: 31, 85: 31, 103: 31,

  // === Thimiri → Thimiri Rmcc (30) ===
  17: 30, 83: 30, 73: 30, 34: 30, 81: 30, 82: 30, 84: 30, 75: 30, 78: 30, 77: 30,

  // === Uthangarai → Uthangarai Cc (35) ===
  181: 35,

  // === Vellimedupettai → Vellimedupettai Cc (36) ===
  182: 36,
};

async function run() {
  console.log('Mapping ALL departments to facilities...\n');

  let updated = 0, failed = 0;
  const entries = Object.entries(MAPPING);

  for (const [deptId, nameId] of entries) {
    const result = await knex('departments')
      .where('id', parseInt(deptId))
      .update({ name_id: nameId });
    if (result > 0) updated++;
    else { failed++; console.log('  SKIP dept_id:', deptId, '(not found)'); }
  }

  console.log(`Mapped: ${updated} / ${entries.length}`);
  if (failed > 0) console.log(`Not found: ${failed}`);

  // Show remaining nulls
  const nullDepts = await knex('departments as d')
    .leftJoin('locations as l', 'd.location_id', 'l.id')
    .whereNull('d.name_id')
    .select('d.id', 'd.name as dept', 'l.name as loc')
    .orderBy('l.name');

  console.log(`\nRemaining null: ${nullDepts.length}`);
  if (nullDepts.length > 0) {
    nullDepts.forEach(r => console.log('  ' + r.id + ' | ' + r.loc + ' | ' + r.dept));
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });

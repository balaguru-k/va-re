const knex = require('../../config/database');

// dept_id → name_id mapping for remaining unmapped departments
const MAPPING = {
  // Chennai - Bakeries → each bakery has its own facility
  217: 49,  // Bakery Ambattur → Ambattur (49)
  216: 49,  // Bakery_ambattur → Ambattur (49)
  // Bakery_ayapakkam - no matching facility, skip
  39: 11,   // Bakery_gopalapuram → Gopalapuram (11)
  233: 63,  // Bakery_kk Nagar → Kk Nagar (63)
  235: 65,  // Bakery_kolathur(balaji Nagar) → Kolathur(balaji Nagar) (65)
  // Bakery_madambakkam - no matching facility, skip
  238: 68,  // Bakery_minjur → Minjur (68)
  236: 66,  // Bakery_mkb Nagar → Mkb Nagar (66)
  230: 60,  // Bakery_mudichur → Mudichur (60)
  234: 64,  // Bakery_neelangarai → Neelangarai (64)
  38: 12,   // Bakery_pammal → Pammal (12)
  // Bakery_thiruvetriyur - no matching facility, skip
  // Bakery_valasaravakkam - no matching facility, skip
  19: 24,   // Ck Bakery → Ck Bakery (24)
  15: 42,   // Depot → Chennai Depot (42)
  188: 42,  // Depot - Chennai → Chennai Depot (42)
  241: 27,  // Estate Canteen → Estate Chennai (27)
  242: 27,  // Estate Cleaning → Estate Chennai (27)
  243: 27,  // Estate Pet Maintenance → Estate Chennai (27)
  42: 27,   // Estate Security → Estate Chennai (27)
  // 200: Incubation - no matching facility
  // 211: LimeLite - no matching facility
  // 199: Maintenance - no matching facility

  // Cuddalore
  41: 26,   // Birdfarm - Cuddalore → Birdfarm (26)
  244: 69,  // Estate Securtiy & Garden → Estate Cuddalore (69)
  196: 26,  // Grooming → Birdfarm (26)
  201: 26,  // Handfeeding → Birdfarm (26)
  195: 26,  // Incubation → Birdfarm (26)
  179: 34,  // Kitchen → Ck Kitchen (34)
  198: 26,  // Maintenance → Birdfarm (26)
  40: 25,   // Moonbakes-cuddalore → Moonbakes (25)
  212: 48,  // Sales IT → Sales It (48)
  194: 46,  // Unavagam → Ck Unavagam (46)
  197: 26,  // Weaning → Birdfarm (26)

  // Injambakkam → all Redbelly (47)
  210: 47,  // Redbelly_feather Trim
  202: 47,  // Redbelly_front Office/operations
  206: 47,  // Redbelly_gel Documentation
  203: 47,  // Redbelly_hygiene
  205: 47,  // Redbelly_lab Exit
  209: 47,  // Redbelly_lysate
  204: 47,  // Redbelly_mastermix
  207: 47,  // Redbelly_pcr Machine
  208: 47,  // Redbelly_template Addition

  // Periyampatti → Periyampatti Plant (9) — NOT RMCC (32)
  151: 9,   // Periyampatti Blender
  24: 9,    // Periyampatti Brine
  146: 9,   // Periyampatti Canteen
  144: 9,   // Periyampatti Etp
  16: 9,    // Periyampatti Fg Store
  152: 9,   // Periyampatti Lab
  44: 9,    // Periyampatti Main Gate
  147: 9,   // Periyampatti Men Entry
  153: 9,   // Periyampatti Pickle Packing
  154: 9,   // Periyampatti Rm Dispensing
  149: 9,   // Periyampatti Rm Store
  148: 9,   // Periyampatti Roasting
  43: 9,    // Periyampatti Scrap & Others
  150: 9,   // Periyampatti Sfg
  145: 9,   // Periyampatti Sub Process
  22: 9,    // Roasting

  // Rotn → each bakery has its own facility
  219: 51,  // Bakery_jayanagar → Jayanagar (51)
  224: 55,  // Bakery_kanchipuram → Kanchipuram (55)
  223: 54,  // Bakery_kovaipudur → Kovaipudur (54)
  222: 53,  // Bakery_ondipudur → Ondipudur (53)
  232: 62,  // Bakery_palladam → Palladam (62)
  237: 67,  // Bakery_pondy Lenin Street → Pondy Lenin Street (67)
  228: 58,  // Bakery_ponneri → Ponneri (58)
  218: 50,  // Bakery_saibaba Colony → Saibaba Colony (50)
  227: 57,  // Bakery_semmandalam → Semmandalam (57)
  220: 52,  // Bakery_sundarapuram → Sundarapuram (52)
  226: 56,  // Bakery_tennur → Tennur (56)
  231: 61,  // Bakery_vadavalli → Vadavalli (61)
  214: 59,  // Bakery_villupuram → Vinayagapuram (59) -- closest match
  229: 59,  // Bakery_vinayagapuram → Vinayagapuram (59)
};

async function run() {
  console.log('Mapping remaining departments to facilities...\n');

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

  // Show remaining
  const remaining = await knex('departments').whereNull('name_id').select('d_id');
  const nullDepts = await knex('departments as d')
    .leftJoin('locations as l', 'd.location_id', 'l.id')
    .whereNull('d.name_id')
    .select('d.id', 'd.name as dept', 'l.name as loc');
  
  console.log(`\nRemaining null name_id: ${nullDepts.length}`);
  if (nullDepts.length > 0) {
    nullDepts.forEach(r => console.log('  ' + r.id + ' | ' + r.loc + ' | ' + r.dept));
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });

/**
 * Seed: Location → Facility Name → Department hierarchy
 * 
 * This seed ensures all locations, names (facilities), and departments exist
 * with proper relationships: Location → Name (via location_id) → Department (via location_id + name_id)
 * 
 * It will NOT duplicate existing records — uses findOrCreate logic.
 */

const knex = require('../../config/database');

const DATA = [
  // Plant/Depo - Erode
  { location: 'Erode', facility: 'Erode Dairy Plant', departments: ['Erode Logistics','Erode New plant prducion cl','Erode PMS Process','Erode New plant prd tetra','Erode stores','Erode Dairy process','Erode HR Process','Erode QA lab','Erode Maintenance','Erode pet process','ErodeEHS'] },
  { location: 'Erode', facility: 'Erode Dairy Plant SC', departments: ['Erode Dairy SC','Erode PMS SC','Erode Zhongya SC','Erode Tetrapak SC','Erode UHT preparation SC'] },

  // Plant/Depo - Haridwar
  { location: 'Haridwar', facility: 'Haridwar Plant', departments: ['Haridwar Talc PKG','Haridwar Lab','Haridwar maingate','Haridwar RM dispensing','Haridwar Security periphery','Haridwar men entry','Haridwar RM store','Haridwar PM store','Haridwar FG store & disptach','Haridwar MFG shampoo/lotion','Haridwar packing shampoo FFS','Haridwar PKG shampoo bottle line','Haridwar MFG easy hair color','Haridwar PKG Easy hair color','Haridwar MFG talc','Haridwar Canteen','Haridwar ETP & utility'] },

  // Plant/Depo - Assam
  { location: 'Assam', facility: 'Assam Plant', departments: ['Assam MFG powder hair color','Assam Main gate','Assam Men entry','Assam RM store','Assam PM store','Assam RM dispensing','Assam MFG shampoo/lotion','Assam packing shampoo FFS','Assam packing shampoo bottle line','Assam MFG easy hair color','Assam PKG easy hair color','Assam PKG powder hair color','Assam FG store & dispatch','Assam canteen','Assam ETP & Utility','Assam Lab','Assam security periphery'] },

  // Plant/Depo - Kralz
  { location: 'Kralz', facility: 'Kralz plant', departments: ['Kralz Main gate','Kralz RM store','Kralz Security periphery','Kralz Men entry','Kralz RM & PM Unloading','Kralz PM store','Kralz RM dispensing','Kralz batch coding','Kralz MFG pilot plant','Kralz MFG mixing area','Kralz filling & packing','Kralz Utensil washing area','Kralz lab','Kralz FG store & dispatch','Kralz ETP & Utility'] },

  // Plant/Depo - Rohit India
  { location: 'Rohit India', facility: 'Rohit India plant', departments: ['Rohit India RM store','Rohit India Main gate','Rohit India blending','Rohit India security periphery','Rohit India men Entry','Rohit India canteen','Rohit India PM store','Rohit India FG store','Rohit India transformer area','Rohit India Fumigation area','Rohit India perfumestorage area','Rohit India RM cleaning','Rohit India pulverizer area','Rohit India batch coding','Rohit India filling & packing','Rohit India AOQL checking','Rohit India Lab'] },

  // Plant/Depo - Pondy
  { location: 'Pondy', facility: 'Pondy Plant', departments: ['Pondy FG store & dispatch','Pondy ETP & utitlities','Pondy canteen','Pondy Laboratory','Pondy MFG deo','Pondy Men Entry','Pondy RM dispensing','Pondy PM stores','Pondy RM stores','Pondy security periphery','Pondy Security Main gate','Pondy MFG shampoo/lotion','Pondy packing shampoo bottle line'] },

  // Plant/Depo - Kanchipuram
  { location: 'Kanchipuram', facility: 'Kanchipuram plant', departments: ['Kanchipuram Paneer','Kanchipuram Batter','Kanchipuram Lab','Kanchipuram Milk process','Kanchipuram External','Kanchipuram Main gate','Kanchipuram periphery'] },

  // Plant/Depo - Bhiwandi (Plant)
  { location: 'Bhiwandi', facility: 'Bhiwandi plant', departments: ['Bhiwandi PM store','Bhiwandi RM store','Bhiwandi GMP'] },

  // Depot
  { location: 'Bangalore', facility: 'Depot', departments: ['Depot Bangalore'] },
  { location: 'Hyderabad', facility: 'Depot', departments: ['Hyderabad'] },
  { location: 'Lucknow', facility: 'Lucknow Depot', departments: ['Depot Lucknow'] },
  { location: 'Ghaziabad', facility: 'Ghaziabad Depot', departments: ['Depot Ghaziabad'] },
  { location: 'chennai', facility: 'chennai Depot', departments: ['Depot chennai'] },
  { location: 'Kolkata', facility: 'Kolkata Depot', departments: ['Depot Kolkata'] },
  { location: 'Nagpur', facility: 'Nagpur Depot', departments: ['Depot Nagpur'] },
  { location: 'Bhiwandi', facility: 'Bhiwandi Depot', departments: ['Depot Bhiwandi'] },
  { location: 'Chennai Hub', facility: 'Chennai Hub Depot', departments: ['Depot Chennai Hub'] },

  // CC
  { location: 'Periyampatti CC', facility: 'Periyampatti CC', departments: ['CC periyampatti'] },
  { location: 'Krishnagiri CC', facility: 'Krishnagiri CC', departments: ['CC Krishnagiri'] },
  { location: 'Vellimedupettai', facility: 'Vellimedupettai CC', departments: ['CC Vellimedupettai'] },
  { location: 'Kilkodungalur', facility: 'Kilkodungalur CC', departments: ['CC Kilkodungalur'] },
  { location: 'Uthangarai', facility: 'Uthangarai CC', departments: ['CC Uthangarai'] },

  // RMCC - Chethpet
  { location: 'Chethpet', facility: 'Chethpet RMCC', departments: ['RMCC Chethpet - Iyyampalayam puthur'] },

  // RMCC - Dindugul
  { location: 'Dindugul', facility: 'Dindugul RMCC', departments: ['RMCC Dindugul - Viralipatti','RMCC Dindugul - Ammapatti','RMCC Dindugul - Palanigoundamputhur','RMCC Dindugul - kannivadi','RMCC Dindugul - kannimarkovilpatti','RMCC Dindugul - Senmarpatti'] },

  // RMCC - Pappireddipatti
  { location: 'Pappireddipatti', facility: 'Pappireddipatti RMCC', departments: ['RMCC Pappireddipatti - Kuppanur','RMCC Pappireddipatti - Palpakki','RMCC Pappireddipatti - vattakadu','RMCC Pappireddipatti - sillarahalli','RMCC Pappireddipatti - Rammamoorthi nagar','RMCC Pappireddipatti - Jollykottai','RMCC Pappireddipatti - S palayam','RMCC Pappireddipatti - sikkampatti','RMCC Pappireddipatti - kethureddipatti','RMCC Pappireddipatti - Duraiyur','RMCC Pappireddipatti - kukudupatti','RMCC Pappireddipatti - Ammapalayam','RMCC Pappireddipatti - vadakarai','RMCC Pappireddipatti - Kombai','RMCC Pappireddipatti - Linganaikanhalli','RMCC Pappireddipatti - Thevettipatti'] },

  // RMCC - Periyampatti
  { location: 'Periyampatti', facility: 'Periyampatti RMCC', departments: ['RMCC Periyampatti - Savlupatti','RMCC Periyampatti - Patchanampatti'] },

  // RMCC - Pollachi
  { location: 'Pollachi', facility: 'Pollachi RMCC', departments: ['RMCC Pollachi - Senjeriputhur','RMCC Pollachi - Kumarapalayam'] },

  // RMCC - Thalaivasal
  { location: 'Thalaivasal', facility: 'Thalaivasal RMCC', departments: ['RMCC Thalaivasal - Anjineyarkovil','RMCC Thalaivasal - Vazhapadi','RMCC Thalaivasal - Kadambur New','RMCC Thalaivasal - Manjani','RMCC Thalaivasal - Noothapur valar Nagar','RMCC Thalaivasal - Selliyaman Nagar','RMCC Thalaivasal - Noothapur','RMCC Thalaivasal - K Kadambur','RMCC Thalaivasal - Navakurichi','RMCC Thalaivasal - Venganur','RMCC Thalaivasal - Kuthiraisanthal','RMCC Thalaivasal - kuduvapalli nagar'] },

  // RMCC - Thimiri
  { location: 'Thimiri', facility: 'Thimiri RMCC', departments: ['RMCC Thimiri - Dharmapuram','RMCC Thimiri - Ammoor','RMCC Thimiri - Padavedu','RMCC Thimiri - Pudupalayam','RMCC Thimiri - Iyampalayam','RMCC Thimiri - Kongarapattu'] },
];

async function seed() {
  console.log('Seeding Location → Facility → Department hierarchy...\n');

  let locCount = 0, nameCount = 0, deptCount = 0;
  let locSkipped = 0, nameSkipped = 0, deptSkipped = 0;

  for (const row of DATA) {
    // 1. Find or create Location
    let location = await knex('locations').where('name', row.location).first();
    if (!location) {
      const [id] = await knex('locations').insert({ name: row.location, created_at: new Date(), updated_at: new Date() });
      location = { id, name: row.location };
      locCount++;
    } else {
      locSkipped++;
    }

    // 2. Find or create Name (Facility) with location_id
    let facility = await knex('names').where('name', row.facility).where('location_id', location.id).first();
    if (!facility) {
      // Also check if name exists without location_id (legacy data)
      facility = await knex('names').where('name', row.facility).first();
      if (facility) {
        // Update existing record with location_id if missing
        if (!facility.location_id) {
          await knex('names').where('id', facility.id).update({ location_id: location.id });
          facility.location_id = location.id;
        }
        nameSkipped++;
      } else {
        const [id] = await knex('names').insert({ name: row.facility, location_id: location.id, created_at: new Date(), updated_at: new Date() });
        facility = { id, name: row.facility, location_id: location.id };
        nameCount++;
      }
    } else {
      nameSkipped++;
    }

    // 3. Find or create Departments with location_id + name_id
    for (const deptName of row.departments) {
      let dept = await knex('departments').where('name', deptName).where('location_id', location.id).first();
      if (!dept) {
        // Check if exists without location (legacy)
        dept = await knex('departments').where('name', deptName).first();
        if (dept) {
          // Update existing with location_id and name_id
          const updateData = {};
          if (!dept.location_id) updateData.location_id = location.id;
          if (!dept.name_id) updateData.name_id = facility.id;
          if (Object.keys(updateData).length > 0) {
            await knex('departments').where('id', dept.id).update(updateData);
          }
          deptSkipped++;
        } else {
          await knex('departments').insert({
            name: deptName,
            location_id: location.id,
            name_id: facility.id,
            created_at: new Date(),
            updated_at: new Date()
          });
          deptCount++;
        }
      } else {
        // Ensure name_id is set
        if (!dept.name_id) {
          await knex('departments').where('id', dept.id).update({ name_id: facility.id });
        }
        deptSkipped++;
      }
    }
  }

  console.log(`Locations  : ${locCount} created, ${locSkipped} already existed`);
  console.log(`Facilities : ${nameCount} created, ${nameSkipped} already existed`);
  console.log(`Departments: ${deptCount} created, ${deptSkipped} already existed`);
  console.log('\nSeed completed successfully!');
}

async function run() {
  try {
    await seed();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

run();

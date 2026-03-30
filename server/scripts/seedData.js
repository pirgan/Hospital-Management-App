/**
 * Comprehensive seed script for MediCore General Hospital
 * Creates: 25 doctors, 10 nurses, 5 receptionists, 5 lab techs, 100 patients,
 *          5 wards, 200 appointments, 150 EHR records, 120 prescriptions,
 *          100 lab orders (with results), 150 invoices
 *
 * Run: node scripts/seedData.js
 * Run (wipe first): node scripts/seedData.js --wipe
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ── Models ────────────────────────────────────────────────────────────────────
import User from '../src/models/User.js';
import Patient from '../src/models/Patient.js';
import Appointment from '../src/models/Appointment.js';
import MedicalRecord from '../src/models/MedicalRecord.js';
import Prescription from '../src/models/Prescription.js';
import LabOrder from '../src/models/LabOrder.js';
import Invoice from '../src/models/Invoice.js';
import Ward from '../src/models/Ward.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n);
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randF = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
const daysAgo = (d) => new Date(Date.now() - d * 86400000);
const daysFromNow = (d) => new Date(Date.now() + d * 86400000);
const pad = (n, len = 3) => String(n).padStart(len, '0');

// ── Static Data ───────────────────────────────────────────────────────────────
const FIRST_NAMES = [
  'James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Barbara',
  'David','Susan','Richard','Jessica','Joseph','Sarah','Thomas','Karen','Charles','Lisa',
  'Daniel','Nancy','Matthew','Betty','Anthony','Margaret','Mark','Sandra','Donald','Ashley',
  'Steven','Dorothy','Paul','Kimberly','Andrew','Emily','Kenneth','Donna','Joshua','Michelle',
  'Kevin','Carol','Brian','Amanda','George','Melissa','Timothy','Deborah','Ronald','Stephanie',
  'Edward','Rebecca','Jason','Sharon','Jeffrey','Laura','Ryan','Cynthia','Jacob','Kathleen',
  'Gary','Amy','Nicholas','Angela','Eric','Shirley','Jonathan','Anna','Stephen','Brenda',
  'Larry','Pamela','Justin','Emma','Scott','Nicole','Brandon','Helen','Raymond','Samantha',
  'Frank','Katherine','Gregory','Christine','Benjamin','Debra','Samuel','Rachel','Raymond','Carolyn',
  'Patrick','Janet','Alexander','Maria','Jack','Heather','Dennis','Diane','Jerry','Julie',
];
const LAST_NAMES = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
  'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
  'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
  'Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
  'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts',
  'Turner','Phillips','Evans','Collins','Stewart','Morales','Morris','Murphy','Cook','Rogers',
  'Gutierrez','Ortiz','Morgan','Cooper','Peterson','Bailey','Reed','Kelly','Howard','Ramos',
  'Kim','Cox','Ward','Richardson','Watson','Brooks','Chavez','Wood','James','Bennett',
  'Gray','Mendoza','Ruiz','Hughes','Price','Alvarez','Castillo','Sanders','Patel','Myers',
  'Long','Ross','Foster','Jimenez','Powell','Jenkins','Perry','Russell','Sullivan','Bell',
];
const STREETS = [
  '123 Maple St','456 Oak Ave','789 Pine Rd','321 Elm Dr','654 Cedar Blvd',
  '987 Birch Ln','147 Spruce Way','258 Walnut Ct','369 Chestnut St','741 Hickory Ave',
  '852 Willow Rd','963 Poplar Dr','159 Aspen Blvd','357 Magnolia Ln','753 Sequoia Way',
  '246 Redwood Ct','468 Sycamore St','135 Dogwood Ave','579 Mulberry Rd','864 Hawthorn Dr',
];
const CITIES = [
  'New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio',
  'San Diego','Dallas','San Jose','Austin','Jacksonville','Fort Worth','Columbus','Charlotte',
  'Indianapolis','San Francisco','Seattle','Denver','Nashville',
];
const STATES = ['NY','CA','IL','TX','AZ','PA','TX','CA','TX','CA','TX','FL','TX','OH','NC','IN','CA','WA','CO','TN'];
const DEPARTMENTS = [
  'Cardiology','Neurology','Oncology','Orthopedics','Pediatrics',
  'General Practice','Emergency Medicine','Radiology','Psychiatry','Gastroenterology',
];
const ALLERGIES_LIST = [
  'Penicillin','Sulfa drugs','Aspirin','Ibuprofen','Latex','Shellfish','Peanuts',
  'Tree nuts','Eggs','Milk','Codeine','Morphine','Cephalosporins','Tetracycline',
];
const CHRONIC_CONDITIONS = [
  'Hypertension','Type 2 Diabetes','Asthma','Hypothyroidism','COPD','Atrial Fibrillation',
  'Hyperlipidemia','Osteoarthritis','Depression','Anxiety Disorder','Chronic Kidney Disease',
  'Heart Failure','Rheumatoid Arthritis','Epilepsy','GERD',
];
const INSURANCE_PROVIDERS = [
  'BlueCross BlueShield','Aetna','UnitedHealthcare','Cigna','Humana',
  'Kaiser Permanente','Centene','Anthem','Molina Healthcare','CVS Health',
];
const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const SPECIALTIES = {
  Cardiology: ['MD, FACC','MD, FHRS'],
  Neurology: ['MD, PhD','MD, FAAN'],
  Oncology: ['MD, FASCO','MD, PhD'],
  Orthopedics: ['MD, FAAOS','DO, FAAOS'],
  Pediatrics: ['MD, FAAP','DO, FAAP'],
  'General Practice': ['MD','DO','MD, FAAFP'],
  'Emergency Medicine': ['MD, FACEP','DO, FACEP'],
  Radiology: ['MD, FACR','MD'],
  Psychiatry: ['MD, FAPA','DO'],
  Gastroenterology: ['MD, FACG','MD'],
};
const MEDICATIONS = [
  { name: 'Lisinopril', dosages: ['5mg','10mg','20mg','40mg'] },
  { name: 'Metformin', dosages: ['500mg','850mg','1000mg'] },
  { name: 'Atorvastatin', dosages: ['10mg','20mg','40mg','80mg'] },
  { name: 'Amlodipine', dosages: ['2.5mg','5mg','10mg'] },
  { name: 'Omeprazole', dosages: ['10mg','20mg','40mg'] },
  { name: 'Metoprolol', dosages: ['25mg','50mg','100mg','200mg'] },
  { name: 'Losartan', dosages: ['25mg','50mg','100mg'] },
  { name: 'Gabapentin', dosages: ['100mg','300mg','400mg','600mg'] },
  { name: 'Sertraline', dosages: ['25mg','50mg','100mg'] },
  { name: 'Levothyroxine', dosages: ['25mcg','50mcg','75mcg','100mcg'] },
  { name: 'Albuterol', dosages: ['2mg','4mg','90mcg/actuation'] },
  { name: 'Furosemide', dosages: ['20mg','40mg','80mg'] },
  { name: 'Pantoprazole', dosages: ['20mg','40mg'] },
  { name: 'Hydrochlorothiazide', dosages: ['12.5mg','25mg','50mg'] },
  { name: 'Warfarin', dosages: ['1mg','2mg','2.5mg','5mg','7.5mg','10mg'] },
  { name: 'Clopidogrel', dosages: ['75mg'] },
  { name: 'Prednisone', dosages: ['5mg','10mg','20mg','40mg'] },
  { name: 'Amoxicillin', dosages: ['250mg','500mg','875mg'] },
  { name: 'Azithromycin', dosages: ['250mg','500mg'] },
  { name: 'Ciprofloxacin', dosages: ['250mg','500mg','750mg'] },
];
const FREQUENCIES = ['Once daily','Twice daily','Three times daily','Every 8 hours','Every 12 hours','As needed','At bedtime','With meals'];
const DURATIONS = ['7 days','10 days','14 days','21 days','30 days','60 days','90 days','Ongoing','Until follow-up'];
const LAB_TESTS_PANEL = [
  { name: 'CBC', results: [
    { testName: 'WBC', unit: '10^3/uL', ref: '4.5-11.0', genVal: () => randF(3.5,13.0) },
    { testName: 'RBC', unit: '10^6/uL', ref: '4.5-5.5', genVal: () => randF(3.5,6.0) },
    { testName: 'Hemoglobin', unit: 'g/dL', ref: '13.5-17.5', genVal: () => randF(9.0,18.5) },
    { testName: 'Hematocrit', unit: '%', ref: '41-53', genVal: () => randF(32,57) },
    { testName: 'Platelets', unit: '10^3/uL', ref: '150-400', genVal: () => randF(100,500) },
  ]},
  { name: 'Basic Metabolic Panel', results: [
    { testName: 'Sodium', unit: 'mEq/L', ref: '136-145', genVal: () => randF(128,152) },
    { testName: 'Potassium', unit: 'mEq/L', ref: '3.5-5.0', genVal: () => randF(2.8,6.2) },
    { testName: 'Chloride', unit: 'mEq/L', ref: '98-107', genVal: () => randF(92,115) },
    { testName: 'CO2', unit: 'mEq/L', ref: '22-29', genVal: () => randF(16,34) },
    { testName: 'BUN', unit: 'mg/dL', ref: '7-20', genVal: () => randF(5,42) },
    { testName: 'Creatinine', unit: 'mg/dL', ref: '0.6-1.2', genVal: () => randF(0.4,3.5) },
    { testName: 'Glucose', unit: 'mg/dL', ref: '70-99', genVal: () => randF(55,320) },
  ]},
  { name: 'Lipid Panel', results: [
    { testName: 'Total Cholesterol', unit: 'mg/dL', ref: '<200', genVal: () => randF(120,310) },
    { testName: 'LDL Cholesterol', unit: 'mg/dL', ref: '<100', genVal: () => randF(50,220) },
    { testName: 'HDL Cholesterol', unit: 'mg/dL', ref: '>40', genVal: () => randF(20,90) },
    { testName: 'Triglycerides', unit: 'mg/dL', ref: '<150', genVal: () => randF(50,500) },
  ]},
  { name: 'Liver Function Tests', results: [
    { testName: 'ALT', unit: 'U/L', ref: '7-56', genVal: () => randF(5,180) },
    { testName: 'AST', unit: 'U/L', ref: '10-40', genVal: () => randF(8,200) },
    { testName: 'Alkaline Phosphatase', unit: 'U/L', ref: '44-147', genVal: () => randF(30,320) },
    { testName: 'Total Bilirubin', unit: 'mg/dL', ref: '0.1-1.2', genVal: () => randF(0.1,4.5) },
    { testName: 'Albumin', unit: 'g/dL', ref: '3.5-5.0', genVal: () => randF(2.0,5.5) },
  ]},
  { name: 'Thyroid Panel', results: [
    { testName: 'TSH', unit: 'mIU/L', ref: '0.4-4.0', genVal: () => randF(0.1,12.0) },
    { testName: 'Free T4', unit: 'ng/dL', ref: '0.8-1.8', genVal: () => randF(0.4,3.5) },
    { testName: 'Free T3', unit: 'pg/mL', ref: '2.3-4.2', genVal: () => randF(1.5,8.0) },
  ]},
  { name: 'HbA1c', results: [
    { testName: 'HbA1c', unit: '%', ref: '<5.7', genVal: () => randF(4.5,12.0) },
  ]},
  { name: 'Urinalysis', results: [
    { testName: 'pH', unit: '', ref: '4.5-8.0', genVal: () => randF(4.5,8.5) },
    { testName: 'Specific Gravity', unit: '', ref: '1.005-1.030', genVal: () => randF(1.001,1.035,3) },
    { testName: 'Protein', unit: 'mg/dL', ref: 'Negative', genVal: () => pick(['Negative','Trace','30','100','300']) },
    { testName: 'Glucose', unit: 'mg/dL', ref: 'Negative', genVal: () => pick(['Negative','100','250','500']) },
  ]},
  { name: 'Cardiac Enzymes', results: [
    { testName: 'Troponin I', unit: 'ng/mL', ref: '<0.04', genVal: () => randF(0.01, 2.5, 3) },
    { testName: 'CK-MB', unit: 'ng/mL', ref: '0-6.3', genVal: () => randF(0.5,50,1) },
    { testName: 'BNP', unit: 'pg/mL', ref: '<100', genVal: () => randF(10,1200) },
  ]},
  { name: 'Coagulation Studies', results: [
    { testName: 'PT', unit: 'seconds', ref: '11-13.5', genVal: () => randF(9,45) },
    { testName: 'INR', unit: '', ref: '0.8-1.1', genVal: () => randF(0.8,4.5,2) },
    { testName: 'aPTT', unit: 'seconds', ref: '25-35', genVal: () => randF(20,90) },
  ]},
  { name: 'Electrolytes', results: [
    { testName: 'Sodium', unit: 'mEq/L', ref: '136-145', genVal: () => randF(128,152) },
    { testName: 'Potassium', unit: 'mEq/L', ref: '3.5-5.0', genVal: () => randF(2.8,6.2) },
    { testName: 'Magnesium', unit: 'mg/dL', ref: '1.7-2.2', genVal: () => randF(1.0,3.5) },
    { testName: 'Phosphorus', unit: 'mg/dL', ref: '2.5-4.5', genVal: () => randF(1.5,6.0) },
  ]},
];
const CHIEF_COMPLAINTS = [
  'Chest pain and shortness of breath','Severe headache and dizziness','Abdominal pain and nausea',
  'Persistent cough and fever','Lower back pain radiating to legs','Palpitations and lightheadedness',
  'Fatigue and unexplained weight loss','Joint pain and morning stiffness','Skin rash and itching',
  'Numbness and tingling in extremities','Difficulty breathing at rest','High fever and chills',
  'Vomiting and diarrhea for 3 days','Chest tightness and wheezing','Sudden vision changes',
  'Recurrent urinary tract infection','Ankle swelling and shortness of breath','Confusion and memory loss',
  'Severe abdominal cramping','Anxiety and panic attacks',
];
const TREATMENT_PLANS = [
  'Start ACE inhibitor therapy, dietary sodium restriction, follow-up in 4 weeks',
  'Initiate beta-blocker, refer to cardiology for stress test, monitor blood pressure daily',
  'Adjust insulin regimen, diabetes education referral, HbA1c recheck in 3 months',
  'Physical therapy 3x/week for 6 weeks, NSAIDs PRN, MRI if no improvement',
  'Antibiotic course for 10 days, increase fluid intake, culture follow-up',
  'Increase levothyroxine dose, thyroid function recheck in 6 weeks',
  'Pulmonary function tests ordered, add long-acting bronchodilator, smoking cessation counseling',
  'CT scan of abdomen ordered, NPO for possible procedure, gastroenterology consult',
  'Neurology referral, start antiepileptic medication, driving restriction advised',
  'Orthopedic surgery consultation, X-ray ordered, activity restriction, ice and elevation',
  'Initiate SSRI, cognitive behavioral therapy referral, psychiatric follow-up in 2 weeks',
  'IV antibiotics inpatient, blood cultures, infectious disease consult',
  'Diuretic adjustment, fluid restriction 1.5L/day, daily weight monitoring',
  'Chemotherapy protocol initiation, oncology team consult, palliative care discussion',
  'Echocardiogram ordered, anticoagulation initiated, cardiology urgent referral',
];
const ICD10_CODES = [
  { code: 'I10', desc: 'Essential (primary) hypertension' },
  { code: 'E11.9', desc: 'Type 2 diabetes mellitus without complications' },
  { code: 'J45.40', desc: 'Moderate persistent asthma, uncomplicated' },
  { code: 'M54.5', desc: 'Low back pain' },
  { code: 'I25.10', desc: 'Atherosclerotic heart disease of native coronary artery' },
  { code: 'F41.1', desc: 'Generalized anxiety disorder' },
  { code: 'G43.909', desc: 'Migraine, unspecified, not intractable' },
  { code: 'K21.0', desc: 'Gastro-esophageal reflux disease with esophagitis' },
  { code: 'E78.5', desc: 'Hyperlipidemia, unspecified' },
  { code: 'N39.0', desc: 'Urinary tract infection, site not specified' },
  { code: 'J18.9', desc: 'Pneumonia, unspecified organism' },
  { code: 'I50.9', desc: 'Heart failure, unspecified' },
  { code: 'M06.9', desc: 'Rheumatoid arthritis, unspecified' },
  { code: 'F32.1', desc: 'Major depressive disorder, single episode, moderate' },
  { code: 'G47.00', desc: 'Insomnia, unspecified' },
  { code: 'K58.0', desc: 'Irritable bowel syndrome with diarrhea' },
  { code: 'I48.91', desc: 'Unspecified atrial fibrillation' },
  { code: 'E03.9', desc: 'Hypothyroidism, unspecified' },
  { code: 'N18.3', desc: 'Chronic kidney disease, stage 3' },
  { code: 'C34.10', desc: 'Malignant neoplasm of upper lobe, bronchus or lung, unspecified' },
];
const APPOINTMENT_TYPES = ['consultation','follow-up','procedure','emergency'];
const APPOINTMENT_STATUSES = ['scheduled','confirmed','completed','cancelled','no-show'];
const INVOICE_STATUSES = ['draft','sent','paid','overdue'];
const CLAIM_STATUSES = ['not_filed','pending','approved','denied'];
const LINE_ITEM_TEMPLATES = [
  { description: 'Office Visit - New Patient', unitPrice: 250 },
  { description: 'Office Visit - Established Patient', unitPrice: 175 },
  { description: 'Comprehensive Physical Exam', unitPrice: 320 },
  { description: 'ECG Interpretation', unitPrice: 85 },
  { description: 'Echocardiogram', unitPrice: 450 },
  { description: 'Chest X-Ray', unitPrice: 120 },
  { description: 'CT Scan - Abdomen', unitPrice: 950 },
  { description: 'MRI - Brain', unitPrice: 1200 },
  { description: 'Lab Processing Fee', unitPrice: 45 },
  { description: 'IV Antibiotic Administration', unitPrice: 380 },
  { description: 'Wound Care Dressing', unitPrice: 95 },
  { description: 'Specialist Consultation', unitPrice: 375 },
  { description: 'Procedure: Lumbar Puncture', unitPrice: 680 },
  { description: 'Procedure: Colonoscopy', unitPrice: 1500 },
  { description: 'Emergency Room Visit - Level 3', unitPrice: 780 },
  { description: 'Inpatient Day Rate', unitPrice: 2200 },
  { description: 'ICU Day Rate', unitPrice: 4800 },
  { description: 'Pharmacy - Medications', unitPrice: 120 },
  { description: 'Physical Therapy Session', unitPrice: 165 },
  { description: 'Mental Health Counseling (50 min)', unitPrice: 195 },
];

// ── Doctor Data ────────────────────────────────────────────────────────────────
const DOCTOR_PROFILES = [
  { firstName:'Eleanor', lastName:'Hartmann', dept:'Cardiology' },
  { firstName:'Marcus', lastName:'Chen', dept:'Cardiology' },
  { firstName:'Sofia', lastName:'Patel', dept:'Cardiology' },
  { firstName:'James', lastName:'Okafor', dept:'Neurology' },
  { firstName:'Priya', lastName:'Krishnamurthy', dept:'Neurology' },
  { firstName:'Liam', lastName:'Sullivan', dept:'Neurology' },
  { firstName:'Amara', lastName:'Diallo', dept:'Oncology' },
  { firstName:'Victor', lastName:'Reyes', dept:'Oncology' },
  { firstName:'Hannah', lastName:'Bergmann', dept:'Orthopedics' },
  { firstName:'Kenji', lastName:'Tanaka', dept:'Orthopedics' },
  { firstName:'Fatima', lastName:'Al-Rashid', dept:'Orthopedics' },
  { firstName:'Carlos', lastName:'Mendoza', dept:'Pediatrics' },
  { firstName:'Rachel', lastName:'Kowalski', dept:'Pediatrics' },
  { firstName:'Ethan', lastName:'Blackwood', dept:'Pediatrics' },
  { firstName:'Nadia', lastName:'Volkov', dept:'General Practice' },
  { firstName:'Owen', lastName:'Fitzgerald', dept:'General Practice' },
  { firstName:'Chloe', lastName:'Nakamura', dept:'General Practice' },
  { firstName:'Diego', lastName:'Ferreira', dept:'General Practice' },
  { firstName:'Isabelle', lastName:'Moreau', dept:'Emergency Medicine' },
  { firstName:'Tariq', lastName:'Hassan', dept:'Emergency Medicine' },
  { firstName:'Sienna', lastName:'Whitmore', dept:'Emergency Medicine' },
  { firstName:'Darius', lastName:'Osei', dept:'Radiology' },
  { firstName:'Mei', lastName:'Zhang', dept:'Radiology' },
  { firstName:'Aiden', lastName:'Callahan', dept:'Psychiatry' },
  { firstName:'Yasmin', lastName:'Aziz', dept:'Psychiatry' },
];

// ── Main Seed ─────────────────────────────────────────────────────────────────
async function seed() {
  const wipe = process.argv.includes('--wipe');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  if (wipe) {
    console.log('Wiping existing data...');
    await Promise.all([
      User.deleteMany({ role: { $ne: 'admin' } }), // keep existing admins
      Patient.deleteMany({}),
      Appointment.deleteMany({}),
      MedicalRecord.deleteMany({}),
      Prescription.deleteMany({}),
      LabOrder.deleteMany({}),
      Invoice.deleteMany({}),
      Ward.deleteMany({}),
    ]);
    console.log('Wipe complete.');
  }

  const hashedPw = await bcrypt.hash('Password123!', 12);

  // ── 1. USERS ────────────────────────────────────────────────────────────────

  // Admin (upsert so repeated runs don't duplicate)
  let admin = await User.findOne({ email: 'admin@medicore.hospital' });
  if (!admin) {
    admin = await User.create({
      name: 'Admin User',
      email: 'admin@medicore.hospital',
      password: hashedPw,
      role: 'admin',
      department: 'Administration',
      isActive: true,
    });
  }

  // Doctors
  const doctorDocs = await User.insertMany(
    DOCTOR_PROFILES.map((d, i) => ({
      name: `Dr. ${d.firstName} ${d.lastName}`,
      email: `${d.firstName.toLowerCase()}.${d.lastName.toLowerCase()}@medicore.hospital`,
      password: hashedPw,
      role: 'doctor',
      department: d.dept,
      licenseNumber: `LIC-${pad(1001 + i, 4)}`,
      isActive: true,
    }))
  );
  console.log(`Created ${doctorDocs.length} doctors`);

  // Nurses (10)
  const nurseNames = [
    ['Grace','Kim'],['Olivia','Turner'],['Samuel','Brooks'],['Nia','Washington'],['Ethan','Cole'],
    ['Maria','Santos'],['Jake','Morris'],['Aisha','Freeman'],['Ben','Harper'],['Lucia','Vega'],
  ];
  const nurseDocs = await User.insertMany(
    nurseNames.map(([fn, ln], i) => ({
      name: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}.nurse@medicore.hospital`,
      password: hashedPw,
      role: 'nurse',
      department: pick(['General Ward','ICU','Pediatrics','Maternity','Surgical']),
      licenseNumber: `RN-${pad(2001 + i, 4)}`,
      isActive: true,
    }))
  );
  console.log(`Created ${nurseDocs.length} nurses`);

  // Receptionists (5)
  const receptionistNames = [['Claire','Dupont'],['Leo','Papadopoulos'],['Anita','Sharma'],['Mike','Donovan'],['Zoe','Leblanc']];
  const receptionistDocs = await User.insertMany(
    receptionistNames.map(([fn, ln], i) => ({
      name: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}.rec@medicore.hospital`,
      password: hashedPw,
      role: 'receptionist',
      department: 'Reception',
      isActive: true,
    }))
  );
  console.log(`Created ${receptionistDocs.length} receptionists`);

  // Lab Techs (5)
  const labTechNames = [['Derek','Fontaine'],['Lily','Ng'],['Omar','Bakr'],['Tara','Singh'],['Finn','O\'Brien']];
  const labTechDocs = await User.insertMany(
    labTechNames.map(([fn, ln], i) => ({
      name: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase().replace("'", '')}.lab@medicore.hospital`,
      password: hashedPw,
      role: 'lab_tech',
      department: 'Laboratory',
      licenseNumber: `LAB-${pad(3001 + i, 4)}`,
      isActive: true,
    }))
  );
  console.log(`Created ${labTechDocs.length} lab techs`);

  // ── 2. WARDS ────────────────────────────────────────────────────────────────
  const wardDefinitions = [
    { name: 'General Ward A', type: 'general', floor: 2, capacity: 20 },
    { name: 'General Ward B', type: 'general', floor: 2, capacity: 20 },
    { name: 'ICU', type: 'ICU', floor: 3, capacity: 10 },
    { name: 'Pediatric Ward', type: 'pediatric', floor: 4, capacity: 15 },
    { name: 'Maternity Ward', type: 'maternity', floor: 5, capacity: 12 },
    { name: 'Surgical Ward', type: 'surgical', floor: 3, capacity: 18 },
  ];
  const wardDocs = await Ward.insertMany(
    wardDefinitions.map((w) => ({
      ...w,
      beds: Array.from({ length: w.capacity }, (_, i) => ({
        number: `${w.name.split(' ')[0][0]}${w.type === 'ICU' ? 'I' : w.floor}-${pad(i + 1, 2)}`,
        status: pick(['available', 'available', 'available', 'occupied', 'reserved']),
        patient: null,
        admittedAt: null,
      })),
    }))
  );
  console.log(`Created ${wardDocs.length} wards`);

  // ── 3. PATIENTS (100) ───────────────────────────────────────────────────────
  const patientDocs = await Patient.insertMany(
    Array.from({ length: 100 }, (_, i) => {
      const fn = pick(FIRST_NAMES);
      const ln = pick(LAST_NAMES);
      const cityIdx = rand(0, CITIES.length - 1);
      const dob = new Date(
        rand(1940, 2005),
        rand(0, 11),
        rand(1, 28)
      );
      const allergyCount = rand(0, 3);
      const conditionCount = rand(0, 3);
      return {
        fullName: `${fn} ${ln}`,
        dateOfBirth: dob,
        gender: pick(['male', 'female', 'other']),
        bloodType: pick(BLOOD_TYPES),
        nhsNumber: `NHS-${pad(100001 + i, 6)}`,
        contactInfo: {
          phone: `(${rand(200,999)}) ${rand(200,999)}-${pad(rand(1000,9999),4)}`,
          email: `${fn.toLowerCase()}.${ln.toLowerCase()}${rand(1,99)}@email.com`,
          address: `${pick(STREETS)}, ${CITIES[cityIdx]}, ${STATES[cityIdx]} ${pad(rand(10000,99999),5)}`,
        },
        emergencyContact: {
          name: `${pick(FIRST_NAMES)} ${ln}`,
          relationship: pick(['Spouse','Parent','Sibling','Child','Friend']),
          phone: `(${rand(200,999)}) ${rand(200,999)}-${pad(rand(1000,9999),4)}`,
        },
        allergies: pickN(ALLERGIES_LIST, allergyCount),
        chronicConditions: pickN(CHRONIC_CONDITIONS, conditionCount),
        insuranceDetails: {
          provider: pick(INSURANCE_PROVIDERS),
          policyNumber: `POL-${pad(rand(100000,999999),6)}`,
          groupNumber: `GRP-${pad(rand(10000,99999),5)}`,
        },
        registeredBy: pick(receptionistDocs)._id,
      };
    })
  );
  console.log(`Created ${patientDocs.length} patients`);

  // Assign some patients to ward beds
  let bedAssignCount = 0;
  for (const ward of wardDocs) {
    for (const bed of ward.beds) {
      if (bed.status === 'occupied' && bedAssignCount < patientDocs.length) {
        bed.patient = patientDocs[bedAssignCount]._id;
        bed.admittedAt = daysAgo(rand(1, 14));
        bedAssignCount++;
      }
    }
    await ward.save();
  }
  console.log(`Assigned ${bedAssignCount} patients to ward beds`);

  // ── 4. APPOINTMENTS (200) ───────────────────────────────────────────────────
  const appointmentDocs = await Appointment.insertMany(
    Array.from({ length: 200 }, (_, i) => {
      const daysOffset = rand(-120, 60);
      const scheduledAt = daysOffset >= 0 ? daysFromNow(daysOffset) : daysAgo(-daysOffset);
      const isPast = daysOffset < 0;
      const status = isPast
        ? pick(['completed','completed','completed','cancelled','no-show'])
        : pick(['scheduled','confirmed','confirmed']);
      return {
        patient: patientDocs[i % patientDocs.length]._id,
        doctor: doctorDocs[i % doctorDocs.length]._id,
        scheduledAt,
        duration: pick([15, 30, 45, 60]),
        status,
        type: pick(APPOINTMENT_TYPES),
        notes: rand(0,1) ? pick([
          'Patient requested early morning slot','Interpreter needed - Spanish',
          'Follow-up for recent surgery','Bring previous imaging results',
          'Fasting required before appointment','Wheelchair accessible room required',
        ]) : undefined,
        reminderSent: isPast || Math.random() > 0.5,
        createdBy: pick(receptionistDocs)._id,
      };
    })
  );
  console.log(`Created ${appointmentDocs.length} appointments`);

  // ── 5. MEDICAL RECORDS / EHR (150) ─────────────────────────────────────────
  const completedAppointments = appointmentDocs.filter(a => a.status === 'completed');
  const medRecordDocs = await MedicalRecord.insertMany(
    Array.from({ length: 150 }, (_, i) => {
      const appt = completedAppointments[i % completedAppointments.length];
      const numDiagnoses = rand(1, 3);
      const diagnosesSelected = pickN(ICD10_CODES, numDiagnoses);
      return {
        patient: appt.patient,
        doctor: appt.doctor,
        appointment: appt._id,
        visitDate: appt.scheduledAt,
        chiefComplaint: pick(CHIEF_COMPLAINTS),
        vitals: {
          height: rand(150, 195),
          weight: randF(45, 130),
          bloodPressure: `${rand(100,165)}/${rand(60,100)}`,
          pulse: rand(50, 110),
          temperature: randF(36.0, 39.5),
          o2Saturation: rand(88, 100),
        },
        diagnoses: diagnosesSelected.map((d, di) => ({
          icd10Code: d.code,
          description: d.desc,
          type: di === 0 ? 'primary' : pick(['secondary','differential']),
        })),
        treatmentPlan: pick(TREATMENT_PLANS),
        followUpDate: Math.random() > 0.3 ? daysFromNow(rand(7, 90)) : undefined,
        aiDifferentialDiagnosis: Math.random() > 0.4 ? Array.from({ length: rand(2,4) }, (__, j) => {
          const d = ICD10_CODES[(i + j + 3) % ICD10_CODES.length];
          return {
            diagnosis: d.desc,
            confidence: rand(35, 92),
            reasoning: `Based on presented symptoms and vitals, ${d.desc.toLowerCase()} is consistent with clinical picture.`,
          };
        }) : [],
        aiRiskScore: rand(10, 95),
      };
    })
  );
  console.log(`Created ${medRecordDocs.length} medical records`);

  // ── 6. PRESCRIPTIONS (120) ──────────────────────────────────────────────────
  const prescriptionDocs = await Prescription.insertMany(
    Array.from({ length: 120 }, (_, i) => {
      const rec = medRecordDocs[i % medRecordDocs.length];
      const numMeds = rand(1, 4);
      const meds = pickN(MEDICATIONS, numMeds).map(m => ({
        name: m.name,
        dosage: pick(m.dosages),
        frequency: pick(FREQUENCIES),
        duration: pick(DURATIONS),
        instructions: pick([
          'Take with food','Take on empty stomach','Avoid alcohol',
          'Do not crush or chew','Take with full glass of water',
          'Monitor blood pressure daily','Take at the same time each day',
          undefined, undefined,
        ]),
      }));
      const status = pick(['active','active','dispensed','dispensed','cancelled']);
      const dispensed = status === 'dispensed';
      return {
        patient: rec.patient,
        doctor: rec.doctor,
        medicalRecord: rec._id,
        medications: meds,
        status,
        dispensedBy: dispensed ? pick(nurseDocs)._id : undefined,
        dispensedAt: dispensed ? daysAgo(rand(0, 30)) : undefined,
        aiInteractionCheck: Math.random() > 0.5 ? {
          checkedAt: rec.visitDate,
          interactions: meds.length > 1 && Math.random() > 0.7 ? [{
            drug1: meds[0].name,
            drug2: meds[1].name,
            severity: pick(['minor','moderate','major']),
            description: `Potential interaction between ${meds[0].name} and ${meds[1].name}. Monitor for adverse effects.`,
          }] : [],
          safe: Math.random() > 0.15,
        } : undefined,
      };
    })
  );
  console.log(`Created ${prescriptionDocs.length} prescriptions`);

  // ── 7. LAB ORDERS (100, with results) ──────────────────────────────────────
  const labOrderDocs = await LabOrder.insertMany(
    Array.from({ length: 100 }, (_, i) => {
      const rec = medRecordDocs[i % medRecordDocs.length];
      const numPanels = rand(1, 3);
      const panels = pickN(LAB_TESTS_PANEL, numPanels);
      const testNames = panels.map(p => p.name);
      const priority = pick(['routine','routine','routine','urgent','stat']);
      const status = pick(['ordered','in-progress','completed','completed','completed']);
      const isCompleted = status === 'completed';

      const results = isCompleted
        ? panels.flatMap(panel =>
            panel.results.map(r => {
              const value = r.genVal().toString();
              const refRange = r.ref;
              let flagged = false;
              const numVal = parseFloat(value);
              if (!isNaN(numVal) && refRange.includes('-')) {
                const [lo, hi] = refRange.replace(/[<>]/g,'').split('-').map(Number);
                if (!isNaN(lo) && !isNaN(hi)) flagged = numVal < lo || numVal > hi;
              }
              return {
                testName: r.testName,
                value,
                unit: r.unit,
                referenceRange: refRange,
                flagged,
              };
            })
          )
        : [];

      return {
        patient: rec.patient,
        doctor: rec.doctor,
        medicalRecord: rec._id,
        tests: testNames,
        priority,
        status,
        results,
        notes: rand(0,1) ? pick([
          'Fasting specimen required','Collect at trough level','Random specimen acceptable',
          'Send to reference lab','Pediatric tubes only','Stat processing requested',
        ]) : undefined,
        processedBy: isCompleted ? pick(labTechDocs)._id : undefined,
      };
    })
  );
  console.log(`Created ${labOrderDocs.length} lab orders`);

  // ── 8. INVOICES (150) ───────────────────────────────────────────────────────
  const invoiceDocs = await Invoice.insertMany(
    Array.from({ length: 150 }, (_, i) => {
      const appt = appointmentDocs[i % appointmentDocs.length];
      const numItems = rand(2, 5);
      const lineItems = pickN(LINE_ITEM_TEMPLATES, numItems).map(item => ({
        description: item.description,
        qty: rand(1, item.description.includes('Day') ? 5 : 2),
        unitPrice: item.unitPrice,
      }));
      const totalAmount = lineItems.reduce((sum, li) => sum + li.qty * li.unitPrice, 0);
      const status = pick(INVOICE_STATUSES);
      const issueDate = daysAgo(rand(0, 120));
      const dueDate = new Date(issueDate.getTime() + 30 * 86400000);
      const claimStatus = pick(CLAIM_STATUSES);
      const patientIdx = i % patientDocs.length;

      return {
        patient: appt.patient,
        appointment: appt._id,
        lineItems,
        totalAmount,
        status,
        insuranceClaim: {
          provider: patientDocs[patientIdx].insuranceDetails.provider,
          policyNumber: patientDocs[patientIdx].insuranceDetails.policyNumber,
          claimStatus,
        },
        dueDate,
        paidAt: status === 'paid' ? daysAgo(rand(0, 20)) : undefined,
      };
    })
  );
  console.log(`Created ${invoiceDocs.length} invoices`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n=== Seed Complete ===');
  console.log(`  Admin:          1  (admin@medicore.hospital / Password123!)`);
  console.log(`  Doctors:        ${doctorDocs.length}`);
  console.log(`  Nurses:         ${nurseDocs.length}`);
  console.log(`  Receptionists:  ${receptionistDocs.length}`);
  console.log(`  Lab Techs:      ${labTechDocs.length}`);
  console.log(`  Patients:       ${patientDocs.length}`);
  console.log(`  Wards:          ${wardDocs.length} (${wardDocs.reduce((s,w)=>s+w.capacity,0)} beds)`);
  console.log(`  Appointments:   ${appointmentDocs.length}`);
  console.log(`  Medical Records:${medRecordDocs.length}`);
  console.log(`  Prescriptions:  ${prescriptionDocs.length}`);
  console.log(`  Lab Orders:     ${labOrderDocs.length}`);
  console.log(`  Invoices:       ${invoiceDocs.length}`);
  console.log('\nAll staff passwords: Password123!');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

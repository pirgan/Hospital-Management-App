/**
 * Patient history seed — adds rich longitudinal data for existing patients.
 *
 * Adds per existing patient:
 *   • 3-8 historical EHR visits spanning the last 3 years
 *   • 1-3 prescriptions per visit (active/dispensed/cancelled)
 *   • 1-2 lab orders per visit (all with full results)
 *
 * Totals injected: ~400 EHR records, ~700 prescriptions, ~500 lab orders
 *
 * Run:            node scripts/seedPatientHistory.js
 * Run (wipe hist):node scripts/seedPatientHistory.js --wipe
 */

import 'dotenv/config';
import mongoose from 'mongoose';

import User from '../src/models/User.js';
import Patient from '../src/models/Patient.js';
import Appointment from '../src/models/Appointment.js';
import MedicalRecord from '../src/models/MedicalRecord.js';
import Prescription from '../src/models/Prescription.js';
import LabOrder from '../src/models/LabOrder.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, Math.min(n, arr.length));
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randF = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
const daysAgo = (d) => new Date(Date.now() - d * 86_400_000);

// ── Reference Data ────────────────────────────────────────────────────────────

const CHIEF_COMPLAINTS = [
  // Cardiovascular
  'Chest pain radiating to left arm, onset 2 hours ago',
  'Palpitations and shortness of breath on exertion',
  'Bilateral leg edema worsening over past week',
  'Hypertensive urgency — BP 185/110 at home',
  'Intermittent claudication in both calves',
  // Respiratory
  'Productive cough with yellow sputum for 5 days',
  'Worsening dyspnea, unable to complete sentences',
  'Hemoptysis — small amount noted this morning',
  'Pleuritic chest pain, worse on deep inspiration',
  'Nocturnal wheezing and cough disturbing sleep',
  // GI
  'Epigastric burning pain, worse after meals',
  'Acute onset severe abdominal pain, periumbilical',
  'Nausea, vomiting, and inability to tolerate fluids for 48 hours',
  'Rectal bleeding noted for 3 days, bright red',
  'Jaundice and right upper quadrant discomfort',
  // Musculoskeletal
  'Acute low back pain after lifting heavy objects',
  'Right knee swelling and warmth since yesterday',
  'Morning stiffness in both hands lasting over 1 hour',
  'Shoulder pain limiting range of motion for 2 weeks',
  'Gait instability and recurrent falls',
  // Neurological
  'Sudden onset severe headache — "worst of my life"',
  'Right-sided facial droop and arm weakness, onset 1 hour ago',
  'Recurrent episodes of loss of consciousness',
  'Progressive memory loss noticed by family over 6 months',
  'Bilateral hand numbness and tingling at night',
  // Endocrine / Metabolic
  'Polyuria and polydipsia for past 2 weeks',
  'Unintentional weight loss of 8 kg over 3 months',
  'Excessive fatigue, cold intolerance, and constipation',
  'Tremor, heat intolerance, and unintentional weight loss',
  'Hypoglycaemic episode — blood glucose 2.8 mmol/L at home',
  // Psychiatric / Mental Health
  'Persistent low mood, anhedonia, and poor sleep for 6 weeks',
  'Acute panic attack with palpitations and sense of doom',
  'Auditory hallucinations and disorganised behaviour reported by carer',
  'Increasing anxiety interfering with daily activities',
  'Suicidal ideation — passive, no plan or intent',
  // Renal / Urological
  'Dysuria, frequency, and suprapubic pain for 3 days',
  'Flank pain with haematuria — possible renal colic',
  'Reduced urine output and lower limb oedema for 5 days',
  'Recurrent urinary tract infections — fourth episode this year',
  'Nocturia ×4 and weak urinary stream',
  // Dermatology / Allergy
  'Widespread urticarial rash after new medication',
  'Erythematous scaly plaques on elbows and scalp',
  'Rapidly spreading cellulitis of the left lower leg',
  'Painful vesicular eruption following a dermatomal distribution',
  // General / Other
  'Fever 38.9 °C, rigors, and night sweats for 4 days',
  'Annual chronic disease review — diabetes and hypertension',
  'Medication review and repeat prescriptions',
  'Pre-operative assessment for elective procedure',
  'Post-operative wound check — day 10',
  'Vaccination and travel health consultation',
];

const TREATMENT_PLANS = [
  // Chronic disease management
  'Optimise antihypertensive therapy — add amlodipine 5 mg daily. Low-sodium diet counselling. Repeat BP check in 2 weeks.',
  'Intensify diabetic management — increase metformin to 1000 mg BD, refer to dietitian, HbA1c in 3 months.',
  'Adjust statin dose to atorvastatin 40 mg, recheck lipid panel in 6 weeks, reinforce dietary modifications.',
  'Titrate levothyroxine to 75 mcg, TFTs in 6 weeks, advise morning dosing on empty stomach.',
  'Continue ACE inhibitor, add spironolactone 25 mg for resistant hypertension, monitor renal function and potassium in 1 week.',
  // Acute infections
  'Commence amoxicillin-clavulanate 875/125 mg BD for 7 days for community-acquired pneumonia, advise rest and adequate hydration.',
  'IV ceftriaxone 1 g daily for 5 days, convert to oral amoxicillin when afebrile for 24 hours, sputum culture pending.',
  'Nitrofurantoin 100 mg BD for 5 days for uncomplicated UTI, urine culture results to be reviewed at follow-up.',
  'Topical fusidic acid cream to affected area, oral flucloxacillin 500 mg QDS for 7 days for superficial cellulitis.',
  'Oseltamivir 75 mg BD for 5 days, symptomatic relief with paracetamol, isolation precautions advised.',
  // Cardiac
  'Admit for cardiac monitoring, commence aspirin 300 mg stat then 75 mg daily, urgent cardiology review, troponin serial measurements.',
  'Rate control with bisoprolol 2.5 mg, initiate anticoagulation with apixaban 5 mg BD, echo within 48 hours.',
  'Increase furosemide to 80 mg morning, fluid restriction 1.5 L/day, daily weights, electrolytes in 48 hours.',
  'GTN spray PRN for angina, increase beta-blocker dose, arrange exercise stress test within 2 weeks.',
  // Musculoskeletal
  'Physiotherapy referral — 6 sessions, naproxen 500 mg BD with food for 2 weeks, heat pack and activity modification.',
  'Joint aspiration performed — sample sent for MC&S and crystals, intra-articular methylprednisolone 40 mg injected.',
  'Orthopaedic referral for knee replacement evaluation, continue paracetamol 1 g QDS, weight loss counselling.',
  // Respiratory
  'Add inhaled LABA to existing ICS regimen, action plan provided, spirometry in 4 weeks.',
  'Prednisolone 40 mg for 5 days for acute exacerbation COPD, salbutamol nebulisers 4-hourly, chest X-ray ordered.',
  'Chest X-ray ordered, CT chest if X-ray inconclusive, sputum AFB smear, refer TB clinic if positive.',
  // Mental health
  'Start sertraline 50 mg daily, safety-net advice given, follow-up in 2 weeks, refer to IAPT for CBT.',
  'Increase venlafaxine to 150 mg, sleep hygiene advice, review in 4 weeks, consider referral if no improvement.',
  'Crisis team referral made, lorazepam 0.5 mg PRN for acute anxiety episodes, mental health review in 48 hours.',
  // GI / Hepatic
  'Upper GI endoscopy arranged, pantoprazole 40 mg daily, H. pylori testing ordered, dietary advice given.',
  'Hepatology referral, liver ultrasound ordered, alcohol cessation counselling, LFTs in 4 weeks.',
  'Colonoscopy arranged, iron supplementation commenced for anaemia, dietary fibre advice provided.',
  // Post-operative / Procedural
  'Wound healing well — no signs of infection. Remove remaining sutures at day 14 visit. Mobilise as tolerated.',
  'Continue DVT prophylaxis with LMWH for 4 more weeks post-operatively, compression stockings, early mobilisation.',
  // Investigations-led
  'MRI lumbar spine ordered for radiculopathy assessment, gabapentin 300 mg TDS commenced, neurosurgery referral pending.',
  'Refer to haematology for thrombocytopenia workup, bone marrow biopsy may be required, withhold anticoagulants.',
];

const ICD10 = [
  // Cardiovascular
  { code:'I10',   desc:'Essential (primary) hypertension' },
  { code:'I25.10',desc:'Atherosclerotic heart disease of native coronary artery without angina pectoris' },
  { code:'I48.0', desc:'Paroxysmal atrial fibrillation' },
  { code:'I50.32',desc:'Chronic diastolic (congestive) heart failure, decompensated' },
  { code:'I63.9', desc:'Cerebral infarction, unspecified' },
  { code:'I73.9', desc:'Peripheral vascular disease, unspecified' },
  // Respiratory
  { code:'J18.9', desc:'Pneumonia, unspecified organism' },
  { code:'J44.1', desc:'Chronic obstructive pulmonary disease with (acute) exacerbation' },
  { code:'J45.41',desc:'Moderate persistent asthma with (acute) exacerbation' },
  { code:'J06.9', desc:'Acute upper respiratory infection, unspecified' },
  // Endocrine / Metabolic
  { code:'E11.65',desc:'Type 2 diabetes mellitus with hyperglycaemia' },
  { code:'E11.40',desc:'Type 2 diabetes mellitus with diabetic neuropathy, unspecified' },
  { code:'E03.9', desc:'Hypothyroidism, unspecified' },
  { code:'E05.90',desc:'Thyrotoxicosis, unspecified without thyrotoxic crisis' },
  { code:'E78.00',desc:'Pure hypercholesterolaemia, unspecified' },
  { code:'E66.01',desc:'Morbid (severe) obesity due to excess calories' },
  // GI
  { code:'K21.0', desc:'Gastro-oesophageal reflux disease with oesophagitis' },
  { code:'K57.30',desc:'Diverticulosis of large intestine without perforation or abscess without bleeding' },
  { code:'K74.60',desc:'Unspecified cirrhosis of liver' },
  { code:'K92.1', desc:'Melaena' },
  // Musculoskeletal
  { code:'M06.9', desc:'Rheumatoid arthritis, unspecified' },
  { code:'M16.11',desc:'Unilateral primary osteoarthritis, right hip' },
  { code:'M54.4', desc:'Lumbago with sciatica, right side' },
  { code:'M79.3', desc:'Panniculitis, unspecified' },
  // Renal / Urological
  { code:'N18.3', desc:'Chronic kidney disease, stage 3 (moderate)' },
  { code:'N39.0', desc:'Urinary tract infection, site not specified' },
  { code:'N20.0', desc:'Calculus of kidney' },
  // Mental health
  { code:'F32.1', desc:'Major depressive disorder, single episode, moderate' },
  { code:'F41.1', desc:'Generalised anxiety disorder' },
  { code:'F20.9', desc:'Schizophrenia, unspecified' },
  // Dermatology
  { code:'L03.115',desc:'Cellulitis of right lower limb' },
  { code:'L40.0', desc:'Psoriasis vulgaris' },
  { code:'B02.9', desc:'Zoster without complications' },
  // Infections
  { code:'A41.9', desc:'Sepsis, unspecified organism' },
  { code:'A09',   desc:'Other and unspecified gastroenteritis and colitis of infectious and unspecified origin' },
  // Oncology
  { code:'C34.10',desc:'Malignant neoplasm of upper lobe, bronchus or lung, unspecified side' },
  { code:'C18.9', desc:'Malignant neoplasm of colon, unspecified' },
  { code:'C50.912',desc:'Malignant neoplasm of unspecified site of left female breast' },
];

const MEDICATIONS = [
  { name:'Lisinopril',       dosages:['5 mg','10 mg','20 mg','40 mg'] },
  { name:'Ramipril',         dosages:['2.5 mg','5 mg','10 mg'] },
  { name:'Amlodipine',       dosages:['2.5 mg','5 mg','10 mg'] },
  { name:'Bisoprolol',       dosages:['1.25 mg','2.5 mg','5 mg','10 mg'] },
  { name:'Atenolol',         dosages:['25 mg','50 mg','100 mg'] },
  { name:'Metoprolol',       dosages:['25 mg','50 mg','100 mg','200 mg'] },
  { name:'Losartan',         dosages:['25 mg','50 mg','100 mg'] },
  { name:'Candesartan',      dosages:['4 mg','8 mg','16 mg','32 mg'] },
  { name:'Furosemide',       dosages:['20 mg','40 mg','80 mg'] },
  { name:'Spironolactone',   dosages:['25 mg','50 mg','100 mg'] },
  { name:'Hydrochlorothiazide', dosages:['12.5 mg','25 mg','50 mg'] },
  { name:'Metformin',        dosages:['500 mg','850 mg','1000 mg'] },
  { name:'Empagliflozin',    dosages:['10 mg','25 mg'] },
  { name:'Sitagliptin',      dosages:['25 mg','50 mg','100 mg'] },
  { name:'Glipizide',        dosages:['5 mg','10 mg'] },
  { name:'Insulin Glargine', dosages:['10 units','20 units','30 units','40 units'] },
  { name:'Insulin Aspart',   dosages:['4 units','6 units','8 units','10 units'] },
  { name:'Atorvastatin',     dosages:['10 mg','20 mg','40 mg','80 mg'] },
  { name:'Rosuvastatin',     dosages:['5 mg','10 mg','20 mg','40 mg'] },
  { name:'Simvastatin',      dosages:['10 mg','20 mg','40 mg'] },
  { name:'Ezetimibe',        dosages:['10 mg'] },
  { name:'Levothyroxine',    dosages:['25 mcg','50 mcg','75 mcg','100 mcg','125 mcg'] },
  { name:'Carbimazole',      dosages:['5 mg','10 mg','20 mg'] },
  { name:'Omeprazole',       dosages:['10 mg','20 mg','40 mg'] },
  { name:'Pantoprazole',     dosages:['20 mg','40 mg'] },
  { name:'Esomeprazole',     dosages:['20 mg','40 mg'] },
  { name:'Domperidone',      dosages:['10 mg'] },
  { name:'Ondansetron',      dosages:['4 mg','8 mg'] },
  { name:'Metronidazole',    dosages:['200 mg','400 mg','500 mg'] },
  { name:'Amoxicillin',      dosages:['250 mg','500 mg','875 mg'] },
  { name:'Co-amoxiclav',     dosages:['375 mg','625 mg'] },
  { name:'Azithromycin',     dosages:['250 mg','500 mg'] },
  { name:'Clarithromycin',   dosages:['250 mg','500 mg'] },
  { name:'Doxycycline',      dosages:['100 mg','200 mg'] },
  { name:'Ciprofloxacin',    dosages:['250 mg','500 mg','750 mg'] },
  { name:'Nitrofurantoin',   dosages:['50 mg','100 mg'] },
  { name:'Trimethoprim',     dosages:['100 mg','200 mg'] },
  { name:'Flucloxacillin',   dosages:['250 mg','500 mg'] },
  { name:'Prednisolone',     dosages:['5 mg','10 mg','20 mg','40 mg'] },
  { name:'Naproxen',         dosages:['250 mg','375 mg','500 mg'] },
  { name:'Ibuprofen',        dosages:['200 mg','400 mg','600 mg'] },
  { name:'Diclofenac',       dosages:['25 mg','50 mg','75 mg'] },
  { name:'Paracetamol',      dosages:['500 mg','1000 mg'] },
  { name:'Codeine',          dosages:['15 mg','30 mg','60 mg'] },
  { name:'Tramadol',         dosages:['50 mg','100 mg'] },
  { name:'Morphine',         dosages:['5 mg','10 mg','20 mg'] },
  { name:'Gabapentin',       dosages:['100 mg','300 mg','400 mg','600 mg'] },
  { name:'Pregabalin',       dosages:['25 mg','50 mg','75 mg','150 mg'] },
  { name:'Sertraline',       dosages:['50 mg','100 mg'] },
  { name:'Fluoxetine',       dosages:['10 mg','20 mg','40 mg'] },
  { name:'Escitalopram',     dosages:['5 mg','10 mg','20 mg'] },
  { name:'Venlafaxine',      dosages:['37.5 mg','75 mg','150 mg'] },
  { name:'Mirtazapine',      dosages:['15 mg','30 mg','45 mg'] },
  { name:'Quetiapine',       dosages:['25 mg','50 mg','100 mg','200 mg'] },
  { name:'Olanzapine',       dosages:['2.5 mg','5 mg','10 mg','20 mg'] },
  { name:'Lorazepam',        dosages:['0.5 mg','1 mg','2 mg'] },
  { name:'Diazepam',         dosages:['2 mg','5 mg','10 mg'] },
  { name:'Zolpidem',         dosages:['5 mg','10 mg'] },
  { name:'Aspirin',          dosages:['75 mg','100 mg','300 mg'] },
  { name:'Clopidogrel',      dosages:['75 mg'] },
  { name:'Apixaban',         dosages:['2.5 mg','5 mg'] },
  { name:'Rivaroxaban',      dosages:['10 mg','15 mg','20 mg'] },
  { name:'Warfarin',         dosages:['1 mg','2 mg','3 mg','5 mg','7.5 mg','10 mg'] },
  { name:'Allopurinol',      dosages:['100 mg','200 mg','300 mg'] },
  { name:'Colchicine',       dosages:['500 mcg'] },
  { name:'Salbutamol inhaler', dosages:['100 mcg/actuation'] },
  { name:'Salmeterol/Fluticasone', dosages:['25/125 mcg','50/250 mcg','50/500 mcg'] },
  { name:'Tiotropium',       dosages:['18 mcg'] },
  { name:'Montelukast',      dosages:['4 mg','5 mg','10 mg'] },
  { name:'Folic Acid',       dosages:['400 mcg','5 mg'] },
  { name:'Ferrous Sulfate',  dosages:['200 mg'] },
  { name:'Cholecalciferol',  dosages:['400 IU','1000 IU','20,000 IU'] },
  { name:'Calcium Carbonate',dosages:['500 mg','1.25 g'] },
];

const FREQUENCIES = [
  'Once daily (morning)',
  'Once daily (evening)',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every 8 hours',
  'Every 12 hours',
  'Every 6 hours',
  'At bedtime',
  'With meals',
  'As required (max 4 doses/day)',
  'Every 2 days',
  'Once weekly',
  'On alternate days',
];

const DURATIONS = [
  '3 days','5 days','7 days','10 days','14 days','21 days','28 days',
  '1 month','2 months','3 months','6 months','12 months',
  'Until review','Ongoing','Until course complete',
];

const MED_INSTRUCTIONS = [
  'Take with a full glass of water',
  'Take with or after food to reduce GI upset',
  'Take on an empty stomach, 30 minutes before food',
  'Swallow whole — do not crush or chew',
  'Dissolve in water before taking',
  'Monitor blood pressure before each dose',
  'Check blood glucose before administration',
  'Avoid alcohol while taking this medication',
  'Avoid prolonged sun exposure',
  'Do not stop abruptly — taper dose as directed',
  'If you miss a dose, take as soon as remembered unless near next dose',
  'Store in a cool, dry place away from light',
  'May cause drowsiness — avoid driving',
  'Report any unusual bleeding or bruising immediately',
  'Inhale slowly and deeply, hold for 10 seconds',
];

const STOP_REASONS = [
  'Patient intolerant — developed GI side effects',
  'Therapeutic goal achieved — course complete',
  'Switching to alternative agent with better profile',
  'Contraindication identified at review',
  'Patient declined to continue',
  'Superseded by updated prescribing guidelines',
];

// ── Lab Panels ─────────────────────────────────────────────────────────────────

const LAB_PANELS = [
  {
    name: 'Full Blood Count',
    tests: [
      { n:'WBC',          u:'10³/µL',  ref:'4.5–11.0',    lo:4.5,  hi:11.0,  gen:()=>randF(2.5,15.0) },
      { n:'RBC',          u:'10⁶/µL',  ref:'4.20–5.40 (F) / 4.70–6.10 (M)', lo:3.5, hi:6.2, gen:()=>randF(3.0,6.5) },
      { n:'Haemoglobin',  u:'g/dL',    ref:'11.5–16.5 (F) / 13.5–17.5 (M)', lo:11.5,hi:17.5,gen:()=>randF(7.5,19.0) },
      { n:'Haematocrit',  u:'%',       ref:'36–48 (F) / 41–53 (M)', lo:36, hi:53, gen:()=>randF(28,58) },
      { n:'MCV',          u:'fL',      ref:'80–100',       lo:80,   hi:100,   gen:()=>randF(65,115) },
      { n:'MCH',          u:'pg',      ref:'27–33',        lo:27,   hi:33,    gen:()=>randF(20,40) },
      { n:'Neutrophils',  u:'10³/µL',  ref:'1.8–7.7',     lo:1.8,  hi:7.7,   gen:()=>randF(0.5,15.0) },
      { n:'Lymphocytes',  u:'10³/µL',  ref:'1.0–4.8',     lo:1.0,  hi:4.8,   gen:()=>randF(0.3,8.0) },
      { n:'Platelets',    u:'10³/µL',  ref:'150–400',      lo:150,  hi:400,   gen:()=>randF(50,700) },
    ],
  },
  {
    name: 'Comprehensive Metabolic Panel',
    tests: [
      { n:'Sodium',       u:'mmol/L',  ref:'135–145',      lo:135,  hi:145,   gen:()=>randF(118,158) },
      { n:'Potassium',    u:'mmol/L',  ref:'3.5–5.0',      lo:3.5,  hi:5.0,   gen:()=>randF(2.5,7.0) },
      { n:'Chloride',     u:'mmol/L',  ref:'98–107',       lo:98,   hi:107,   gen:()=>randF(88,120) },
      { n:'Bicarbonate',  u:'mmol/L',  ref:'22–29',        lo:22,   hi:29,    gen:()=>randF(12,40) },
      { n:'Urea',         u:'mmol/L',  ref:'2.5–7.8',      lo:2.5,  hi:7.8,   gen:()=>randF(1.0,30.0) },
      { n:'Creatinine',   u:'µmol/L',  ref:'60–110 (F) / 70–120 (M)', lo:60, hi:120, gen:()=>randF(40,450) },
      { n:'eGFR',         u:'mL/min/1.73m²', ref:'>60',   lo:60,   hi:999,   gen:()=>randF(8,120) },
      { n:'Glucose',      u:'mmol/L',  ref:'3.9–5.5',      lo:3.9,  hi:5.5,   gen:()=>randF(2.0,22.0) },
      { n:'Calcium',      u:'mmol/L',  ref:'2.15–2.55',    lo:2.15, hi:2.55,  gen:()=>randF(1.6,3.5,2) },
      { n:'Total Protein',u:'g/L',     ref:'60–80',        lo:60,   hi:80,    gen:()=>randF(40,90) },
      { n:'Albumin',      u:'g/L',     ref:'35–50',        lo:35,   hi:50,    gen:()=>randF(18,55) },
    ],
  },
  {
    name: 'Lipid Profile',
    tests: [
      { n:'Total Cholesterol',  u:'mmol/L', ref:'<5.0',       lo:0,   hi:5.0,   gen:()=>randF(2.5,9.5) },
      { n:'LDL Cholesterol',    u:'mmol/L', ref:'<3.0',       lo:0,   hi:3.0,   gen:()=>randF(0.8,7.0) },
      { n:'HDL Cholesterol',    u:'mmol/L', ref:'>1.0 (M) / >1.2 (F)', lo:1.0, hi:99, gen:()=>randF(0.5,3.0) },
      { n:'Triglycerides',      u:'mmol/L', ref:'<1.7',       lo:0,   hi:1.7,   gen:()=>randF(0.4,7.0) },
      { n:'Non-HDL Cholesterol',u:'mmol/L', ref:'<4.0',       lo:0,   hi:4.0,   gen:()=>randF(1.5,8.0) },
      { n:'TC:HDL Ratio',       u:'',       ref:'<4.5',       lo:0,   hi:4.5,   gen:()=>randF(1.5,9.0) },
    ],
  },
  {
    name: 'Liver Function Tests',
    tests: [
      { n:'ALT',                  u:'U/L',  ref:'7–56',       lo:7,   hi:56,    gen:()=>randF(5,300) },
      { n:'AST',                  u:'U/L',  ref:'10–40',      lo:10,  hi:40,    gen:()=>randF(8,350) },
      { n:'Alkaline Phosphatase', u:'U/L',  ref:'44–147',     lo:44,  hi:147,   gen:()=>randF(20,500) },
      { n:'Gamma-GT',             u:'U/L',  ref:'9–48',       lo:9,   hi:48,    gen:()=>randF(5,400) },
      { n:'Total Bilirubin',      u:'µmol/L',ref:'3–20',      lo:3,   hi:20,    gen:()=>randF(2,120) },
      { n:'Direct Bilirubin',     u:'µmol/L',ref:'0–5',       lo:0,   hi:5,     gen:()=>randF(0,80) },
      { n:'Albumin',              u:'g/L',  ref:'35–50',      lo:35,  hi:50,    gen:()=>randF(18,55) },
      { n:'Total Protein',        u:'g/L',  ref:'60–80',      lo:60,  hi:80,    gen:()=>randF(40,90) },
      { n:'PT',                   u:'seconds',ref:'11–13.5',  lo:11,  hi:13.5,  gen:()=>randF(9,60) },
    ],
  },
  {
    name: 'Thyroid Function Tests',
    tests: [
      { n:'TSH',      u:'mIU/L',  ref:'0.35–4.94',  lo:0.35, hi:4.94, gen:()=>randF(0.01,15.0,3) },
      { n:'Free T4',  u:'pmol/L', ref:'9.0–19.0',   lo:9.0,  hi:19.0, gen:()=>randF(4.0,40.0) },
      { n:'Free T3',  u:'pmol/L', ref:'3.5–6.5',    lo:3.5,  hi:6.5,  gen:()=>randF(1.5,15.0) },
    ],
  },
  {
    name: 'HbA1c & Glucose',
    tests: [
      { n:'HbA1c',           u:'mmol/mol', ref:'<48',    lo:0,   hi:48,   gen:()=>randF(28,120) },
      { n:'Fasting Glucose', u:'mmol/L',   ref:'3.9–5.5',lo:3.9, hi:5.5,  gen:()=>randF(2.5,22.0) },
    ],
  },
  {
    name: 'Renal Panel',
    tests: [
      { n:'Sodium',     u:'mmol/L', ref:'135–145',  lo:135,  hi:145,  gen:()=>randF(118,158) },
      { n:'Potassium',  u:'mmol/L', ref:'3.5–5.0',  lo:3.5,  hi:5.0,  gen:()=>randF(2.5,7.0) },
      { n:'Urea',       u:'mmol/L', ref:'2.5–7.8',  lo:2.5,  hi:7.8,  gen:()=>randF(1.0,35.0) },
      { n:'Creatinine', u:'µmol/L', ref:'60–120',   lo:60,   hi:120,  gen:()=>randF(40,600) },
      { n:'eGFR',       u:'mL/min/1.73m²', ref:'>60', lo:60, hi:999,  gen:()=>randF(5,120) },
      { n:'Uric Acid',  u:'µmol/L', ref:'180–420',  lo:180,  hi:420,  gen:()=>randF(100,700) },
    ],
  },
  {
    name: 'Cardiac Enzymes & BNP',
    tests: [
      { n:'Troponin I',    u:'ng/L',   ref:'<26',     lo:0,   hi:26,   gen:()=>randF(1,5000,0) },
      { n:'Troponin T',    u:'ng/L',   ref:'<14',     lo:0,   hi:14,   gen:()=>randF(1,3000,0) },
      { n:'CK',            u:'U/L',    ref:'55–170',  lo:55,  hi:170,  gen:()=>randF(20,2000) },
      { n:'CK-MB',         u:'µg/L',   ref:'<6.3',    lo:0,   hi:6.3,  gen:()=>randF(0.5,80) },
      { n:'NT-proBNP',     u:'pg/mL',  ref:'<125',    lo:0,   hi:125,  gen:()=>randF(10,10000) },
      { n:'LDH',           u:'U/L',    ref:'140–280', lo:140, hi:280,  gen:()=>randF(80,800) },
    ],
  },
  {
    name: 'Coagulation Screen',
    tests: [
      { n:'PT',        u:'seconds',  ref:'11.0–13.5',  lo:11,  hi:13.5,  gen:()=>randF(8,60) },
      { n:'INR',       u:'',         ref:'0.8–1.2',    lo:0.8, hi:1.2,   gen:()=>randF(0.7,6.5,2) },
      { n:'APTT',      u:'seconds',  ref:'25.0–37.0',  lo:25,  hi:37,    gen:()=>randF(18,120) },
      { n:'Fibrinogen',u:'g/L',      ref:'1.5–4.0',    lo:1.5, hi:4.0,   gen:()=>randF(0.5,8.0) },
      { n:'D-Dimer',   u:'µg/L',     ref:'<500',       lo:0,   hi:500,   gen:()=>randF(50,8000) },
    ],
  },
  {
    name: 'Inflammatory Markers',
    tests: [
      { n:'CRP',          u:'mg/L',   ref:'<5',        lo:0,   hi:5,    gen:()=>randF(0.1,350) },
      { n:'ESR',          u:'mm/hr',  ref:'<20 (M) / <30 (F)', lo:0, hi:25, gen:()=>randF(2,150) },
      { n:'Ferritin',     u:'µg/L',   ref:'15–200 (F) / 30–400 (M)', lo:15, hi:250, gen:()=>randF(3,2000) },
      { n:'Procalcitonin',u:'µg/L',   ref:'<0.25',     lo:0,   hi:0.25, gen:()=>randF(0.01,50,3) },
    ],
  },
  {
    name: 'Urinalysis with Microscopy',
    tests: [
      { n:'pH',              u:'',      ref:'4.5–8.0',   lo:4.5, hi:8.0, gen:()=>randF(4.5,8.5,1) },
      { n:'Specific Gravity',u:'',      ref:'1.005–1.030',lo:1.005,hi:1.030,gen:()=>()=>randF(1.001,1.035,3) },
      { n:'Protein',         u:'mg/dL', ref:'Negative',  lo:0,   hi:0,   gen:()=>pick(['Negative','Trace','+1 (30)','++2 (100)','+++3 (300)']) },
      { n:'Glucose',         u:'mg/dL', ref:'Negative',  lo:0,   hi:0,   gen:()=>pick(['Negative','100','250','500','1000']) },
      { n:'Leucocytes',      u:'/hpf',  ref:'0–5',       lo:0,   hi:5,   gen:()=>rand(0,50) },
      { n:'Red Blood Cells', u:'/hpf',  ref:'0–3',       lo:0,   hi:3,   gen:()=>rand(0,50) },
      { n:'Bacteria',        u:'',      ref:'None',      lo:0,   hi:0,   gen:()=>pick(['None seen','Occasional','Moderate','Heavy']) },
    ],
  },
  {
    name: 'Iron Studies',
    tests: [
      { n:'Serum Iron',    u:'µmol/L',  ref:'10–30',     lo:10,  hi:30,   gen:()=>randF(3,45) },
      { n:'TIBC',          u:'µmol/L',  ref:'45–80',     lo:45,  hi:80,   gen:()=>randF(20,100) },
      { n:'Transferrin Saturation', u:'%', ref:'20–50',  lo:20,  hi:50,   gen:()=>randF(2,80) },
      { n:'Ferritin',      u:'µg/L',    ref:'13–150 (F) / 30–400 (M)', lo:13, hi:200, gen:()=>randF(2,1800) },
    ],
  },
  {
    name: 'Bone Profile',
    tests: [
      { n:'Calcium (corrected)', u:'mmol/L', ref:'2.20–2.60', lo:2.20, hi:2.60, gen:()=>randF(1.5,3.5,2) },
      { n:'Phosphate',          u:'mmol/L', ref:'0.8–1.5',  lo:0.8,  hi:1.5,  gen:()=>randF(0.3,2.5) },
      { n:'Alkaline Phosphatase',u:'U/L',   ref:'44–147',   lo:44,   hi:147,  gen:()=>randF(20,600) },
      { n:'25-OH Vitamin D',    u:'nmol/L', ref:'50–250',   lo:50,   hi:250,  gen:()=>randF(8,300) },
      { n:'PTH',                u:'pmol/L', ref:'1.6–6.9',  lo:1.6,  hi:6.9,  gen:()=>randF(0.5,30) },
    ],
  },
  {
    name: 'Urine Microalbumin',
    tests: [
      { n:'Urine Albumin',            u:'mg/L',   ref:'<20',      lo:0,   hi:20,   gen:()=>randF(1,500) },
      { n:'Urine Creatinine',         u:'mmol/L', ref:'3.0–30.0', lo:3,   hi:30,   gen:()=>randF(1,40) },
      { n:'Albumin:Creatinine Ratio', u:'mg/mmol',ref:'<3.0',     lo:0,   hi:3.0,  gen:()=>randF(0.5,50) },
    ],
  },
  {
    name: 'Blood Cultures',
    tests: [
      { n:'Aerobic Culture',   u:'', ref:'No growth',       lo:0, hi:0, gen:()=>pick(['No growth after 5 days','Staphylococcus aureus isolated','Escherichia coli isolated','Klebsiella pneumoniae isolated','No growth after 5 days','No growth after 5 days']) },
      { n:'Anaerobic Culture', u:'', ref:'No growth',       lo:0, hi:0, gen:()=>pick(['No growth after 5 days','No growth after 5 days','No growth after 5 days','Bacteroides fragilis isolated']) },
    ],
  },
];

const LAB_NOTES = [
  'Fasting specimen — patient confirmed 12-hour fast',
  'Trough level taken 30 minutes before next dose',
  'Haemolysed sample — results may be affected; repeat recommended',
  'Random specimen; patient not fasting',
  'Send to external reference laboratory for reflex testing',
  'STAT processing requested by attending physician',
  'Patient on anticoagulation — adjust reference ranges accordingly',
  'Paediatric collection tubes used',
  'Sample collected via central line — peripheral repeat advised if unexpected results',
  'Results correlate with clinical presentation',
];

const AI_DIAGNOSES_POOL = [
  { d:'Hypertensive heart disease with preserved ejection fraction', reasoning:'Longstanding hypertension with LVH pattern on ECG; BNP mildly elevated; echo confirmation pending.' },
  { d:'Type 2 diabetes mellitus — poorly controlled', reasoning:'HbA1c significantly above target; postprandial hyperglycaemia; no acute complications identified at this visit.' },
  { d:'Community-acquired pneumonia', reasoning:'Consolidation on CXR right lower lobe; productive cough, fever, elevated CRP and WBC; consistent with bacterial aetiology.' },
  { d:'Acute coronary syndrome — NSTEMI', reasoning:'Troponin I elevated at 450 ng/L; dynamic ECG changes in lateral leads; risk stratification score intermediate.' },
  { d:'Pulmonary embolism', reasoning:'Acute dyspnoea with pleuritic chest pain; D-Dimer markedly elevated; Wells score 5 (high probability); CTPA ordered.' },
  { d:'Decompensated heart failure', reasoning:'Bilateral basal crackles; elevated NT-proBNP; peripheral oedema; worsening dyspnoea consistent with fluid overload.' },
  { d:'Hyperthyroidism — Graves\' disease suspected', reasoning:'Suppressed TSH <0.01; elevated Free T4; tremor and weight loss; ophthalmopathy noted on examination.' },
  { d:'Acute pancreatitis', reasoning:'Severe epigastric pain radiating to back; amylase and lipase >3× ULN; CT abdomen pending.' },
  { d:'Sepsis — likely urinary source', reasoning:'SIRS criteria met; elevated WBC, CRP, procalcitonin; urinalysis showing heavy pyuria; blood cultures pending.' },
  { d:'Rheumatoid arthritis — active disease', reasoning:'Morning stiffness >1 hour; symmetrical small joint synovitis; elevated RF and anti-CCP; CRP elevated.' },
  { d:'Chronic kidney disease progression', reasoning:'eGFR declining trend over 12 months; proteinuria on urine ACR; anaemia of chronic disease pattern on FBC.' },
  { d:'Iron deficiency anaemia', reasoning:'Low Hb with microcytic hypochromic picture; low ferritin and transferrin saturation; dietary history consistent.' },
  { d:'Hypothyroidism — undertreated', reasoning:'TSH above target range despite current levothyroxine dose; fatigue, weight gain; dose adjustment indicated.' },
  { d:'Major depressive disorder with somatic features', reasoning:'PHQ-9 score 18 (moderately severe); sleep disturbance; anhedonia; somatic symptoms predominant.' },
  { d:'Acute exacerbation COPD — Anthonisen Type I', reasoning:'Increased dyspnoea, sputum volume and purulence; PEFR reduced 35% from baseline; SpO2 88% on air.' },
];

// ── Deterministic-ish visit pattern per patient ───────────────────────────────

function generateVisitDates(patientIdx, numVisits) {
  // Spread visits over 3 years; sicker patients (higher idx) visit more recently
  const dates = [];
  const spreadDays = 1095; // 3 years
  for (let v = 0; v < numVisits; v++) {
    const daysBack = Math.round(spreadDays - (v / numVisits) * spreadDays + rand(0, 30));
    dates.push(daysAgo(daysBack));
  }
  return dates.sort((a, b) => a - b); // chronological
}

function isFlagged(result, lo, hi) {
  if (typeof result === 'string') return false; // qualitative results
  const n = parseFloat(result);
  if (isNaN(n)) return false;
  return n < lo || n > hi;
}

function buildLabResults(panel) {
  return panel.tests.map(t => {
    const raw = t.gen();
    const value = typeof raw === 'function' ? raw() : raw; // handle the double-lambda edge case
    return {
      testName: t.n,
      value: String(value),
      unit: t.u,
      referenceRange: t.ref,
      flagged: isFlagged(value, t.lo, t.hi),
    };
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function seedHistory() {
  const wipe = process.argv.includes('--wipe');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  if (wipe) {
    console.log('Removing existing EHR / prescription / lab order history...');
    await Promise.all([
      MedicalRecord.deleteMany({}),
      Prescription.deleteMany({}),
      LabOrder.deleteMany({}),
    ]);
    console.log('Removed.');
  }

  // Load existing entities
  const patients = await Patient.find({}).lean();
  const doctors  = await User.find({ role: 'doctor' }).lean();
  const labTechs = await User.find({ role: 'lab_tech' }).lean();
  const nurses   = await User.find({ role: 'nurse' }).lean();

  if (!patients.length) { console.error('No patients found — run seedData.js first.'); process.exit(1); }
  if (!doctors.length)  { console.error('No doctors found — run seedData.js first.'); process.exit(1); }

  console.log(`Loaded ${patients.length} patients, ${doctors.length} doctors`);

  let totalRecords = 0, totalRx = 0, totalLabs = 0;

  for (let pi = 0; pi < patients.length; pi++) {
    const patient = patients[pi];
    // Each patient gets 4-9 visits
    const numVisits = rand(4, 9);
    const visitDates = generateVisitDates(pi, numVisits);

    // Assign a primary doctor (consistent per patient) + occasional different doctors
    const primaryDoctor = doctors[pi % doctors.length];

    for (let vi = 0; vi < visitDates.length; vi++) {
      const visitDate = visitDates[vi];
      const doctor = vi % 4 === 3 ? pick(doctors) : primaryDoctor; // occasional different doctor

      // ── Medical Record ────────────────────────────────────────────────────
      const numDx    = rand(1, 3);
      const diagnoses = pickN(ICD10, numDx).map((d, di) => ({
        icd10Code: d.code,
        description: d.desc,
        type: di === 0 ? 'primary' : pick(['secondary','differential']),
      }));

      const aiDx = Math.random() > 0.35
        ? pickN(AI_DIAGNOSES_POOL, rand(2, 4)).map(a => ({
            diagnosis: a.d,
            confidence: rand(38, 94),
            reasoning: a.reasoning,
          }))
        : [];

      const record = await MedicalRecord.create({
        patient:   patient._id,
        doctor:    doctor._id,
        visitDate,
        chiefComplaint: pick(CHIEF_COMPLAINTS),
        vitals: {
          height:        rand(155, 192),
          weight:        randF(48, 135),
          bloodPressure: `${rand(95, 175)}/${rand(55, 105)}`,
          pulse:         rand(48, 118),
          temperature:   randF(35.8, 39.8),
          o2Saturation:  rand(85, 100),
        },
        diagnoses,
        treatmentPlan: pick(TREATMENT_PLANS),
        followUpDate: Math.random() > 0.25 ? daysAgo(rand(-90, -7)) : undefined,
        aiDifferentialDiagnosis: aiDx,
        aiRiskScore: rand(8, 97),
      });
      totalRecords++;

      // ── Prescriptions (1-3 per visit) ─────────────────────────────────────
      const numRx = rand(1, 3);
      for (let r = 0; r < numRx; r++) {
        const numMeds = rand(1, 4);
        const meds    = pickN(MEDICATIONS, numMeds).map(m => ({
          name:         m.name,
          dosage:       pick(m.dosages),
          frequency:    pick(FREQUENCIES),
          duration:     pick(DURATIONS),
          instructions: Math.random() > 0.35 ? pick(MED_INSTRUCTIONS) : undefined,
        }));

        const rxStatus = pick(['active','active','dispensed','dispensed','dispensed','cancelled']);
        const isDispensed  = rxStatus === 'dispensed';
        const isCancelled  = rxStatus === 'cancelled';

        // Build interaction check for multi-drug prescriptions
        let aiInteractionCheck;
        if (meds.length >= 2 && Math.random() > 0.45) {
          const hasInteraction = Math.random() > 0.72;
          aiInteractionCheck = {
            checkedAt: visitDate,
            interactions: hasInteraction ? [{
              drug1:       meds[0].name,
              drug2:       meds[1].name,
              severity:    pick(['minor','moderate','moderate','major']),
              description: `Concurrent use of ${meds[0].name} and ${meds[1].name} may ${pick([
                'increase risk of hypotension — monitor blood pressure closely',
                'potentiate CNS depression — advise caution when driving',
                'increase bleeding risk — check INR more frequently',
                'cause additive QT prolongation — baseline ECG recommended',
                'reduce efficacy of ' + meds[1].name + ' — consider dose adjustment',
              ])}.`,
            }] : [],
            safe: !hasInteraction,
          };
        }

        await Prescription.create({
          patient:      patient._id,
          doctor:       doctor._id,
          medicalRecord: record._id,
          medications:  meds,
          status:       rxStatus,
          dispensedBy:  isDispensed ? pick(nurses)._id : undefined,
          dispensedAt:  isDispensed ? new Date(visitDate.getTime() + rand(1, 48) * 3_600_000) : undefined,
          notes:        isCancelled ? pick(STOP_REASONS) : undefined,
          aiInteractionCheck,
        });
        totalRx++;
      }

      // ── Lab Orders (1-2 per visit) ─────────────────────────────────────────
      const numOrders = rand(1, 2);
      for (let lo = 0; lo < numOrders; lo++) {
        const numPanels = rand(1, 3);
        const panels    = pickN(LAB_PANELS, numPanels);
        const testNames = panels.map(p => p.name);
        const priority  = pick(['routine','routine','routine','urgent','stat']);
        const status    = pick(['ordered','completed','completed','completed','completed']);
        const done      = status === 'completed';

        const results = done
          ? panels.flatMap(p => buildLabResults(p))
          : [];

        await LabOrder.create({
          patient:      patient._id,
          doctor:       doctor._id,
          medicalRecord: record._id,
          tests:        testNames,
          priority,
          status,
          results,
          notes: Math.random() > 0.6 ? pick(LAB_NOTES) : undefined,
          processedBy: done ? pick(labTechs)._id : undefined,
        });
        totalLabs++;
      }
    } // end visits

    if ((pi + 1) % 20 === 0) {
      console.log(`  Processed ${pi + 1}/${patients.length} patients...`);
    }
  }

  console.log('\n=== Patient History Seed Complete ===');
  console.log(`  EHR Records:   ${totalRecords}`);
  console.log(`  Prescriptions: ${totalRx}`);
  console.log(`  Lab Orders:    ${totalLabs}`);
  console.log(`  Avg visits/patient: ${(totalRecords / patients.length).toFixed(1)}`);

  await mongoose.disconnect();
}

seedHistory().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

---
description: Scaffold the complete Express backend with all models, controllers, routes, and RAG pipeline
allowed-tools: Bash, Write
---

You are a backend engineer. Create the full server/ directory structure for a MERN Hospital Management System:

1. Run: cd server && npm init -y
2. Run: npm install express mongoose dotenv cors bcryptjs jsonwebtoken multer
         cloudinary multer-storage-cloudinary @anthropic-ai/sdk nodemailer node-cron
3. Run: npm install -D vitest supertest mongodb-memory-server nodemon @vitest/coverage-v8

4. Add to server/package.json scripts:
   "dev": "nodemon src/index.js"
   "start": "node src/index.js"
   "test": "vitest run"
   "test:unit": "vitest run --testPathPattern=unit"
   "test:coverage": "vitest run --coverage"

5. Create all files in this structure:
   server/src/
     config/db.js                  — mongoose connect
     config/cloudinary.js          — cloudinary v2 config
     config/anthropic.js           — Anthropic SDK singleton: export { anthropic }
     config/email.js               — Nodemailer transporter singleton
     models/User.js                — name, email, password, role (6 roles),
                                      department, licenseNumber, isActive, timestamps
     models/Patient.js             — fullName, dateOfBirth, gender, bloodType,
                                      nhsNumber (unique), contactInfo{}, emergencyContact{},
                                      allergies[], chronicConditions[], insuranceDetails{},
                                      registeredBy (User ref), aiSummary (cached), timestamps
     models/Appointment.js         — patient ref, doctor ref, scheduledAt, duration,
                                      status (scheduled/confirmed/completed/cancelled/no-show),
                                      type (consultation/follow-up/procedure/emergency),
                                      notes, reminderSent, createdBy ref
     models/MedicalRecord.js       — patient ref, doctor ref, appointment ref, visitDate,
                                      chiefComplaint, vitals{height,weight,bp,pulse,temp,o2sat},
                                      diagnoses[]{icd10Code,description,type},
                                      treatmentPlan, followUpDate,
                                      aiDifferentialDiagnosis[], aiRiskScore,
                                      $text index on chiefComplaint+treatmentPlan
     models/Prescription.js        — patient ref, doctor ref, medicalRecord ref,
                                      medications[]{name,dosage,frequency,duration,instructions},
                                      status (active/dispensed/cancelled),
                                      dispensedBy (User ref), dispensedAt, aiInteractionCheck{}
     models/LabOrder.js            — patient ref, doctor ref, medicalRecord ref,
                                      tests[], priority (routine/urgent/stat),
                                      status (ordered/in-progress/completed/cancelled),
                                      results[]{testName,value,unit,referenceRange,flagged},
                                      reportFile (Cloudinary URL), notes, processedBy ref
     models/Invoice.js             — patient ref, appointment ref, lineItems[]{description,qty,unitPrice},
                                      totalAmount, status (draft/sent/paid/overdue),
                                      insuranceClaim{provider,policyNumber,claimStatus},
                                      dueDate, paidAt
     models/Ward.js                — name, type (general/ICU/pediatric/maternity/surgical),
                                      floor, capacity,
                                      beds[]{number,status(available/occupied/reserved),
                                      patient ref, admittedAt}
     models/ProtocolChunk.js       — source (filename), section (heading),
                                      chunkIndex, content, wordCount, createdAt
     controllers/authController.js
     controllers/patientController.js
     controllers/appointmentController.js
     controllers/medicalRecordController.js
     controllers/prescriptionController.js
     controllers/labOrderController.js
     controllers/invoiceController.js
     controllers/wardController.js
     controllers/aiController.js
     routes/authRoutes.js
     routes/patientRoutes.js
     routes/appointmentRoutes.js
     routes/medicalRecordRoutes.js
     routes/prescriptionRoutes.js
     routes/labOrderRoutes.js
     routes/invoiceRoutes.js
     routes/wardRoutes.js
     routes/aiRoutes.js
     middleware/authMiddleware.js       — JWT protect middleware
     middleware/roleMiddleware.js       — requireRole(...roles) guard
     middleware/auditMiddleware.js      — log every write operation to console + DB
     middleware/rateLimit.js           — 10 req/min per user for /api/ai/* routes
     scripts/ingestProtocols.js        — reads server/src/data/clinical-protocols/*.md,
                                          chunks into ~500-word blocks,
                                          upserts ProtocolChunk collection
     scripts/seedCronJobs.js           — registers node-cron jobs for appointment reminders
     data/clinical-protocols/          — 8 mock .md clinical protocol files
     index.js
   server/tests/
     unit/
     integration/
   server/.env.example  — ANTHROPIC_API_KEY, MONGODB_URI, JWT_SECRET,
                           CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
                           CLOUDINARY_API_SECRET, EMAIL_USER, EMAIL_PASS

Output: ## Server scaffolded successfully — list all files created
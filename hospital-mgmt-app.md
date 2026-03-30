# Hospital Management System — Complete Claude Code Guide
### Build a Full-Stack MERN App with AI, Clinical Protocol RAG, Skills, Agents, Hooks, and MCP
*March 2026*

---

## Table of Contents

1. [What You Will Build](#1-what-you-will-build)
2. [Prerequisites](#2-prerequisites)
3. [Environment Setup](#3-environment-setup)
4. [Create All Skills First](#4-create-all-skills-first)
5. [Trello MCP Setup + Populate Backlog](#5-trello-mcp-setup)
6. [Configure Hooks](#6-configure-hooks)
7. [UI Prototype with Pencil MCP](#7-ui-prototype-with-pencil-mcp)
8. [Scaffold the Backend](#8-scaffold-the-backend)
9. [Scaffold the Frontend](#9-scaffold-the-frontend)
10. [Write the Comprehensive Test Suite](#10-write-the-comprehensive-test-suite)
11. [GitHub Actions CI/CD](#11-github-actions-cicd)
12. [The Feature Creation Workflow](#12-the-feature-creation-workflow)
13. [The Six AI Features](#13-the-six-ai-features)
14. [Push to GitHub](#14-push-to-github)
15. [Deploy to Vercel](#15-deploy-to-vercel)
16. [Release Tags and Notes](#16-release-tags-and-notes)
17. [Skills Deep Dive](#17-skills-deep-dive)
18. [Agents Deep Dive](#18-agents-deep-dive)
19. [Hooks Deep Dive](#19-hooks-deep-dive)
20. [Appendices](#20-appendices)

---

## 1. What You Will Build

A full-stack Hospital Management System for **MediCore General Hospital** — a fictional mid-size hospital — where patients book appointments, doctors manage electronic health records, nurses track ward occupancy, and all clinical staff can query an AI assistant trained on the hospital's own clinical protocols.

*"Caring for patients, powered by intelligence."* — MediCore General Hospital

### Core Features

| Feature | Description |
|---------|-------------|
| Auth | JWT register, login, logout; six roles: Admin, Doctor, Nurse, Patient, Receptionist, Lab Technician |
| Patient Management | Register patients with demographics, emergency contacts, allergies, insurance details |
| Appointment Scheduling | Book, confirm, cancel, reschedule; doctor availability slots; status tracking |
| Electronic Health Records | Visit notes, ICD-10 diagnoses, vitals, treatment plans, linked prescriptions and lab orders |
| Medication & Pharmacy | Create prescriptions, dispensing log, medication stock levels, expiry alerts |
| Lab & Diagnostics | Order tests, upload result files (Cloudinary), flag abnormal values, link to EHR |
| Billing & Invoicing | Generate itemised invoices, insurance claim details, payment status tracking |
| Ward & Bed Management | Ward list, real-time bed occupancy grid, admit/discharge flow |
| Notifications | Email appointment reminders and discharge summaries via Nodemailer + node-cron |
| **6 AI Features** | Claude-powered enhancements including Clinical Protocol RAG (see Part 13) |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite (port 5173) + Tailwind CSS |
| Backend | Node.js + Express REST API (port 5000) |
| Database | MongoDB Atlas + Mongoose |
| Auth | JWT + bcryptjs |
| File Storage | Cloudinary (lab reports, X-rays, scan PDFs) |
| Email | Nodemailer + Gmail SMTP |
| Scheduling | node-cron (appointment reminders, expiry alerts) |
| AI | Anthropic Claude API (server-side only) |
| RAG Store | MongoDB `ProtocolChunk` collection (no external vector DB) |
| Unit Testing | Vitest + React Testing Library |
| Integration | Supertest + mongodb-memory-server |
| E2E | Playwright |
| CI/CD | GitHub Actions |
| Deployment | Vercel |

### Claude Code Features You Will Learn

| Feature | Used In | What It Does |
|---------|---------|--------------|
| Skills | Throughout | Custom slash commands for repetitive tasks |
| Agents | Part 18 | Autonomous sub-processes with scoped tools |
| Hooks | Part 19 | Auto-run shell commands on Claude Code events |
| MCP — Trello | Parts 5, 12 | Create and manage user stories from the terminal |
| MCP — Pencil | Part 7 | Generate UI prototypes with a single prompt |

---

## 2. Prerequisites

Before starting, verify you have everything installed:

```bash
node --version          # must be 18+
git --version
gh auth login           # GitHub CLI authenticated
vercel --version        # npm install -g vercel
```

You also need accounts on:
- **GitHub** — repository created
- **MongoDB Atlas** — free tier cluster URI ready
- **Cloudinary** — free tier API key and secret ready (for lab report file uploads)
- **Gmail** — App Password generated for SMTP (or SendGrid API key)
- **Trello** — empty board named "Hospital Management System"
- **Vercel** — account created

Install Claude Code:
```bash
npm install -g @anthropic-ai/claude-code
claude --version
claude auth login
```

---

## 3. Environment Setup

### Step 1 — Initialise the Repository

```bash
cd Hospital-MGMT-App
git init
mkdir -p .claude/commands .claude/agents .github/workflows
```

Create `.gitignore` at the project root:
```
node_modules/
.env
dist/
.vercel/
.claude/activity.log
```

### Step 2 — Create CLAUDE.md

`CLAUDE.md` is the most important file in a Claude Code project. It gives Claude context about your project, commands, and expectations. Claude reads it automatically every session.

Create it at the project root:

```markdown
# Hospital Management System — MediCore General Hospital

## Project Overview
Full-stack MERN hospital management system with AI-powered differential diagnosis,
clinical protocol RAG chatbot, discharge summary generation, and medication interaction
checking. Built for learning Claude Code features: Skills, Agents, Hooks, and MCP.

## Architecture
- client/ — React 18 + Vite (port 5173), Tailwind CSS
- server/ — Node.js + Express REST API (port 5000)
- MongoDB Atlas — cloud database; ProtocolChunk collection is the RAG store
- Cloudinary — lab report and medical imaging file storage
- Anthropic Claude API — six AI features (server-side only)
- RAG pipeline — no external vector DB; MongoDB $text search + Claude synthesis

## Key Commands
- Start backend:  cd server && npm run dev
- Start frontend: cd client && npm run dev
- Seed protocols: cd server && node scripts/ingestProtocols.js   (run once after first deploy)
- Run all tests:  npm test
- Run unit tests: npm run test:unit
- Build:          cd client && npm run build
- Deploy:         /deploy

## Code Style
- ES modules (import/export) throughout
- async/await over .then() chains
- Commit format: feat:, fix:, chore:, test:, docs:

## Testing Requirements
- All controllers: unit tests (mock Anthropic SDK and Cloudinary — never call real APIs in CI)
- All API routes: integration tests
- Critical flows: E2E tests
- Coverage target: 80% lines, 75% branches

## User Roles
- admin        — full system access, user management, reports
- doctor       — EHR, prescriptions, lab orders, AI assistant
- nurse        — vitals entry, ward management, medication dispensing
- patient      — view own appointments, records, invoices
- receptionist — patient registration, appointment booking
- lab_tech     — process lab orders, upload results

## Skills Available
- /create-user-stories <feature>
- /run-tests
- /unit-test-on-deploy
- /create-release-notes <tag>
- /deploy
- /check-coverage
- /scaffold-server
- /scaffold-client
```

### Step 3 — Configure Permissions

Create `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm *)",
      "Bash(git *)",
      "Bash(npx *)",
      "Bash(vercel *)",
      "Bash(gh *)",
      "Bash(node scripts/*)"
    ]
  }
}
```

### Step 4 — Open Claude Code

```bash
claude
```

Claude reads `CLAUDE.md` automatically. Type `/help` to see available skills.

---

## 4. Create All Skills First

> **Why first?** Skills automate everything that follows — scaffolding, testing, deployment. Create them once here and every subsequent step becomes a single command.

Skills are Markdown files in `.claude/commands/`. The exact format:

```markdown
---
description: One-line summary shown in /help
allowed-tools: Bash, Read, Write, Grep
argument-hint: <placeholder shown in CLI>
---

You are a [role]. When invoked with $ARGUMENTS, you must:
1. [Explicit step with exact commands]
2. [Step two]

Always output:
## Result
[structured output]
```

### Skill 1 — `/scaffold-server`

Create `.claude/commands/scaffold-server.md`:

```markdown
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
```

### Skill 2 — `/scaffold-client`

Create `.claude/commands/scaffold-client.md`:

```markdown
---
description: Scaffold the complete React + Vite + Tailwind frontend with all pages and components
allowed-tools: Bash, Write
---

You are a frontend engineer. Scaffold the full client/ directory for a MERN Hospital Management System:

1. Run: npm create vite@latest client -- --template react
2. Run: cd client && npm install react-router-dom axios react-toastify recharts
3. Run: npm install -D vitest @testing-library/react @testing-library/jest-dom
         @vitest/ui tailwindcss @tailwindcss/vite

4. Configure Tailwind in vite.config.js
5. Add to client/package.json scripts:
   "test": "vitest"
   "test:unit": "vitest run"
   "test:coverage": "vitest run --coverage"

6. Create all files in this structure:
   client/src/
     api/axios.js                    — Axios instance with baseURL + auth header interceptor
     context/AuthContext.jsx         — user state, login/logout/register functions
     components/
       Navbar.jsx                    — role-aware navigation: links change by role
       Sidebar.jsx                   — collapsible sidebar with role-filtered menu items
       PatientCard.jsx               — card: name, NHS number, DOB, blood type, allergy badges
       AppointmentSlotPicker.jsx     — visual slot grid: morning/afternoon/evening rows,
                                        available (green), booked (grey), selected (blue)
       VitalsChart.jsx               — recharts LineChart: BP, pulse, O2 sat over time
       StatusBadge.jsx               — colour-coded badge for appointment/prescription/lab status
       FileUploadZone.jsx            — drag-and-drop file upload; calls Cloudinary via server
       InvoiceTable.jsx              — line items table with subtotals
       BedGrid.jsx                   — ward bed map: available (green), occupied (red),
                                        reserved (amber) with tooltip on hover
       RoleRoute.jsx                 — redirects if user role not in allowedRoles prop
       ProtectedRoute.jsx            — redirects to /login if not authenticated
       AIAssistantPanel.jsx          — streaming diagnosis panel: bullet list of differentials
                                        with confidence bars, expandable reasoning
       DiagnosisChatbot.jsx          — floating chat bubble (bottom-right, teal),
                                        slide-in panel, protocol RAG queries, source citation pills,
                                        typing indicator, useSSE hook for streaming
       InteractionWarning.jsx        — modal with drug interaction severity badges
                                        (none/mild/moderate/severe) before prescription save
     pages/
       Login.jsx
       Register.jsx
       Dashboard.jsx                 — role-specific: Doctor sees patient queue + today's appts;
                                        Receptionist sees check-in list; Nurse sees ward summary
       PatientList.jsx               — searchable patient registry table
       PatientDetail.jsx             — tabs: Overview | EHR History | Prescriptions |
                                        Lab Orders | Invoices | AI Summary
       PatientRegister.jsx           — 3-step wizard: Demographics → Contact → Insurance
       AppointmentCalendar.jsx       — week/day view with doctor filter dropdown
       AppointmentBook.jsx           — natural language input + AppointmentSlotPicker
       EHRRecord.jsx                 — create/view visit: vitals form, ICD-10 search,
                                        treatment plan textarea, AIAssistantPanel
       PharmacyDashboard.jsx         — active prescriptions queue, dispense action, stock alerts
       LabResults.jsx                — ordered tests list, upload result PDF, flag form
       BillingPage.jsx               — invoice list with status filters, create/send invoice
       WardMap.jsx                   — ward selector tabs + BedGrid + admit/discharge form
       AdminPanel.jsx                — user management table, create/deactivate users
     hooks/
       useSSE.js                     — EventSource hook: append chunks, close on [DONE],
                                        expose { sources } from final [DONE] payload
   client/src/App.jsx                — BrowserRouter + all routes with RoleRoute guards

Output: ## Client scaffolded successfully — list all files created
```

### Skill 3 — `/create-user-stories`

Create `.claude/commands/create-user-stories.md`:

```markdown
---
description: Generate Gherkin user stories and create Trello cards for a feature
allowed-tools: Bash
argument-hint: <feature description>
---

You are a product manager. When invoked with $ARGUMENTS:

1. Parse the feature into 3-5 user stories: "As a [role], I want [action], so that [benefit]"
2. Write Given/When/Then acceptance criteria for each story
3. Create a Trello card per story in the Backlog list with label "Story"

Output:
## Created Stories for: $ARGUMENTS

| # | Story | Trello Card |
|---|-------|-------------|
| 1 | As a... | [URL] |

## Acceptance Criteria
[Given/When/Then per story]
```

### Skill 4 — `/run-tests`

Create `.claude/commands/run-tests.md`:

```markdown
---
description: Run the full test suite (unit + integration + E2E) and report results
allowed-tools: Bash
---

Run the full test suite in sequence:

1. cd server && npm test -- --reporter=verbose
2. cd client && npm test -- --run --reporter=verbose
3. npx playwright test --reporter=list

Output:
## Test Results — [timestamp]

| Suite         | Passed | Failed | Skipped | Duration |
|---------------|--------|--------|---------|----------|
| Unit (server) | X      | X      | X       | Xs       |
| Unit (client) | X      | X      | X       | Xs       |
| Integration   | X      | X      | X       | Xs       |
| E2E           | X      | X      | X       | Xs       |

List each failure with file:line and error message.

Final status: PASS or FAIL

Exit with error code 1 if any failures > 0.
```

### Skill 5 — `/unit-test-on-deploy`

Create `.claude/commands/unit-test-on-deploy.md`:

```markdown
---
description: Run unit tests before deployment; block deploy if any fail
allowed-tools: Bash
---

1. cd server && npm run test:unit -- --run
2. cd client && npm run test:unit -- --run

If ALL pass output:
## Pre-Deploy Check: PASSED
- Server unit tests: X passed
- Client unit tests: X passed
- Proceeding with deployment...

If ANY fail output:
## Pre-Deploy Check: FAILED
- [test name] at [file:line]
- DEPLOYMENT BLOCKED. Fix failing tests before deploying.

Exit with code 1 to halt deployment on failure.
```

### Skill 6 — `/check-coverage`

Create `.claude/commands/check-coverage.md`:

```markdown
---
description: Run tests with coverage and flag files below 80% lines / 75% branches
allowed-tools: Bash
---

1. cd server && npm run test:coverage
2. cd client && npm run test:coverage

Flag any file where: line coverage < 80% OR branch coverage < 75%

Output:
## Coverage Report

| File                                    | Lines | Branches | Status |
|-----------------------------------------|-------|----------|--------|
| src/controllers/authController          | 92%   | 88%      | PASS   |
| src/controllers/aiController            | 65%   | 60%      | FAIL   |

For each FAIL: list the untested functions by name.
```

### Skill 7 — `/create-release-notes`

Create `.claude/commands/create-release-notes.md`:

```markdown
---
description: Generate release notes from git commits and create a GitHub Release
allowed-tools: Bash
argument-hint: <version tag e.g. v1.0.0>
---

1. git tag --sort=-version:refname | head -2   (get current and previous tag)
2. git log <prev>..<current> --oneline --no-merges
3. Categorise commits:
   - feat:  → New Features
   - fix:   → Bug Fixes
   - chore: → Maintenance
   - test:  → Testing
4. gh release create $ARGUMENTS --notes "..." --title "Release $ARGUMENTS"

Output the GitHub Release URL.
```

### Skill 8 — `/deploy`

Create `.claude/commands/deploy.md`:

```markdown
---
description: Run pre-deploy tests, build, deploy to Vercel production, and create a GitHub Release
allowed-tools: Bash
---

Step 1: cd server && npm run test:unit -- --run
        cd client && npm run test:unit -- --run
        If any fail: DEPLOYMENT BLOCKED — stop here.
Step 2: cd client && npm run build
Step 3: vercel --prod --confirm
Step 4: Capture deployment URL from vercel output
Step 5: TAG=$(git tag --sort=-version:refname | head -1)
        gh release create $TAG --generate-notes

Output:
## Deployment Complete
- URL:     [vercel URL]
- Release: [GitHub Release URL]
```

---

## 5. Trello MCP Setup

### Step 1 — Get Trello API Credentials

1. Go to https://trello.com/power-ups/admin
2. Click **New Power-Up** → name it "Claude Code Integration"
3. Copy your **API Key**
4. Click **Generate Token** → authorise → copy the **Token**
5. Open your Trello board and copy the **Board ID** from the URL:
   `https://trello.com/b/BOARD_ID/hospital-management-system`

### Step 2 — Add Trello and Pencil to Claude Code MCP Config

Edit `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "trello": {
      "command": "npx",
      "args": ["-y", "mcp-server-trello"],
      "env": {
        "TRELLO_API_KEY": "your_api_key",
        "TRELLO_TOKEN": "your_token"
      }
    },
    "pencil": {
      "command": "npx",
      "args": ["-y", "@pencil/mcp-server"]
    }
  }
}
```

Restart Claude Code to load the MCP servers:
```bash
# Exit current session and restart
claude
```

Verify MCP is connected:
```
/mcp
```

You should see `trello` and `pencil` listed as connected servers.

### Step 3 — Create Board Structure

In Claude Code, ask Claude to set up the board:

```
Using the Trello MCP, on my "Hospital Management System" board:
1. Rename the default lists to: Backlog, In Progress, In Review, Done
2. Create labels: Epic (purple), Story (blue), Bug (red), Chore (grey)
```

### Step 4 — Seed the Initial Backlog

Run these commands one by one to populate your backlog with user stories:

```
/create-user-stories "Patient Registration — receptionist registers a new patient with demographics, emergency contact, and insurance details; patient receives welcome email"
```

```
/create-user-stories "Appointment Scheduling — patient or receptionist books an appointment by selecting a doctor, date and time slot; doctor receives notification"
```

```
/create-user-stories "Electronic Health Record — doctor creates a visit record with vitals, ICD-10 diagnoses, and treatment plan linked to the appointment"
```

```
/create-user-stories "Prescription Management — doctor creates a prescription; pharmacist views active prescriptions queue and marks as dispensed"
```

```
/create-user-stories "Lab Order and Results — doctor orders lab tests; lab technician uploads results PDF and flags abnormal values"
```

```
/create-user-stories "Billing and Invoicing — receptionist generates an invoice from appointment line items; patient views and pays invoice"
```

```
/create-user-stories "Ward and Bed Management — nurse views ward bed grid; admits a patient to an available bed; updates status to occupied"
```

```
/create-user-stories "Admin User Management — admin creates, views, and deactivates staff accounts with role assignment"
```

After running all eight, your Trello Backlog should have 24–40 user story cards.

### Step 5 — Move a Card to In Progress

When starting a feature, use Claude to move the card:

```
Using Trello MCP, move the "Patient Registration" epic card from Backlog to In Progress.
```

---

## 6. Configure Hooks

Hooks run shell commands automatically when Claude Code events fire. They are defined in `.claude/settings.json` alongside permissions.

Update `.claude/settings.json` to add hooks:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm *)",
      "Bash(git *)",
      "Bash(npx *)",
      "Bash(vercel *)",
      "Bash(gh *)",
      "Bash(node scripts/*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo '$CLAUDE_TOOL_INPUT' | grep -q 'git push' && (cd server && npm run test:unit -- --run) && (cd client && npm run test:unit -- --run) || true"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo '$CLAUDE_TOOL_INPUT' | grep -q 'vercel --prod' && TAG=$(git tag --sort=-version:refname | head -1) && [ -n \"$TAG\" ] && gh release create $TAG --generate-notes || true"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '\\n--- MediCore Coverage Snapshot ---' && cd server && npm run test:coverage -- --silent 2>/dev/null | tail -5 || true"
          }
        ]
      }
    ]
  }
}
```

### What Each Hook Does

| Hook | Trigger | Action |
|------|---------|--------|
| `PreToolUse` (Bash) | Any `git push` command | Runs server + client unit tests; blocks push if tests fail |
| `PostToolUse` (Bash) | Any `vercel --prod` command | Creates GitHub Release with auto-generated notes |
| `Stop` | Claude Code session ends | Prints a server coverage snapshot so you always know your coverage |

> **Why hooks beat manual reminders:** Without hooks, you must remember to run tests before every push. With hooks, it is physically impossible to push without the test gate firing. The Stop hook means every session ends with a coverage health check — no separate command needed.

---

## 7. UI Prototype with Pencil MCP

Before writing a single line of application code, use Pencil MCP to generate your UI screens. This gives you a visual target and dramatically reduces frontend rework.

### Step 1 — Open a New Document

In Claude Code:

```
Using Pencil MCP, open a new document.
```

### Step 2 — Get Design Guidelines and Style Guide

```
Using Pencil MCP, get guidelines for topic: web-app
```

Then:

```
Using Pencil MCP, get style guide tags, then fetch a style guide appropriate for
a professional hospital/healthcare management system — clean, trustworthy,
clinical with a teal and white palette.
```

### Step 3 — Generate Each Screen

Send each prompt separately and validate with a screenshot after each one.

**Screen 1 — Doctor Dashboard**
```
Design a Doctor Dashboard page for MediCore Hospital Management System.
Left sidebar with navigation: Dashboard, Patients, Appointments, EHR, Prescriptions, Lab Orders.
Main area: top stats row (4 cards: Today's Appointments, Patients Seen, Pending Labs, Active Prescriptions).
Below: two columns — left "Today's Appointments" list (time, patient name, type badge, status badge);
right "Recent Patients" list (name, last visit, chief complaint snippet).
Floating teal chat bubble bottom-right for AI assistant.
Use teal (#0D9488) primary, white background, slate-100 sidebar.
```

**Screen 2 — Patient Registration Wizard**
```
Design a 3-step Patient Registration wizard for MediCore.
Step indicator at top: Demographics (active) → Contact & Emergency → Insurance & Confirm.
Step 1 form fields: Full Name, Date of Birth (datepicker), Gender (radio), Blood Type (dropdown),
NHS Number (text), Allergies (tag input), Chronic Conditions (tag input).
Primary button "Next →", secondary "Cancel".
Clean card layout, white form on light grey background.
```

**Screen 3 — Electronic Health Record View**
```
Design an EHR Record page for MediCore. Patient info header strip: name, DOB, blood type, allergy pills.
Tabs: Overview | Vitals | Diagnoses | Treatment Plan.
Vitals tab: line chart (recharts style) showing BP, pulse, O2 saturation over last 10 visits.
Diagnoses tab: table with ICD-10 code, description, type (primary/secondary), date.
Right sidebar panel "AI Differential Diagnosis" with numbered list of differentials,
confidence percentage bar per item, and "Reasoning" expand toggle.
```

**Screen 4 — Appointment Calendar**
```
Design an Appointment Calendar page for MediCore.
Week view (Mon–Sun columns, 08:00–18:00 hour rows).
Appointment blocks: colour by type — consultation (teal), follow-up (blue),
procedure (amber), emergency (red). Each block shows patient name + duration.
Top: doctor filter dropdown, date navigation arrows, "Book Appointment" button.
Right panel slides in when clicking an appointment: patient name, type, notes, action buttons.
```

**Screen 5 — Lab Results Upload**
```
Design a Lab Results page for MediCore (Lab Technician view).
Table of ordered tests: columns — Patient, Test Name, Priority (routine/urgent/stat badge),
Ordered By, Ordered Date, Status.
Click a row to open a results form: test name, value input, unit, reference range, abnormal flag checkbox.
File upload zone below: drag-and-drop PDF area "Upload Result Report".
"Save Results" button; on save, row status updates to "Completed".
```

**Screen 6 — Ward Map**
```
Design a Ward Map page for MediCore.
Top: tab row for ward types — General | ICU | Pediatric | Maternity | Surgical.
Main area: bed grid (4 columns × N rows). Each bed card shows bed number,
patient name (if occupied), admission date.
Colour coding: available (green background), occupied (red), reserved (amber).
Click available bed → slide-in "Admit Patient" form: patient search, admission reason, doctor.
Click occupied bed → slide-in "Bed Detail": patient summary, discharge button.
```

### Step 4 — Validate Each Screen

After each screen, ask:

```
Using Pencil MCP, take a screenshot of the current document.
```

Review it and iterate with specific adjustment prompts before moving on.

---

## 8. Scaffold the Backend

With your skills created and your UI designs ready, scaffold the entire backend in one command:

```
/scaffold-server
```

Claude will create the full directory tree. Once complete, configure your environment:

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your real credentials:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/medicore
JWT_SECRET=your_64_char_hex_secret
ANTHROPIC_API_KEY=sk-ant-...
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
EMAIL_USER=your.gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
PORT=5000
```

### Verify the Scaffold

```bash
cd server && npm run dev
```

You should see:
```
MongoDB connected
MediCore API running on port 5000
Cron jobs registered: appointment-reminder, expiry-alert
```

Test the health endpoint:
```bash
curl http://localhost:5000/api/health
# {"status":"ok","timestamp":"..."}
```

### Understanding the Key Models

#### User Model — Six Roles
```javascript
// server/src/models/User.js
{
  name: String,
  email: { type: String, unique: true },
  password: String,  // bcrypt hashed
  role: {
    type: String,
    enum: ['admin', 'doctor', 'nurse', 'patient', 'receptionist', 'lab_tech']
  },
  department: String,       // e.g. "Cardiology", "Emergency"
  licenseNumber: String,    // for clinical staff
  isActive: { type: Boolean, default: true },
  timestamps: true
}
```

#### Patient Model — NHS Number as Unique Identifier
```javascript
// server/src/models/Patient.js
{
  fullName: String,
  dateOfBirth: Date,
  gender: String,
  bloodType: String,
  nhsNumber: { type: String, unique: true },
  contactInfo: { phone: String, address: String, city: String, postcode: String },
  emergencyContact: { name: String, relationship: String, phone: String },
  allergies: [String],
  chronicConditions: [String],
  insuranceDetails: { provider: String, policyNumber: String, expiryDate: Date },
  registeredBy: { type: ObjectId, ref: 'User' },
  aiSummary: Object,  // cached Claude summary — invalidated on new MedicalRecord
  timestamps: true
}
```

#### MedicalRecord Model — The Clinical Core
```javascript
// server/src/models/MedicalRecord.js
{
  patient: { type: ObjectId, ref: 'Patient' },
  doctor: { type: ObjectId, ref: 'User' },
  appointment: { type: ObjectId, ref: 'Appointment' },
  visitDate: Date,
  chiefComplaint: String,
  vitals: {
    height: Number,     // cm
    weight: Number,     // kg
    bloodPressure: String,  // "120/80"
    pulse: Number,
    temperature: Number,    // °C
    oxygenSaturation: Number  // %
  },
  diagnoses: [{
    icd10Code: String,
    description: String,
    type: { type: String, enum: ['primary', 'secondary', 'differential'] }
  }],
  treatmentPlan: String,
  followUpDate: Date,
  aiDifferentialDiagnosis: [Object],  // cached Claude response
  aiRiskScore: Number,
}
```

### The Audit Middleware

Because hospital data is sensitive, every write operation is logged:

```javascript
// server/src/middleware/auditMiddleware.js
export const auditLog = (req, res, next) => {
  const originalSend = res.json.bind(res);
  res.json = (data) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      console.log(`[AUDIT] ${new Date().toISOString()} | ${req.method} ${req.path} | User: ${req.user?.id} | Role: ${req.user?.role}`);
    }
    return originalSend(data);
  };
  next();
};
```

Apply it globally in `server/src/index.js`:

```javascript
import { auditLog } from './middleware/auditMiddleware.js';
app.use(auditLog);
```

---

## 9. Scaffold the Frontend

With the backend running, scaffold the frontend:

```
/scaffold-client
```

Configure the environment:

```bash
echo "VITE_API_URL=http://localhost:5000/api" > client/.env
```

Start the frontend:

```bash
cd client && npm run dev
```

Navigate to `http://localhost:5173`. You should see the MediCore login page.

### The Role-Aware Navigation

The sidebar changes based on the logged-in user's role. The `RoleRoute` component protects pages:

```jsx
// client/src/components/RoleRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}
```

Usage in `App.jsx`:
```jsx
<Route path="/ehr/:id" element={
  <RoleRoute allowedRoles={['doctor', 'nurse', 'admin']}>
    <EHRRecord />
  </RoleRoute>
} />
<Route path="/pharmacy" element={
  <RoleRoute allowedRoles={['nurse', 'admin']}>
    <PharmacyDashboard />
  </RoleRoute>
} />
<Route path="/admin" element={
  <RoleRoute allowedRoles={['admin']}>
    <AdminPanel />
  </RoleRoute>
} />
```

### The SSE Hook for Streaming AI Responses

```javascript
// client/src/hooks/useSSE.js
import { useState, useCallback } from 'react';

export function useSSE() {
  const [content, setContent] = useState('');
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);

  const stream = useCallback(async (url, body) => {
    setContent('');
    setSources([]);
    setLoading(true);

    const token = localStorage.getItem('token');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        const data = line.replace('data: ', '');
        if (data === '[DONE]') { setLoading(false); continue; }
        try {
          const parsed = JSON.parse(data);
          if (parsed.chunk) setContent(prev => prev + parsed.chunk);
          if (parsed.sources) setSources(parsed.sources);
        } catch {}
      }
    }
    setLoading(false);
  }, []);

  return { content, sources, loading, stream };
}
```

---

## 10. Write the Comprehensive Test Suite

Tests are written after scaffolding so you can see the real structure. Use three prompts — one per layer.

### Unit Tests

```
Write unit tests for server/src/controllers/authController.js using Vitest.
Save in server/tests/unit/authController.test.js.

Tests to cover:
- register: success creates user + returns JWT; duplicate email returns 409;
  missing fields returns 400; password is bcrypt-hashed (never stored plain)
- login: correct credentials return JWT + user object (no password field);
  wrong password returns 401; unknown email returns 401
- role validation: role must be one of 6 valid values; invalid role returns 400

Mock mongoose User model with vi.mock('../models/User.js').
Mock bcryptjs and jsonwebtoken.
Never call real MongoDB.
```

```
Write unit tests for server/src/controllers/appointmentController.js using Vitest.
Save in server/tests/unit/appointmentController.test.js.

Tests to cover:
- createAppointment: success with valid patient, doctor, future scheduledAt;
  conflict detection — blocks if doctor already has appointment in same time slot;
  past date returns 400; non-existent patient returns 404
- updateStatus: transitions: scheduled→confirmed, confirmed→completed, any→cancelled;
  invalid transition returns 400
- getByDoctor: returns only appointments for the authenticated doctor
- getByPatient: returns only appointments for authenticated patient (role=patient)

Mock Appointment, Patient, User mongoose models.
```

```
Write unit tests for server/src/controllers/aiController.js using Vitest.
Save in server/tests/unit/aiController.test.js.

Tests to cover:
- differentialDiagnosis: calls anthropic.messages.stream(); streams chunks via SSE;
  missing chiefComplaint returns 400
- summarizeRecord: cache hit returns Patient.aiSummary without calling Anthropic;
  cache miss calls Anthropic and saves to Patient.aiSummary; patientId not found returns 404
- checkInteractions: calls Anthropic with JSON mode; parses and returns interactions array;
  empty medications array returns 400
- parseAppointment: extracts specialty/urgency/preferredDate from NL query;
  empty query returns 400

IMPORTANT: Always mock @anthropic-ai/sdk with vi.mock. Never call real Anthropic API.
Use vi.fn() to simulate stream chunks and JSON responses.
```

```
Write unit tests for client/src/components/AppointmentSlotPicker.jsx using Vitest + React Testing Library.
Save in client/src/tests/AppointmentSlotPicker.test.jsx.

Tests to cover:
- renders morning/afternoon/evening rows
- available slots are clickable; selected slot gets 'selected' CSS class
- booked slots are not clickable; show tooltip "Already booked"
- fires onSlotSelect callback with correct datetime when slot clicked
- shows loading skeleton when slots prop is empty array
```

### Integration Tests

```
Write integration tests using Supertest and mongodb-memory-server.
Save in server/tests/integration/patientFlow.test.js.

Test the complete patient registration and appointment booking flow:

1. Register a Receptionist user (POST /api/auth/register with role: receptionist)
2. Login → get JWT (POST /api/auth/login)
3. Register a new Patient (POST /api/patients) — include full demographics
4. Verify Patient appears in search (GET /api/patients?search=lastname)
5. Register a Doctor user
6. Book an Appointment (POST /api/appointments) — patient + doctor + future date
7. Confirm the Appointment (PATCH /api/appointments/:id/status {status: confirmed})
8. Verify the appointment appears in doctor's list (GET /api/appointments?doctorId=...)

Each step must use the real HTTP layer (Supertest).
Use mongodb-memory-server — no real Atlas connection.
Set ANTHROPIC_API_KEY=test in process.env so no real AI calls fire.
```

```
Write integration tests for the prescription and lab flow.
Save in server/tests/integration/clinicalFlow.test.js.

1. Login as Doctor
2. Create Medical Record for existing patient + appointment
3. Create Prescription linked to that record (3 medications)
4. Login as Nurse → dispense the Prescription (PATCH status: dispensed)
5. Login as Doctor → create Lab Order (3 tests, priority: urgent)
6. Login as Lab Tech → upload result file (mock Cloudinary call), set results, flag one abnormal
7. Verify Lab Order status is completed
8. Generate Invoice for the appointment (POST /api/invoices)
9. Verify Invoice total matches line items sum
```

### E2E Tests (Playwright)

```
Write Playwright E2E tests. Save in e2e/hospitalFlow.spec.js.

Setup: use test user fixtures (seeded before tests run).

Test 1 — Doctor creates EHR record:
1. Navigate to /login; fill credentials for doctor@medicore.test; submit
2. Click first patient in dashboard queue
3. Click "New Visit" button
4. Fill Chief Complaint: "Chest pain and shortness of breath"
5. Fill vitals: BP 140/90, pulse 95, O2 sat 97%
6. Wait for AI Differential to load (check for text "Possible diagnoses:")
7. Add ICD-10 code "I20.9" (Angina pectoris)
8. Fill treatment plan textarea
9. Click "Save Record"; verify success toast

Test 2 — Receptionist books appointment:
1. Login as receptionist@medicore.test
2. Navigate to /appointments/book
3. Search patient by NHS number
4. Select doctor from dropdown
5. Type in NL box: "Cardiology follow-up next Tuesday morning"
6. Verify slot picker auto-selects a morning slot in the coming Tuesday
7. Confirm booking; verify confirmation card with appointment reference

Test 3 — Patient views own records:
1. Login as patient@medicore.test
2. Verify dashboard shows "My Appointments" section
3. Click first appointment → verify details page loads
4. Navigate to "My Lab Results" → verify test results table renders
5. Navigate to "My Invoices" → verify at least one invoice is shown
```

---

## 11. GitHub Actions CI/CD

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Test Suite
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
          cache-dependency-path: |
            server/package-lock.json
            client/package-lock.json

      - name: Install server dependencies
        run: cd server && npm ci

      - name: Install client dependencies
        run: cd client && npm ci

      - name: Run server unit tests
        run: cd server && npm run test:unit -- --run
        env:
          MONGODB_URI: mongodb://localhost:27017/medicore_test
          JWT_SECRET: test_jwt_secret_for_ci_only
          ANTHROPIC_API_KEY: test_key_never_called_in_unit_tests

      - name: Run server integration tests
        run: cd server && npm test -- --run
        env:
          JWT_SECRET: test_jwt_secret_for_ci_only
          ANTHROPIC_API_KEY: test_key_never_called_in_unit_tests
          # mongodb-memory-server handles the DB — no real Atlas needed

      - name: Run client unit tests
        run: cd client && npm run test:unit -- --run

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./server/coverage/lcov.info,./client/coverage/lcov.info
        continue-on-error: true

  build:
    name: Build Check
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x

      - name: Install and build client
        run: cd client && npm ci && npm run build
        env:
          VITE_API_URL: https://placeholder.vercel.app/api

  deploy:
    name: Deploy to Vercel
    runs-on: ubuntu-latest
    needs: [test, build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }} --confirm
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

### Set GitHub Secrets

In your GitHub repository: **Settings → Secrets and variables → Actions**

| Secret | Value |
|--------|-------|
| `VERCEL_TOKEN` | From Vercel dashboard → Account Settings → Tokens |
| `VERCEL_ORG_ID` | From `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` after `vercel link` |

> **Important:** `ANTHROPIC_API_KEY` is NOT a GitHub secret. Real AI calls must never run in CI. Unit and integration tests mock the Anthropic SDK.

---

## 12. The Feature Creation Workflow

This is the loop you will repeat for every feature in the project. The example below walks through **Medication Interaction Checker** — Feature 4 of the six AI features.

### Step 1 — Create User Stories

```
/create-user-stories "Medication Interaction Checker — before a doctor saves a prescription,
Claude checks all medications for interactions and displays severity warnings; doctor can
override with a documented reason"
```

Claude creates 3–5 Trello cards in Backlog. Example output:

```
## Created Stories for: Medication Interaction Checker

| # | Story | Trello Card |
|---|-------|-------------|
| 1 | As a doctor, I want to see drug interaction warnings before saving a prescription, so that I avoid prescribing harmful combinations | https://trello.com/c/abc123 |
| 2 | As a doctor, I want to override an interaction warning with a documented reason, so that I can exercise clinical judgment | https://trello.com/c/def456 |
| 3 | As a nurse, I want to see interaction flags on the dispensing queue, so that I can double-check before dispensing | https://trello.com/c/ghi789 |
```

### Step 2 — Move Cards to In Progress

```
Using Trello MCP, move the "Medication Interaction Checker" story cards
from Backlog to In Progress.
```

### Step 3 — Prototype the UI Screen

```
Using Pencil MCP, design an Interaction Warning modal for MediCore.
Show a list of drug pairs with severity badges: none (grey), mild (yellow), moderate (orange), severe (red).
Each row: Drug A — Drug B | Severity badge | short description.
Below the list: overall risk summary sentence.
Two buttons: "Proceed Anyway (document reason)" and "Edit Prescription".
If "Proceed Anyway" clicked: show a text area "Reason for override" before final save.
```

### Step 4 — Build Backend

```
Create POST /api/ai/check-interactions in server/src/controllers/aiController.js.
Accept { medications: [{name, dosage}] } in req.body.
Protect with authMiddleware + requireRole('doctor', 'nurse') + aiRateLimit.
If medications.length < 2 return 400 "At least 2 medications required for interaction check."
Call claude-3-5-haiku-20241022 with JSON mode.
System: 'Return ONLY valid JSON. No markdown.'
User prompt: list the medication names and ask Claude to identify all potential interactions.
Expected JSON: {
  interactions: [{ drug1, drug2, severity (none/mild/moderate/severe), description, mechanism }],
  overallRisk: string,
  recommendations: string[]
}
Parse JSON, save the result to Prescription.aiInteractionCheck if prescriptionId provided, return it.
Create route: POST /api/ai/check-interactions in server/src/routes/aiRoutes.js.
```

### Step 5 — Build Frontend

```
Create client/src/components/InteractionWarning.jsx.
Props: { medications, onProceed, onEdit }.
On mount, call POST /api/ai/check-interactions with the medications array.
Show a loading spinner while the API call runs.
Render a modal with:
  - Title "Drug Interaction Check"
  - Table: Drug A | Drug B | Severity badge | Description
  - Overall risk sentence from response
  - "Edit Prescription" button (calls onEdit)
  - "Proceed Anyway" button — if clicked, shows a textarea "Document your clinical reason"
    then a "Confirm Override" button (calls onProceed with overrideReason)
Import and render InteractionWarning inside the Prescription form in EHRRecord.jsx.
Show it as a blocking step when the doctor clicks "Save Prescription" and
overallRisk is not "none".
```

### Step 6 — Write Tests

```
Write unit tests for the checkInteractions AI controller function.
Mock @anthropic-ai/sdk. Test:
- Returns 400 if fewer than 2 medications
- Calls Anthropic with JSON mode and the correct medication list
- Returns parsed interactions array
- Handles Anthropic JSON parse error gracefully (returns 500)

Write a React Testing Library test for InteractionWarning.jsx:
- Renders loading spinner while API call pending
- Renders interaction table with correct severity badges
- "Proceed Anyway" shows override textarea
- "Confirm Override" is disabled until textarea has at least 10 characters
```

### Step 7 — Run Tests

```
/run-tests
```

All green? Commit:

```bash
git add -A
git commit -m "feat: add medication interaction checker with AI severity warnings"
```

### Step 8 — Close Trello Cards

```
Using Trello MCP, move the Medication Interaction Checker story cards
from In Progress to Done.
```

Repeat this loop for every feature.

---

## 13. The Six AI Features

Each feature includes a `/create-user-stories` call, a backend prompt, and a frontend prompt. Follow the Feature Creation Workflow (Part 12) for each.

---

### Feature 1 — AI Differential Diagnosis Assistant (Streaming)

**Endpoint:** `POST /api/ai/differential-diagnosis` | **Model:** `claude-3-5-sonnet-20241022`

```
/create-user-stories "AI Differential Diagnosis Assistant — as a doctor records a patient's
chief complaint and vitals, Claude streams a ranked list of possible diagnoses with
confidence levels and recommended next steps, displayed in the EHR creation form"
```

**Backend prompt:**
```
Create POST /api/ai/differential-diagnosis in server/src/controllers/aiController.js.
Accept { chiefComplaint, vitals, allergies, chronicConditions } in req.body.
Protect with authMiddleware + requireRole('doctor') + aiRateLimit.
Validate: chiefComplaint is required; return 400 if missing.

Set SSE headers: Content-Type text/event-stream, Cache-Control no-cache, Connection keep-alive.
Call claude-3-5-sonnet-20241022 with anthropic.messages.stream().
System: "You are a clinical decision support tool. Generate a ranked differential diagnosis.
Format each item as: '1. [Diagnosis] — Confidence: X% — Next Steps: ...'
Always include a disclaimer that this is AI assistance, not a final diagnosis.
Never recommend specific drug doses. 3-5 differentials maximum."
User prompt: include chiefComplaint, vitals as JSON, allergies[], chronicConditions[].
On each text delta: res.write("data: " + JSON.stringify({ chunk: text }) + "\n\n").
Save the final concatenated text to MedicalRecord.aiDifferentialDiagnosis if recordId provided.
On stream end: res.write("data: [DONE]\n\n") then res.end().
```

**Frontend prompt:**
```
Create client/src/components/AIAssistantPanel.jsx.
Props: { recordData, onSave }.
Show "Get AI Differential" button (doctor-only, check AuthContext role).
On click, call useSSE hook to stream POST /api/ai/differential-diagnosis.
Display streaming text incrementally in a styled panel with a teal left border.
Show animated typing cursor (blinking |) during streaming.
Each completed differential item (detected by line ending with "..."):
  render as a card with: numbered rank, diagnosis name bold, confidence as a
  progress bar (0-100%), next steps as a collapsible bullet list.
Show disclaimer text at the bottom in grey italic.
On [DONE]: show "Accept to EHR" button that calls onSave with the generated text.
Place AIAssistantPanel in EHRRecord.jsx alongside the diagnosis entry form.
```

---

### Feature 2 — Medical Record Summarization (JSON + Cache)

**Endpoint:** `POST /api/ai/summarize-record` | **Model:** `claude-3-5-haiku-20241022`

```
/create-user-stories "Medical Record Summarization — a doctor or nurse opening a patient
profile can request a Claude-generated AI summary of the patient's entire visit history,
cached in the Patient document and invalidated when a new record is added"
```

**Backend prompt:**
```
Create POST /api/ai/summarize-record in aiController.js.
Accept { patientId } in req.body. Protect with authMiddleware + requireRole('doctor','nurse','admin').
Fetch Patient by ID. If Patient.aiSummary exists and is not empty, return it immediately (cache hit).
Fetch all MedicalRecords for this patient (sorted by visitDate desc, limit 20).
If no records: return { summary: null, message: "No visit history to summarize." }
Call claude-3-5-haiku-20241022 with JSON mode.
System: 'Return ONLY valid JSON. No markdown. No prose outside JSON.'
Prompt: include all records serialised as compact JSON.
Expected JSON response:
{
  chiefComplaints: string[],
  diagnoses: [{ icd10Code, description, firstSeen, frequency }],
  medications: string[],
  keyFindings: string[],
  riskFlags: string[],
  summaryText: string (2-3 sentences plain language overview)
}
Parse JSON, save to Patient.aiSummary, return it.
Also add a post-save hook on MedicalRecord schema to clear Patient.aiSummary when a new record is created.
```

**Frontend prompt:**
```
Create a collapsible "AI Patient Summary" card in PatientDetail.jsx.
Place it at the top of the Overview tab, above the demographics details.
On card expand (first time only), call POST /api/ai/summarize-record with the patientId.
Show a skeleton loader with 4 pulsing lines while loading.
Expanded content:
  - summaryText paragraph in italic at the top
  - "Key Diagnoses" — tag chips for each diagnosis with ICD-10 code tooltip
  - "Risk Flags" — red alert badges (show only if riskFlags.length > 0)
  - "Current Medications" — simple bulleted list
Collapse icon (chevron) top-right of card.
Show a "Refreshed just now" timestamp.
If summary is null, show "No visit history yet" empty state.
```

---

### Feature 3 — Discharge Summary Generator (Streaming)

**Endpoint:** `POST /api/ai/discharge-summary` | **Model:** `claude-3-5-sonnet-20241022`

```
/create-user-stories "Discharge Summary Generator — when a patient is being discharged from
a ward, the doctor clicks 'Generate Discharge Summary' and Claude streams a structured
clinical discharge note that can be accepted, edited, and saved as a PDF"
```

**Backend prompt:**
```
Create POST /api/ai/discharge-summary in aiController.js.
Accept { patientId, wardBedId } in req.body.
Protect with authMiddleware + requireRole('doctor', 'admin') + aiRateLimit.
Fetch Patient with full details. Fetch most recent MedicalRecord. Fetch Ward bed info.
If patient not found: return 404.

Set SSE headers. Call claude-3-5-sonnet-20241022 with stream.
System: "You are a clinical documentation specialist. Generate a professional
hospital discharge summary. Use standard clinical headings. Do not invent information
not provided. Flag missing data as [TO COMPLETE]."
User prompt: structured block with:
  - Patient name, DOB, NHS number, admission reason
  - Diagnoses (ICD-10 codes + descriptions)
  - Vitals at discharge vs admission
  - Treatment received (from treatmentPlan)
  - Medications at discharge (from latest Prescription)
  - Follow-up plan (from MedicalRecord.followUpDate + treatmentPlan)
Stream chunks. On [DONE] also upload the final text as a plain-text file to Cloudinary
and return the Cloudinary URL in the final SSE event: { sources: [{ url, label: 'PDF' }] }.
```

**Frontend prompt:**
```
In WardMap.jsx, on the occupied bed detail slide-in panel:
Add a "Generate Discharge Summary" button (doctor-only, visible only when bed status is occupied).
On click, open a full-screen modal "Discharge Summary".
Use useSSE hook to stream POST /api/ai/discharge-summary.
Show streaming text in a monospace editable textarea that grows with content.
Show animated cursor during streaming.
After [DONE]:
  - Show "Download PDF" button (link to Cloudinary URL from sources)
  - Show "Accept & Discharge" button — calls PATCH /api/wards/:wardId/beds/:bedId/discharge
    which sets bed status to available and patient to null.
  - Show "Edit" button — makes the textarea directly editable.
```

---

### Feature 4 — Medication Interaction Checker (JSON)

*(Already built step-by-step in Part 12 — Feature Creation Workflow)*

**Endpoint:** `POST /api/ai/check-interactions` | **Model:** `claude-3-5-haiku-20241022`

For reference, the full backend and frontend prompts are in Part 12, Steps 4 and 5.

---

### Feature 5 — Natural Language Appointment Scheduling (JSON Intent Parsing)

**Endpoint:** `POST /api/ai/parse-appointment` | **Model:** `claude-3-5-haiku-20241022`

```
/create-user-stories "Natural Language Appointment Scheduling — a patient or receptionist
types a natural language request like 'I need a cardiology follow-up next Tuesday morning
for chest pain', and Claude extracts the structured appointment details to pre-fill the
booking form"
```

**Backend prompt:**
```
Create POST /api/ai/parse-appointment in aiController.js.
Accept { query: string } in req.body. Protect with authMiddleware + aiRateLimit.
Validate: query must be a non-empty string; return 400 if missing.
Call claude-3-5-haiku-20241022 with JSON mode.
System: 'Return ONLY valid JSON. No markdown. Dates should be ISO 8601 strings.'
User prompt: extract appointment intent from: "${query}"
Expected JSON:
{
  specialty: string | null,   // e.g. "Cardiology", "General Practice"
  appointmentType: string,    // consultation / follow-up / procedure / emergency
  urgency: string,            // routine / urgent / emergency
  preferredDate: string | null,  // ISO date string best guess
  preferredTimeOfDay: string | null, // morning / afternoon / evening
  chiefComplaint: string | null,
  suggestedDuration: number,  // minutes: 15/30/45/60
  notes: string | null
}
Parse JSON. Look up available doctors matching specialty using a DB query.
Return { intent: parsedJSON, availableDoctors: [{ id, name, specialty }] }.
```

**Frontend prompt:**
```
In AppointmentBook.jsx, add a natural language input bar at the top of the page.
Placeholder: "Describe your appointment need... e.g. 'Cardiology follow-up Tuesday morning'"
"Parse" button beside the input with a sparkle icon.
On submit: call POST /api/ai/parse-appointment.
Show a loading spinner on the Parse button during the API call.
When response arrives:
  - Auto-select the doctor from the availableDoctors array that matches intent.specialty
    (show a dropdown with the matches if multiple)
  - Set the appointment type dropdown to intent.appointmentType
  - Set the date picker to intent.preferredDate if not null
  - Filter AppointmentSlotPicker to show only intent.preferredTimeOfDay slots
  - Pre-fill the notes textarea with intent.chiefComplaint
Show a "Parsed from your description" chip above the slot picker with the
extracted specialty and urgency as coloured badges.
Allow user to manually override any pre-filled field.
```

---

### Feature 6 — Clinical Protocol RAG Chatbot ⭐

**Endpoint:** `POST /api/ai/protocol-chat` | **Models:** `claude-3-5-haiku-20241022` (keyword extraction) + `claude-3-5-sonnet-20241022` (answer synthesis)

```
/create-user-stories "Clinical Protocol RAG Chatbot — doctors and nurses can ask clinical
questions like 'What is the sepsis management protocol?' and Claude answers using only
MediCore's own clinical protocol documents, with source citations shown as clickable pills"
```

This is the architectural centrepiece of the app. It involves two Claude calls per query and a MongoDB-backed document store — no external vector database required.

---

#### Step A — Protocol Ingestion (`scripts/ingestProtocols.js`, run once)

The ingestion script reads Markdown files from `data/clinical-protocols/`, splits them into ~500-word chunks, and upserts them into the `ProtocolChunk` collection with a `$text` index.

**Prompt to create the ingestion script:**
```
Create server/src/scripts/ingestProtocols.js.
Read all .md files from server/src/data/clinical-protocols/.
For each file:
  1. Split into sections by H2 headings (## heading)
  2. For each section, split into ~500-word chunks (break at paragraph boundaries)
  3. For each chunk, upsert a ProtocolChunk document:
     { source: filename, section: heading, chunkIndex: n, content: chunkText, wordCount: n }
  Use updateOne with upsert: true, matching on source + section + chunkIndex.
Create a $text index on ProtocolChunk.content field.
Log: "Ingested X chunks from Y files."
```

**The 8 mock clinical protocol documents to create:**

Create these files in `server/src/data/clinical-protocols/`:

| Filename | Content Focus |
|----------|---------------|
| `sepsis-management.md` | SIRS criteria, Sepsis-3 definition, Hour-1 bundle, antibiotic choices, fluid resuscitation |
| `medication-administration.md` | 5 Rights of medication, IV preparation, PCA protocols, high-risk medications, double-check requirements |
| `fall-prevention.md` | Morse Fall Scale assessment, intervention tiers, environmental checks, post-fall protocol |
| `hand-hygiene.md` | WHO 5 Moments, technique steps, alcohol hand rub vs soap, compliance monitoring |
| `patient-discharge.md` | Discharge criteria checklist, medication reconciliation, referral letters, follow-up booking, patient education |
| `icu-admission-criteria.md` | ICU admission triggers, monitoring requirements, APACHE II scoring, organ support indications |
| `triage-guide.md` | Manchester Triage System categories (Immediate/Very Urgent/Urgent/Standard/Non-Urgent), presentation-to-category mapping |
| `pain-management.md` | WHO analgesic ladder, numeric pain scale, non-pharmacological interventions, opioid prescribing guidelines, PCA setup |

**Run the ingestion script once after setup:**
```bash
cd server && node src/scripts/ingestProtocols.js
```

---

#### Step B — The RAG Endpoint (Two-Claude Pipeline)

**Backend prompt:**
```
Create POST /api/ai/protocol-chat in aiController.js.
Accept { query: string, history: [{role, content}] } in req.body.
Protect with authMiddleware + requireRole('doctor','nurse','admin') + aiRateLimit.
Validate: query must be non-empty.

Set SSE headers (text/event-stream).

Step 1 — Keyword Extraction (claude-3-5-haiku-20241022, NOT streaming):
  System: 'Return ONLY a JSON array of 3-6 search keywords. No prose.'
  User: 'Extract search keywords from: "${query}"'
  Parse JSON array of keywords.

Step 2 — Document Retrieval:
  $text search ProtocolChunk collection using the extracted keywords.
  Sort by { score: { $meta: "textScore" } }, limit 6 chunks.
  If no chunks found: stream back "I couldn't find a relevant protocol for that query.
  Please consult the hospital policy manual directly." then [DONE].

Step 3 — Answer Synthesis (claude-3-5-sonnet-20241022, streaming):
  Build context block from the 6 chunks: include source filename and section for each.
  System: "You are MediCore Hospital's clinical protocol assistant.
  Answer questions ONLY using the provided protocol documents.
  ALWAYS cite your sources as [source.md — Section Name].
  If the answer is not in the documents, say so clearly.
  Never give personal medical advice."
  Messages: history + { role: user, content: query + "\n\nDocuments:\n" + contextBlock }
  Stream each text delta: res.write("data: " + JSON.stringify({ chunk: delta }) + "\n\n")
  On stream end: extract all cited sources from the full response text.
    Parse [filename — Section] citations using regex.
    Send final event: res.write("data: " + JSON.stringify({ sources: citedSources }) + "\n\n")
  Then: res.write("data: [DONE]\n\n"); res.end()
```

---

#### Step C — The Chatbot Frontend Component

**Frontend prompt:**
```
Create client/src/components/DiagnosisChatbot.jsx.
Visible only to users with role doctor, nurse, or admin.
Floating teal chat bubble button fixed bottom-right (same position across all pages).
On click: slide-in panel from right, 400px wide, full height.
Panel header: "MediCore Protocol Assistant" with close X button.
Message list area (scrollable):
  - User messages: right-aligned teal bubble
  - AI messages: left-aligned white bubble with teal left border
  - After each AI message: source citation pills below the bubble —
    each pill shows the protocol filename, clicking copies the source name to clipboard
  - Typing indicator: 3 animated dots while streaming
Input area at bottom: textarea (Enter to send, Shift+Enter for newline) + Send button.
Use useSSE hook for streaming: call POST /api/ai/protocol-chat with { query, history }.
Maintain history array (last 10 turns) in local state.
On new [DONE] event: append { sources } to the last AI message.
Show empty state: "Ask me anything about MediCore clinical protocols."
```

---

## 14. Push to GitHub

### Step 1 — Create the Repository

```bash
gh repo create hospital-mgmt-app --public --description "MediCore Hospital Management System — Full-stack MERN app with AI"
```

### Step 2 — Add Remote and Initial Commit

```bash
git remote add origin https://github.com/yourusername/hospital-mgmt-app.git

git add .
git commit -m "feat: initial project scaffold — MERN hospital management system

- CLAUDE.md with full project context and role definitions
- 8 Claude Code skills for scaffolding, testing, and deployment
- Server: Express + MongoDB + 9 models (User, Patient, Appointment, EHR, etc.)
- Client: React 18 + Vite + Tailwind with role-aware navigation
- Trello MCP integration for user story management
- Pencil MCP UI prototypes for all 6 key screens
- GitHub Actions CI/CD pipeline
- 6 Claude AI features: diagnosis, summarization, discharge, interactions, NL scheduling, RAG"
```

### Step 3 — Create Branch Strategy

```bash
# Create develop branch for integration
git checkout -b develop
git push -u origin develop

# Work on features in feature branches
git checkout -b feature/ehr-records
```

**Branch strategy:**

| Branch | Purpose | CI Trigger |
|--------|---------|-----------|
| `main` | Production-ready code | Tests + Deploy |
| `develop` | Integration branch | Tests only |
| `feature/*` | Individual features | Tests only |

### Step 4 — Push and Verify CI

```bash
git push -u origin main
```

Navigate to your GitHub repository → **Actions** tab. You should see the CI workflow running. All three jobs (test, build, deploy) should complete green on first push.

---

## 15. Deploy to Vercel

### Step 1 — Configure Vercel Project

```bash
cd Hospital-MGMT-App
vercel link
```

Follow the prompts. This creates `.vercel/project.json` with your `orgId` and `projectId`.

### Step 2 — Create `vercel.json`

Create at the project root:

```json
{
  "version": 2,
  "buildCommand": "cd client && npm install && npm run build",
  "outputDirectory": "client/dist",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/**/*.js": {
      "runtime": "@vercel/node"
    }
  }
}
```

### Step 3 — Set Environment Variables

In Vercel dashboard: **Project → Settings → Environment Variables**

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | 64-byte hex string |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (Vercel only — never CI) |
| `CLOUDINARY_CLOUD_NAME` | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | From Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | From Cloudinary dashboard |
| `EMAIL_USER` | Gmail address |
| `EMAIL_PASS` | Gmail App Password |
| `VITE_API_URL` | `https://your-project.vercel.app/api` |

### Step 4 — Run Pre-Deploy Check

```
/unit-test-on-deploy
```

If PASSED, proceed. If FAILED, fix tests first.

### Step 5 — Deploy

```
/deploy
```

This runs: unit tests → client build → `vercel --prod` → GitHub Release (via PostToolUse hook).

### Step 6 — Seed the Protocol Store on Production

After the first successful deployment, run the ingestion script against your production MongoDB URI:

```bash
MONGODB_URI=mongodb+srv://... node server/src/scripts/ingestProtocols.js
```

Or set `MONGODB_URI` in your local `.env` pointing to Atlas and run locally — the chunks persist in the cloud database.

### Step 7 — Verify

```bash
vercel ls
```

Open the deployment URL, log in as a Doctor, click the teal chat bubble, and ask:

```
What is the sepsis management protocol?
```

The chatbot should stream an answer citing `sepsis-management.md`.

---

## 16. Release Tags and Notes

### Create a Tag

```bash
git tag -a v1.0.0 -m "First release: patient management, EHR, 6 AI features, ward management"
git push origin v1.0.0
```

### Run the Skill

```
/create-release-notes v1.0.0
```

Claude reads the git log, categorises commits, and creates a GitHub Release at:
`github.com/youruser/hospital-mgmt-app/releases/tag/v1.0.0`

> The `/deploy` skill does this automatically — no extra steps needed after the first manual tag.

### Version Naming Convention

| Version | Contents |
|---------|---------|
| `v1.0.0` | Core: auth, patients, appointments, EHR, 6 AI features |
| `v1.1.0` | Pharmacy, lab orders, billing |
| `v1.2.0` | Ward management, discharge flow |
| `v2.0.0` | Breaking changes, major refactors |

---

## 17. Skills Deep Dive

### Skill Anatomy — Exact Markup Format

Every skill is a `.md` file in `.claude/commands/`. The exact format:

```markdown
---
description: One-line summary shown in /help
allowed-tools: Bash, Read, Write, Grep
argument-hint: <placeholder shown in CLI>
---

You are a [role]. When invoked with $ARGUMENTS, you must:
1. [Explicit step with exact commands]
2. [Step two — reference exact file paths]

Always output:
## Result
[structured output]
```

### Key Fields

| Field | Purpose |
|-------|---------|
| `description` | Shown in `/help` — keep it action-oriented |
| `allowed-tools` | Restricts which Claude tools can be used — security and predictability |
| `argument-hint` | Placeholder shown in CLI after the skill name |
| `$ARGUMENTS` | The text the user types after the skill name |

### All 8 Skills — Quick Reference

| Skill | File | Trigger | Side Effect |
|-------|------|---------|------------|
| `/scaffold-server` | `.claude/commands/scaffold-server.md` | `/scaffold-server` | Creates entire server/ tree |
| `/scaffold-client` | `.claude/commands/scaffold-client.md` | `/scaffold-client` | Creates entire client/ tree |
| `/create-user-stories` | `.claude/commands/create-user-stories.md` | `/create-user-stories "feature"` | Creates Trello cards |
| `/run-tests` | `.claude/commands/run-tests.md` | `/run-tests` | None |
| `/unit-test-on-deploy` | `.claude/commands/unit-test-on-deploy.md` | `/unit-test-on-deploy` | Blocks if fail |
| `/check-coverage` | `.claude/commands/check-coverage.md` | `/check-coverage` | None |
| `/create-release-notes` | `.claude/commands/create-release-notes.md` | `/create-release-notes v1.0.0` | GitHub Release |
| `/deploy` | `.claude/commands/deploy.md` | `/deploy` | Deploys + release |

### Skill Storage Locations

- `.claude/commands/` — project-scoped (this repo only)
- `~/.claude/commands/` — global (available in all projects)
- Share via `CLAUDE.md` import: `@.claude/commands/run-tests.md`

### Tips for Writing Effective Skills

**1. Be specific about commands.** Vague prompts produce vague results.
```markdown
# Bad:
Run the tests.

# Good:
1. cd server && npm run test:unit -- --run --reporter=verbose
2. cd client && npm run test:unit -- --run --reporter=verbose
```

**2. Define the output format.** Structured output can be parsed by hooks.
```markdown
Always output:
## Test Results — [ISO timestamp]
| Suite | Passed | Failed | Duration |
```

**3. Use `allowed-tools` as a security boundary.**
- A skill that only reads logs should have `allowed-tools: Read, Bash` — not `Write`.
- The `/create-release-notes` skill needs `Bash` only (for `gh` and `git`).

**4. Arguments via `$ARGUMENTS` are positional.** For multi-argument skills, parse them in the body:
```markdown
argument-hint: <tag> <environment>
---
Parse $ARGUMENTS as: TAG=first word, ENV=second word.
```

---

## 18. Agents Deep Dive

### What Agents Are

Agents are subprocess Claude instances launched by the main Claude Code session. Each agent:
- Has its own isolated context window
- Can only access the tools you specify in its frontmatter
- Returns a single structured result to the parent
- Can run in parallel with other agents

### Skills vs Agents

| | Skills | Agents |
|--|--------|--------|
| Duration | < 1 minute, single shot | Multi-step, can take minutes |
| Context | Shares parent context | Isolated context window |
| Use case | Deterministic, repetitive tasks | Research, analysis, parallel work |
| Invocation | User types `/skill-name` | Claude Code spawns automatically |
| Output | Printed to terminal | Returned to parent Claude instance |

### Agent 1 — `test-reporter`

File: `.claude/agents/test-reporter.md`

```markdown
---
name: test-reporter
description: Runs all tests and returns a structured pass/fail report with failure details
tools: Bash, Read, Grep
---

1. cd server && npm test -- --reporter=json > /tmp/server-results.json
2. cd client && npm test -- --run --reporter=json > /tmp/client-results.json
3. npx playwright test --reporter=json > /tmp/e2e-results.json

Parse all three JSON outputs and return:

## Test Report — [ISO timestamp]

| Suite         | Passed | Failed | Duration |
|---------------|--------|--------|----------|
| Unit (server) | X      | X      | Xs       |
| Unit (client) | X      | X      | Xs       |
| Integration   | X      | X      | Xs       |
| E2E           | X      | X      | Xs       |

### Failures
- Test: [name] | File: [path:line] | Error: [message]

Final status: PASS or FAIL
```

### Agent 2 — `pr-reviewer`

File: `.claude/agents/pr-reviewer.md`

```markdown
---
name: pr-reviewer
description: Reviews a PR diff for code quality, test coverage gaps, and security issues
tools: Bash, Read, Grep
---

Given branch name $ARGUMENTS:

1. git diff main..$ARGUMENTS -- server/ client/
2. Analyse the diff for:
   a. Missing test coverage: any new controller function without a corresponding test file?
   b. Security issues: hardcoded secrets, SQL/NoSQL injection risks, missing auth middleware
   c. Role checks: any new route missing authMiddleware or requireRole()?
   d. Error handling: unhandled promise rejections, missing try/catch in async controllers
   e. AI usage: any direct Anthropic SDK call outside /controllers/aiController.js?

Return:

## PR Review — [branch name]

### Summary
[1-2 sentence overview of what the PR does]

### Issues Found
| Severity | File | Line | Issue |
|----------|------|------|-------|
| HIGH     | ...  | ...  | ...   |

### Missing Tests
- [function name] in [file] has no test

### Recommendation
APPROVE / REQUEST_CHANGES
```

### Agent 3 — `compliance-auditor` (Hospital-Specific)

File: `.claude/agents/compliance-auditor.md`

```markdown
---
name: compliance-auditor
description: Scans code changes for patient data exposure risks and missing audit logging
tools: Bash, Read, Grep
---

Scan the current git diff (git diff HEAD~1) for compliance issues:

1. PII in logs: search for console.log calls that include patient fields
   (nhsNumber, dateOfBirth, fullName, contactInfo, diagnoses, prescriptions).
   Flag any match as CRITICAL.

2. Missing audit logging: find any POST/PUT/PATCH/DELETE route handler that does NOT
   import or call auditLog middleware. Flag as HIGH.

3. Patient data in error responses: find res.json() calls in catch blocks that might
   include patient document fields. Flag as MEDIUM.

4. Unprotected AI routes: find any route in aiRoutes.js that does NOT call
   authMiddleware. Flag as CRITICAL.

5. Cloudinary URLs in logs: search for console.log near Cloudinary upload calls. Flag as LOW.

Return:

## Compliance Audit Report — [timestamp]

| Severity | File | Line | Issue | Recommendation |
|----------|------|------|-------|----------------|

Overall risk: CLEAR / LOW / MEDIUM / HIGH / CRITICAL

If any CRITICAL issues: output "MERGE BLOCKED — resolve CRITICAL issues before merging."
```

### Using Agents in Your Workflow

**Spawn the test-reporter from the main Claude session:**
```
Ask the test-reporter agent to run all tests and report results.
```

**Spawn pr-reviewer before merging a feature branch:**
```
Ask the pr-reviewer agent to review the feature/ehr-records branch.
```

**Spawn compliance-auditor before every push to main:**
```
Ask the compliance-auditor agent to scan the latest diff for patient data risks.
```

**Run agents in parallel:**
```
Spawn test-reporter and compliance-auditor in parallel, then summarise their combined results.
```

---

## 19. Hooks Deep Dive

### Hook Anatomy — JSON Format

Hooks are defined in `.claude/settings.json` under the `hooks` key:

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "ToolName",
        "hooks": [
          {
            "type": "command",
            "command": "shell command to run"
          }
        ]
      }
    ]
  }
}
```

### Available Hook Events

| Event | When It Fires | Common Use |
|-------|--------------|------------|
| `PreToolUse` | Before Claude calls any tool | Gate checks (block dangerous ops) |
| `PostToolUse` | After a tool call completes | Side effects (create release, notify) |
| `Notification` | When Claude sends a notification | Logging, alerting |
| `Stop` | When Claude finishes its turn | Coverage summary, cleanup |

### Environment Variables Available in Hook Commands

| Variable | Contains |
|----------|---------|
| `$CLAUDE_TOOL_NAME` | Name of the tool being called |
| `$CLAUDE_TOOL_INPUT` | JSON-encoded input to the tool |
| `$CLAUDE_TOOL_RESULT` | JSON-encoded result (PostToolUse only) |

### MediCore's Three Hooks Explained

#### Hook 1 — Pre-push Test Gate

```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "command",
    "command": "echo '$CLAUDE_TOOL_INPUT' | grep -q 'git push' && (cd server && npm run test:unit -- --run) && (cd client && npm run test:unit -- --run) || true"
  }]
}
```

**How it works:**
1. Before every Bash call, the hook checks if the command contains `git push`.
2. If yes: runs server and client unit tests.
3. If tests fail (non-zero exit): Claude Code blocks the Bash tool call. The push never executes.
4. If tests pass: Bash proceeds normally.
5. `|| true` at the end ensures the hook does not fire for non-push commands.

#### Hook 2 — Post-deploy Release Creation

```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "command",
    "command": "echo '$CLAUDE_TOOL_INPUT' | grep -q 'vercel --prod' && TAG=$(git tag --sort=-version:refname | head -1) && [ -n \"$TAG\" ] && gh release create $TAG --generate-notes || true"
  }]
}
```

**How it works:**
1. After every Bash call, checks if the command was `vercel --prod`.
2. If yes: reads the latest git tag.
3. Creates a GitHub Release with auto-generated notes from commits since the previous tag.
4. This means you never need to manually create releases — tag + deploy = done.

#### Hook 3 — Session-end Coverage Snapshot

```json
{
  "hooks": [{
    "type": "command",
    "command": "echo '\\n--- MediCore Coverage Snapshot ---' && cd server && npm run test:coverage -- --silent 2>/dev/null | tail -5 || true"
  }]
}
```

**How it works:**
1. After every Claude Code turn, runs a quick coverage report.
2. Prints the last 5 lines of the coverage table — the overall summary row.
3. You always know your coverage without running `/check-coverage` explicitly.

### Chaining Hooks

You can run multiple commands in one hook by chaining with `&&` or `;`:

```json
{
  "type": "command",
  "command": "echo '$CLAUDE_TOOL_INPUT' | grep -q 'git push' && npx eslint server/src --max-warnings 0 && (cd server && npm run test:unit -- --run) || true"
}
```

This hook: lints → unit tests → only then allows `git push`.

### Debugging Hooks

If a hook blocks unexpectedly:

```bash
# Test the hook command directly in your shell
echo '{"command":"git push origin main"}' | grep -q 'git push' && echo "MATCHED" || echo "NO MATCH"
```

Check the Claude Code activity log:
```bash
cat .claude/activity.log | grep "hook"
```

---

## 20. Appendices

### Appendix A — Full CLAUDE.md Template

```markdown
# Hospital Management System — MediCore General Hospital

## Project Overview
Full-stack MERN hospital management system with AI-powered differential diagnosis,
clinical protocol RAG chatbot, discharge summary generation, and medication interaction
checking. Built for learning Claude Code features: Skills, Agents, Hooks, and MCP.

## Architecture
- client/ — React 18 + Vite (port 5173), Tailwind CSS
- server/ — Node.js + Express REST API (port 5000)
- MongoDB Atlas — cloud database; ProtocolChunk collection is the RAG store
- Cloudinary — lab report and medical imaging file storage
- Anthropic Claude API — six AI features (server-side only)
- RAG pipeline — no external vector DB; MongoDB $text search + Claude synthesis

## Key Commands
- Start backend:  cd server && npm run dev
- Start frontend: cd client && npm run dev
- Seed protocols: cd server && node src/scripts/ingestProtocols.js
- Run all tests:  npm test
- Run unit tests: npm run test:unit
- Build:          cd client && npm run build
- Deploy:         /deploy

## Code Style
- ES modules (import/export) throughout
- async/await over .then() chains
- Commit format: feat:, fix:, chore:, test:, docs:
- Never import @anthropic-ai/sdk in client/ — server-side only

## Testing Requirements
- All controllers: unit tests (mock Anthropic SDK and Cloudinary — never call real APIs in CI)
- All API routes: integration tests using mongodb-memory-server
- Critical flows: E2E tests with Playwright
- Coverage target: 80% lines, 75% branches
- ANTHROPIC_API_KEY=test in CI — any real Anthropic call in a test is a bug

## User Roles and Permissions
- admin        — full system access, user management, reports
- doctor       — EHR create/edit, prescriptions, lab orders, AI assistant, own patients
- nurse        — vitals entry, ward management, medication dispensing, view EHR
- patient      — view own appointments, own records, own invoices only
- receptionist — patient registration, appointment booking, invoice creation
- lab_tech     — process lab orders, upload results, flag abnormal values

## Skills Available
- /create-user-stories <feature description>
- /run-tests
- /unit-test-on-deploy
- /create-release-notes <tag>
- /deploy
- /check-coverage
- /scaffold-server
- /scaffold-client

## Agents Available
- test-reporter       — full test suite with structured output
- pr-reviewer         — diff analysis, security, coverage gaps
- compliance-auditor  — patient data exposure and audit log checks
```

---

### Appendix B — Full `.claude/settings.json`

```json
{
  "permissions": {
    "allow": [
      "Bash(npm *)",
      "Bash(git *)",
      "Bash(npx *)",
      "Bash(vercel *)",
      "Bash(gh *)",
      "Bash(node scripts/*)",
      "Bash(node src/scripts/*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo '$CLAUDE_TOOL_INPUT' | grep -q 'git push' && (cd server && npm run test:unit -- --run) && (cd client && npm run test:unit -- --run) || true"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo '$CLAUDE_TOOL_INPUT' | grep -q 'vercel --prod' && TAG=$(git tag --sort=-version:refname | head -1) && [ -n \"$TAG\" ] && gh release create $TAG --generate-notes || true"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '\\n--- MediCore Coverage Snapshot ---' && cd server && npm run test:coverage -- --silent 2>/dev/null | tail -5 || true"
          }
        ]
      }
    ]
  }
}
```

---

### Appendix C — All 8 Skills Quick Reference

| Skill | Purpose | Tools Used | Has Arguments? |
|-------|---------|-----------|----------------|
| `/scaffold-server` | Create full Express backend tree | Bash, Write | No |
| `/scaffold-client` | Create full React + Vite frontend tree | Bash, Write | No |
| `/create-user-stories` | Gherkin stories + Trello cards | Bash | Yes — feature description |
| `/run-tests` | Full test suite: unit + integration + E2E | Bash | No |
| `/unit-test-on-deploy` | Gate: unit tests only, blocks on failure | Bash | No |
| `/check-coverage` | Coverage report, flags files below threshold | Bash | No |
| `/create-release-notes` | Git log categorisation + GitHub Release | Bash | Yes — version tag |
| `/deploy` | Tests → build → Vercel → release | Bash | No |

---

### Appendix D — GitHub Actions CI/CD YAML (Complete)

```yaml
name: MediCore CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20.x'

jobs:
  test:
    name: Test Suite
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: |
            server/package-lock.json
            client/package-lock.json

      - name: Install dependencies
        run: |
          cd server && npm ci
          cd ../client && npm ci

      - name: Lint server
        run: cd server && npx eslint src/ --max-warnings 0 || true

      - name: Run server unit tests
        run: cd server && npm run test:unit -- --run --reporter=verbose
        env:
          JWT_SECRET: ci_test_secret_medicore
          ANTHROPIC_API_KEY: test_key_mocked_in_unit_tests

      - name: Run server integration tests
        run: cd server && npm test -- --run
        env:
          JWT_SECRET: ci_test_secret_medicore
          ANTHROPIC_API_KEY: test_key_mocked_in_integration_tests

      - name: Run client unit tests
        run: cd client && npm run test:unit -- --run

      - name: Generate server coverage
        run: cd server && npm run test:coverage -- --run
        env:
          JWT_SECRET: ci_test_secret_medicore
          ANTHROPIC_API_KEY: test_key

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./server/coverage/lcov.info,./client/coverage/lcov.info
          flags: medicore
        continue-on-error: true

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      - name: Run E2E tests
        run: npx playwright test
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
          TEST_DOCTOR_EMAIL: ${{ secrets.TEST_DOCTOR_EMAIL }}
          TEST_DOCTOR_PASS: ${{ secrets.TEST_DOCTOR_PASS }}

  build:
    name: Build Check
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      - name: Build client
        run: cd client && npm ci && npm run build
        env:
          VITE_API_URL: https://placeholder.vercel.app/api

  deploy:
    name: Deploy to Vercel
    runs-on: ubuntu-latest
    needs: [test, build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel Production
        run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }} --confirm
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

### Appendix E — Sample Clinical Protocol Documents

Create these 8 files in `server/src/data/clinical-protocols/`:

**`sepsis-management.md`** (excerpt):
```markdown
# Sepsis Management Protocol

## Definition and Recognition
Sepsis is defined as life-threatening organ dysfunction caused by a dysregulated host response
to infection (Sepsis-3 criteria). Suspect sepsis when qSOFA score ≥ 2:
- Respiratory rate ≥ 22/min
- Altered mental status (GCS < 15)
- Systolic blood pressure ≤ 100 mmHg

## Hour-1 Bundle
Upon sepsis recognition, initiate all of the following within 1 hour:
1. Measure lactate. Remeasure if initial lactate > 2 mmol/L.
2. Obtain blood cultures before administering antibiotics.
3. Administer broad-spectrum antibiotics.
4. Begin rapid administration of 30 mL/kg crystalloid for hypotension or lactate ≥ 4 mmol/L.
5. Apply vasopressors if patient remains hypotensive during or after fluid resuscitation.

## Antibiotic Selection
First-line: Piperacillin-tazobactam 4.5g IV every 6 hours
Alternative (penicillin allergy): Meropenem 1g IV every 8 hours
Add Vancomycin 25-30 mg/kg IV loading dose if MRSA suspected.
```

**`medication-administration.md`** (excerpt):
```markdown
# Medication Administration Protocol

## The 5 Rights of Medication Administration
Before every medication administration, verify:
1. Right Patient — check two identifiers: full name + date of birth
2. Right Medication — verify against prescription and original container
3. Right Dose — recalculate weight-based doses; use a second checker for high-risk medications
4. Right Route — oral, IV, IM, SC, topical — confirm route matches prescription
5. Right Time — check last administration time; do not administer early or late by > 30 minutes

## High-Risk Medications — Mandatory Double-Check
The following require independent double-check by two nurses before administration:
- Insulin (all types and routes)
- Heparin (all routes)
- Concentrated electrolytes (KCl > 20 mEq/100ml)
- Opioids > 10mg morphine equivalent
- Chemotherapy agents
```

**`triage-guide.md`** (excerpt):
```markdown
# Manchester Triage System Guide

## Category Definitions

### Immediate (Red) — Target: Now
Life-threatening presentations requiring immediate medical assessment.
Examples: Cardiac arrest, severe respiratory distress, uncontrolled haemorrhage,
major trauma, GCS < 9, anaphylaxis.

### Very Urgent (Orange) — Target: 10 minutes
Presentations that are serious and require rapid assessment.
Examples: Chest pain, stroke symptoms, high fever in infant < 3 months,
severe pain (NRS ≥ 8), active seizure, SBP < 90 mmHg.

### Urgent (Yellow) — Target: 30 minutes
Moderate acuity presentations requiring timely assessment.
Examples: Moderate pain (NRS 5-7), limb injury without neurovascular compromise,
fever in child 3-12 months, moderate respiratory difficulty.

### Standard (Green) — Target: 90 minutes
Non-urgent presentations where a short wait is clinically safe.
Examples: Mild pain (NRS 1-4), chronic condition review, simple wound care.

### Non-Urgent (Blue) — Target: 120 minutes
Presentations appropriate for primary care referral.
Examples: Administrative requests, repeat prescriptions, minor chronic conditions.
```

---

### Appendix F — MongoDB Schema Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│     User     │     │   Patient    │     │  Appointment     │
│──────────────│     │──────────────│     │──────────────────│
│ _id          │──┐  │ _id          │──┐  │ _id              │
│ name         │  │  │ fullName     │  ├──│ patient (ref)    │
│ email        │  ├──│ registeredBy │  │  │ doctor (ref) ────┤──┐
│ password     │  │  │ nhsNumber    │  │  │ scheduledAt      │  │
│ role         │  │  │ allergies[]  │  │  │ status           │  │
│ department   │  │  │ aiSummary{}  │  │  │ type             │  │
│ licenseNumber│  │  └──────────────┘  │  └──────────────────┘  │
└──────────────┘  │                   │                         │
       │          │  ┌────────────────┴────┐                    │
       │          │  │   MedicalRecord     │                    │
       │          │  │─────────────────────│                    │
       │          └──│ patient (ref)       │                    │
       └─────────────│ doctor (ref)        │◄───────────────────┘
                     │ appointment (ref)   │
                     │ chiefComplaint      │
                     │ vitals{}            │
                     │ diagnoses[]         │
                     │ treatmentPlan       │
                     │ aiDifferentials[]   │
                     └──────────┬──────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
   ┌──────────┴───┐   ┌─────────┴────┐   ┌───────┴────────┐
   │ Prescription │   │  LabOrder    │   │    Invoice     │
   │──────────────│   │──────────────│   │────────────────│
   │ medications[]│   │ tests[]      │   │ lineItems[]    │
   │ status       │   │ results[]    │   │ totalAmount    │
   │ dispensedBy  │   │ reportFile   │   │ status         │
   └──────────────┘   └──────────────┘   └────────────────┘

   ┌──────────────┐   ┌─────────────────┐
   │     Ward     │   │ ProtocolChunk   │
   │──────────────│   │─────────────────│
   │ name         │   │ source          │
   │ type         │   │ section         │
   │ beds[]       │   │ chunkIndex      │
   │   .patient───┼───│ content ($text) │
   │   .status    │   │ wordCount       │
   └──────────────┘   └─────────────────┘
```

---

### Appendix G — Role-Permission Matrix

| Route | admin | doctor | nurse | patient | receptionist | lab_tech |
|-------|-------|--------|-------|---------|--------------|----------|
| POST /api/auth/register | ✓ | | | | | |
| POST /api/auth/login | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GET /api/patients | ✓ | ✓ | ✓ | | ✓ | |
| POST /api/patients | ✓ | | | | ✓ | |
| GET /api/patients/:id | ✓ | ✓ | ✓ | own | ✓ | |
| PATCH /api/patients/:id | ✓ | | | | ✓ | |
| GET /api/appointments | ✓ | own | ✓ | own | ✓ | |
| POST /api/appointments | ✓ | | | | ✓ | |
| PATCH /api/appointments/:id/status | ✓ | ✓ | ✓ | cancel only | ✓ | |
| GET /api/medical-records | ✓ | own patients | ✓ | own | | |
| POST /api/medical-records | ✓ | ✓ | | | | |
| PATCH /api/medical-records/:id | ✓ | owner | | | | |
| GET /api/prescriptions | ✓ | ✓ | ✓ | own | | |
| POST /api/prescriptions | ✓ | ✓ | | | | |
| PATCH /api/prescriptions/:id/dispense | ✓ | | ✓ | | | |
| GET /api/lab-orders | ✓ | ✓ | ✓ | own | | ✓ |
| POST /api/lab-orders | ✓ | ✓ | | | | |
| PATCH /api/lab-orders/:id/results | ✓ | | | | | ✓ |
| GET /api/invoices | ✓ | | | own | ✓ | |
| POST /api/invoices | ✓ | | | | ✓ | |
| GET /api/wards | ✓ | ✓ | ✓ | | | |
| PATCH /api/wards/:id/beds/:bedId | ✓ | ✓ | ✓ | | | |
| GET /api/users | ✓ | | | | | |
| POST /api/users | ✓ | | | | | |
| PATCH /api/users/:id/deactivate | ✓ | | | | | |
| POST /api/ai/differential-diagnosis | ✓ | ✓ | | | | |
| POST /api/ai/summarize-record | ✓ | ✓ | ✓ | | | |
| POST /api/ai/discharge-summary | ✓ | ✓ | | | | |
| POST /api/ai/check-interactions | ✓ | ✓ | ✓ | | | |
| POST /api/ai/parse-appointment | ✓ | ✓ | ✓ | ✓ | ✓ | |
| POST /api/ai/protocol-chat | ✓ | ✓ | ✓ | | | |

**Key:** ✓ = full access · `own` = own records only · `owner` = created by this user · blank = no access

---

*MediCore Hospital Management System — Complete Claude Code Guide*
*Built with Claude Code, Anthropic Claude API, and the MERN stack*
*March 2026*

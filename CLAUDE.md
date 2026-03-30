# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Hospital Management System — MediCore General Hospital

## Project Overview
Full-stack MERN hospital management system with AI-powered differential diagnosis, clinical protocol RAG chatbot, discharge summary generation, and medication interaction checking. Built to demonstrate Claude Code features: Skills, Agents, Hooks, and MCP.

## Architecture
- `client/` — React 18 + Vite (port 5173), Tailwind CSS, React Router, Axios, Recharts
- `server/` — Node.js + Express REST API (port 5000)
- MongoDB Atlas — cloud database; `ProtocolChunk` collection is the RAG store (no external vector DB — uses MongoDB `$text` search + Claude synthesis)
- Cloudinary — lab report and medical imaging file storage
- Anthropic Claude API — six AI features, **server-side only**
- JWT auth with role-based access control; audit middleware logs all write operations

## Key Commands
```bash
cd server && npm run dev              # Start Express backend (port 5000)
cd client && npm run dev              # Start React + Vite frontend (port 5173)
cd server && node scripts/ingestProtocols.js  # Seed RAG store (run once after first deploy)
npm test                              # Run full test suite
npm run test:unit                     # Run unit tests only
cd client && npm run build            # Build frontend for production
```
Deploy via `/deploy` skill (runs tests → build → Vercel → creates GitHub Release).

## Code Style
- ES modules (`import`/`export`) throughout — no CommonJS
- `async`/`await` over `.then()` chains
- Commit format: `feat:`, `fix:`, `chore:`, `test:`, `docs:`

## Testing
- **Unit**: Mock Anthropic SDK and Cloudinary — never call real APIs in CI (`ANTHROPIC_API_KEY=test_key_mocked`)
- **Integration**: Use `mongodb-memory-server` — no external DB during CI
- **E2E**: Playwright for critical flows
- Coverage target: 80% lines, 75% branches
- Run a single test: `cd server && npx vitest run src/tests/controllers/patientController.test.js`

## Architecture Details

### Backend (`server/src/`)
- `config/` — DB, Cloudinary, Anthropic SDK singleton, Nodemailer transporter
- `models/` — 9 Mongoose schemas: `User`, `Patient`, `Appointment`, `MedicalRecord` (with `$text` index for RAG), `Prescription`, `LabOrder`, `Invoice`, `Ward`, `ProtocolChunk`
- `controllers/aiController.js` — all 6 AI features
- `middleware/` — `authMiddleware.js` (JWT), `roleMiddleware.js` (RBAC), `auditMiddleware.js` (write logging), `rateLimit.js` (10 req/min on `/api/ai/*`)
- `scripts/ingestProtocols.js` — chunks `data/clinical-protocols/*.md` into `ProtocolChunk` collection

### Frontend (`client/src/`)
- `context/AuthContext.jsx` — global auth state
- `api/axios.js` — Axios instance with JWT interceptor
- `hooks/useSSE.js` — Server-Sent Events hook for AI streaming
- `components/AIAssistantPanel.jsx` — differential diagnosis streamer
- `components/DiagnosisChatbot.jsx` — floating RAG chatbot
- `components/InteractionWarning.jsx` — drug interaction modal

### Six AI Features
1. **Differential Diagnosis** — Sonnet, streaming SSE, ranked diagnoses with confidence scores
2. **Medical Record Summarization** — Haiku, JSON mode, cached on `Patient.aiSummary`
3. **Discharge Summary Generator** — Sonnet, streaming, saved to Cloudinary
4. **Medication Interaction Checker** — Haiku, JSON mode, checked before prescription save
5. **Natural Language Appointment Scheduling** — Haiku, JSON intent parsing
6. **Clinical Protocol RAG Chatbot** — two-Claude pipeline: Haiku extracts keywords → MongoDB `$text` search → Sonnet synthesizes answer with citations

## User Roles
- `admin` — full system access, user management, reports
- `doctor` — EHR, prescriptions, lab orders, AI assistant
- `nurse` — vitals entry, ward management, medication dispensing
- `patient` — view own appointments, records, invoices
- `receptionist` — patient registration, appointment booking
- `lab_tech` — process lab orders, upload results

## Skills Available
- `/scaffold-server` — generate full Express backend
- `/scaffold-client` — generate full React + Vite frontend
- `/create-user-stories <feature>` — generate Gherkin stories + Trello cards
- `/run-tests` — run full test suite
- `/unit-test-on-deploy` — gate deployments with tests
- `/check-coverage` — coverage report with thresholds
- `/create-release-notes <tag>` — auto-generate release notes
- `/deploy` — complete deployment pipeline (test → build → Vercel → GitHub Release)

## Environment Variables (server/.env)
`ANTHROPIC_API_KEY`, `MONGODB_URI`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `EMAIL_USER`, `EMAIL_PASS`

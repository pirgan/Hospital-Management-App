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
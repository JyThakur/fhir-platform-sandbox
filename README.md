# 🏥 FHIR Learning Platform — Open Source FHIR R4 Practice Environment

[![FHIR R4](https://img.shields.io/badge/FHIR-R4-blue?style=flat-square)](https://hl7.org/fhir/R4/)
[![US Core](https://img.shields.io/badge/US%20Core-6.1-green?style=flat-square)](https://hl7.org/fhir/us/core/)
[![HL7 Validator](https://img.shields.io/badge/Validator-hapi.fhir.org-orange?style=flat-square)](https://hapi.fhir.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![No Backend](https://img.shields.io/badge/Backend-None%20Required-lightgrey?style=flat-square)](https://github.com)
[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-black?style=flat-square&logo=github)](https://pages.github.com/)

> **A fully browser-based, zero-backend FHIR R4 learning environment.**
> Send real FHIR orders from a simulated clinician platform, receive and report results on a simulated vendor/lab platform, validate against the official HL7 FHIR validator, and practice with FHIR resources used in US healthcare interoperability.

---

## 🎯 Who Is This For?

| Audience | How it helps |
|---|---|
| **HL7 / FHIR learners** | Practice the full order→result workflow with real FHIR R4 resources in your browser |
| **Healthcare IT students** | Understand how EHR ↔ Lab/Radiology messaging works using standard FHIR resources |
| **Developers** | Prototype FHIR integrations, test resource structures, explore US Core profiles |
| **Interoperability engineers** | Reference implementation of ServiceRequest → DiagnosticReport + Observation bundles |
| **FHIR trainers / educators** | Live demo environment — no server setup, no credentials, open in browser and go |

---

## ✨ What You Can Do

### On the Client Platform (Clinician / EHR side)
- 📋 **Create FHIR ServiceRequests** — form mode, JSON editor, or XML editor
- 📤 **Send orders** to the vendor platform in real time (BroadcastChannel API)
- 👤 **Store Patient demographics** — full name from `name[]`, MRN from `identifier[]`
- 📊 **View DiagnosticReport results** — observation table with flags, reference ranges
- ✅ **Validate any FHIR resource** — live call to `hapi.fhir.org` (same engine as inferno.healthit.gov)
- 🔍 **Search 158+ codes** across LOINC · SNOMED CT · ICD-10 · RxNorm · CPT · RadLex
- 🤖 **FHIR IntelliSense** — VSCode-style Ctrl+Space autocomplete in all JSON editors

### On the Vendor Platform (Lab / Radiology side)
- 📥 **Receive orders** instantly with patient demographics banner
- 🧪 **Build DiagnosticReport bundles** — lab, radiology, pathology, microbiology
- 📎 **Attach files** — DICOM, PDF, JPEG, HL7 v2
- 📤 **Send results** back to the client with structured Observations
- 🔬 **FHIR Composer** — transmit any of 9 resource types directly to a FHIR server

### Shared Features
- ⌨️ **Code editor behaviour** — Tab indent, `{`→`{}` auto-close, Enter auto-indent (VSCode-style)
- 🏷️ **Patient demographics** parsed from full FHIR Patient resource (`name[]`, `identifier[]` MRN, DOB, gender)
- 📱 **Responsive** — works on mobile and tablet

---

## 🚀 Live Demo

```
https://jythakur.github.io/fhir-platform-sandbox/
```

Open two browser tabs — one for Client, one for Vendor — and watch real FHIR resources flow between them.

---

## ⚡ Quick Start (30 seconds)

1. **Download** `fhir-client-platform.html` and `fhir-vendor-platform.html`
2. **Open both** in the same browser in different tabs
3. On **Client**: Create Order → Send
4. On **Vendor**: Order appears in Inbox → Accept → Build Report → Send Result
5. On **Client**: DiagnosticReport appears in Observations

No installation. No server. No credentials.

---

## 📁 Repository Structure

```
fhir-platform/
├── index.html                  ← Landing page + bridge status dashboard
├── fhir-client-platform.html   ← Client Platform (clinician / EHR side)
├── fhir-vendor-platform.html   ← Vendor Platform (lab / radiology / pharmacy)
├── fhir-bridge.js              ← Messaging layer (also inlined into both HTML files)
├── .nojekyll                   ← Prevents GitHub Pages Jekyll processing
└── README.md
```

> Each HTML file is **self-contained** — the bridge is inlined so you can open either file directly from your desktop as a `file://` URL with no web server needed.

---

## 🏗️ Architecture

```
BROWSER TAB 1                              BROWSER TAB 2
fhir-client-platform.html                 fhir-vendor-platform.html
┌─────────────────────────┐               ┌──────────────────────────┐
│  Create Order           │               │  Inbox                   │
│  (ServiceRequest R4)    │──── ORDER ──► │  Patient demographics    │
│                         │               │  banner                  │
│  Patient demographics   │               │                          │
│  (stored from Patient   │               │  Accept → Report Builder │
│   FHIR resource)        │               │  (DiagnosticReport +     │
│                         │               │   Observation Bundle)    │
│  Observations page      │               │                          │
│  (DiagnosticReport      │◄── RESULT ─── │  Attach DICOM/PDF/HL7    │
│   + Observation cards)  │               │                          │
│                         │               │  FHIR Composer           │
│  FHIR Validator         │               │  (9 resource types)      │
│  (live hapi.fhir.org)   │               │                          │
└─────────────────────────┘               └──────────────────────────┘
              │                                        │
              └────────────────┬───────────────────────┘
                               │
                     ┌─────────┴──────────┐
                     │   fhir-bridge.js   │
                     │                    │
                     │  localStorage      │ ← persists across reloads
                     │  BroadcastChannel  │ ← instant cross-tab delivery
                     │  Storage events    │ ← Safari / file:// fallback
                     │  File Store        │ ← base64 attachments ≤4MB
                     └────────────────────┘
```

---

## 🔬 FHIR Resources Covered

| Resource | Platform | Direction | US Core Profile |
|---|---|---|---|
| `Patient` | Both | Reference | US Core Patient |
| `Practitioner` | Client | Reference | US Core Practitioner |
| `Organization` | Both | Reference | US Core Organization |
| `ServiceRequest` | Client → Vendor | Order | US Core ServiceRequest |
| `DiagnosticReport` | Vendor → Client | Result header | US Core DiagnosticReport Lab |
| `Observation` | Vendor → Client | Individual results | US Core Observation Lab |
| `Bundle` (transaction) | Vendor → Client | Result container | — |
| `Specimen` | Both | Sample info | — |
| `Media` | Vendor → Client | DICOM / imaging | — |
| `DocumentReference` | Vendor → Client | PDF / HL7 | US Core DocumentReference |
| `ImagingStudy` | Vendor | DICOM reference | — |
| `Task` | Both | Workflow tracking | — |
| `OperationOutcome` | Validator | Errors/warnings | — |
| `CapabilityStatement` | Raw Editor | Server metadata | — |
| `CarePlan` | FHIR Composer | Care coordination | — |
| `MedicationRequest` | FHIR Composer | Prescriptions | US Core MedicationRequest |
| `AllergyIntolerance` | FHIR Composer | Allergy record | US Core AllergyIntolerance |
| `Immunization` | FHIR Composer | Vaccination record | US Core Immunization |

---

## 🇺🇸 US FHIR / US Core

This platform is designed with US healthcare interoperability in mind:

- **US Core 6.1** profiles referenced throughout
- **ONC Certification** testing: the built-in validator uses `hapi.fhir.org` — the same HL7 Java FHIR Validator as [inferno.healthit.gov](https://inferno.healthit.gov/validator/)
- **USCDI v3 data classes**: Clinical Notes, Diagnostic Reports, Laboratory, Medications, Patient Demographics, Problems, Procedures
- **SMART on FHIR** auth fields in Settings (for connecting to real US EHR systems)
- **NPI** field for Practitioner (10-digit National Provider Identifier)
- **MRN identifier** type `http://terminology.hl7.org/CodeSystem/v2-0203` code `MR` correctly parsed and displayed

### US FHIR Sandbox Endpoints

| Server | Base URL | Auth |
|---|---|---|
| HAPI FHIR Public (R4) | `https://hapi.fhir.org/baseR4` | None |
| Cerner Open Sandbox | `https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d` | None |
| Epic Sandbox | `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4` | OAuth 2.0 |
| Azure Health Data Services | `https://YOUR_INSTANCE.fhir.azurehealthcareapis.com` | Azure AD |
| AWS HealthLake | `https://healthlake.YOUR_REGION.amazonaws.com/datastore/YOUR_ID/r4/` | AWS SigV4 |

---

## 🧪 Practice Scenarios

### Scenario 1 — Basic Lab Order *(Beginner)*
Create a CBC order from the Client, receive it on the Vendor, build a DiagnosticReport with 10 Observations (WBC, RBC, Haemoglobin, Haematocrit, MCV, MCH, MCHC, Platelets, Neutrophils, Lymphocytes), send back, view on Client.

### Scenario 2 — Full Patient Record *(Intermediate)*
Paste a complete FHIR Patient resource (with `name[]`, `identifier[]`, `telecom`, `address`) on the Client side. Both platforms will parse and display the full demographics banner including MRN, DOB, gender, emergency contact.

### Scenario 3 — FHIR Validation *(Intermediate)*
Use the Validator page on the Client to validate any FHIR resource against the live HL7 validator. Review `OperationOutcome` issues, fix them, and re-validate until clean.

### Scenario 4 — Radiology Workflow *(Advanced)*
Send a CT imaging request (`24725-4`), receive it on the Vendor, build a Radiology DiagnosticReport with findings/impression text, attach a JPEG, send back an ImagingStudy reference.

### Scenario 5 — US Core Conformance *(Advanced)*
Build a fully US Core 6.1-compliant Patient, ServiceRequest, and DiagnosticReport. Validate each against `hapi.fhir.org` targeting zero errors on the base R4 profile.

---

## 🗓️ Deploy to GitHub Pages

```bash
# 1. Create a public repo at github.com/new named fhir-platform
# 2. Upload all files
git clone https://github.com/jythakur/fhir-platform-sandbox.git
cd fhir-platform-sandbox
# copy the files here, then:
git add .
git commit -m "Initial release — FHIR Learning Platform"
git push origin main
# 3. Settings → Pages → Source: main / (root) → Save
# 4. Visit: https://jythakur.github.io/fhir-platform-sandbox/
```

---

## 🤝 Contributing

Contributions welcome! Some ideas:

- [ ] Add US Core profile-specific validation (select profile URL)
- [ ] Add more resources: MedicationAdministration, Condition, Procedure
- [ ] Add a SMART on FHIR launch flow demo
- [ ] Add bulk FHIR export (ndjson)
- [ ] Add CDA → FHIR conversion example
- [ ] Add HL7 v2 → FHIR mapping demo (ADT^A01, ORU^R01, ORM^O01)
- [ ] Expand code search database (more LOINC, SNOMED, NDC)

```bash
git clone https://github.com/jythakur/fhir-platform-sandbox.git
# Edit the HTML files
# Test by opening both in the same browser
# Submit a pull request
```

---

## 📚 Learning Resources

| Resource | URL |
|---|---|
| HL7 FHIR R4 Specification | https://hl7.org/fhir/R4/ |
| US Core IG 6.1 | https://hl7.org/fhir/us/core/ |
| FHIR Downloads (schemas) | https://build.fhir.org/downloads.html |
| Inferno FHIR Validator | https://inferno.healthit.gov/validator/ |
| HAPI FHIR (open source server) | https://hapifhir.io/ |
| LOINC code search | https://loinc.org/search/ |
| SNOMED CT browser | https://browser.ihtsdotools.org/ |
| ICD-10 lookup | https://icd.who.int/browse10/2019/en |
| ONC USCDI | https://www.healthit.gov/isa/united-states-core-data-interoperability-uscdi |
| SMART on FHIR | https://smarthealthit.org/ |
| FHIR Community Chat | https://chat.fhir.org/ |

---

## 📄 License

MIT — free to use, modify, and share for education, research, and development.

---

## 🙏 Acknowledgements

- **HL7 International** for the FHIR specification
- **HAPI FHIR team** for the open-source Java validator and public test server
- **ONC / Inferno team** for the validator.fhir.org infrastructure and US Core tooling
- **The global FHIR community** at chat.fhir.org

---

<div align="center">

**Built for the FHIR community — learn, practice, and build better healthcare interoperability.**

⭐ Star this repo if it helped you learn FHIR  ·  🍴 Fork it to build your own scenarios

[Open Client Platform](fhir-client-platform.html) · [Open Vendor Platform](fhir-vendor-platform.html)

</div>

```
## Feature: Submit New Idea — Full Assessment Wizard

### Overview
Add a complete "Submit New Idea" flow to the Automation Hub portal.
Business users submit automation candidates through a structured wizard that:
- Maps the idea to the company APQC process taxonomy
- Collects volumetry, complexity, systems, and AI-readiness data
- Automatically computes ROI, Feasibility Score, and Technology Category
- Classifies the idea and routes it to the correct pipeline lane

---

### Data Source — APQC Taxonomy
File: `data/raw/K07122_Life_Sciences_v722_vsLife_Sciences_v721_2025.xlsx`
Standard: APQC Process Classification Framework, Life Sciences edition.
Hierarchy: L1 → L2 → L3 (cascading, each level filters the next).
Analyse the file structure yourself, design DB tables, and write an idempotent 
ingestion script runnable via npm script with summary log output.

---

### Wizard Structure — 7 Steps

**Step 1 — Basic Info**
- Idea title
- Submitter name

**Step 2 — Process Mapping**
- Cascading dropdowns: L1 → L2 → L3 from APQC taxonomy
- L2 disabled until L1 selected; L3 disabled until L2 selected

**Step 3 — Process Overview & Business Goals**
- Primary goal: Cost Reduction | Speed/SLA | Error Reduction | Compliance | Employee Satisfaction
- Process stability (next 6 months): No Change | Minor Tweak | Moderate Change | Major Overhaul Planned
- System stability (next 6 months): No Change | Minor Patch | Platform Migration Planned

**Step 4 — Volumetry & Human Effort**
- Task frequency: Daily | Weekly | Monthly | Quarterly | Yearly
- Transaction volume per cycle (number)
- Headcount in FTEs (number)
- Avg. time per task in minutes (number)
- Error rate % (number)
- Avg. rework time in minutes (number)
- Audit rate % (number)
- Avg. loaded FTE cost per year in EUR (number)

**Step 5 — Complexity & Standardisation**
- Number of steps: 1–5 | 6–15 | 16–30 | 31+
- Decision logic: 100% Rule-Based | Mostly Rules, Few Exceptions | Requires Subjective Judgment
- Process variations: 1 Standard Path | 2–3 Paths | 4–5 Paths | 6+ Custom Paths

**Step 6 — Systems & Environment**
- Primary input format: Structured Digital (Excel/DB/API) | Unstructured Digital (PDF/Email) | Physical Paper
- Number of systems: 1 | 2–3 | 4–5 | 6+
- System interface: API Available | Web/Desktop GUI | Mainframe/Legacy | Citrix/Virtual Desktop

**Step 7 — AI Assessment**
- Unstructured data: No (Tabular/Structured) | Yes - Standard Forms | Yes - Free Text (Emails/Contracts)
- Cognitive reasoning required: No (Strict If/Then) | Yes (Summarization/Sentiment/Extraction)
- Computer vision / OCR: No | Yes - Native OCR | Yes - Advanced AI Vision/Handwriting
- AI output risk tolerance: Strict 0% Tolerance | Moderate (Human-in-the-Loop) | High (Generative output acceptable)

**Step 8 — Review & Submit**
- Full summary of all answers
- Live preview of computed scores (see Scoring below)
- Back navigation without data loss
- Submit → save to DB → redirect to pipeline

---

### Scoring Engine (computed server-side on submit)

**ROI Calculation**
```
Frequency factors: Daily=250 | Weekly=52 | Monthly=12 | Quarterly=4 | Yearly=1

Annual Transactions     = Volume × Frequency Factor
Base Manual Hours/Year  = (Annual Transactions × Avg Time per Task) / 60
Rework Hours/Year       = (Annual Transactions × Error Rate × Avg Rework Time) / 60
Total Hours Saved/Year  = Base Manual Hours + Rework Hours
Hourly Rate             = Avg Loaded FTE Cost / (250 × 8)
Gross Financial ROI     = Total Hours Saved × Hourly Rate
```

**Feasibility Score (starts at 100, subtract penalties)**
```
Major Overhaul Planned        → -30
Platform Migration Planned    → -20
Requires Subjective Judgment  → -25
6+ Custom Paths               → -20
Citrix / Virtual Desktop      → -15
Physical Paper input          → -15
```
Bands: High ≥ 80 | Medium 50–79 | Low < 50

**Technology Category (from Step 7 answers)**
```
No unstructured data + no reasoning → Traditional RPA
Unstructured data, standard forms   → RPA + AI Document Understanding
Free text / reasoning required      → GenAI / Agentic (LLM + Automation)
```

**Final Classification**
```
High feasibility + High ROI   → Quick Win         (prioritise immediately)
Medium feasibility + High ROI → Strategic Investment (AI / Human-in-the-Loop)
High feasibility + Low ROI    → Low-Hanging Fruit  (citizen developer candidate)
Low feasibility + any ROI     → Deprioritise / Avoid
```

ROI threshold for High vs Low is relative — use median of submitted ideas 
or a configurable threshold (store in app config, default €50,000/year).

---

### Idea Data Model
Store all wizard answers plus all computed outputs:
- All Step 3–7 inputs
- annual_transactions, base_hours, rework_hours, total_hours_saved, gross_roi
- feasibility_score, feasibility_band
- technology_category
- final_classification
- Status lifecycle: Draft → Submitted → Under Review → Approved / Rejected

---

### Pipeline Page `/ideas`
Display submitted ideas as cards or table.
Each card shows: title, submitter, L1→L2→L3 path, classification badge, 
feasibility band, gross ROI (formatted), status, submission date.
Clicking a card opens a read-only detail view with all answers and scores.

---

### Quality Bar
- All computations run server-side; client shows a live preview on Step 8 
  via a lightweight client-side mirror of the same formulas
- Step cannot advance if required fields are missing
- Wizard state preserved on back-navigation
- Ingestion script idempotent, with run summary (L1/L2/L3 counts)
- No authentication required
```
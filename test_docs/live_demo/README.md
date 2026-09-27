# Live demo documents

Five fictional documents on topics GLM-5.3-Flash cannot know from training. Any correct, specific answer
therefore has to come from the document you upload on stage. Open each PDF on screen first, then upload it.

## Before the talk
- Start the server under `caffeinate -i` so the laptop does not sleep.
- In the app, open **Domain Expert → Live Demo**. It starts empty.
- Keep this folder open in Finder next to the browser.

## The flow to show (for each document)
1. Open the PDF so the audience sees what is in it.
2. Click **Documents**, choose **Upload into: Live Demo**, drop the PDF.
3. Point at the live **ingest.log**: pages rendered, text layer found (or GLM vision reading a scan),
   hidden text quarantined, passages chunked, bge-m3 dense + sparse embeddings, stored in Qdrant.
4. Close the panel and ask a question. Open the **Sources** under the answer and the **pipeline** line:
   hybrid search, rerank, GLM-5.3-Flash, citation check.

Tip for contrast: ask one question **before** uploading. The expert answers from general knowledge and
cannot know these facts; after the upload it answers precisely, with a citation.

## Documents and questions

| File | Shows | Ask | Expected answer |
|---|---|---|---|
| `01_project_kaatru_launch_brief.pdf` | Typed PDF, tables | When does Project Kaatru launch and how many sensors are there? | 12 November 2026, 240 sensors in 18 wards |
| | | What does a Red alert mean in the Kaatru app? | PM2.5 61-120 µg/m³: reduce outdoor activity, schools move sports indoors |
| `02_aurora_x2_water_meter_spec.pdf` | Specs and error codes | My Aurora meter shows E04. What should I do? | Burst (flow above 1.5 × Q3 for 30 min): close the inlet valve, call the utility |
| | | How long does the Aurora X2 battery last? | 12 years at one reading per hour |
| `03_incident_report_upi_outage.pdf` | Root-cause reasoning | Why did the UPI outage on 14 August happen? | A 30 s timeout (was 2 s) exhausted the 200-connection pool when the bank switch slowed |
| | | How long did it last and how many payments failed? | 47 minutes, about 18,400 failed attempts |
| `04_hackathon_rules_scanned.pdf` | **Scanned page read by GLM vision**, English + Tamil | What are the hackathon prize amounts? | ₹1,50,000 / ₹75,000 / ₹50,000 best student team |
| | | அணியில் எத்தனை பேர் இருக்கலாம்? | Answer in Tamil: 2 to 4 people |
| `05_vendor_quotation_hidden_text.pdf` | **Hidden white-text injection** | What are the payment terms in the sensor quotation? | 30% on PO, 60% on delivery, 10% after calibration |

For document 05 the upload log shows **hidden text quarantined** as it happens. Open the Documents panel and
click the red badge to show the hidden instruction (pay 100% in advance to an account). Ask about payment
terms: the answer gives the real terms. Turn **Defence Off** and ask again to show what happens without it.

Uploading documents 01, 02, 03 and 05 makes no model calls. Document 04 is a scan, so uploading it makes one
GLM vision call; the result is cached, so uploading it again is free.

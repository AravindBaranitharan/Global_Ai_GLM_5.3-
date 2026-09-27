# Design doc: Customer Support Assistant

Owner: Support platform · Status: draft

## Summary
An assistant that answers customer questions from our help-centre articles and drafts replies
for human agents to approve.

## Data
- Conversation transcripts, stored for 60 days in the Mumbai region, encrypted with AES-256.
- Customer identifiers are pseudonymised before transcripts reach the analytics warehouse.
- Support call recordings are not used.

## Architecture
- Retrieval over help-centre articles (Public data only).
- The language model is self-hosted in our Mumbai VPC; no data leaves India.
- Drafted replies are never sent automatically; an agent approves each one.
- Access to transcripts is limited to the support-quality role and reviewed every quarter.

## Privacy
- A DPIA was completed on 2 September 2026 and approved by the privacy office.
- Customers can ask for their transcripts to be deleted from the help widget; requests are
  processed automatically within 7 days.
- Suspected breaches follow the incident runbook, which alerts the privacy office immediately.

# LERS Request and Response Template Analysis

## Purpose

The two new templates materially change the build plan because they provide:

1. a realistic **input document shape** for legal request ingestion
2. a realistic **output document shape** for response package drafting

The request template should be treated as synthetic/example material, not legal advice or a final production SOP.

## LERS Request Template — what it adds

The request template is a search warrant / ex parte court order format for Google data. It includes instruction text, placeholder text, legal authority references, requested data categories, identifiers, special handling, and court order language.

### Important intake fields

| Field group | Examples to extract |
|---|---|
| Court / jurisdiction | County of Larimer, State of Colorado, Combined Court |
| Legal process type | Search warrant, ex parte court order, pen register, trap and trace, location information order |
| Recipient | Google LLC, Google Legal Investigations Support, LERS |
| Affiant / officer | name, title, agency, badge number, contact information |
| Requesting agency | agency name, address, phone, email |
| Subject account | Gmail account, Google ID / UID |
| Device identifiers | ESN, IMEI, MEID, MAC ID |
| Date range | “Between the dates of DATE OF INTEREST through DATE OF INTEREST” |
| Offense | listed criminal offenses |
| Legal authority | 18 U.S.C. §2703, 18 U.S.C. §§3122 and 3123, C.R.S. §16-3-301, §16-3-301.1, §16-3-303.5, Crim. P. 41 |
| Production deadline | records produced within 35 days of service |
| Service deadline | order must be served within 14 days after issuance |
| Pen register period | 60 days or until investigation is complete |
| Ongoing access cadence | daily / once every 15 minutes in the template language |
| Non-disclosure period | one year unless otherwise ordered |
| Special handling | seal order, no adverse action, no subscriber disclosure |

## Requested data categories

The request template includes a broad list of Google data categories. CaseFlow should not automatically produce these, but it should detect and classify them.

| Category | Examples |
|---|---|
| Subscriber info | name, DOB, gender, contact email, address, phone, personal identifiers |
| Account creation and login | account creation date, length of service, registration IP, Port IDs |
| Associated accounts | other Gmail addresses, accounts linked by device or cookie |
| Device identifiers | ESN, ICCID, IMSI, IMEI, MAC, activation dates |
| Google Cloud / Google One | data collected in connection with associated devices |
| Chromebook | data collected from associated Chromebook devices |
| Activity data | web and app activity, voice/audio activity, YouTube search/watch/comment/stories |
| Location data | GPS, cell site/cell tower, Wi-Fi, SensorVault, coordinates, timeline |
| Semantic Location History | activity, start/end location, duration, distance, waypoints, places visited, location confidence |
| Email contents | sent/received/deleted/stored/preserved/draft emails and attachments |
| Photos/videos | stored/captured media and metadata |
| Services used | Maps, Duo, Hangouts, Chrome, Home, Drive, Nest, Play, Photos, Voice, YouTube |
| Google Voice | call detail records, SMS/MMS, voicemail |
| Calendar | calendars, entries, notes, alerts, invites |
| Contacts | names, phone numbers, emails, social links, images |
| Docs/Sheets/Slides | files created/shared/downloaded |
| Support communications | records of communications between Google and any person regarding the account |
| Decryption info | keys or info necessary to decrypt produced data, when available |
| Privacy/security | privacy settings, verification methods, 2FA phone |
| Payments | payment methods, purchase history, subscriptions |
| Tombstone archive | deleted account data archive |

## Special handling flags to detect

These should become first-class fields in the data model.

```json
{
  "sealed": true,
  "non_disclosure_to_subscriber": true,
  "no_adverse_action": true,
  "pen_register_requested": true,
  "trap_and_trace_requested": true,
  "ongoing_access_requested": true,
  "location_tracking_requested": true,
  "content_requested": true,
  "tombstone_requested": true,
  "production_deadline_days": 35,
  "service_deadline_days": 14,
  "nondisclosure_period": "one_year"
}
```

## Template LERS Response — what it adds

The response template gives the expected output contract for a production package.

### Output sections

| Section | Fields |
|---|---|
| Header | Request ID, Production ID, Date Produced |
| Requesting agency | Agency, Case Number, Officer, Legal Process, Date Received |
| Subject identifiers | Account ID, Customer Reference, Associated Device ID |
| Production summary | Start Date, End Date, Total Responsive Records, ordinary-course-of-business statement |
| Index of produced records | Record ID, Timestamp UTC, Latitude, Longitude, Accuracy, Source |
| Data field definitions | Timestamp, Latitude, Longitude, Accuracy, Source |
| Chain of custody | Collection Date, Collection Method, Collected By, Review Status |
| Production certification | Authorized Representative, title, certification language |
| End marker | End of production package |

## Response package object

```json
{
  "request_id": "LER-2026-004812",
  "production_id": "PROD-2026-004812-01",
  "date_produced": "2026-06-09",
  "requesting_agency": {
    "agency": "Los Angeles County Sheriff's Office",
    "case_number": "MC-26-11784",
    "officer": "Detective Sarah Johnson",
    "legal_process": "Search Warrant John Doe",
    "date_received": "2026-06-01"
  },
  "subject_identifiers": {
    "account_id": "ACC-7784512",
    "customer_reference": "CUST-992181",
    "associated_device_id": "DEV-88471"
  },
  "production_summary": {
    "start_date": "2026-05-10T00:00:00Z",
    "end_date": "2026-05-15T23:59:59Z",
    "total_responsive_records": 8
  },
  "records": [],
  "chain_of_custody": {
    "collection_date": "2026-06-08",
    "collection_method": "Internal Location Data Repository Query",
    "collected_by": "Legal Response Operations Team",
    "review_status": "Reviewed and Approved"
  },
  "certification": {
    "authorized_representative": "Jane Doe",
    "title": "Legal Operations Analyst",
    "certification_text": "I certify that the attached records were retrieved..."
  }
}
```

## Product implications

1. The app needs a request extraction layer, not just email parsing.
2. The app needs a response package draft layer, not just email drafting.
3. Requested data category detection is critical.
4. Product/domain segmentation should power governance metrics.
5. Special handling flags should drive review/escalation logic.
6. Chain of custody and certification should be visible but always human-approved.
7. The demo should use synthetic data and never real PII.

## Required caution

The LERS Request Template contains placeholder and instructional text. The agent must be able to identify and ignore template instructions such as “PLEASE DELETE,” “YOUR NAME HERE,” and placeholder account/date/offense text when running extraction.

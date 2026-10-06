# Project status — read this first after a break

Last updated: 6 October 2026

This document is a handover note. It explains where the project is, what has been
decided, what is still open, and what should happen next. Read this file before
changing any code.

---

## 1. What this project is

An internal production tracker for a pashmina / fine-wool shawl business that makes
**shawls, stoles and lohis**.

The work is subcontracted across several external partners. The company sends work
out, receives it back, inspects it at each step, separates defective pieces, and
sends the good pieces onward until they are ready for sale.

The current codebase is an **early prototype** written as plain HTML, CSS and
JavaScript. It runs locally, works offline, and saves data in the browser.

---

## 2. Git and GitHub state (working)

| Item | Value |
| --- | --- |
| Local folder | `E:\confidential E drive\146enterprises` |
| GitHub repository | https://github.com/ykmsvikas123/StockFlow.git |
| Remote name | `origin` |
| Branch | `main` (tracks `origin/main`) |
| First commit | `058d9a0` — "initial commit : stock flow" |
| Working tree | Clean, nothing uncommitted |

Git was installed on this machine (Git for Windows via winget). The user is
authenticated to GitHub through the browser, so `git push` works without typing a
token.

Every meaningful change should follow this loop:

```powershell
git status                 # what changed
git diff                   # review the change
git add <file>             # choose what goes in
git diff --staged          # review again
git commit -m "message"    # save locally
git push                   # upload to GitHub
```

`.gitignore` already excludes `config.js`, `.env`, `pashmina_flow.sqlite3`,
`__pycache__/` and `*.pyc`. Never force-add those.

---

## 3. How to run the app locally

```powershell
cd "E:\confidential E drive\146enterprises"
python server.py
```

Then open <http://localhost:8000>. Keep the PowerShell window open while using the
app. Stop the server with `Ctrl+C`.

The app is offline-first: it stores one JSON document in IndexedDB with a
localStorage backup. Pressing **Sync** tries to reach the small development sync
API in `server.py`. There is no real authentication yet.

---

## 4. The real business workflow — source of truth

This section describes the actual business as explained by the business owner.
**This is the authoritative description. Where the current code disagrees with this
section, the code is wrong.**

### 4.1 The flow

```
Thread mill
  │
  │  we order thread; it is delivered straight to the fabricator,
  │  NOT to our shop
  ▼
Fabricator warehouse (weaving machines)
  │  we give a warp instruction, e.g. 200 m of stole
  │  pieces are delivered in PARTS, not all at once
  ▼
OUR SHOP — inspection #1 (after weaving)
  ├── defective → responsibility: FABRICATOR
  └── good
        ▼
Carbonizer  (outside; only for warps that require carbonization)
  │  return may be all at once, or in parts
  ▼
OUR SHOP — inspection #2 (after carbonization)
  ├── defective → responsibility: CARBONIZER
  └── good
        ▼
Dyer  (colour is chosen by us; one warp can be split into several colours)
  │  pieces are white/cream by default before dyeing
  ▼
OUR SHOP — inspection #3 (after dyeing)
  ├── defective → responsibility: DYER
  └── good
        ▼
Finisher / "press" (called "finish" in the business)
  ▼
OUR SHOP — inspection #4 (after finishing)
  ├── defective → responsibility: FINISHER
  └── good
        ▼
     READY FOR SALE
```

### 4.2 The steps in words

1. **Order thread to the mill.** The thread does not come to our shop. It goes
   directly to the fabricator's warehouse, where the weaving machines are.
2. **Give the fabricator a warp instruction.** For example "make a 200 m warp of
   stole" or "make a 300 m warp of lohi". The warp is measured in metres; the output
   is measured in pieces (pcs). A metre length yields an *estimated* number of pcs.
3. **Receive pieces in parts.** The machine does not produce everything at once, so
   the fabricator sends deliveries as they become ready. Example: a warp expected to
   produce 195 pcs, the first delivery is 40 pcs.
4. **Inspection #1 — after weaving.** We inspect the delivered pcs, separate the
   defective ones, and send only the good ones onward. Defects here belong to the
   **fabricator**.
5. **Carbonization.** The good pcs go to the carbonizer, which is outside the shop.
   Not every cloth type goes for carbonization, but most do. The carbonizer may
   return everything at once or in parts.
6. **Inspection #2 — after carbonization.** Separate defective pcs. Defects belong
   to the **carbonizer**.
7. **Dyeing.** The selected pcs go to the dyers. The dyers do different colours
   according to our demand. A single warp may be split into several colours.
8. **Inspection #3 — after dyeing.** Separate defective pcs. Defects belong to the
   **dyer**.
9. **Finishing / pressing.** The selected pcs go to the last step, called *press* or
   *finish*.
10. **Inspection #4 — after finishing.** Separate defective pcs. Defects belong to
    the **finisher**.
11. **Ready for sale.** Every pc that passed all four inspections is saleable.

### 4.3 Defect responsibility

Defective pieces are attributed to the partner who caused the defect:

| Inspection point | Responsible partner |
| --- | --- |
| After weaving | Fabricator |
| After carbonization | Carbonizer |
| After dyeing | Dyer |
| After finishing | Finisher |

### 4.4 Rules confirmed by the business owner

1. **Do not record thread quantity.** Thread is ordered and sent to the fabricator,
   but quantities are not tracked in the app.
2. **Warp pcs are an estimate.** They are derived from the metre length, not
   counted in advance. *(See the unresolved question in section 6 — the stated
   yield formula still needs confirming.)*
3. **Vendor accounts are kept separate.** Fabricator, carbonizer, dyer and finisher
   are managed independently. They are never linked to one another.
4. **Defective pcs:** sometimes returned to the vendor, sometimes kept separately.
   **There is no replacement piece.** The disposition must be recorded.
5. **Carbonization is per warp, not per piece.** A warp is either fully carbonized
   or not carbonized at all. It is never a mix of both.
6. **Colour split is allowed.** One warp may be divided into different colours at
   the dyeing step. Before dyeing, pcs are white/cream.
7. **"Account" means responsibility only.** We record who caused the defect. We do
   **not** track money, price deductions or payment claims.
8. **Every defect record contains:** defect type, responsible vendor, date, and the
   person who performed the inspection.

---

## 5. Known gaps between the code and the real workflow

The current prototype does **not** yet represent the business correctly. These are
the known mismatches:

| Area | Current code does this | Business actually needs this |
| --- | --- | --- |
| Thread | Has a `threadStock` list with kg quantities and "Receive thread" | Thread goes to the fabricator; quantity is not tracked |
| Batch model | One `batch` with a fixed `initialPieces` count | A **warp order** with metre length and an estimated piece yield |
| Stages | Fixed list: weaving → woven received → cutting → carbonization → dyeing → inspection → pressing → packing → finished stock | Weaving → *(optional carbonization)* → dyeing → finishing, with inspections after each. No cutting or packing stage was mentioned |
| Carbonization | Always in the stage list | Optional, decided per warp |
| Partial deliveries | Not modelled | Deliveries arrive in parts at the fabricator, and possibly at the carbonizer and other partners |
| Pieces still at a vendor | Not modelled | Need a view of how many pcs are still with each partner |
| Defect attribution | A single `result` (pass/rework/reject) with free-text reason | A structured defect record: type, responsible vendor, date, inspector, disposition |
| Colour | Colour is a single field on the product | One warp can split into several colour lots at dyeing |
| Vendor accounts | Vendors exist but are not tied to defect responsibility | Each defect names one of four roles: fabricator / carbonizer / dyer / finisher |

**Conclusion:** before adding realistic demo data, the data model needs to be
redesigned around *warp orders*, *deliveries*, *stage inspections* and *defect
records*.

---

## 6. Open questions — need answers before coding

1. **Warp yield formula.** Two different numbers have been given:
   - "200 m produces roughly 195 pcs"
   - "pcs < 200 ÷ 2.3", which is about 87 pcs

   Which is correct? Is 2.3 used for a different product, or was it a typo?

2. **Piece-level or quantity-level tracking?** If 5 pcs are defective, do we need to
   identify each one (piece numbers / labels), or is recording "5 pcs defective"
   enough? Piece-level tracking is far more work but gives full traceability.

3. **Partial deliveries at every stage?** Confirm whether the dyer and the finisher
   can also return pcs in parts, or whether only the fabricator and carbonizer do.

4. **Defect type list.** Which defect types should the app offer as a fixed list?
   Possible examples: shade difference, hole, tear, stain, weaving fault,
   measurement fault, finishing fault, other.

5. **Inspectors.** Who performs the inspections? Should the app store a list of
   inspector names that can be selected?

6. **Held defectives.** When defective pcs are kept separately, is there any later
   decision recorded for them, or are they just stored?

7. **Sale and customers.** The finished pcs eventually go to customers. Should the
   next design step include issuing pcs to customers, or is that a later phase?

---

## 7. Suggested order of work

1. Answer the open questions in section 6.
2. Write the new data model (warp orders, deliveries, inspections, defect records).
3. Design the screens around that data model.
4. Rewrite the app logic to match the real workflow.
5. Add realistic demo data.
6. Connect Supabase and real login.
7. Deploy to Netlify.

Each step should be a separate Git commit so the history shows real progress.

---

## 8. Useful files

| File | Purpose |
| --- | --- |
| `index.html` | Screen shell and navigation |
| `styles.css` | All visual design |
| `app.js` | All screens, forms and business logic |
| `db.js` | Offline storage (IndexedDB + localStorage) |
| `sync.js` | Sync API adapter |
| `server.py` | Local development server and demo sync API |
| `sw.js` | Service worker for offline use |
| `manifest.webmanifest` | PWA / install settings |
| `supabase/schema.sql` | Intended future hosted database schema |
| `docs/LEARNING-GUIDE.md` | Beginner walkthrough of the code |
| `docs/PROJECT-STATUS.md` | This document |
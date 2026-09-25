# Supabase setup for 146enterprises

This folder contains the database design for the real website.

## Safe setup steps

1. Open the Supabase dashboard and choose the project you created earlier.
2. Open **SQL Editor**.
3. Open the file `supabase/schema.sql` in this project.
4. Copy the whole file into a new SQL Editor query.
5. Press **Run**.
6. If Supabase reports no error, the tables and security policies were created.

The schema does not delete existing tables or data. It uses `if not exists` and drops/recreates only the named policies so it can be rerun while we learn.

## What gets created

- `companies` — one business workspace
- `profiles` — names for signed-in users
- `company_members` — owner/employee access
- `locations` — main shop and outside units
- `vendors` — weaving, carbonization, dyeing, and pressing workers
- `customers` — customers receiving finished pieces
- `products` — pashmina, stole, and lohi specifications
- `thread_lots` — thread stock by kg and alert level
- `batches` — the current state of each production batch
- `batch_events` — the history of stage changes
- `stock_movements` — every stock-in and stock-out movement
- `quality_checks` — pass, rework, and reject records
- `notes` — free-form operational context
- `customer_issues` — pieces issued, returned, or replaced
- `alerts` — in-app alerts shared across devices
- `company_settings` — low-stock and deadline rules
- `custom_fields` — owner-defined product fields

## Important security idea

The public Supabase key is designed to be visible in the browser. The important protection is **Row Level Security (RLS)**. The policies in the schema make a signed-in user see only companies where they are an active member.

Never put the Supabase **service role key** in `index.html`, `app.js`, Netlify environment variables visible to the browser, or a public GitHub repository. The service role key can bypass security rules.

## Later app flow

1. User signs up or signs in with Supabase Auth.
2. The website checks `profiles` and `company_members`.
3. If no company exists, the owner creates one and becomes its first owner.
4. The owner invites employees.
5. The website reads/writes only the tables for that company.

## Learning terms

- **Table:** a structured list of similar records, such as all batches.
- **Row:** one record in a table, such as one batch.
- **Column:** a field in a table, such as `batch_number`.
- **Primary key:** a unique ID for a record.
- **Foreign key:** a link from one record to another, such as a batch pointing to its product.
- **RLS:** database rules that decide which signed-in user can read or change a row.
- **SQL migration:** a saved, repeatable change to the database structure.

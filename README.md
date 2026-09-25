# 146enterprises

146enterprises is a website for tracking pashmina, fine-wool shawls, stoles, and lohis from thread purchase through delivery. It is being built as a normal browser website: the eventual production version will use Supabase for the shared database and individual logins, and Netlify for hosting.

The current folder also contains a local-first prototype and a local development server so the workflow can be learned before connecting the hosted services.

## Supabase + Netlify path

The real website will use:

- **Supabase Auth** for individual owner and employee accounts.
- **Supabase PostgreSQL** for the shared business database.
- **Netlify** for the website files and a temporary free address.
- **GitHub** for code history and safe versions.

Follow [supabase/README.md](supabase/README.md) to run the database schema in the existing Supabase project. Copy `config.example.js` to `config.js` and fill it with the project's public URL and anon key. Never put the Supabase service-role key in the browser or GitHub.

## What this first version does

- Tracks thread stock by location and minimum stock level.
- Creates manual production batch numbers.
- Tracks a batch through weaving, woven-fabric receipt, cutting, carbonization, dyeing, inspection, pressing, packing, and finished stock.
- Supports partial quantities, stage differences, loss, rework, and rejection.
- Records outside-worker details and expected return dates.
- Keeps free-form operational notes attached to a batch.
- Tracks finished pieces issued to customers, returns, and replacements.
- Creates in-app alerts for low stock, late outside work, and customer dates.
- Shows operational analytics for production, stock, quality, and delays.
- Stores data locally first using IndexedDB, with a localStorage safety backup.
- Includes a Sync button and a development Python sync server.
- Includes a Learn page explaining the words used in the app.

This version intentionally does **not** include income, expense, accounting, invoicing values, or profit.

## Run it on your computer

Python 3 is enough; Node.js is not required.

1. Open PowerShell in this project folder.
2. Run:

   ```powershell
   python server.py
   ```

3. Open [http://localhost:8000](http://localhost:8000).
4. Keep the PowerShell window open while using the app.

The first visit uses sample data. A real deployment will need a secure login, a hosted database, HTTPS, backups, and a proper server-side sync implementation. The included `server.py` is intentionally a learning/demo server and is not a production security solution.

## How offline sync is designed

1. The screen is a **frontend**.
2. The browser's **IndexedDB** stores the current data on the device.
3. A **service worker** saves the app files so the screen can open offline.
4. When the owner presses **Sync**, the browser sends the current document to `/api/sync`.
5. The server checks a version number. If another device already changed the document, it returns a conflict instead of silently destroying either version.
6. The next production phase can replace this small API with a hosted database and secure authentication.

## The main development terms

- **Frontend:** the screens and buttons you use.
- **Backend:** the server code and database.
- **API:** the route used to ask the backend to save or fetch data.
- **Dashboard:** the overview screen for important counts and alerts.
- **Card:** a small information panel on a dashboard.
- **Database:** organized storage for batches, products, stock, and notes.
- **PWA:** a web app that can be installed and work offline.
- **IndexedDB:** browser-based offline storage.
- **Service worker:** the offline file-cache helper.
- **Sync:** exchanging changes between devices.
- **Git:** code history and safe project versions.
- **Frontend state:** the values currently being edited or displayed.
- **Event listener:** code that reacts to a click, submit, or other user action.
- **Validation:** checking that a form contains sensible values.
- **Migration:** changing the shape of stored data when the app improves.

Read [docs/LEARNING-GUIDE.md](docs/LEARNING-GUIDE.md) for a friendly walkthrough of the project structure.

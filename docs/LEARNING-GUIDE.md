# Learning guide: Pashmina Flow

This project is written in plain HTML, CSS, and JavaScript on purpose.

## Files

- `index.html` is the **screen structure** and the app shell.
- `styles.css` is the visual design: colors, cards, tables, buttons, and mobile layout.
- `app.js` is the application logic: rendering screens, handling clicks, validating forms, and changing data.
- `db.js` is the offline database layer. It talks to IndexedDB and keeps a localStorage backup.
- `sync.js` is the API adapter. It is the only file that knows how to call the sync server.
- `server.py` is a small development server. It serves the app and provides a demo `/api/sync` endpoint.
- `sw.js` is the service worker. It caches the app shell for offline use.
- `manifest.webmanifest` contains the app name, theme color, and install information.

## A simple request flow

When an employee clicks **Save**:

1. The click event reaches an **event listener** in `app.js`.
2. `app.js` validates the form fields.
3. The batch or note is changed in memory.
4. `saveState()` writes the updated document to IndexedDB.
5. The screen is rendered again from the updated data.
6. When online, **Sync** sends the document to the backend.

## Important data idea

A production batch is the main record. It contains:

- a manual batch number;
- a product and size;
- the current production stage;
- stage quantities, dates, outside worker, and loss;
- quality results;
- free notes;
- customer issues and returns.

This is called a **record**. Several records together make the database.

## What to learn next

1. Change a color in `styles.css` and reload the app.
2. Add a text label to a button in `app.js` and see where it appears.
3. Trace one event from a `data-action` attribute to its handler.
4. Add a field to a batch form and then add the same field to the saved object.
5. Add a new dashboard card using an existing metric.
6. Add a new stage to `DEFAULT_STAGES` and decide which records need to be tested.
7. Replace the demo role switch with real authentication when the app is ready for the internet.
8. Add a real hosted database only after the local workflow is agreed.

The best way to learn is to change one small thing, save the file, reload the browser, and observe what changed.

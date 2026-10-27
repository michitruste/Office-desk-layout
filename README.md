# Office Desk Map (standalone)

A floor plan of the office desks: who sits where, their details, rows, areas, and Excel and CAD export. It runs from a plain HTML file. There's no server or install.

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The desk map app. Open it in a browser. |
| `desk-map-data.json` | The map's data: desks, people and areas. It's a copy of the online map as of the day this folder was made. |
| `README.md` | This file. |

## Getting started (Chrome or Edge)

1. Open `index.html` in Chrome or Edge.
2. Click **Data → Open an existing data file…** and choose `desk-map-data.json` from this folder.
3. Click **Allow** when the browser asks to let the page edit the file.

From then on every change is written to `desk-map-data.json` automatically. The chip under the title says **Saved to desk-map-data.json**. The browser remembers the file. After a restart it may ask for permission again; click **Reconnect** when you see the yellow banner.

## Other browsers (Firefox, Safari)

These can't write to files directly. The map saves in the browser instead, and the chip says **Saved in this browser**.

- To load the folder's data, use **Data → Load a backup…** and pick `desk-map-data.json`.
- To save back to the folder, use **Data → Download backup** and replace the file.

## Keeping it in a shared folder or a git repo

- **Shared or synced folder** (network drive, OneDrive, Google Drive, Dropbox): put the whole folder there and link `desk-map-data.json` as above. Everyone who opens it from Chrome or Edge sees the same map. Only one person should edit at a time, because the last save wins. If the file changed somewhere else while you also had unsaved changes, the page asks which version to keep.
- **Git repo**: commit `index.html` and `desk-map-data.json`. Edit with the file linked, then commit the updated `desk-map-data.json`. The JSON is formatted one field per line, so diffs are readable.
- **Website** (GitHub Pages, an intranet server): when the folder is served over http(s), the page loads `desk-map-data.json` by itself the first time someone opens it. Visitors' own changes stay in their browser. To publish changes, edit the file and upload it again. **Data → Reload desk-map-data.json from this site** picks up the latest version.

## Fields and Excel columns

- **People → Fields** lets you rename fields, add your own, and list other Excel column titles that should fill each one.
- **Recognise people by this:** tick it on the fields that identify a person (by default Employee ID, Customer ID, email and name). On import, a match on any ticked field updates that person instead of adding a duplicate.
- **When you import**, each Excel column has a dropdown showing where it goes. You can change it, skip a column, or add it as a new field. Your choices are remembered for next time.
- **Where it's kept:** the field setup is saved inside `desk-map-data.json` with everything else.

## Good to know

- **Internet:** Excel import and export load a spreadsheet library from the internet, so they need a connection. Everything else, including the CAD (.dxf) export and JSON backups, works offline.
- **Backups:** **Data → Download backup** saves a complete copy you can load anywhere. **Export → Excel workbook** is also re-importable.
- **Clearing the browser's site data** erases the browser copy. If a data file is linked, the file still has everything.
- **Example people:** the 13 people in the starting data are made up. Use **Clear examples** on the yellow banner once you import your real list.
- **Online version:** this standalone copy is separate from the map in your Claude account. To move data between them, export an Excel workbook from one and import it into the other.

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
- **Colour by:** under the map, pick which field colours the desks. It lists the short text fields (Team, Supervisor, the team leads, your own) that at least one person has filled in. Each browser remembers its own choice, and the picture and Excel plan exports use it too. Click a name in that row to highlight those people's desks (and list them under People); click it again or press Esc to stop.

## Walls, doors, windows and pillars

- Turn on **Arrange desks** and use the **Room** tools. **Wall**, **Door** and **Window** draw straight lines along the grid lines: drag from one corner to another. Click Door or Window once on the map for a standard 2-square one. Press **Esc** when you're done drawing.
- **Pillar**: drag it from the toolbar onto the map (or click to add one), then drag its round handle to make it bigger.
- Click any of them to move it, drag its handles, nudge it with the arrow keys, flip a door's swing, or press **Delete** to remove it.
- They never stop you from placing a desk. A desk that sits on a pillar, crosses a wall or stands where a door swings gets an orange outline and a **!** badge, and the header counts them. Desks added with a click, a row or a paste avoid those spots by themselves.
- They show up in every export. In the Excel data workbook they're on the **Room** sheet (a wall across has a Height of 0); importing a workbook with that sheet replaces the room on the map.

## Areas

- In Arrange mode, click **Area**, then drag from one corner to the opposite one for a rectangle. For any other shape (an L, a U), click corner by corner along the grid lines and click the first corner again, or press **Enter**, to finish. **Backspace** takes back the last corner and **Esc** cancels.
- To change an area, click its name. Drag a round corner or the handle in the middle of a side. Double-click a side to add a corner there, then drag one half of the side out or in. Double-click a corner to square it off. **Make it a rectangle** in the side panel undoes any shape.
- In the Excel data workbook, a shaped area lists its corners in the **Shape** column of the Areas sheet, as `column row` pairs.

## Selecting, moving and copying several things

- Drag a box on an empty part of the map to select everything in it: the desks it touches, and the areas, walls, doors, windows and pillars it goes all the way round. **Shift+click** adds or removes single items.
- Drag any of them, or use the arrow keys, to move them all together. **Ctrl+C** / **Ctrl+V** copy and paste the whole selection where your mouse is, **Ctrl+D** duplicates it, and **Delete** removes it. Pasted desks get new numbers and pasted areas get "copy" added to their name.

## Good to know

- **Room to grow:** while arranging there's always free space on every side of the map. Put something in the space at the top or left and the whole map shifts over to make more, so the column and row numbers of everything change by the same amount. Undo still works as usual.
- **Internet:** Excel import and export load a spreadsheet library from the internet, so they need a connection. Everything else, including the CAD (.dxf) export and JSON backups, works offline.
- **Backups:** **Data → Download backup** saves a complete copy you can load anywhere. **Export → Excel workbook** is also re-importable.
- **Clearing the browser's site data** erases the browser copy. If a data file is linked, the file still has everything.
- **Example people:** the 13 people in the starting data are made up. Use **Clear examples** on the yellow banner once you import your real list.
- **Online version:** this standalone copy is separate from the map in your Claude account. To move data between them, export an Excel workbook from one and import it into the other.

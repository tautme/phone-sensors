# Image Share — XO Annotate

A small full-stack app for marking up images with **X** and **O** annotations,
with a strong focus on *easy correction* — because the most common thing a user
does after marking an X is change their mind.

- **Frontend** (`public/index.html`): an HTML/Canvas editor — upload an image,
  place X/O marks, and re-edit anything you've saved.
- **Backend** (`server.js`): a dependency-free Node server that stores each
  image in its own folder alongside its annotations.

## Run it

```bash
cd xo-annotate
node server.js          # or: npm start
```

Then open <http://localhost:3000>. No `npm install` needed — the server uses
only Node's standard library.

Set a different port with `PORT=8080 node server.js`.

## Correcting marks (the important part)

| Action | How |
| --- | --- |
| Remove a single mark | **Tap the mark** — works with any tool selected |
| Remove without risk of adding | Switch to the **Erase** tool, then tap |
| Take back the last action | **Undo** (or <kbd>Ctrl</kbd>+<kbd>Z</kbd>) |
| Re-apply something undone | **Redo** (or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>) |
| Start over | **Clear all** |
| Fix marks after saving | **Edit** from the gallery, change marks, **Update marks** |

Keyboard: <kbd>X</kbd> / <kbd>O</kbd> / <kbd>E</kbd> switch tools.

## How images are stored

Each image gets its own folder under `storage/images/<id>/`, keyed by a short
random id so images and annotations never collide:

```
storage/
  images/
    9f3a1c0b8e2d4f6a/
      original.png        the uploaded image bytes
      annotations.json    the X/O marks (normalized 0..1 coordinates)
      meta.json           id, filename, mime, size, created/updated timestamps
```

Marks are stored as fractions of the image dimensions, so they line up no
matter what size the canvas is rendered at later.

The `storage/` folder is created on first run and is git-ignored.

## HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/images` | Create an image from a base64 data URL + annotations |
| `GET` | `/api/images` | List stored images (newest first) |
| `GET` | `/api/images/:id` | Get one image's meta + annotations |
| `GET` | `/api/images/:id/file` | Get the raw image bytes |
| `PUT` | `/api/images/:id/annotations` | Replace the annotations (save corrections) |
| `DELETE` | `/api/images/:id` | Delete the image and its folder |

`POST` body:

```json
{
  "filename": "photo.png",
  "imageData": "data:image/png;base64,iVBORw0KGgo...",
  "annotations": [ { "type": "X", "x": 0.42, "y": 0.31 } ]
}
```

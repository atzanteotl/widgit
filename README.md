# WIDgiT 2027 website

Static site for the 1st International Workshop on Immersive Digital Twins, held with IEEE VR 2027.

## Files

- `index.html` holds all page content.
- `style.css` holds the styling. It follows the visitor's light or dark setting.
- `twin.js` draws the interactive 3D car twin and the topic nodes. It needs no libraries.

There is no build step and no dependencies.

## Publish on GitHub Pages

1. Create a new repository on GitHub, for example `widgit-2027`.
2. Upload `index.html`, `style.css`, `twin.js` and this README to the repository root.
3. Open **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
5. After a minute or two the site is live at `https://<your-username-or-org>.github.io/widgit-2027/`.

## Preview locally

Open `index.html` in a browser, or run `python3 -m http.server` in this folder and visit `http://localhost:8000`.

## Items to update later

- Submission system link (search the page for "Submission link to be announced").
- Keynote speaker name and affiliation.
- Final workshop day (27 or 28 February 2027).
- Exact session times once the IEEE VR program is set.

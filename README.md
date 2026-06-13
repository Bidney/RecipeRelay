# Recipe Relay

Recipe Relay is a backend-free Chrome extension that turns recipe ingredients into a clean shopping list and sends it to your phone with a QR code.

The QR contains the shopping list text directly. There is no server, account, separate web page, database, analytics, or setup flow.

Repository: https://github.com/bidney/RecipeRelay

## What is included

- Manifest V3 Chrome extension
- Current-tab recipe extraction using structured JSON-LD first, then DOM fallback
- Manual paste mode when a recipe site cannot be parsed
- Ingredient cleanup and pantry basics filtering
- Editable ingredient checklist in the extension popup
- Add, remove, select all, and clear all controls
- Local QR code generator bundled with the extension
- Plain text QR transfer that works immediately
- New publish-ready icon set
- Chrome Web Store graphics in store-assets
- Demo recipe page

## What is not included

- No backend
- No accounts
- No database
- No analytics
- No remote JavaScript
- No separate mobile page
- No native mobile app

## Folder structure

```text
RecipeRelay/
  manifest.json
  popup.html
  popup.css
  popup.js
  src/lib/qr.js
  demo/sample-recipe.html
  icons/
  store-assets/
  docs/
  README.md
  PRIVACY.md
  LICENSE
  CHANGELOG.md
  CONTRIBUTING.md
  SECURITY.md
```

## Install locally in Chrome

1. Open Chrome.
2. Go to chrome://extensions.
3. Turn on Developer mode.
4. Click Load unpacked.
5. Select the RecipeRelay folder.
6. Pin Recipe Relay to the toolbar.

## Use the extension

1. Open a recipe page in desktop Chrome.
2. Click the Recipe Relay toolbar icon.
3. Click Extract recipe.
4. Review the cleaned ingredients.
5. Add, remove, edit, select, or clear items as needed.
6. Click Generate QR.
7. Scan the QR with your phone camera.

Most phone cameras will show the QR content as text. From there, the user can copy the list into Notes, Reminders, Messages, or any shopping app.

## Manual import

Some recipe sites do not expose ingredients in a clean format. Use Paste manually in the popup, enter a title, and paste ingredients one per line. Recipe Relay will still clean, deduplicate, and filter the list before generating the QR.

## Test with the included sample recipe

Chrome extensions usually cannot parse local file pages unless extra permissions are enabled. The easiest local test is to serve the demo page over HTTP:

```bash
cd demo
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080/sample-recipe.html
```

Click the extension and extract the recipe.

## Package for Chrome Web Store

For Chrome Web Store upload, zip the contents of this folder so manifest.json is at the root of the ZIP file.

This release also includes a prepared upload ZIP named recipe-relay-webstore-upload-v0.3.2.zip.

## Publishing assets

Chrome Web Store graphics are in store-assets/chrome-web-store:

- promo-small-440x280.png
- promo-marquee-1400x560.png
- screenshot-01-extract-list-1280x800.png
- screenshot-02-qr-transfer-1280x800.png
- screenshot-03-privacy-first-1280x800.png

GitHub social preview graphic:

- store-assets/github-social-preview-1280x640.png

## Support

Recipe Relay is free and offline-first. If you find it useful, you can support the project here:

https://buycoffee.to/bidney

## Privacy model

The extension uses activeTab, scripting, and storage permissions only.

- activeTab gives temporary access to the current page after the user clicks the extension.
- scripting is used to run the recipe extractor on the current tab.
- storage saves local preferences such as cleanup options.

The extension does not send recipe data to a server. Shopping-list text stays in the browser popup and in the generated QR code.

## Known limitations

- Recipe extraction is best on sites that expose schema.org Recipe JSON-LD.
- DOM fallback is broader than the original MVP, but it still will not work on every recipe site.
- Very long shopping lists can create dense QR codes. Shorter item names and fewer selected items scan better.
- Phone camera behavior varies by device. Some phones display QR text directly, while others may require copying from the scanner result.

## Next improvements

- Add unit normalization and duplicate combining.
- Add user-defined pantry items.
- Add aisle grouping.
- Add import from selected text.
- Add optional share shortcuts after copying the list.

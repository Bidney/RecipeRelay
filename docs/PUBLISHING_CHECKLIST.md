# Publishing Checklist

## Before GitHub upload

- Confirm manifest.json version is correct.
- Confirm README.md, PRIVACY.md, LICENSE, CHANGELOG.md, CONTRIBUTING.md, and SECURITY.md are present.
- Confirm icons are present in icons/ at 16, 32, 48, and 128 px.
- Confirm no backend, analytics, or remote script references were added.
- Confirm the support link points to https://buycoffee.to/bidney.

## Before Chrome Web Store upload

- Use the prepared upload ZIP: recipe-relay-webstore-upload-v0.3.2.zip.
- Confirm manifest.json is at the root of the upload ZIP.
- Upload the 128 x 128 icon from store-assets/icons/recipe-relay-icon-128.png if requested by the dashboard.
- Upload the required small promotional image from store-assets/chrome-web-store/promo-small-440x280.png.
- Upload at least one screenshot from store-assets/chrome-web-store.
- Add the privacy policy URL after the GitHub repository is public.
- Use the permission justifications from docs/CHROME_WEB_STORE_LISTING.md.

## Suggested first release test

- Load the unpacked extension locally.
- Open demo/sample-recipe.html through a local HTTP server.
- Extract the sample recipe.
- Edit one item and confirm the QR refreshes.
- Generate the QR.
- Scan it with a phone.
- Confirm the list text is readable.

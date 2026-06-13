# Privacy Policy

Recipe Relay is designed to run without a backend.

## Data handled by the extension

Recipe Relay may process the following data locally in the browser:

- Recipe title from the current page
- Ingredient text from the current page
- Source URL of the current page
- Manually pasted ingredient text, if the user chooses manual import
- Local preferences such as cleanup toggles

## Data storage

- Preferences are stored using chrome.storage.local.
- Shopping lists are not uploaded by this extension.
- QR transfer stores the list directly in the generated QR code.

## Network behavior

- The extension does not call a remote API.
- The bundled QR generator runs locally.
- The extension does not include third-party scripts.
- The extension does not include analytics.

## Permissions

Recipe Relay uses these Chrome permissions:

- activeTab: temporary access to the current tab after the user clicks the extension.
- scripting: runs the recipe extractor on the current tab.
- storage: stores local user preferences.

## QR code note

Anyone who can see or scan the QR can read the shopping list. QR scanner previews, screenshots, and browser or camera history may keep a copy of scanned text depending on the user's device.

## Donation link

The popup includes an optional support link to https://buycoffee.to/bidney. Clicking it opens an external website in a new tab.

Recipe Relay does not send recipe data, shopping lists, browsing history, or extension data to that site. Any information entered on the donation site is handled by that external service.

## Contact

For issues or privacy questions, use the GitHub repository:

https://github.com/bidney/RecipeRelay

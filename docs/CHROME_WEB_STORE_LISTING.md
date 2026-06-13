# Chrome Web Store Listing Draft

## Title

Recipe Relay

## Summary

Turn recipe ingredients into a clean shopping list and send it to your phone with a QR code. No account or backend.

## Description

Recipe Relay helps you move from recipe page to shopping list without accounts, apps, or setup.

Open a recipe page, click the extension, review the cleaned ingredients, and generate a QR code. Scan it with your phone to copy the shopping list into Notes, Reminders, Messages, or your favorite shopping app.

Main features:

- Extracts ingredients from recipe pages
- Uses structured recipe data first, then DOM fallback
- Includes manual paste mode when a site cannot be parsed
- Cleans common ingredient notes and duplicates
- Can hide pantry basics like salt, pepper, water, and oil
- Lets you edit, add, remove, select, and clear items
- Generates a QR code with the shopping list text directly
- Works without a backend, account, analytics, or remote scripts

Privacy-first behavior:

Recipe Relay does not upload recipes or shopping lists. The QR code is generated locally and contains the selected shopping-list text directly.

## Suggested support URL

https://github.com/bidney/RecipeRelay/issues

## Suggested homepage URL

https://github.com/bidney/RecipeRelay

## Suggested privacy policy URL

https://github.com/bidney/RecipeRelay/blob/main/PRIVACY.md

## Permission justification

activeTab:
Used only after the user clicks the extension, so Recipe Relay can read ingredients from the current recipe page.

scripting:
Used to run the recipe extractor on the current tab.

storage:
Used to save local preferences such as cleanup options.

## Single purpose statement

Recipe Relay extracts or accepts recipe ingredients, cleans them into a shopping list, and generates a QR code so the user can move the list to their phone.

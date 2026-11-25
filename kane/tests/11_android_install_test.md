---
name: The Android page offers the app install and a safe keyboard download
tags: [android, install]
devices: [web, phone]
---
Go to {{baseUrl}}/android
Assert the page heading says "Mlyfo on your Android phone"
Assert the page shows a "Download the keyboard" button
Assert the page explains how to install the Mlyfo app from Chrome
Assert the page says internet is the keyboard's only permission and keystrokes never leave the phone
Assert the "Check your download" section shows a long SHA-256 fingerprint
Go to {{baseUrl}}/manifest.webmanifest
Assert the page shows the app name "Mlyfo" and "standalone" display

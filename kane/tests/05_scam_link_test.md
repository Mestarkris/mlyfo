---
name: Shield flags a fake Phantom airdrop link as dangerous
tags: [smoke, shield]
---
Go to {{baseUrl}}/signin?demo=1
Click the "Sign in" button
Go to {{baseUrl}}/app/shield
Type "https://phantorn-airdrop.app/claim" into the link field that shows "https://…"
Click "Quick check"
Assert the result shows "Dangerous"
Assert the reasons mention that the address imitates phantom

---
name: Shield flags a fake Phantom airdrop link as dangerous
tags: [smoke, shield]
devices: [web, phone]
---
Go to {{baseUrl}}/signup
Type "Link Tester" into the Full name field
Type "link{{runId}}@mlyfo.app" into the Email field
Type "link{{runId}}" into the Username field
Type "kane-password-123" into the Password field
Click "Create account"
Go to {{baseUrl}}/app/shield
Type "https://phantorn-airdrop.app/claim" into the link field that shows "https://…"
Click "Quick check"
Assert the link scan result shows "Dangerous"
Assert the reasons listed in the link scan result mention that the address imitates phantom

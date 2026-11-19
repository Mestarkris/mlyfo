---
name: New user can sign up and lands on a funded dashboard
tags: [smoke, auth]
---
Go to {{baseUrl}}/signup
Type "Kane Tester" into the Full name field
Type "kane{{runId}}@mlyfo.app" into the Email field
Type "kane{{runId}}" into the Username field
Assert the page says "@kane{{runId}} is free"
Type "kane-password-123" into the Password field
Click "Create account"
Assert the page heading says "Welcome, Kane"
Assert the wallet balance shows "$500.00"

---
name: A payment over the spend limit waits for password confirmation
tags: [smoke, money, limits]
---
Go to {{baseUrl}}/signup
Type "Limit Tester" into the Full name field
Type "limit{{runId}}@mlyfo.app" into the Email field
Type "limit{{runId}}" into the Username field
Type "kane-password-123" into the Password field
Click "Create account"
Go to {{baseUrl}}/app/pad
Type "pay @ada 150 for rent" into the Message field
Click the "Pay $150.00" button
Assert the keyboard card says "Confirm $150.00 to @ada" and mentions the per-payment limit
Type "kane-password-123" into the "Your password" field
Click "Confirm payment"
Assert the keyboard card says "Sent $150.00 to @ada"

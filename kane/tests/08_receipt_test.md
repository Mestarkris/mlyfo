---
name: A payment gives a receipt with an ID and a public receipt page
tags: [smoke, money, receipts]
devices: [web, phone]
---
Go to {{baseUrl}}/signup
Type "Receipt Tester" into the Full name field
Type "receipt{{runId}}@mlyfo.app" into the Email field
Type "receipt{{runId}}" into the Username field
Type "kane-password-123" into the Password field
Click "Create account"
Go to {{baseUrl}}/app/pad
Type "pay @kabir 10 for lunch" into the Message field
Click the "Pay $10.00" button
Assert the keyboard card says "Sent $10.00 to @kabir" and shows a receipt ID starting with "MLY-"
Assert the keyboard card says the money was delivered to @kabir
Go to {{baseUrl}}/app
Click the "Receipt" link in Recent activity
Assert the receipt page shows $10.00 paid to @kabir with a receipt ID starting with "MLY-"

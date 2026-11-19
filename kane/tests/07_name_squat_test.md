---
name: Paying a name that is both a saved person and another user asks who you meant
tags: [smoke, money, people]
---
Go to {{baseUrl}}/signup
Type "Squat Tester" into the Full name field
Type "squat{{runId}}@mlyfo.app" into the Email field
Type "squat{{runId}}" into the Username field
Type "kane-password-123" into the Password field
Click "Create account"
Go to {{baseUrl}}/app/people
Click "Any wallet"
Type "Semi" into the Name field
Type "SemiMumW7pQ2vRm9xLwT4nBc8ZsY3hJfUe6GdN1oPq5Q" into the "Solana address" field
Click "Save person"
Assert the page says "Saved Semi"
Go to {{baseUrl}}/app/pad
Type "pay semi 5 for coffee" into the Message field
Click the "Pay $5.00" button
Assert the keyboard card asks "Who did you mean?" and offers "Your contact Semi" and "Mlyfo user @semi"
Click "Your contact Semi"
Assert the keyboard card says "Sent $5.00 to Semi"

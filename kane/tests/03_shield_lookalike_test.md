---
name: Shield blocks a look-alike of a saved contact's address
tags: [smoke, shield]
---
Go to {{baseUrl}}/signin?demo=1
Click the "Sign in" button
Go to {{baseUrl}}/app/shield
Type "AdaK9zXw2LmQ8rTvB3nYc7HsP4kJe6FgD1oWu5Ra2Fx" into the "Paste a Solana address" field
Click "Check address"
Assert the result says "Blocked"
Assert the result says it looks like Ada’s saved address but isn’t

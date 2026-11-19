---
name: Shield refuses to save a look-alike of a saved person
tags: [smoke, shield, people]
---
Go to {{baseUrl}}/signup
Type "People Tester" into the Full name field
Type "people{{runId}}@mlyfo.app" into the Email field
Type "people{{runId}}" into the Username field
Type "kane-password-123" into the Password field
Click "Create account"
Go to {{baseUrl}}/app/people
Click "Any wallet"
Type "Ada" into the Name field
Type "AdaK7pQ2vRm9xLwT4nBc8ZsY3hJfUe6GdN1oPq5Ma2Fx" into the "Solana address" field
Click "Save person"
Assert the page says "Saved Ada"
Type "Ada new" into the Name field
Type "AdaK9zXw2LmQ8rTvB3nYc7HsP4kJe6FgD1oWu5Ra2Fx" into the "Solana address" field
Click "Save person"
Assert the page says the address was not saved because it looks like Ada’s saved address
Assert "Ada new" does not appear in the list of your people

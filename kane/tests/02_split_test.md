---
name: Split a $236 bill four ways and get a link per person
tags: [smoke, money]
---
Go to {{baseUrl}}/signup
Type "Split Tester" into the Full name field
Type "split{{runId}}@mlyfo.app" into the Email field
Type "split{{runId}}" into the Username field
Type "kane-password-123" into the Password field
Click "Create account"
Go to {{baseUrl}}/app/splits
Type "Kane dinner {{runId}}" into the "What’s it for?" field
Type "236" into the Total field
Type "zoya, kabir, sofia" into the "Who’s paying you back?" field
Assert the page says "4 people, $59.00 each"
Click "Create split and links"
Assert a split called "Kane dinner {{runId}}" is listed with "1 of 4 paid"
Assert that split shows "$59.00" for zoya, kabir and sofia with a "Copy link" button for each

---
name: The Android keyboard hands a copied address to Shield
tags: [keyboard, shield]
devices: [web, phone]
---
Go to {{baseUrl}}/signin?demo=1
Click the "Sign in" button
Go to {{baseUrl}}/k?address=AdaK9zXw2LmQ8rTvB3nYc7HsP4kJe6FgD1oWu5Ra2Fx
Assert the page shows the Shield heading
Assert the "Paste a Solana, Ethereum or Base address" field contains "AdaK9zXw2LmQ8rTvB3nYc7HsP4kJe6FgD1oWu5Ra2Fx"
Assert the result says "Blocked"
Assert the result says it looks like Ada’s saved address but isn’t

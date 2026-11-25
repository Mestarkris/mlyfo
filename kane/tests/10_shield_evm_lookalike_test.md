---
name: Shield blocks a look-alike of a saved Ethereum and Base address
tags: [smoke, shield, evm]
devices: [web, phone]
---
Go to {{baseUrl}}/signin?demo=1
Click the "Sign in" button
Go to {{baseUrl}}/app/shield?address=0x7a3f9cE5b801Dd3fA7426C9e0B1f8a5d3e27c4b9
Assert the "Paste a Solana, Ethereum or Base address" field contains "0x7a3f9cE5b801Dd3fA7426C9e0B1f8a5d3e27c4b9"
Assert the result says "Blocked"
Assert the result says it looks like Ada (Base)’s saved address but isn’t
Assert the result is labelled as an Ethereum and Base address

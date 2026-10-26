# Order portal

![CI](https://github.com/MayhurJoker007/b2b-order-portal/actions/workflows/ci.yml/badge.svg)

The buyer-facing web app for [b2b-marketplace-api](https://github.com/MayhurJoker007/b2b-marketplace-api).
A shop owner signs in, picks a distributor, builds an order and sees it in their order history, with
delivery dates in working days.

**Stack:** React 19, TypeScript, Vite, Vitest + Testing Library, oxlint, GitHub Actions.
No UI framework or state library, because the app doesn't need one.

## How the rules are split

The API is the authority on every order rule (minimum order quantity, case sizes, stock, minimum order value).
The portal repeats the cheap ones **so the buyer finds out while typing, not after pressing Place order**:

- adding a product starts at its minimum quantity and then goes up a case at a time
- a line that isn't a whole number of cases, or is under the minimum, shows why next to it
- the cart says how much more is needed to reach the distributor's minimum order
- **Place order** stays disabled until all of that is satisfied

Anything only the server can know (stock that sold out a minute ago, for example) comes back as a 422 listing
every problem, and the cart shows each one.

The rules live in `src/cart.ts` as plain functions with no React, so they're tested directly. Money is added up
in integer cents, so `3 × R1.10` is `R3.30` and not `R3.3000000000000003`.

## A bug the tests caught

The first version removed a cart line as soon as its quantity became 0. That sounds reasonable until you
select the quantity field and delete it to type a new number: the line vanished mid-edit. Now an empty
quantity keeps the line (marked "Enter a whole number"), and removing it is a separate button. There's a test
for both.

## Other details

- Product search is debounced, so typing doesn't fire a request per keystroke.
- Switching distributor clears the cart, since an order goes to one distributor.
- If the token expires mid-session, the next request sends you back to sign in instead of failing quietly.
- Network failures show a readable message, not `TypeError: Failed to fetch`.
- It's keyboard accessible with labelled controls (the tests find elements by label and role, the way a screen
  reader would). It follows the system dark mode and works at phone width.

## Running it

Start the API first (from the `b2b-marketplace-api` repo):

```
dotnet run --project src/Marketplace.Api --launch-profile http
```

Then the portal:

```
npm install
npm run dev
```

Open http://localhost:5173 and sign in as `buyer.mamelodi` with password `Demo@12345` (the API's seeded
demo user). Vite proxies `/api` to `http://localhost:5095`. Set `API_URL` to point somewhere else.

## Tests

```
npm test
```

There are cart rule unit tests, plus UI tests that drive the whole app against a small fake of the API:
wrong password, the token being sent, the minimum-order gate, case-size warnings, server-side rejections and
a successful order. CI runs lint, tests and a production build on every push.

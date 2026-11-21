<img src="assets/icon.svg" width="64" height="64" alt="">

# Rentit

Pilot app for daily car rentals in Cairo. Anyone can browse; a signed-in account can both rent cars and list its own
(individual owners and rental businesses). Expo React Native app + a small self-hosted Node 22 API with SQLite.

## Run it locally

Requirements: Node 22.18+ (`.nvmrc`), Xcode or Android Studio for the dev client.

```sh
npm install
npm run api            # API on http://0.0.0.0:4000, data in ./data (SQLite + uploads), seeds sample cars on first run
npm start              # Metro for the dev client (in a second terminal)
npm run ios            # or: npm run android   — builds and installs the dev client once
```

The app finds the API on the Metro host at port 4000. To point it elsewhere (another machine, a phone on Wi-Fi when
Metro runs behind a tunnel), copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL=http://<lan-ip>:4000`, then
restart Metro. Server settings are environment variables: `PORT` (4000), `DATA_DIR` (`./data`), `SEED=false` to skip samples.
No secrets live in the mobile app; it only stores its session token in SecureStore.

Checks:

```sh
npm test               # API + domain tests (cross-account request/accept/decline/cancel, overlap, concurrency, contacts)
npm run typecheck
npm run export:mobile  # iOS + Android bundle export
```

## Sample data

On an empty database the API creates 8 **sample listings** (marked "Sample listing" in the app) owned by three demo
accounts, all with password `rentit-sample`:
`nile.fleet@sample.rentit` (business), `mona@sample.rentit`, `omar@sample.rentit`. To try the full flow, request a car
from another account, then sign in as that car's owner to respond. Photos are Wikimedia Commons images, credited in
`server/seed-photos/CREDITS.md`.
Reset everything by stopping the API and deleting `./data`.

## Rules the app and API follow

- **Prices** are whole EGP per day. **Days = return date − pickup date** (pick up 3 May, return 5 May = 2 days).
  Dates are Cairo calendar dates, no times.
- A rental occupies `[pickup, return)`: a new rental may pick up on another's return date. Owner blocks cover
  start–end inclusive.
- **Pending requests don't reserve.** Accepting runs in a SQLite `BEGIN IMMEDIATE` transaction that re-checks accepted
  rentals and blocks, so two overlapping requests can never both be accepted; overlapping pending requests are
  auto-declined on accept.
- The **quote is stored on the request** (days, daily rate, total). The renter's app sends the total it showed; if the
  owner changed the rate meanwhile the API refuses with the new quote. Later rate changes never alter existing requests.
- **Contacts** (phone, email) are returned only to the renter and owner of an *accepted* request.
- Renter can cancel pending or accepted requests; owner accepts/declines pending and can cancel accepted ones (until the
  return date). New listings start paused and need one photo to publish.
- Status updates: screens refetch on focus and poll every 15 s, with an "Updated hh:mm" / offline indicator.

## Manual review (reports)

Signed-in users can report a listing. Review on the server machine:

```sh
npm run admin -- reports            # open reports
npm run admin -- listings           # latest listings
npm run admin -- hide <listingId>   # hide from browse (owner sees "Under review")
npm run admin -- restore <listingId> # back to paused; owner republishes
npm run admin -- resolve <reportId>
```

## Layout

- `app/` Expo Router routes: native tabs (`expo-router/native-tabs`) Browse · Trips · My cars · Account, native stacks
  for car detail, booking (modal), request detail, car editor, sign-in.
- `src/domain/rental.ts` date, quote and overlap rules shared by app and server.
- `src/ui.tsx` components incl. the filter `MenuPill` (rounded selector, current choice + chevron, anchored menu with tick).
- `server/` HTTP API (`app.ts`), SQLite schema (`db.ts`), seeds, admin CLI, tests.

## Not in the pilot

Payments, chat, reviews, push notifications, password reset, email verification, rate limiting, HTTPS (put the API
behind a reverse proxy for anything beyond a LAN pilot), deleting listings/accounts, photo reordering, cleanup of
removed photo files.

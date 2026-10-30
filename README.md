# Oinkly 🐷

A piggy bank for kids, inside Nimiq Pay. Children do **Quests** (chores), earn **coins**, watch their **Dream** fill up, and unlock **Money Badges**. They never see the word crypto. Parents approve everything and real NIM goes to each child's own Piggy address.

Live: https://oinkly-kids.vercel.app

## Words in the app
| In Oinkly | What it means |
|---|---|
| Coins | 1 coin = 10 NIM (naira value shown) |
| Piggy | The child's jar (a Nimiq address the parent controls) |
| Quests | Chores that earn coins |
| Dream | A savings goal with a picture |
| Saver points | +5 per quest, plus daily points for coins kept in the Piggy (2× after a 7-day streak; breaking the bank restarts it). 10 points = 1 coin, paid in real NIM by the grown-up |
| Name tag | A saver rank that grows with lifetime points: Piggy Starter, Coin Keeper, Smart Saver, Super Saver, Money Master |
| Badges | Saver badges (streaks, points, first cash-in) and money lessons that unlock as coins grow |
| Grown-up corner | The parent screen, behind a PIN |

## How to open it
1. Install Nimiq Pay ([iOS](https://apps.apple.com/app/nimiq-pay/id6471844738), [Android](https://play.google.com/store/apps/details?id=com.nimiq.pay)).
2. Go to Mini Apps, then Custom URL, and enter `https://oinkly-kids.vercel.app`.

## For grown-ups
1. Open Oinkly in Nimiq Pay and answer **Yes** to "Are you a parent?" (kids tap **No** and scan or paste their Piggy link). Your Nimiq address becomes your family account (outside Nimiq Pay you can tap **Try a demo family**; payments are off).
2. **Add child:** type a name, pick an animal and tap **Create Piggy**. Oinkly makes a new Nimiq address for the child (the key stays on your phone; back it up in Settings). You can paste an existing Nimiq address instead.
3. **Link Piggy:** send 1 NIM with memo `Oinkly:link:<childId>`, then tap **Check link**. The first link payment to a Piggy decides its grown-up, and later ones are ignored.
4. **Kid's phone:** tap it to show a QR code. Your child scans it and sees only their own Piggy, with no wallet.
   **Kid's login key:** shows the Piggy's private key as a QR code. Your child scans it (or pastes the key) to log in, and can then **break the bank**.
5. Add Quests and set the Dream. When your child taps "I did it!", tap **Pay**: Nimiq Pay sends the NIM with a note like `Quest: Make bed · Ada`.
6. Send **Pocket money** in one tap, and answer "Ask to spend" requests.
   When your child cashes in saver points, it shows under **Needs you**: tap **Pay** and Nimiq Pay sends the NIM.
7. Settings: set a 4-digit PIN, back up Piggy keys, and copy the **family recovery code** to open the family on a second grown-up phone.

## For kids
- Tap **No, I'm a kid** and log in with the Piggy key your grown-up gave you.
- Tap the piggy and watch the coins drop in.
- Do a Quest and tap **I did it!**, then wait for a grown-up to approve it.
- Watch your Dream picture get more colourful as you save.
- Keep your coins in the Piggy and tap **Collect** every day to grow saver points. Save 7 days in a row and they grow 2×.
- Open **Saver** to see your name tag, your badges, and **Turn points into NIM**.
- Tap **Ask to spend** and choose whether it's a Need or a Want.
- **Ask to spend**, and your grown-up gets a pop-up to say yes or not now.
- **Break the bank** once they say yes: the approved coins go as NIM to your grown-up so they can cash out and buy it. You both get an invoice-style receipt listing the quests that earned it.

## Network
The live app runs on Nimiq **mainnet** with real NIM. Local development (`npm run dev`) uses **testnet**, with balances from `rpc.testnet.nimiqwatch.com` and links to `test.nimiq.watch`. To test there:
1. In Nimiq Pay, long-press **Settings** for about 10 seconds to open the developer menu, then switch to **Testnet**.
2. Tap **Get free NIM**.
3. Payments from Oinkly now use test NIM. If Nimiq Pay is on a different network than Oinkly, the grown-up corner shows a warning and payments are blocked.

Set `VITE_NIMIQ_NETWORK=testnet` or `mainnet` to override the default for any build.

## Limits right now
- Created Piggy keys live only on the parent's phone. Back them up.
- The coin count is kept in the app and isn't matched to the on-chain balance.
- Saver points are app points until the grown-up pays a cash-in in NIM.
- The family is protected by a secret code, not a wallet signature (Nimiq Pay has no sign-message call yet).
- Not yet tested inside a real Nimiq Pay wallet.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the diagram, data model, conflict rules and custody notes.

## Run it yourself
```
npm install
npx vercel dev   # runs the app plus the /api sync functions
```
Built with Vite, React and TypeScript, Vercel functions and Vercel Blob. Set `BLOB_READ_WRITE_TOKEN` for persistent sync; without it the API uses temporary in-memory storage.

## License
[MIT](LICENSE)

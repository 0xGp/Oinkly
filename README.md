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
| Patience Seeds | A 5% weekly bonus for not spending, which teaches interest |
| Money Badges | One-line money lessons that unlock as coins grow |
| Grown-up corner | The parent screen, behind a PIN |

## How to open it
1. Install Nimiq Pay ([iOS](https://apps.apple.com/app/nimiq-pay/id6471844738), [Android](https://play.google.com/store/apps/details?id=com.nimiq.pay)).
2. Go to Mini Apps, then Custom URL, and enter `https://oinkly-kids.vercel.app`.

## For grown-ups
1. Tap **Grown-up corner** and enter the PIN (the demo PIN is `1234`; change it on the first visit).
2. Add each child, then paste their Piggy address (`NQ...`) or tap the button to use your own Nimiq Pay account.
3. Add Quests with coin rewards, and set each child's Dream.
4. When a child taps "I did it!", approve the quest. Nimiq Pay sends the NIM with a note like `Quest: Make my bed`.
5. Use **Pocket money** to send coins in one tap, and approve or decline "Ask to spend" requests.

## For kids
- Tap the piggy and watch the coins drop in.
- Do a Quest and tap **I did it!**, then wait for a grown-up to approve it.
- Watch your Dream picture get more colourful as you save.
- Leave your coins in for a week to grow Patience Seeds.
- Tap **Ask to spend** and choose whether it's a Need or a Want.
- Open **Badges** to read the money lessons you've unlocked.

## Testing with free NIM (testnet)
The app is set up for **mainnet**: payments move real NIM. To test without real money:
1. In Nimiq Pay, long-press **Settings** for about 10 seconds to open the developer menu, then switch to **Testnet**.
2. Tap **Get free NIM**.
3. Payments from Oinkly will now use test NIM, because Nimiq Pay sends them on whichever network it is on.
Note: the Piggy balance shown in the Grown-up corner is still read from mainnet, so it won't show test NIM.

## Limits right now
- Data is saved on one phone only (in the browser's storage), so the kid and parent screens must be on the same device.
- The coin count is kept in the app and isn't matched to the on-chain balance.
- Approving a spend lowers the coin count but doesn't move NIM.
- Patience Seeds are app points, not real on-chain interest.
- The PIN is a simple lock, not real security.

## Run it yourself
```
npm install
npm run dev
```
Built with Vite, React and TypeScript.

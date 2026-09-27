# Relay: demo script (≈5 minutes)

**Before you start:** run `npm run seed` (resets the demo data), then `npm run dev`, then open http://localhost:5173.
Use the **one-click demo login** buttons on `/login`. To switch users, press the log-out icon (top right), then go back to **Log in**.

> Tip: keep a second browser window (or an incognito window) logged in as another role to show the board updating live. It refreshes every 15 s.

---

### 0. Landing page (20 s)
- "Relay is a community board for urgent **non-medical** help during floods, cyclones and outages."
- Point at the **live counters** (open requests, critical requests, verified volunteers) and the two CTAs: *I need help* / *I want to volunteer*.

### 1. Requester posts a CRITICAL need
1. Log in as **Requester** (`requester@relay.demo`).
2. Click **I need help**. Choose **Food** and **Critical**.
   - Title: `Food packets for 10 people`
   - Details: `Family of 10 stuck on first floor, water knee deep outside. Need ready-to-eat food.`
   - Quantity `10`, People affected `10`, Area `Velachery`, Street `5th Main Rd, near Vijaya Nagar bus stop`
   - (Optional) **Use my current location**. Without it, Relay uses the approximate centre of Velachery.
3. Show **inline validation**: clear the title and submit, and the fields turn red with messages.
4. Submit, and you land on the request page with status **Open** and a timeline.
5. Click **Board**. The request is in the **top row of CRITICAL cards**, tagged **NEW**.
   - Talking point: *sorted by priority, then oldest first so nobody waits forever. Within a priority, unclaimed requests come first.*

### 2. Pending volunteer can look but not accept
1. Log out, then log in as **Volunteer (pending)** (`pending@relay.demo`).
2. The dashboard shows the amber **"pending verification"** banner.
3. Open the new request. **Accept is disabled**, with an explanation, and the address and phone are hidden.
   - Talking point: *this is enforced on the server too. The API returns 403 for unapproved volunteers.*

### 3. Admin approves the volunteer
1. Log out, then log in as **Admin** (`admin@relay.demo` / `Admin@123`).
2. Show the stats cards: **Pending verifications = 2**.
3. On **Priya Venkatesh**, click **Approve**, add the note `SRM student ID verified over video call`, and confirm.
4. The stats update right away: **Pending 1**, **Verified volunteers 4**.
5. Scroll down to the **charts** (status / priority / category / city) and the **Reported requests** list (the seeded "Free iPhones" scam).

### 4. Volunteer accepts → starts → fulfils
1. Log out, then log in as **Volunteer (pending)** again (Priya, who is now verified). The badge says **Volunteer · verified** with no re-registration needed.
2. Go to **Board** and tap **Near me**.
   - If the browser location prompt is denied, Relay says it's *using your saved area (Velachery)*.
   - Move the radius slider (5 km). Cards show "300 m away", and the sort switches to nearest.
   - Alternatively, use the **Area → Velachery** filter.
3. Open **Food packets for 10 people**, then **Accept this request**. The requester's phone and exact address now appear.
4. **Start - I'm on my way** → **Mark as fulfilled**, adding the note `Delivered 10 packets`.

### 5. Requester sees the full timeline
1. Log out, then log in as **Requester**.
2. Go to **My requests** (grouped by status) and open the request.
3. The **timeline** shows *posted → accepted by Priya → started → fulfilled*, with times and notes, and the progress bar is complete.

---

### Bonus points, if time allows
- **Map view** (`/map`): pins coloured by priority, with the radius circle when Near me is on.
- **Race safety**: `npm test` includes a test where 3 volunteers accept the same request simultaneously. Exactly one wins, and the others get 409.
- **Offline**: say this is a PWA. The board stays readable offline and requests are queued and posted when you reconnect. (For a live demo, use a production build: `npm run build -w client && npm run preview -w client`, open http://localhost:4173, load the board once, then turn on airplane mode or DevTools → Network → Offline.)
- **Phone view**: DevTools device toolbar at 375 px shows large tap targets and the collapsible filter panel.
- **Report**: as any volunteer, open a request and choose *Report as fake*. It appears in the admin's Reported requests list.

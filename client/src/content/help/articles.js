export const HELP_ARTICLES = [
  {
    id: 'borrowing-and-renewals',
    title: 'Borrowing Books & Loan Renewals',
    category: 'Circulation',
    tags: ['borrow', 'loan', 'renew', 'due date', 'checkout', 'return'],
    summary: 'Learn how to borrow physical books, view active due dates, and request loan extensions.',
    content: `
# Borrowing & Loan Renewals

## How to Borrow a Book
1. Browse the campus catalog or use search to find a book.
2. Visit the campus library desk or click **Request Loan** if eligible.
3. Show your patron digital ID card for instant scanning and checkout.

## Renewing Active Loans
- Active loans can be renewed up to 3 days before their due date if no other patron has reserved the item.
- Go to **My Loans** on your dashboard and click **Renew Loan**.
    `,
  },
  {
    id: 'inter-library-loans',
    title: 'Inter-Library Loans (Cross-College Sharing)',
    category: 'Cross-College Sharing',
    tags: ['ill', 'cross-college', 'inter-library', 'partner', 'share', 'request'],
    summary: 'Discover and request physical books and e-resources from partner institutions.',
    content: `
# Inter-Library Loans (ILL)

## Requesting Partner College Resources
1. Navigate to the **Cross-College Catalog** tab on your navigation bar.
2. Search for items marked with partner institution badges (e.g., *From College Alpha*).
3. Click **Request ILL** to open the confirmation modal and submit your request.

## Tracking Request Status
- View real-time status transitions (Requested → Approved → In Transit → Fulfilled) on your **Inter-Library Requests** timeline.
    `,
  },
  {
    id: 'fine-settlement-razorpay',
    title: 'Fine Settlement & Razorpay Payments',
    category: 'Payments & Fines',
    tags: ['fine', 'payment', 'razorpay', 'overdue', 'pci-dss', 'settlement', 'credit card'],
    summary: 'Understand fine accrual and how to settle outstanding balances via Razorpay.',
    content: `
# Fine Settlement & Payments

## Overdue Fine Accrual
- Fines accrue daily for overdue loans according to your college library policy.
- Check your outstanding balance on the **Fines & Settlement** dashboard page.

## Secure Razorpay Checkout
- Click **Pay Fines Now** to launch the PCI-DSS compliant Razorpay checkout modal.
- Amounts are computed server-side to guarantee accuracy.
- Once verified by server webhook, your balance is automatically cleared and receipt generated.
    `,
  },
  {
    id: 'offline-downloads',
    title: 'Offline E-Resource Reading Mode',
    category: 'E-Resources',
    tags: ['offline', 'download', 'indexeddb', 'eresource', 'pdf', 'epub', 'service worker'],
    summary: 'Download e-books and lab notes for offline reading without an active internet connection.',
    content: `
# Offline Download Mode

## Downloading Resources
1. Open any downloadable e-resource marked with **Available Offline**.
2. Click **Download Offline** to save the file securely into IndexedDB.
3. Access downloaded materials anytime via the **Offline Downloads** page, even when completely disconnected from the internet.
    `,
  },
  {
    id: 'reading-streaks-and-achievements',
    title: 'Reading Goals, Streaks & Badges',
    category: 'Gamification',
    tags: ['streak', 'gamification', 'badge', 'points', 'leaderboard', 'freeze'],
    summary: 'Build daily reading habits, earn milestone stickers, and protect your streak with streak freezes.',
    content: `
# Reading Streaks & Achievements

## Building Daily Streaks
- Log reading activity daily to build your active streak.
- Earn unlockable stickers and points that contribute to your college leaderboard rank.

## Streak Freezes
- If you miss a day, available **Streak Freezes** automatically protect your streak from resetting.
    `,
  },
];

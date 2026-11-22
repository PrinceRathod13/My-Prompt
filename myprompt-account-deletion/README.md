# MyPrompt – Account Deletion Website

A minimal, single-page website for **MyPrompt Account & Data Deletion**, ready for direct deployment on **Vercel** and compliance with **Google Play Store Account Deletion Policy**.

---

## Features & Compliance

- **Minimalist & Clean Design**:
  - Pure white background.
  - MyPrompt title and branding at the top.
  - Heading: `"Delete Your Account"`.
  - Description: `"Enter your registered MyPrompt email address to request deletion of your account and associated personal data."`
  - Single email input field.
  - One blue button: `"Request Account Deletion"`.
  - Clean confirmation message.
  - Fully mobile-friendly and responsive.
  - Zero navigation bars, zero dashboards, zero unwanted animations.
- **Security & Data Privacy**:
  - **Email Ownership Verification**: Requires the user to click a cryptographically signed verification link sent to their registered email before any deletion is executed. An attacker cannot delete someone else's account.
  - **No Exposed Credentials**: Firebase Admin private keys are stored securely in Vercel Environment Variables only and are never exposed to the frontend or browser.
  - **Complete Personal Data Cleanup**:
    - Deletes document in Firestore `users/{uid}`
    - Deletes `user_favorites/{uid}`
    - Deletes `saved_prompts/{uid}`
    - Deletes `copied_prompts/{uid}`
    - Deletes Firebase Authentication user record (`admin.auth().deleteUser(uid)`)

---

## Project Structure

```
myprompt-account-deletion/
├── api/
│   ├── lib/
│   │   └── firebase-admin.js     # Secure server-side Firebase Admin initialization & token signing
│   ├── request-deletion.js       # Serverless function: validates user and generates verification link
│   └── verify-and-delete.js      # Serverless function: verifies token & permanently deletes Firestore + Auth records
├── public/
│   ├── index.html                # Clean, mobile-friendly single-page interface
│   └── logo.png                  # MyPrompt transparent logo
├── .env.example                  # Template of required Vercel Environment Variables
├── package.json                  # Dependencies (firebase-admin)
├── vercel.json                   # Vercel deployment routing configuration
└── README.md                     # Documentation
```

---

## How to Deploy to Vercel (3 Simple Steps)

### Step 1: Push or Upload to Vercel
You can deploy using either method:
- **Option A (Via Vercel CLI)**:
  ```bash
  cd myprompt-account-deletion
  npx vercel
  ```
- **Option B (Via Vercel Web Dashboard)**:
  1. Push the `myprompt-account-deletion` folder to your GitHub/GitLab repository.
  2. Log in to [vercel.com](https://vercel.com).
  3. Click **Add New...** &rarr; **Project**.
  4. Select your repository and click **Deploy**.

---

### Step 2: Configure Environment Variables in Vercel
In your Vercel Project Dashboard:
1. Go to **Settings** &rarr; **Environment Variables**.
2. Add the following keys (from your Firebase project `mypromptapp-dcc07`):

| Variable Name | Value / Description |
| :--- | :--- |
| `FIREBASE_PROJECT_ID` | `mypromptapp-dcc07` |
| `FIREBASE_CLIENT_EMAIL` | Your Firebase service account email (e.g. `firebase-adminsdk-xxx@mypromptapp-dcc07.iam.gserviceaccount.com`) |
| `FIREBASE_PRIVATE_KEY` | Your Firebase private key (`-----BEGIN PRIVATE KEY-----\n...`) |
| `DELETION_TOKEN_SECRET` | Any long random secret string used for HMAC signing |
| `APP_BASE_URL` | Your live Vercel URL (e.g. `https://myprompt-account-deletion.vercel.app`) |

#### Where to get your Firebase Service Account Key:
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select **mypromptapp-dcc07**.
3. Go to **Project Settings** (gear icon) &rarr; **Service accounts** tab.
4. Click **Generate new private key**.
5. Copy `client_email` and `private_key` from the downloaded JSON file into your Vercel Environment Variables.

---

### Step 3: Google Play Store Account Deletion URL
Once deployed, copy your Vercel URL:
```
https://your-app-name.vercel.app
```
Enter this URL in the **Google Play Console** under:
**Policy and programs** &rarr; **App content** &rarr; **Data safety** &rarr; **Account deletion web link**.

---

## Local Testing

You can run the frontend and API locally:
```bash
cd myprompt-account-deletion
npm install
npm start
```
Open `http://localhost:3000` in your browser.

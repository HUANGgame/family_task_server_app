# Family Task Server App

Node.js + Express family task app with static HTML/CSS/JavaScript screens, Supabase PostgreSQL data storage, Supabase Storage photo uploads, and Render Web Service deployment settings.

## Features

- First screen asks the user to choose parent or child, with large icon buttons.
- Child role selection uses Bopomofo ruby annotations shown under the Chinese text.
- Parent selection opens registration/login; child selection opens child login.
- Signup creates a family, a manager account, and the first child account in one request.
- Manager receives a generated `family_code`; each child receives a generated 4-character `child_code`.
- Parent creates child accounts for children, then gives each child the Family Code and 4-character Child Code.
- Parent password reset uses the Family Code plus parent name. No email, SMS, or paid service is required.
- Manager login uses `family_code + manager_password`.
- Child login uses `family_code + child_code`.
- Manager can create/delete children, assign tasks, require photos, add fines, add shop items, and add encouragement messages.
- Child can view tasks, upload image proof, finish tasks, earn points, view fines, and redeem shop rewards.
- Child page includes Bopomofo reading support with ruby annotations shown under Chinese characters.
- Server stores all data in Supabase PostgreSQL and photos in Supabase Storage.
- No `data.json`, no local `public/uploads`, no Python.
- AI task suggestion is a local demo function named `aiSuggestion()` and does not call any AI API.

## Project Structure

```text
.
├── package.json
├── server.js
├── render.yaml
├── supabase_schema.sql
├── .env.example
└── public
    ├── index.html
    ├── manager.html
    ├── child.html
    ├── styles.css
    ├── app.js
    ├── manager.js
    └── child.js
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in values:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_STORAGE_BUCKET=task-photos
JWT_SECRET=replace-with-a-long-random-secret
NODE_ENV=development
PORT=3000
```

3. Run the server:

```bash
npm start
```

4. Open:

- Home: `http://localhost:3000/`
- Manager: `http://localhost:3000/manager`
- Child: `http://localhost:3000/child`

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run all SQL in `supabase_schema.sql`.
4. Create a Storage bucket with the same name as `SUPABASE_STORAGE_BUCKET`.
5. Make the bucket public if you want `tasks.photo_url` to be immediately viewable from the browser.

The service role key must stay server-side only. Put it in Render environment variables or a local `.env` file. Do not expose it in frontend JavaScript.

## Render Deployment

Create a Render Web Service with:

- Language: `Node`
- Build Command: `npm install`
- Start Command: `npm start`

Set these Render environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
SUPABASE_STORAGE_BUCKET
JWT_SECRET
NODE_ENV
PORT
```

Render sets `PORT` automatically. `server.js` uses:

```js
const PORT = process.env.PORT || 3000;
```

The included `render.yaml` can also be used as a blueprint.

## API Summary

All successful API responses use:

```json
{
  "ok": true,
  "data": {}
}
```

Errors use:

```json
{
  "ok": false,
  "message": "Error message"
}
```

### Public

- `POST /api/signup`
- `POST /api/families`
- `POST /api/manager/login`
- `POST /api/manager/reset-password`
- `POST /api/child/login`
- `GET /api/health`

### Manager Token Required

- `GET /api/manager/dashboard`
- `POST /api/manager/children`
- `GET /api/manager/children`
- `DELETE /api/manager/children/:childId`
- `POST /api/manager/children/:childId/tasks`
- `GET /api/manager/children/:childId/tasks`
- `DELETE /api/manager/children/:childId/tasks/:taskId`
- `POST /api/manager/children/:childId/fines`
- `GET /api/manager/children/:childId/fines`
- `POST /api/manager/shop`
- `GET /api/manager/shop`
- `DELETE /api/manager/shop/:itemId`
- `POST /api/manager/encouragements`
- `GET /api/manager/encouragements`
- `POST /api/manager/ai-suggestion`

### Child Token Required

- `GET /api/child/me`
- `GET /api/child/tasks`
- `POST /api/child/tasks/:taskId/photo`
- `PUT /api/child/tasks/:taskId/finish`
- `GET /api/child/fines`
- `GET /api/child/shop`
- `POST /api/child/shop/:itemId/redeem`
- `GET /api/child/encouragement`

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` is used only in `server.js`.
- Parent passwords are stored as bcrypt hashes.
- Manager and child sessions are JWTs stored in browser `sessionStorage`.
- Child APIs are scoped by both `family_id` and `child_id`.
- Manager APIs are scoped by `family_id`.
- Photo uploads accept only `image/*` and are limited to 5 MB.

## Manual Test Flow

1. Open `/`.
2. Choose parent or child.
3. If parent, create the family, manager account, and first child account from `/manager`.
4. Copy the generated Family Code and 4-character Child Code.
5. Continue into manager mode.
6. Add more children, tasks, shop items, fines, and encouragement messages.
7. If child, open `/child`.
8. Log in with Family Code and the 4-character Child Code.
9. Upload a photo for tasks that require one.
10. Finish tasks and confirm points increase.
11. Redeem an item and confirm points and stock decrease.

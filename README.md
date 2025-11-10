This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Environment Variables

Create a `.env.local` file in the project root with the backend URL (default shown):

```
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

Restart the dev server after updating environment variables.

### Sending Emails End-to-End

1. Start the FastAPI backend: `uvicorn app.main:app --reload` (from the `automail-backend` folder).
2. In the frontend Table Editor, upload or edit your CSV. Ensure it contains `recipient` and `email` columns.
3. Choose an HTML template (managed in the Template Editor), adjust the subject/CC list, and toggle attachments as needed.
4. Click **Send Emails**. The frontend uploads your dataset to the backend and triggers `/emails/send-bulk`, using the selected template.
5. Track progress in the backend logs (`email_log.csv` plus console output).

The backend resolves templates via the Next.js API (`/api/templates`), so both servers must be running for email sending to work.

## Learn More

- [FastAPI + Email Service Documentation](../automail-backend/README.md)
- [Next.js Documentation](https://nextjs.org/docs)

Happy automailing!

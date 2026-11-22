# AirWatch Deployment Guide

This guide deploys the public AirWatch website to Render, configures private reading storage with Supabase, and publishes an Android APK download.

## What you need

- The AirWatch repository on GitHub, with the branch you intend to deploy (usually `main`).
- A Supabase project.
- A Render account connected to the GitHub repository.
- Android build tools installed locally if you need to build a cloud-enabled APK.

The ESP32 communicates with the Android app over Bluetooth Low Energy (BLE). The phone needs internet access to upload readings to Supabase; the ESP32 itself does not connect to the cloud.

## 1. Create the Supabase table

1. Create a project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. In the project, open **SQL Editor → New query**.
3. Copy [`supabase/schema.sql`](../supabase/schema.sql) into the editor and run it once.
4. Open **Table Editor** and confirm `airwatch_readings` exists.

The SQL enables row-level security and limits authenticated users to their own readings. If the script already ran successfully, do not run it again.

## 2. Deploy the website on Render

1. Push the latest code to the GitHub branch you want Render to deploy.
2. In the [Render Dashboard](https://dashboard.render.com), select **New + → Blueprint**.
3. Connect the GitHub repository. Select the production branch (for example, `main`) and keep the Blueprint path as `render.yaml`.
4. Deploy the Blueprint. It creates the `airwatch-dashboard` Static Site described in [`render.yaml`](../render.yaml).
5. Wait for the service deployment to show **Live**, then copy its `https://...onrender.com` address.

If a deployment fails, open the failed deployment and inspect the last lines of its build logs before retrying.

## 3. Add Supabase settings to Render

In Supabase, find the **Project URL** under **Data API** and the **Publishable key** under **Settings → API Keys**. In Render, open **airwatch-dashboard → Environment** and add:

| Key | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Publishable key |

The environment variable keeps the existing `ANON_KEY` name; the current Supabase Publishable key is the client-safe value to use. Never use a Supabase Secret key or `service_role` key in the website or APK. Select **Save and deploy** after adding the variables.

## 4. Set Supabase Auth URLs

In Supabase, open **Authentication → URL Configuration**:

1. Set **Site URL** to the Render website address.
2. Add the same address to the allowed redirect URLs.
3. Save the settings.

## 5. Build and publish the APK

To enable Supabase cloud sync in the Android app, build the APK with the same project URL and Publishable key:

1. Copy `.env.example` to `.env`.
2. Replace the placeholders in `.env` with the Supabase values. Keep `.env` private; it is ignored by Git.
3. Run these commands in PowerShell from the repository root:

   ```powershell
   pnpm install --frozen-lockfile
   pnpm run build:apk
   New-Item -ItemType Directory -Force public\downloads
   Copy-Item android\app\build\outputs\apk\debug\app-debug.apk public\downloads\airwatch.apk -Force
   ```

4. Commit and push `public/downloads/airwatch.apk` to the branch Render deploys. Render will rebuild the site and include the APK at `/downloads/airwatch.apk`.

The generated APK is a debug build for testing. A separate signed release build is needed for Play Store distribution.

## 6. Verify the setup

1. Open the Render website and create an account.
2. Install the downloaded APK and sign in with the same account.
3. Connect the phone to AirWatch over BLE and keep the phone online.
4. Check the `airwatch_readings` table in Supabase and the website dashboard for that account's readings.

The APK uploads valid readings at most once every 30 seconds. Cloud access is account-protected by Supabase Auth and the table's row-level security policies.

## Troubleshooting

- **`ERR_PNPM_OUTDATED_LOCKFILE`:** update and push `pnpm-lock.yaml` whenever `package.json` dependencies change. Render must receive both files.
- **APK download returns 404:** confirm `public/downloads/airwatch.apk` is committed to the deployed branch, then redeploy.
- **Website still says cloud is not configured:** check both Render environment variable names and values, save, and wait for a fresh build.
- **No readings appear:** confirm the APK was built after setting `.env`, both clients use the same Supabase project and account, and the phone has internet while connected to BLE.


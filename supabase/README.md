# Connect Pulse Stage to your own Supabase backend

The supplied Supabase Project URL and public publishable key are now configured. The SQL installation and anonymous sign-in setting still need confirmation in your project. Gameplay and local saves remain available during setup. The old Sites database and its uploads are left in place; this setup does not migrate them.

1. Open https://supabase.com/dashboard and create a **new project** in your own account. Keep its database password private. Choose the plan and region that suit you; no subscription or billing change is made by this repository.
2. Open the project's **SQL Editor**, paste [setup.sql](setup.sql), and run it once. It creates the song table, private media bucket, validation functions, and ownership/read policies in one transaction. It is intended for a new project, not an existing database with these object names.
3. In **Authentication → Sign In / Providers**, enable **Allow anonymous sign-ins**. This powers the game's **Continue on this device** button without a separate email service. These are real, authenticated Supabase users; ownership rules still apply. Configure provider rate limits and bot protection before promoting a public upload service. If you enable CAPTCHA, the game needs its CAPTCHA token integration before sign-in will work.
4. From the project's **Connect** dialog (or **Settings → API Keys**), copy the **Project URL** and **publishable key**. Update `public/backend-config.js` and its root GitHub Pages copy `backend-config.js` with those two public values, leaving `provider: 'supabase'`. You can give these public values to ChatGPT to finish connecting the game. **Never provide a database password, `sb_secret_…`, or `service_role` key.**
5. Rebuild/deploy the hosted version and commit the public files for GitHub Pages. The supplied public connection settings are already in the game. If SQL or authentication setup is incomplete, the library will report that service error; it does not attempt the old cross-site sign-in.

```js
window.PulseBackendConfig = Object.freeze({
  provider: 'supabase',
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  publishableKey: 'YOUR_PUBLIC_PUBLISHABLE_KEY',
  allowDeviceSignIn: true,
  emailSignIn: false
});
```

The public key is meant to be visible in a browser. Access control is enforced in the database and private storage bucket, using the visitor's Supabase access token. No ChatGPT login cookie is used. Don't disable row-level security or make the bucket public.

## How players use it

Song Library, upload, and sign-in stay in the existing popup. Anyone can browse and play **published, completed** songs after the backend is connected. To upload, choose **Sign in → Continue on this device**, add a title/creator, then upload. Private songs remain visible only to that device account. The token is stored under the game's origin; another device, another site address, signing out, or clearing browser data does not carry this account over. Use the same game address consistently.

Each account can have 40 levels, including incomplete uploads. Limits: audio 25 MiB, image/video 50 MiB, chart 2 MB, song 20 minutes, 30,000 notes. Files upload to private paths and the level becomes readable to the community only after the server verifies that all expected files have arrived. Audio and backgrounds already within the limit retain their original bytes. Oversized backgrounds are automatically re-encoded for upload at the same pixel dimensions; that upload copy can have lower encoding quality. The imported original is kept locally. Turning publication off prevents new public reads. Deletion first makes a level private, then removes its files and record; a failed cleanup can be retried by its owner.

Device sign-in is convenient but not a recoverable cross-device account. Optional email sign-in is described below. It does not automatically merge an existing device account into an email account.

## Optional email-code accounts

Enable email auth in Supabase. In **Authentication → Email Templates → Magic Link**, use an OTP template, for example:

```html
<h2>Pulse Stage sign-in code</h2>
<p>Enter this code in the game: {{ .Token }}</p>
```

Set `emailSignIn: true` in the config to show the email/code forms. The code is entered in the popup; the game does not open a sign-in tab. Supabase's built-in email sender is restricted to project-team addresses and is for testing. Configure your own SMTP delivery in the Supabase dashboard before offering email-code sign-in to other players. Keep SMTP credentials in Supabase, never in this repository. Device sign-in does not require SMTP.

## Validation before activation

Local tests cover the browser adapter, session refresh, request routing, upload ordering, rollback and deletion. They do **not** prove that the SQL policies work in a real project. After running setup, verify these in the actual project before considering the online feature ready:

- Two distinct signed-in test users cannot read each other's private levels or media, or update/delete each other's uploads.
- An anonymous visitor can read published completed levels and media, but cannot write, read unfinished uploads, or read private media.
- A client cannot set `ready`, change owner/paths, upload files for another user, overwrite finalized files, or bypass the 40-record limit.
- Upload a real song and 4K background, play it from another browser, unpublish it, then verify public reads stop. Delete it and verify both objects are removed.
- Test expired-session refresh, device-account persistence, and a failed upload on the actual game URL.

The SQL defines policies for this new backend only. An existing Sites owner ID is not a Supabase user ID; old private uploads need an explicit, owner-authorized migration or re-upload.

## Sources

- API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Anonymous users: https://supabase.com/docs/guides/auth/auth-anonymous
- Email OTP: https://supabase.com/docs/guides/auth/auth-email-passwordless
- Email delivery limits: https://supabase.com/docs/guides/auth/auth-smtp
- Storage policies: https://supabase.com/docs/guides/storage/security/access-control
- Standard uploads: https://supabase.com/docs/guides/storage/uploads/standard-uploads

## Increase limits on an existing project

The game accepts background images and videos up to **50 MiB per file**. For a project installed with the older 40 MiB image / 20 MiB video limits, run [increase-background-limit.sql](increase-background-limit.sql) once in SQL Editor. It changes the private bucket limit and upload-finalization check without deleting any records or files. Audio stays at 25 MiB. In **Storage Settings**, also ensure the global file-size limit is at least 50 MB. Supabase Free projects cannot exceed a 50 MB global maximum; larger files require compression or a plan that permits a higher limit, followed by matching app/database changes. No plan or billing settings are changed by this patch.

After running the patch, refresh the game and retry. Existing local levels keep their original files and do not need to be regenerated.

## Automatic background compression

Both Upload Song buttons prepare oversized backgrounds automatically before upload. Files already within 50 MiB are sent unchanged. For larger files, the game keeps the imported original and creates a separate upload copy:

- Still images are encoded as PNG first, then WebP at progressively lower quality only if necessary. The canvas always uses the decoded source width and height.
- Videos and supported animated images are converted to a browser-supported WebM/MP4 at the same width and height, at up to 30 fps, with a bitrate targeted below the limit. Background audio is omitted (backgrounds are already muted in the game). The output dimensions are checked before upload.
- Animation decoding uses ImageDecoder when available; a browser that cannot preserve an animation stops with an error instead of flattening it into a still image.
- Moving-image conversion runs in real time and may take about the clip's length, or twice that if a lower-bitrate retry is needed. Keep the tab visible. Progress and Cancel are inside the existing popup.
- Results are cached for that source file during the page session. Cancelling or failing compression does not replace the local original or upload a partial clip.

Playback decodes the uploaded file at its encoded dimensions, so a 3840 × 2160 source remains 3840 × 2160. This does not reconstruct lost encoding quality or the exact original file. Local Save Song retains the imported original; online players receive the upload copy. Source files are limited to 250 MiB, 40 megapixels, and 20 minutes for automatic conversion, and animated image conversions to 3000 frames. If the browser cannot fit the file without changing resolution, it stops rather than silently resizing or truncating it. Audio remains limited to 25 MiB and is not automatically re-encoded.

The automatic-compression logic and integration have automated tests with mocked browser codecs. Real browser video/image encoding and uploads still require testing on the target device.

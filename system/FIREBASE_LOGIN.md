# Firebase login: what failed, and what to do instead

Do not start another `firebase login` on this PC. It failed for two days. The website console login and the CLI login are not the same thing. Being signed in at console.firebase.google.com does not sign in the command line.

## What we tried, and why it failed

Run the commands from `D:\projects\luxiva\Luxiva`. Running them from `C:\Windows\system32` cannot see the project.

These all failed:

- `npx firebase-tools login`
- `npx firebase-tools login --reauth`
- `npx firebase-tools login --no-localhost`

The browser either said the code was no longer valid, or the CLI said `Unable to authenticate using the provided code`.

Mistakes that looked like the cause, but were not the real bug:

- Pasting the short session id (for example `603B8` or `22A51`). That is not the authorization code.
- The auth link wrapping onto two lines, so the copied link was missing the ending.
- The authorization code itself wrapping onto two lines. It has to be one line.
- Node is v24.17.0. `firebase-tools@13.35.1` prints an engine warning. The warning is not the failure.

The real failure: this PC’s copy of `firebase-tools` exchanges the Google code with `node-fetch`. That request dies with `Premature close` against `https://www.googleapis.com/oauth2/v4/token`. The CLI then reports it as “credentials are no longer valid.” A normal browser sign-in cannot fix that.

## What worked

Skip the CLI login. Use a service-account key from the Firebase website, where the Google account is already signed in.

1. Open https://console.firebase.google.com/project/fancydeals-ug/settings/serviceaccounts/adminsdk
2. Click **Generate new private key**, then **Generate key**.
3. Save the download in the project folder. The file we used is `D:\projects\luxiva\Luxiva\fancydeals-ug-firebase-adminsdk-fbsvc-9fefd5e36f.json`.
4. Never commit it, never upload it to Hostinger, and never paste it into chat. `Luxiva/.gitignore` already ignores `*firebase-adminsdk*.json`.

That key alone still cannot call `firebase deploy` until two more things are true.

### 1. The key’s account needs Owner

The new key is the Firebase Admin SDK service account. It can sign in and still be forbidden to publish functions.

In Google Cloud IAM for project `fancydeals-ug`:

https://console.cloud.google.com/iam-admin/iam?project=fancydeals-ug

Find `firebase-adminsdk-fbsvc@fancydeals-ug.iam.gserviceaccount.com`, edit it, and add the role **Owner**. This was done on 6 Nov 2026. A new key does not include that role. Add Owner again if you generate another key.

### 2. Node must not use node-fetch for Google calls

`GOOGLE_APPLICATION_CREDENTIALS` pointed at the key, and deploy still said `Failed to authenticate, have you run firebase login?` The hidden detail was the same `Premature close` on the token URL.

Native `fetch` on this PC can reach that URL. `node-fetch`, which `firebase-tools` and `gaxios` use, cannot. The working deploy command called the firebase-tools script with Node directly, after those two files in the npm cache were pointed at `globalThis.fetch`:

- `C:\Users\DICKSON\AppData\Local\npm-cache\_npx\a2c365da195827f4\node_modules\gaxios\build\src\gaxios.js`
- `C:\Users\DICKSON\AppData\Local\npm-cache\_npx\a2c365da195827f4\node_modules\firebase-tools\lib\apiv2.js`

`npx` can download a fresh copy and wipe that change. If deploy says “have you run firebase login?” again, check the token error before starting another login. If it is `Premature close`, the fetch change was lost. Put `globalThis.fetch` back, or install Node 20 and use that Node for the CLI.

Command that got past login, from `D:\projects\luxiva\Luxiva`:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "D:\projects\luxiva\Luxiva\fancydeals-ug-firebase-adminsdk-fbsvc-9fefd5e36f.json"
node "C:\Users\DICKSON\AppData\Local\npm-cache\_npx\a2c365da195827f4\node_modules\firebase-tools\lib\bin\firebase.js" deploy --only functions:shopStartPesapalPayment --non-interactive --project fancydeals-ug
```

## Where that deploy stopped

Login was solved. Publishing the function was not. `fancydeals-ug` is on the Spark plan. Cloud Functions require the Blaze plan, and Blaze asks for a card. The card was refused.

Do not go back to `firebase login` to get around that. The live shop does not use the Firebase function. Checkout on fancydealsug.com posts to `public_html/api/pesapal-start.php`. The keys for that file live in `public_html/api/pesapal-config.php`, which `.htaccess` blocks from the web. Local checkout posts to the Vite route `/api/local-pesapal`.

Raise the Pesapal transaction limit in the Pesapal account. No Firebase login and no new upload is required for that.

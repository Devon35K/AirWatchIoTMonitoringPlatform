type DeploymentGuidePageProps = {
  onOpenHome: () => void;
};

export default function DeploymentGuidePage({ onOpenHome }: DeploymentGuidePageProps) {
  return (
    <div className="deployment-guide">
      <section className="guide-heading">
        <div>
          <span className="guide-kicker">AIRWATCH SETUP</span>
          <h1>Deployment guide</h1>
          <p>
            Deploy the public website on Render, store private readings in Supabase, and publish
            an Android APK download.
          </p>
        </div>
        <button className="guide-home-button" onClick={onOpenHome}>Back to Home</button>
      </section>

      <div className="guide-callout">
        <b>There are two separate services:</b> Render hosts the website; Supabase handles
        accounts and private readings. The ESP32 connects to the phone over Bluetooth, not directly
        to the internet.
      </div>

      <div className="guide-steps">
        <section className="guide-card">
          <div className="guide-step-number">01</div>
          <div>
            <h2>Create the Supabase table</h2>
            <ol>
              <li>Create a project at <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">supabase.com/dashboard</a>.</li>
              <li>Open <b>SQL Editor → New query</b> and run the project's <a href="https://github.com/Devon35K/AirWatchIoTMonitoringPlatform/blob/main/supabase/schema.sql" target="_blank" rel="noreferrer">schema.sql</a> once.</li>
              <li>In <b>Table Editor</b>, confirm that <code>airwatch_readings</code> exists. Its row-level security policies restrict readings to their account owner.</li>
            </ol>
            <p className="guide-note">If the SQL has already run successfully, don't run it again.</p>
          </div>
        </section>

        <section className="guide-card">
          <div className="guide-step-number">02</div>
          <div>
            <h2>Create the Render website</h2>
            <ol>
              <li>Push the project to the GitHub <code>main</code> branch.</li>
              <li>In <a href="https://dashboard.render.com" target="_blank" rel="noreferrer">Render</a>, select <b>New + → Blueprint</b> and connect this repository.</li>
              <li>Choose <code>main</code> and keep the Blueprint path as <code>render.yaml</code>. Deploy the Blueprint and wait for the static site to show <b>Live</b>.</li>
              <li>Open the <code>airwatch-dashboard</code> service and copy its <code>onrender.com</code> URL.</li>
            </ol>
          </div>
        </section>

        <section className="guide-card">
          <div className="guide-step-number">03</div>
          <div>
            <h2>Connect Render to Supabase</h2>
            <p>In Supabase, get the Project URL from <b>Data API</b> and the client-safe <b>Publishable key</b> from <b>Settings → API Keys</b>.</p>
            <p>In Render, open <b>airwatch-dashboard → Environment</b> and add these variables:</p>
            <pre><code>{`VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_YOUR_PUBLIC_KEY`}</code></pre>
            <p className="guide-note">The variable name says ANON_KEY, but the current Supabase Publishable key is the correct value. Never use a Secret or service_role key here.</p>
            <p>Click <b>Save and deploy</b>. Render must rebuild after environment changes.</p>
          </div>
        </section>

        <section className="guide-card">
          <div className="guide-step-number">04</div>
          <div>
            <h2>Set the Supabase website URL</h2>
            <p>In Supabase, open <b>Authentication → URL Configuration</b>. Set the Site URL to the Render URL, for example:</p>
            <pre><code>https://your-site.onrender.com</code></pre>
            <p>Add the same URL to the allowed redirect URLs, then save.</p>
          </div>
        </section>

        <section className="guide-card">
          <div className="guide-step-number">05</div>
          <div>
            <h2>Build and publish a cloud-enabled APK</h2>
            <p>On your Windows computer, copy <code>.env.example</code> to <code>.env</code>, put the same Supabase URL and Publishable key in it, then run:</p>
            <pre><code>{`pnpm install --frozen-lockfile
pnpm run build:apk
New-Item -ItemType Directory -Force public\\downloads
Copy-Item android\\app\\build\\outputs\\apk\\debug\\app-debug.apk public\\downloads\\airwatch.apk -Force`}</code></pre>
            <p>Commit and push the updated APK at <code>public/downloads/airwatch.apk</code> to <code>main</code>. Render will redeploy the site and include the download.</p>
            <p className="guide-note">Keep <code>.env</code> private. The APK build needs the Supabase values to enable cloud sync.</p>
          </div>
        </section>

        <section className="guide-card">
          <div className="guide-step-number">06</div>
          <div>
            <h2>Test the complete flow</h2>
            <ol>
              <li>Open the Render website, create an account, and sign in.</li>
              <li>Install the downloaded APK and sign in with the same account.</li>
              <li>Connect the phone to AirWatch over Bluetooth, with internet available on the phone.</li>
              <li>Check Supabase's <code>airwatch_readings</code> table, then confirm the website shows that account's readings.</li>
            </ol>
          </div>
        </section>
      </div>

      <section className="guide-troubleshooting">
        <h2>If deployment fails</h2>
        <ul>
          <li>For <code>ERR_PNPM_OUTDATED_LOCKFILE</code>, update and push <code>pnpm-lock.yaml</code> with the package changes.</li>
          <li>If the APK link returns 404, make sure <code>public/downloads/airwatch.apk</code> is in GitHub <code>main</code> and redeploy.</li>
          <li>If no readings appear, check that the APK and website use the same Supabase project and account. Keep row-level security enabled.</li>
        </ul>
      </section>
    </div>
  );
}

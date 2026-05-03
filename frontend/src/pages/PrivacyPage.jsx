import { useNavigate } from 'react-router-dom';

export default function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-md)' }}>
      <div className="card legal-page">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', color: 'var(--color-primary)', fontWeight: 600, fontSize: 'var(--font-size-sm)', padding: 0, marginBottom: 'var(--space-md)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Back
        </button>
        <h1 className="page-title">Privacy Policy</h1>
        <p className="legal-updated">Last updated: April 29, 2026</p>

        <section>
          <h2>1. Information We Collect</h2>
          <p>When you use Calorie Tracker, we collect:</p>
          <ul>
            <li><strong>Account information:</strong> name, email address, and encrypted password</li>
            <li><strong>Profile data:</strong> age, gender, height, weight, activity level, and fitness goals</li>
            <li><strong>Meal data:</strong> meal names, calorie and macronutrient values, timestamps, and uploaded food photos</li>
            <li><strong>Usage data:</strong> interactions with the Service for functionality purposes (e.g., session tokens)</li>
          </ul>
        </section>

        <section>
          <h2>2. How We Use Your Information</h2>
          <p>Your information is used to:</p>
          <ul>
            <li>Provide and personalize the Service, including calorie target calculations</li>
            <li>Process food photos through AI for nutritional estimation</li>
            <li>Generate nutrition reports and suggestions</li>
            <li>Authenticate your account and maintain security</li>
          </ul>
        </section>

        <section>
          <h2>3. Third-Party Services</h2>
          <p>
            Food photos may be sent to OpenAI's API for nutritional analysis. Photos are processed in real-time
            and are subject to <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer">OpenAI's Privacy Policy</a>.
            We do not sell your personal data to third parties.
          </p>
        </section>

        <section>
          <h2>4. Data Storage and Security</h2>
          <p>
            Your data is stored in a secured PostgreSQL database. Passwords are hashed using bcrypt.
            Authentication tokens are stored securely and expire automatically. We implement reasonable
            security measures, but no system is completely secure.
          </p>
        </section>

        <section>
          <h2>5. Data Retention and Deletion</h2>
          <p>
            Your data is retained as long as your account is active. You can delete your account at any time
            from the Profile page, which permanently removes all your data including meals, photos, and
            personal information. This action cannot be undone.
          </p>
        </section>

        <section>
          <h2>6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access and update your personal information via the Profile page</li>
            <li>Delete your account and all associated data</li>
            <li>Export your meal data through the Reports feature</li>
          </ul>
        </section>

        <section>
          <h2>7. Cookies</h2>
          <p>
            The Service uses local storage to maintain authentication tokens. We do not use tracking cookies
            or third-party analytics.
          </p>
        </section>

        <section>
          <h2>8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be reflected by the "Last updated"
            date at the top of this page.
          </p>
        </section>
      </div>
    </div>
  );
}

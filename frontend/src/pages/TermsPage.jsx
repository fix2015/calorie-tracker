import { useNavigate } from 'react-router-dom';

export default function TermsPage() {
  const navigate = useNavigate();
  return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-md)' }}>
      <div className="card legal-page">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', color: 'var(--color-primary)', fontWeight: 600, fontSize: 'var(--font-size-sm)', padding: 0, marginBottom: 'var(--space-md)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Back
        </button>
        <h1 className="page-title">Terms of Service</h1>
        <p className="legal-updated">Last updated: October 10, 2026</p>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Calorize ("the Service"), you agree to be bound by these Terms of Service.
            If you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p>
            Calorize is a nutrition tracking application that allows users to log meals manually or via
            AI-powered photo recognition, view calorie and macronutrient summaries, and receive personalized
            nutrition suggestions. The Service is provided for informational purposes only and does not constitute
            medical or dietary advice.
          </p>
        </section>

        <section>
          <h2>3. User Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials. You agree to
            provide accurate information during registration and to update it as needed. You may delete your
            account at any time from the Profile page, which permanently removes all associated data.
          </p>
        </section>

        <section>
          <h2>4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to the Service or its systems</li>
            <li>Upload malicious content or interfere with the Service's operation</li>
            <li>Resell or redistribute the Service without permission</li>
            <li>Post content that is objectionable, offensive, sexually explicit, hateful, violent, or that harasses, bullies, or threatens others</li>
            <li>Post spam or impersonate another person</li>
          </ul>
        </section>

        <section>
          <h2>5. User-Generated Content and Zero Tolerance Policy</h2>
          <p>
            Calorize lets users share meals, comments, profiles, and messages. <strong>There is no tolerance for
            objectionable content or abusive users.</strong> By using the Service you agree not to post or send any
            such content.
          </p>
          <ul>
            <li>You can report any meal, comment, user, or conversation using the <strong>Report</strong> (flag) action. Reporting a conversation also blocks the sender.</li>
            <li>You can block any user from their profile. Blocked users cannot view your profile or contact you.</li>
            <li><strong>We review every report and act on it within 24 hours</strong> by removing the offending content and, where appropriate, suspending or permanently removing the user who posted it.</li>
            <li>Content that receives multiple reports is hidden automatically until it has been reviewed.</li>
          </ul>
        </section>

        <section>
          <h2>6. AI-Powered Features</h2>
          <p>
            The Service uses artificial intelligence to estimate nutritional content from food photos. These
            estimates are approximate and may not be accurate. You should not rely solely on AI estimates for
            medical dietary needs. Always consult a healthcare professional for dietary guidance.
          </p>
        </section>

        <section>
          <h2>7. Limitation of Liability</h2>
          <p>
            The Service is provided "as is" without warranties of any kind. We are not liable for any damages
            arising from your use of the Service, including but not limited to health outcomes based on nutritional
            information provided.
          </p>
        </section>

        <section>
          <h2>8. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. Continued use of the Service after changes constitutes
            acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2>9. Termination</h2>
          <p>
            We reserve the right to suspend or terminate accounts that violate these Terms. You may stop using
            the Service and delete your account at any time.
          </p>
        </section>
      </div>
    </div>
  );
}

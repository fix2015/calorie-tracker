export default function TermsPage() {
  return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="card legal-page">
        <h1 className="page-title">Terms of Service</h1>
        <p className="legal-updated">Last updated: April 29, 2026</p>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Calorie Tracker ("the Service"), you agree to be bound by these Terms of Service.
            If you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p>
            Calorie Tracker is a nutrition tracking application that allows users to log meals manually or via
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
          </ul>
        </section>

        <section>
          <h2>5. AI-Powered Features</h2>
          <p>
            The Service uses artificial intelligence to estimate nutritional content from food photos. These
            estimates are approximate and may not be accurate. You should not rely solely on AI estimates for
            medical dietary needs. Always consult a healthcare professional for dietary guidance.
          </p>
        </section>

        <section>
          <h2>6. Limitation of Liability</h2>
          <p>
            The Service is provided "as is" without warranties of any kind. We are not liable for any damages
            arising from your use of the Service, including but not limited to health outcomes based on nutritional
            information provided.
          </p>
        </section>

        <section>
          <h2>7. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. Continued use of the Service after changes constitutes
            acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2>8. Termination</h2>
          <p>
            We reserve the right to suspend or terminate accounts that violate these Terms. You may stop using
            the Service and delete your account at any time.
          </p>
        </section>
      </div>
    </div>
  );
}

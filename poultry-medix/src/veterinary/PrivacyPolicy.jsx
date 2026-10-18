export default function PrivacyPolicy() {
  return (
    <div className="veterinary-page privacy-policy-page bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <section className="veterinary-page-heading">
        <span className="veterinary-kicker">PoultryMedix</span>
        <h1>Privacy &amp; Security</h1>
        <p>PoultryMedix: Privacy, Security, and Terms of Use Policy</p>
      </section>

      <article className="privacy-policy-card bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:border-gray-700">
        <section className="privacy-policy-section">
          <h2>1. App Ownership and Intellectual Property</h2>
          <p>PoultryMedix is an independent, proprietary digital health platform developed to integrate modern data analytics with veterinary science. All intellectual property rights, including the AI diagnostic algorithms, source code, UI/UX design, and the PoultryMedix brand, are exclusively owned by the creator. Unauthorized reproduction, distribution, or commercial exploitation of the app’s core features without explicit permission is strictly prohibited under national and international copyright laws.</p>
        </section>

        <section className="privacy-policy-section">
          <h2>2. Medical Disclaimer &amp; Telemedicine Ethics</h2>
          <p>PoultryMedix provides AI-assisted triage, dose calculation, and epidemiological mapping to support flock health management. However, it is fundamentally an advisory tool.</p>
          <ul>
            <li>Not a Substitute for Clinical Diagnosis: The "Smart Diagnosis" feature is designed for preliminary triage and must not replace a physical examination or professional consultation.</li>
            <li>Prescription &amp; Treatment: In compliance with the Bangladesh Veterinary Council (BVC) and international veterinary telehealth guidelines, final treatment decisions, prescriptions, and antimicrobial usage must be authorized by a registered veterinary practitioner.</li>
            <li>Dose Calculator Usage: The dose calculator is intended to assist with veterinarian-prescribed dosages. Users must verify withdrawal periods and contraindications against product labels and local regulations.</li>
          </ul>
        </section>

        <section className="privacy-policy-section">
          <h2>3. Data Collection and Informed Consent</h2>
          <p>To provide accurate epidemiological tracking and AI diagnostics, PoultryMedix collects specific user and farm data. By using the app, users provide explicit consent for the collection of:</p>
          <ul>
            <li>Farm &amp; Flock Information: Location data (district/upazila level for outbreak mapping), flock size, species, and reported clinical signs.</li>
            <li>Media Inputs: Uploaded images, audio recordings, and scanned prescriptions used for the AI diagnostic tool.</li>
            <li>User Information: Basic profile details (e.g., role as Farmer, Vet, or Student) for personalized dashboard experiences.</li>
          </ul>
        </section>

        <section className="privacy-policy-section">
          <h2>4. Data Usage for Academic Research &amp; Public Health (One Health)</h2>
          <p>PoultryMedix is deeply integrated with One Health initiatives, focusing on clinical surveillance and antimicrobial stewardship.</p>
          <ul>
            <li>Research Consent: By using the "Contribute" or "Smart Diagnosis" features, users consent to their anonymized data being used for academic research, systematic reviews, and epidemiological studies.</li>
            <li>AMR &amp; Outbreak Mapping: Farm location data and clinical inputs are aggregated to generate live epidemiological and Antimicrobial Resistance (AMR) maps. This data helps track disease outbreaks and pathological impacts in livestock, contributing to national and global veterinary public health safety.</li>
            <li>Anonymity: Any data published in academic journals, conferences, or open-science frameworks (e.g., OSF) will be strictly de-identified. No personal user details will be publicly disclosed.</li>
          </ul>
        </section>

        <section className="privacy-policy-section">
          <h2>5. Privacy, Data Security, and Storage</h2>
          <p>We are committed to safeguarding your data against unauthorized access, alteration, or disclosure.</p>
          <ul>
            <li>Data Encryption: All user inputs, including media uploads and farm locations, are processed through secure, encrypted channels.</li>
            <li>Secure Infrastructure: Data is stored on secure servers with restricted administrative access.</li>
            <li>Third-Party Services: Map tile requests (e.g., Esri/ArcGIS) and localized weather data APIs receive only the necessary geographical coordinates required to render the service. We do not sell user data to third-party marketing or pharmaceutical companies.</li>
          </ul>
        </section>

        <section className="privacy-policy-section">
          <h2>6. User Rights and Data Control</h2>
          <ul>
            <li>Data Retention: User data is retained as long as the account is active or as needed for ongoing epidemiological tracking.</li>
            <li>Right to Withdraw: Users have the right to request the deletion of their personal profile data and farm location from our active database. However, previously anonymized and aggregated data used in published epidemiological maps or research cannot be retracted.</li>
          </ul>
        </section>

        <section className="privacy-policy-section">
          <h2>7. Policy Updates</h2>
          <p>PoultryMedix reserves the right to update this policy to reflect new legal, clinical, or technological developments in veterinary medicine and data privacy laws. Users will be notified of any significant changes via the app dashboard.</p>
        </section>
      </article>
    </div>
  )
}

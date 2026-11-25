import { Building2, ShieldCheck, Stethoscope } from 'lucide-react'
import { useLanguage } from '../context/useLanguage.js'
import { requestTelemedicineReferral, requestUloDirectoryModal } from '../lib/uloDirectory.js'
import './EthicalCareBar.css'

export default function EthicalCareBar({
  prefillConcern = '',
  district = '',
  compact = false,
  onBeforeAction,
}) {
  const { language } = useLanguage()
  const isBn = language === 'bn'

  function handleTelemedicine() {
    onBeforeAction?.()
    requestTelemedicineReferral({ concern: prefillConcern, district })
  }

  function handleUloDirectory() {
    onBeforeAction?.()
    requestUloDirectoryModal({ district })
  }

  return (
    <aside
      className={`ethical-care-bar${compact ? ' ethical-care-bar--compact' : ''}`}
      role="note"
      aria-label={isBn ? 'নিরাপদ পশুচিকিৎসা ও এন্টি-কোয়াকারি নির্দেশনা' : 'Strict Anti-Quackery & Ethical Care Protocol'}
    >
      <div className="ethical-care-head">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>
          {isBn
            ? 'নিরাপদ পশুচিকিৎসা নির্দেশনা (অপ্রয়োজনীয় ওষুধ বর্জন করুন)'
            : 'Strict Anti-Quackery & Ethical Veterinary Protocol'}
        </span>
      </div>

      <p className="ethical-care-copy">
        {isBn
          ? 'নিবন্ধিত পশুচিকিৎসকের পরীক্ষা ছাড়া কখনোই দোকান থেকে অনুমান করে অ্যান্টিবায়োটিক খাওয়াবেন না। ভুল ওষুধ প্রয়োগে মুরগির কিডনি-লিভার নষ্ট হয়ে মৃত্যু বাড়ে এবং পাখি ও মানুষের শরীরে ওষুধ-প্রতিরোধী জীবাণু (AMR) তৈরি হয়।'
          : 'Never buy or give antibiotics without a registered veterinarian’s evaluation. Guesswork or unauthorized dosing causes organ toxicity, worsens flock mortality, and drives Antimicrobial Resistance (AMR) in both birds and humans.'}
      </p>

      <div className="ethical-care-actions">
        <button
          type="button"
          className="ethical-care-btn ethical-care-btn--primary"
          onClick={handleTelemedicine}
        >
          <Stethoscope size={15} aria-hidden="true" />
          <span>{isBn ? 'BVC নিবন্ধিত ভেটের পরামর্শ নিন (টেলিমেডিসিন)' : 'Consult BVC Vet (Telemedicine)'}</span>
        </button>

        <button
          type="button"
          className="ethical-care-btn"
          onClick={handleUloDirectory}
        >
          <Building2 size={15} aria-hidden="true" />
          <span>{isBn ? 'নিকটস্থ সরকারি ULO হাসপাতালে যান' : 'Visit Nearest Govt. ULO Hospital'}</span>
        </button>
      </div>
    </aside>
  )
}

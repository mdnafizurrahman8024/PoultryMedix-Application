import Icon from './Icon.jsx'

const disclaimer = 'Disclaimer: This AI is an assistant and does NOT replace a registered Veterinary Doctor. The diagnosis provided is predictive. Always consult a certified veterinarian for actual medical decisions and treatments.'

export default function AiSafetyBanner() {
  return (
    <aside className="ai-safety-banner" role="note" aria-label="Veterinary safety disclaimer">
      <Icon name="shield" size={19} />
      <p>{disclaimer}</p>
    </aside>
  )
}

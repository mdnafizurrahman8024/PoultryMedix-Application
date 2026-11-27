import { useState } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import {
  RX_DOSE_CHIPS,
  RX_DURATION_CHIPS,
  RX_FREQUENCY_CHIPS,
  RX_ROUTE_OPTIONS,
  isWithdrawalRequiredMedication,
} from '../lib/rxSecurityHelper.js'
import { mapFormulationToRxSelect } from '../lib/poultryMedicinesStore.js'
import { useLanguage } from '../context/useLanguage.js'

function collectGenerics(medicineCategories, categoryId = '') {
  const categories = categoryId
    ? medicineCategories.filter((c) => c.id === categoryId)
    : medicineCategories
  const out = []
  for (const cat of categories) {
    for (const gen of cat.generics) {
      out.push({
        ...gen,
        categoryId: cat.id,
        category: cat.category,
        requiresRegisteredVetRx: cat.requiresRegisteredVetRx,
      })
    }
  }
  return out
}

function findMatchingGeneric(medicineCategories, genericName = '') {
  const currentGen = String(genericName || '').trim().toLowerCase()
  if (!currentGen) return null
  for (const cat of medicineCategories) {
    const hit = cat.generics.find((g) => g.genericName.toLowerCase() === currentGen)
    if (hit) {
      return {
        ...hit,
        categoryId: cat.id,
        category: cat.category,
        requiresRegisteredVetRx: cat.requiresRegisteredVetRx,
      }
    }
  }
  return null
}

export default function HybridMedicationRow({
  medication,
  index,
  canRemove,
  medicineCategories,
  onPatch,
  onRemove,
  onApplyPreset,
  isLocked = false,
}) {
  const { t, language } = useLanguage()
  const isBn = language === 'bn'
  const [comboOpen, setComboOpen] = useState(false)
  const [comboGeneric, setComboGeneric] = useState('')

  const selectedCategoryId = medication.categoryId || ''
  const selectedGenericName = medication.genericName || ''
  const allGenericsInScope = collectGenerics(medicineCategories, selectedCategoryId)
  const allGenericsFlat = collectGenerics(medicineCategories).map((g) => g.genericName)
  const matchedGenericObj = findMatchingGeneric(medicineCategories, selectedGenericName)

  const brandsForGeneric = matchedGenericObj?.brands || []
  const withdrawalAlertActive = isWithdrawalRequiredMedication(medication)

  function handleSelectGenericFromList(genName) {
    const found = allGenericsInScope.find((g) => g.genericName === genName)
    if (!found) {
      onPatch(medication.id, { genericName: genName })
      return
    }
    const firstBrand = found.brands[0]
    onPatch(medication.id, {
      genericName: found.genericName,
      categoryId: found.categoryId,
      antibioticClass: found.category,
      whoAwareCategory: found.whoAwareCategory || 'Access',
      requiresRegisteredVetRx: found.requiresRegisteredVetRx,
      formulation: mapFormulationToRxSelect(found.formulation),
      suggestedDose: firstBrand?.standardDose || '',
    })
  }

  function handleAddCombinationGeneric() {
    if (!comboGeneric.trim()) return
    const nextGen = medication.genericName
      ? `${medication.genericName} + ${comboGeneric.trim()}`
      : comboGeneric.trim()
    onPatch(medication.id, { genericName: nextGen })
    setComboGeneric('')
    setComboOpen(false)
  }

  function handlePickBrand(brand) {
    const entryKey = `${matchedGenericObj?.categoryId || 'custom'}::${matchedGenericObj?.genericName || medication.genericName}::${brand.tradeName}`
    if (onApplyPreset) {
      onApplyPreset(medication.id, entryKey)
      return
    }
    onPatch(medication.id, {
      masterKey: entryKey,
      name: brand.tradeName,
      tradeName: brand.tradeName,
      company: brand.company,
      packSize: brand.packSizes?.[0] || '',
      packSizesAvailable: brand.packSizes || [],
      approxMrpBdt: brand.approxMrpBdt || '',
      dosage: brand.standardDose || medication.dosage,
      suggestedDose: brand.standardDose || '',
      withdrawal: brand.withdrawalPeriod || medication.withdrawal || '0 days',
      meatWithdrawalDays: brand.withdrawalPeriod || '0 days',
    })
  }

  return (
    <fieldset
      className="telemedicine-medication-row pmx-hybrid-med-row dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
      disabled={isLocked}
    >
      <legend>
        {t('medicineNumber', { number: index + 1 })}
        {medication.company ? ` · ${medication.company}` : ''}
        {medication.packSize ? ` · ${medication.packSize}` : ''}
        {medication.approxMrpBdt ? ` · ${medication.approxMrpBdt}` : ''}
      </legend>

      {canRemove && !isLocked && (
        <button
          className="telemedicine-remove-button"
          type="button"
          aria-label={`${t('remove')} ${index + 1}`}
          onClick={() => onRemove(medication.id)}
        >
          <Trash2 size={14} aria-hidden="true" />
          {t('remove')}
        </button>
      )}

      {withdrawalAlertActive && (
        <div className="pmx-rx-withdrawal-alert" role="status">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>
            {t('rxWithdrawalAlertBadge', {
              period: medication.withdrawal || (isBn ? 'কমপক্ষে ৫-৭ দিন যাচাই করুন' : 'Verify mandatory withdrawal'),
            })}
          </span>
        </div>
      )}

      {/* Step 1: Category Filter & Generic Selector (Preset + Manual + Combination) */}
      <div className="pmx-hybrid-step-box dark:bg-gray-900 dark:border-gray-700">
        <div className="pmx-hybrid-step-title">
          <span>1. {t('rxStepGenericTitle')}</span>
          <button
            type="button"
            className="pmx-combo-toggle-btn"
            onClick={() => setComboOpen((v) => !v)}
          >
            <Plus size={12} aria-hidden="true" />
            <span>{t('rxAddComboGenericBtn')}</span>
          </button>
        </div>

        <div className="telemedicine-fields-grid">
          <label className="telemedicine-field dark:text-gray-100">
            <span>{t('rxCategoryFilterLabel')}</span>
            <select
              value={medication.categoryId || ''}
              onChange={(e) => onPatch(medication.id, { categoryId: e.target.value })}
            >
              <option value="">{t('rxAllCategoriesOption')}</option>
              {medicineCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {isBn ? cat.categoryBn : cat.category}
                </option>
              ))}
            </select>
          </label>

          <label className="telemedicine-field dark:text-gray-100">
            <span>{t('rxSelectGenericPreset')}</span>
            <select
              value={matchedGenericObj?.genericName || ''}
              onChange={(e) => handleSelectGenericFromList(e.target.value)}
            >
              <option value="">{t('rxChooseGenericPlaceholder')}</option>
              {allGenericsInScope.map((g) => (
                <option key={`${g.categoryId}-${g.genericName}`} value={g.genericName}>
                  {g.genericName} ({g.brands.length} {t('rxBrandsCountUnit')})
                </option>
              ))}
            </select>
          </label>

          <label className="telemedicine-field telemedicine-field--wide dark:text-gray-100">
            <span>{t('rxGenericManualLabel')}</span>
            <input
              type="text"
              value={medication.genericName}
              onChange={(e) => onPatch(medication.id, { genericName: e.target.value })}
              placeholder={t('rxGenericPlaceholder')}
            />
          </label>
        </div>

        {comboOpen && (
          <div className="pmx-combo-adder-row">
            <select
              value={comboGeneric}
              onChange={(e) => setComboGeneric(e.target.value)}
              aria-label={t('rxPickComboGeneric')}
            >
              <option value="">{t('rxPickComboGeneric')}</option>
              {allGenericsFlat.map((gName) => (
                <option key={gName} value={gName}>{gName}</option>
              ))}
            </select>
            <input
              type="text"
              value={comboGeneric}
              onChange={(e) => setComboGeneric(e.target.value)}
              placeholder={t('rxOrTypeComboPlaceholder')}
            />
            <button type="button" className="telemedicine-add-button" onClick={handleAddCombinationGeneric}>
              {t('add')}
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Company Brand, Pack Size & MRP (Preset Cards/Dropdown + 100% Manual Override) */}
      <div className="pmx-hybrid-step-box dark:bg-gray-900 dark:border-gray-700">
        <div className="pmx-hybrid-step-title">
          <span>2. {t('rxStepBrandTitle')}</span>
        </div>

        {brandsForGeneric.length > 0 && (
          <div className="pmx-brand-preset-grid" role="group" aria-label={t('rxStepBrandTitle')}>
            {brandsForGeneric.map((brand) => {
              const isSelected = medication.tradeName === brand.tradeName || medication.name === brand.tradeName
              return (
                <button
                  key={`${brand.tradeName}-${brand.company}`}
                  type="button"
                  className={`pmx-brand-card-btn${isSelected ? ' is-selected' : ''}`}
                  onClick={() => handlePickBrand(brand)}
                >
                  <strong>{brand.tradeName}</strong>
                  <span>{brand.company}</span>
                  <small>{(brand.packSizes || []).join(' / ')} · {brand.approxMrpBdt}</small>
                </button>
              )
            })}
          </div>
        )}

        <div className="telemedicine-fields-grid" style={{ marginTop: brandsForGeneric.length > 0 ? '8px' : 0 }}>
          <label className="telemedicine-field dark:text-gray-100">
            <span>{t('drugMedicineName')}</span>
            <input
              type="text"
              value={medication.name}
              onChange={(e) => onPatch(medication.id, { name: e.target.value, tradeName: e.target.value })}
              placeholder={t('medicineName')}
            />
          </label>
          <label className="telemedicine-field dark:text-gray-100">
            <span>{t('rxCompanyLabel')}</span>
            <input
              type="text"
              value={medication.company || ''}
              onChange={(e) => onPatch(medication.id, { company: e.target.value })}
              placeholder="e.g. SK+F / Renata / Square"
            />
          </label>
          <label className="telemedicine-field dark:text-gray-100">
            <span>{t('rxPackSizeLabel')}</span>
            <input
              type="text"
              value={medication.packSize || ''}
              onChange={(e) => onPatch(medication.id, { packSize: e.target.value })}
              placeholder="100 ml Vial / 100 gm Sachet"
            />
          </label>
          <label className="telemedicine-field dark:text-gray-100">
            <span>{t('rxEstPriceLabel')}</span>
            <input
              type="text"
              value={medication.approxMrpBdt || ''}
              onChange={(e) => onPatch(medication.id, { approxMrpBdt: e.target.value })}
              placeholder="~৳ 750"
            />
          </label>
        </div>

        {Array.isArray(medication.packSizesAvailable) && medication.packSizesAvailable.length > 1 && (
          <div className="pmx-chip-strip">
            {medication.packSizesAvailable.map((pk) => (
              <button
                key={pk}
                type="button"
                className={`pmx-regimen-chip${medication.packSize === pk ? ' is-selected' : ''}`}
                onClick={() => onPatch(medication.id, { packSize: pk })}
              >
                {pk}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 3: Route, Dose, Frequency, Duration Quick Chips + Manual Override */}
      <div className="pmx-hybrid-step-box dark:bg-gray-900 dark:border-gray-700">
        <div className="pmx-hybrid-step-title">
          <span>3. {t('rxStepRegimenTitle')}</span>
        </div>

        <div className="pmx-regimen-group">
          <span className="pmx-regimen-label">{t('rxRouteLabel')}</span>
          <div className="pmx-chip-strip">
            {RX_ROUTE_OPTIONS.map((rt) => (
              <button
                key={rt}
                type="button"
                className={`pmx-regimen-chip${(medication.route || medication.formulation) === rt ? ' is-selected' : ''}`}
                onClick={() => onPatch(medication.id, { route: rt, formulation: rt })}
              >
                {t(`rxRoutes.${rt}`, rt)}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={medication.route || medication.formulation || ''}
            onChange={(e) => onPatch(medication.id, { route: e.target.value, formulation: e.target.value })}
            placeholder={t('rxRouteManualPlaceholder')}
          />
        </div>

        <div className="pmx-regimen-group">
          <span className="pmx-regimen-label">{t('dosage')}</span>
          <div className="pmx-chip-strip">
            {medication.suggestedDose && (
              <button
                type="button"
                className={`pmx-regimen-chip is-db-suggested${medication.dosage === medication.suggestedDose ? ' is-selected' : ''}`}
                onClick={() => onPatch(medication.id, { dosage: medication.suggestedDose })}
              >
                DB: {medication.suggestedDose}
              </button>
            )}
            {RX_DOSE_CHIPS.map((ds) => (
              <button
                key={ds}
                type="button"
                className={`pmx-regimen-chip${medication.dosage === ds ? ' is-selected' : ''}`}
                onClick={() => onPatch(medication.id, { dosage: ds })}
              >
                {ds}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={medication.dosage}
            onChange={(e) => onPatch(medication.id, { dosage: e.target.value })}
            placeholder={t('dosagePlaceholder')}
          />
        </div>

        <div className="pmx-regimen-group">
          <span className="pmx-regimen-label">{t('frequencyTiming')}</span>
          <div className="pmx-chip-strip">
            {RX_FREQUENCY_CHIPS.map((fq) => (
              <button
                key={fq}
                type="button"
                className={`pmx-regimen-chip${medication.frequency === fq ? ' is-selected' : ''}`}
                onClick={() => onPatch(medication.id, { frequency: fq })}
              >
                {t(`frequencies.${fq}`, fq)}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={medication.frequency}
            onChange={(e) => onPatch(medication.id, { frequency: e.target.value })}
            placeholder={t('rxFrequencyManualPlaceholder')}
          />
        </div>

        <div className="telemedicine-fields-grid">
          <div className="pmx-regimen-group" style={{ marginBottom: 0 }}>
            <span className="pmx-regimen-label">{t('duration')}</span>
            <div className="pmx-chip-strip">
              {RX_DURATION_CHIPS.map((chip) => {
                const selected = String(medication.duration) === chip.value && (medication.durationType || 'Days') === chip.unit
                return (
                  <button
                    key={chip.value}
                    type="button"
                    className={`pmx-regimen-chip${selected ? ' is-selected' : ''}`}
                    onClick={() => onPatch(medication.id, { duration: chip.value, durationType: chip.unit })}
                  >
                    {isBn ? chip.labelBn : chip.labelEn}
                  </button>
                )
              })}
            </div>
            <span className="telemedicine-duration-inputs">
              <input
                type="number"
                min="1"
                value={medication.duration}
                onChange={(e) => onPatch(medication.id, { duration: e.target.value })}
                placeholder="5"
              />
              <select
                aria-label={t('durationType')}
                value={medication.durationType}
                onChange={(e) => onPatch(medication.id, { durationType: e.target.value })}
              >
                <option value="Days">{t('days')}</option>
                <option value="Weeks">{t('weeks')}</option>
              </select>
            </span>
          </div>

          <label className="telemedicine-field dark:text-gray-100">
            <span>{t('withdrawalPeriod')}</span>
            <input
              type="text"
              value={medication.withdrawal}
              onChange={(e) => onPatch(medication.id, { withdrawal: e.target.value, meatWithdrawalDays: e.target.value })}
              placeholder={t('withdrawalPlaceholder')}
            />
          </label>
        </div>
      </div>
    </fieldset>
  )
}

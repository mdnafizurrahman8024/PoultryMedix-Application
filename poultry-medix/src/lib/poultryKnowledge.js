const knowledge = {
  en: [
    { terms: ['clean water', 'water access', 'drinking water'], answer: 'Keep clean drinking water available to every bird throughout the day. Check drinkers regularly for access, cleanliness, and leaks.' },
    { terms: ['ventilation', 'air flow', 'respiratory', 'breathing'], answer: 'Good ventilation and reduced dust support respiratory health. Record breathing changes and arrange assessment by a veterinarian.' },
    { terms: ['antibiotic', 'antimicrobial', 'medicine'], answer: 'Do not start or change antibiotics without a veterinarian’s diagnosis and prescription. Confirm medicine rules with your local veterinary authority.' },
    { terms: ['biosecurity', 'disinfect', 'visitors'], answer: 'Limit unnecessary visitors, clean and disinfect equipment between groups, and protect feed and water from contamination.' },
    { terms: ['diarrhea', 'droppings', 'bloody stool', 'bloody dropping'], answer: 'Record changes in droppings, feed and water intake, and how many birds are affected. Keep clean water available and contact a veterinarian for an assessment.' },
    { terms: ['sick bird', 'ill bird', 'isolate', 'unwell'], answer: 'When safe to do so, separate visibly unwell birds, record when signs began, and contact a poultry veterinarian for an assessment.' },
    { terms: ['record', 'daily notes', 'flock notes'], answer: 'Record daily changes in feed, water, egg output, mortality, and flock behavior so your veterinarian can review the timeline.' },
  ],
  bn: [
    { terms: ['পরিষ্কার পানি', 'পানির সুবিধা', 'পানীয় পানি'], answer: 'সারাদিন প্রতিটি পাখির জন্য পরিষ্কার পানির ব্যবস্থা রাখুন। পানির পাত্র পরিষ্কার আছে কি না এবং সব পাখি পানি পাচ্ছে কি না নিয়মিত দেখুন।' },
    { terms: ['বাতাস চলাচল', 'শ্বাসতন্ত্র', 'শ্বাস নিতে'], answer: 'ভালো বাতাস চলাচল ও ধুলা কমানো শ্বাসতন্ত্রের স্বাস্থ্যে সহায়তা করে। শ্বাসের পরিবর্তন লিখে রাখুন এবং পশুচিকিৎসকের মূল্যায়নের ব্যবস্থা করুন।' },
    { terms: ['অ্যান্টিবায়োটিক', 'ওষুধ'], answer: 'পশুচিকিৎসকের রোগ নির্ণয় ও প্রেসক্রিপশন ছাড়া অ্যান্টিবায়োটিক শুরু বা পরিবর্তন করবেন না। ওষুধের নিয়ম স্থানীয় পশুচিকিৎসা কর্তৃপক্ষের কাছ থেকে নিশ্চিত করুন।' },
    { terms: ['জৈব-নিরাপত্তা', 'জীবাণুমুক্ত', 'দর্শনার্থী'], answer: 'অপ্রয়োজনীয় দর্শনার্থী সীমিত করুন, দল পরিবর্তনের আগে সরঞ্জাম পরিষ্কার ও জীবাণুমুক্ত করুন এবং খাদ্য ও পানি দূষণ থেকে রক্ষা করুন।' },
    { terms: ['ডায়রিয়া', 'বিষ্ঠা', 'রক্তমিশ্রিত'], answer: 'বিষ্ঠা, খাদ্য ও পানির গ্রহণ এবং কতটি পাখি আক্রান্ত তা লিখে রাখুন। পরিষ্কার পানি দিন এবং পশুচিকিৎসকের মূল্যায়নের জন্য যোগাযোগ করুন।' },
    { terms: ['অসুস্থ পাখি', 'আলাদা', 'অসুস্থতা'], answer: 'নিরাপদ হলে দৃশ্যত অসুস্থ পাখিকে আলাদা রাখুন, লক্ষণ কখন শুরু হয়েছে লিখে রাখুন এবং পোল্ট্রি পশুচিকিৎসকের সঙ্গে যোগাযোগ করুন।' },
    { terms: ['নোট', 'দৈনিক তথ্য', 'রেকর্ড'], answer: 'পশুচিকিৎসককে সময়রেখা দেখাতে খাদ্য, পানি, ডিম উৎপাদন, মৃত্যু ও পালের আচরণের দৈনিক পরিবর্তন লিখে রাখুন।' },
  ],
}

export function findLocalPoultryKnowledge(query, language) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return null
  return (knowledge[language] ?? []).find(({ terms }) => terms.some((term) => normalizedQuery.includes(term)))
    ?? (knowledge[language] ?? []).find(({ terms }) => terms.some((term) => normalizedQuery.split(/\s+/).some((word) => word.length > 2 && term.includes(word))))
    ?? null
}

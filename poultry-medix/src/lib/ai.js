let teachableModelPromise

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('This file could not be read.'))
        return
      }
      resolve(reader.result.slice(reader.result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('This file could not be read.'))
    reader.readAsDataURL(file)
  })
}

export async function classifyPoultryImage(file) {
  const modelBase = import.meta.env.VITE_TEACHABLE_MACHINE_MODEL_URL
  if (!modelBase) throw new Error('The image classification model is not configured.')

  if (!teachableModelPromise) {
    teachableModelPromise = import('@teachablemachine/image')
      .then(({ load }) => load(`${modelBase}model.json`, `${modelBase}metadata.json`))
      .catch((error) => {
        teachableModelPromise = undefined
        throw error
      })
  }

  const model = await teachableModelPromise
  const imageUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = imageUrl
    await image.decode()
    const predictions = await model.predict(image)
    const top = predictions.sort((first, second) => second.probability - first.probability)[0]
    if (!top) throw new Error('The image model did not return a classification.')
    return { label: top.className, confidence: top.probability }
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

export async function requestDiagnosis({ text, files, accessToken, visualResult, userRole, appLanguage }) {
  const attachments = await Promise.all(files.map(async (file) => ({
    name: file.name,
    mimeType: file.type,
    data: await readFileAsBase64(file),
  })))
  const response = await fetch('/api/diagnose', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text, attachments, visualResult, userRole, appLanguage }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'AI diagnosis could not be completed.')
  return result
}

export async function runMultimodalDiagnosis({ text, files, accessToken, userRole, appLanguage, onModelWarning }) {
  let visualResult = null
  const image = files.find((file) => file.type.startsWith('image/'))
  if (image) {
    try {
      visualResult = await classifyPoultryImage(image)
    } catch (error) {
      onModelWarning(error)
    }
  }
  const result = await requestDiagnosis({ text, files, accessToken, visualResult, userRole, appLanguage })
  return { ...result, visualResult }
}

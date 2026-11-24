import * as tmImage from '@teachablemachine/image'

let cachedVisionModel = null
let visionModelLoadingPromise = null

const LOCAL_VISION_PATH = '/models/vision/'
const REMOTE_FALLBACK_URL = 'https://teachablemachine.withgoogle.com/models/i4VE4hlCa/'

/**
 * Loads the client-side Teachable Machine vision model.
 * Prefers the local model in /models/vision/, with graceful fallback to the remote Google URL.
 */
export async function loadEdgeVisionModel(preferredBaseUrl = LOCAL_VISION_PATH) {
  if (cachedVisionModel) return cachedVisionModel
  if (visionModelLoadingPromise) return visionModelLoadingPromise

  const load = tmImage.load || tmImage.default?.load
  if (typeof load !== 'function') {
    throw new Error('Teachable Machine image loader is unavailable in the environment.')
  }

  visionModelLoadingPromise = (async () => {
    // Attempt local edge model first
    try {
      const modelUrl = `${preferredBaseUrl.replace(/\/$/, '')}/model.json`
      const metadataUrl = `${preferredBaseUrl.replace(/\/$/, '')}/metadata.json`
      const model = await load(modelUrl, metadataUrl)
      cachedVisionModel = model
      return model
    } catch (localError) {
      if (preferredBaseUrl !== REMOTE_FALLBACK_URL) {
        console.warn('[edge-ai] Local vision model failed to load, falling back to remote endpoint', localError)
        const remoteModelUrl = `${REMOTE_FALLBACK_URL}model.json`
        const remoteMetadataUrl = `${REMOTE_FALLBACK_URL}metadata.json`
        const model = await load(remoteModelUrl, remoteMetadataUrl)
        cachedVisionModel = model
        return model
      }
      throw localError
    } finally {
      visionModelLoadingPromise = null
    }
  })()

  return visionModelLoadingPromise
}

/**
 * Runs client-side inference on an HTML image, video, or canvas element.
 */
export async function classifyPoultryEdgeImage(imageElement, options = {}) {
  const model = await loadEdgeVisionModel(options.baseUrl)
  const predictions = await model.predict(imageElement)
  
  const sorted = predictions
    .map((item) => ({
      disease: item.className.trim(),
      confidence: item.probability,
    }))
    .sort((a, b) => b.confidence - a.confidence)

  return {
    topMatch: sorted[0] || null,
    predictions: sorted,
    source: 'edge-client-tfjs',
  }
}

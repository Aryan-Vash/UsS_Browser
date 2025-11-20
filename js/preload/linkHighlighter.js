/* global MutationObserver */

const { ipcRenderer } = require('electron')

const processedLinks = new WeakSet()
let highlightEnabled = true
let bootstrapped = false
let observerStarted = false

function clamp (value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function extractProbability (data) {
  if (!data) {
    return null
  }

  const probabilityFields = ['probability_unsafe', 'probability', 'p']
  for (const field of probabilityFields) {
    if (typeof data[field] === 'number') {
      return data[field]
    }
  }

  return null
}

function probabilityToColor (rawProbability) {
  const probability = clamp(rawProbability, 0, 1)

  if (probability < 0.3) {
    return '#006400' // dark green
  }
  if (probability < 0.6) {
    return '#32cd32' // light green
  }
  if (probability < 0.999) {
    return '#ffa500' // orange
  }
  return '#ff0000' // red
}

function clearHighlights () {
  const links = document.querySelectorAll ? document.querySelectorAll('a') : []
  links.forEach(link => {
    link.style.color = ''
    delete link.dataset.riskProbability
    processedLinks.delete(link)
  })
}

function setHighlightingEnabled (enabled) {
  const normalized = enabled !== false
  if (highlightEnabled === normalized) {
    return
  }
  highlightEnabled = normalized
  if (!highlightEnabled) {
    clearHighlights()
  } else if (bootstrapped) {
    highlightLinks()
  }
}

function analyzeLink (link) {
  if (!highlightEnabled || !link || processedLinks.has(link)) {
    return
  }

  const url = link.href
  if (!url || (!url.startsWith('http:') && !url.startsWith('https:'))) {
    return
  }

  processedLinks.add(link)
  const channel = `response-${Date.now()}-${Math.random().toString(36).slice(2)}`

  ipcRenderer.once(channel, (event, data) => {
    console.log(`[LinkHighlighter] Received data for ${url}:`, data)
    const probability = extractProbability(data)

    if (probability !== null) {
      const color = probabilityToColor(probability)
      link.style.color = color
      link.dataset.riskProbability = probability.toFixed(2)
      console.log(`[LinkHighlighter] Applied gradient color ${color} to ${url} for probability ${probability}`)
      return
    }

    const label = data.label
    switch (label) {
      case 0:
        link.style.color = 'lightgreen'
        break
      case 1:
        link.style.color = 'yellow'
        break
      case 2:
        link.style.color = 'orange'
        break
      case 3:
        link.style.color = 'red'
        break
      default:
        link.style.color = 'grey'
        break
    }
    console.log(`[LinkHighlighter] Applied fallback label color to ${url} (label: ${label})`)
  })

  console.log(`[LinkHighlighter] Sending URL for analysis: ${url}`)
  ipcRenderer.send('analyze-url', { url: url, channel: channel })
}

function highlightLinks (root = document) {
  if (!highlightEnabled) {
    return
  }
  const scope = root.querySelectorAll ? root.querySelectorAll('a') : []
  scope.forEach(analyzeLink)
}

function startObserving () {
  if (!document.body) {
    return
  }

  if (observerStarted) {
    return
  }
  observerStarted = true

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return
        }
        if (node.tagName === 'A') {
          analyzeLink(node)
        } else if (node.querySelectorAll) {
          node.querySelectorAll('a').forEach(analyzeLink)
        }
      })
    })
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

function bootHighlighting () {
  if (bootstrapped) {
    return
  }
  bootstrapped = true

  const start = () => {
    if (highlightEnabled) {
      highlightLinks()
    }
    startObserving()
  }

  if (document.readyState === 'complete') {
    start()
  } else {
    window.addEventListener('load', start)
  }
}

ipcRenderer.on('link-highlighter-toggle', (event, enabled) => {
  setHighlightingEnabled(enabled)
})

ipcRenderer.invoke('link-highlighter-get-state')
  .then(value => {
    setHighlightingEnabled(value)
    bootHighlighting()
  })
  .catch(() => {
    bootHighlighting()
  })

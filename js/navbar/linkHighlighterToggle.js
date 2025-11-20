const webviews = require('webviews.js')
const settings = require('util/settings/settings.js')

const settingKey = 'linkHighlighterEnabled'

function normalizeState (value) {
  return value === undefined ? true : Boolean(value)
}

function sendStateToTab (tabId, enabled) {
  if (!tabId) {
    return
  }
  try {
    webviews.callAsync(tabId, 'send', ['link-highlighter-toggle', enabled])
  } catch (e) {
    console.warn('[LinkHighlighterToggle] Failed to send state to tab', tabId, e)
  }
}

function broadcastState (enabled) {
  if (!window.tasks) {
    return
  }
  window.tasks.forEach(task => {
    task.tabs.forEach(tab => {
      if (webviews.hasViewForTab(tab.id)) {
        sendStateToTab(tab.id, enabled)
      }
    })
  })
}

module.exports = {
  initialize: function () {
    const button = document.getElementById('link-highlighter-toggle')
    if (!button) {
      return
    }

    let enabled = normalizeState(settings.get(settingKey))

    function updateButtonUI () {
      button.classList.toggle('active', enabled)
      button.setAttribute('aria-pressed', enabled)
      button.title = enabled ? 'Disable link safety colors' : 'Enable link safety colors'
    }

    function applyState (nextState, options = {}) {
      enabled = normalizeState(nextState)
      updateButtonUI()
      if (options.persist) {
        settings.set(settingKey, enabled)
      }
      if (options.broadcast !== false) {
        broadcastState(enabled)
      }
    }

    button.addEventListener('click', function () {
      applyState(!enabled, { persist: true })
    })

    updateButtonUI()
    broadcastState(enabled)

    settings.listen(settingKey, function (value) {
      const normalized = normalizeState(value)
      if (normalized !== enabled) {
        enabled = normalized
        updateButtonUI()
        broadcastState(enabled)
      }
    })

    webviews.bindEvent('view-shown', function (tabId) {
      sendStateToTab(tabId, enabled)
    })
  }
}

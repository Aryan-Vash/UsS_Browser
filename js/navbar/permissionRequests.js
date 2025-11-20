const { ipcRenderer } = require('electron')
const webviews = require('webviews.js')

const permissionRequests = {
  requests: [],
  listeners: [],
  grantPermission: function (permissionId) {
    ipcRenderer.send('handle-permission-request', { permissionId: permissionId, grant: true })
  },
  getIcons: function (request) {
    if (request.permission === 'notifications') {
      return ['carbon:chat']
    } else if (request.permission === 'pointerLock') {
      return ['carbon:cursor-1']
    } else if (request.permission === 'media' && request.details.mediaTypes) {
      var mediaIcons = {
        video: 'carbon:video',
        audio: 'carbon:microphone'
      }
      return request.details.mediaTypes.map(t => mediaIcons[t])
    }
    return ['carbon:settings']
  },

  showPermissionDialog: async function (request) {
    const dialog = document.getElementById('permission-review-dialog')
    const overlay = document.getElementById('overlay')
    
    if (!dialog) return

    // 1. Setup Basic UI Elements
    const iconContainer = document.getElementById('perm-icon-container')
    const titleEl = document.getElementById('perm-title')
    const originEl = document.getElementById('perm-origin')
    const loadingEl = document.getElementById('perm-loading')
    const textEl = document.getElementById('perm-explanation-text')

    // Reset Content
    iconContainer.innerHTML = ''
    const icons = permissionRequests.getIcons(request)
    icons.forEach(icon => {
        const i = document.createElement('i')
        i.className = 'i ' + icon
        iconContainer.appendChild(i)
    })

    titleEl.textContent = `Allow ${request.permission} access?`
    originEl.textContent = `${request.url || 'This site'} wants to access your ${request.permission}.`
    
    // Reset Loading State
    loadingEl.hidden = false
    textEl.hidden = true
    textEl.textContent = ''

    // 2. Show the Dialog
    dialog.hidden = false
    if (overlay) overlay.hidden = false 
    // If your browser uses modalMode helper:
    // if (typeof modalMode !== 'undefined') modalMode.show(dialog)

    // 3. Setup Buttons (Clone to remove old listeners)
    const allowBtn = document.getElementById('perm-allow-btn')
    const denyBtn = document.getElementById('perm-deny-btn')

    const newAllow = allowBtn.cloneNode(true)
    const newDeny = denyBtn.cloneNode(true)
    
    allowBtn.parentNode.replaceChild(newAllow, allowBtn)
    denyBtn.parentNode.replaceChild(newDeny, denyBtn)

    newAllow.addEventListener('click', () => {
        permissionRequests.grantPermission(request.permissionId)
        dialog.hidden = true
        if (overlay) overlay.hidden = true
    })

    newDeny.addEventListener('click', () => {
        permissionRequests.denyPermission(request.permissionId)
        dialog.hidden = true
        if (overlay) overlay.hidden = true
    })

    // 4. API INTEGRATION (Fetch Explanation)
    try {
        // This calls the handler we added to main/permissionManager.js
        const explanation = await ipcRenderer.invoke('explain-permission', {
            permission: request.permission,
            url: request.url // Ensures the backend gets the URL
        })
        
        // Update UI with API response
        loadingEl.hidden = true
        textEl.hidden = false
        textEl.textContent = explanation
    } catch (err) {
        console.error("Permission explanation failed", err)
        loadingEl.hidden = true
        textEl.hidden = false
        textEl.textContent = "Unable to retrieve security analysis at this time."
    }
  },
  
  getButtons: function (tabId) {
    var buttons = []
    permissionRequests.requests.forEach(function (request) {
      const icons = permissionRequests.getIcons(request)
      //don't display buttons for unsupported permission types
      if (icons.length === 0) {
        return
      }
  
      if (request.tabId === tabId) {
        var button = document.createElement('button')
        button.className = 'tab-icon permission-request-icon'
        if (request.granted) {
          button.classList.add('active')
        }
        icons.forEach(function (icon) {
          var el = document.createElement('i')
          el.className = 'i ' + icon
          button.appendChild(el)
        })
        button.addEventListener('click', function (e) {
          e.stopPropagation()
          if (request.granted) {
            webviews.callAsync(tabId, 'reload')
          } else {
            permissionRequests.showPermissionDialog(request)
            // button.classList.add('active')
          }
        })
        buttons.push(button)
      }
    })
    return buttons
  },
  onChange: function (listener) {
    permissionRequests.listeners.push(listener)
  },
  initialize: function () {
    ipcRenderer.on('updatePermissions', function (e, data) {
      var oldData = permissionRequests.requests
      permissionRequests.requests = data
      oldData.forEach(function (req) {
        permissionRequests.listeners.forEach(listener => listener(req.tabId))
      })
      permissionRequests.requests.forEach(function (req) {
        permissionRequests.listeners.forEach(listener => listener(req.tabId))
      })
      const newPendingRequests = permissionRequests.requests.filter(
        req => !req.granted && !oldData.some(oldReq => oldReq.permissionId === req.permissionId)
      )

      newPendingRequests.forEach(function (request) {
        // Send a message to the webview associated with the tabId
        // This message will be caught by a preload script
        webviews.callAsync(request.tabId, 'send', ['queue-permission-request', request])
      })
    })
  }
}

permissionRequests.initialize()

module.exports = permissionRequests

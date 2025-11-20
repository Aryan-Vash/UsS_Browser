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
    return []
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
            permissionRequests.grantPermission(request.permissionId)
            button.classList.add('active')
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

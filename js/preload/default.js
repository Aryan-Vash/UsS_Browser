/* imports common modules */

var electron = require('electron')
var ipc = electron.ipcRenderer

var propertiesToClone = ['deltaX', 'deltaY', 'metaKey', 'ctrlKey', 'defaultPrevented', 'clientX', 'clientY']

function cloneEvent (e) {
  var obj = {}

  for (var i = 0; i < propertiesToClone.length; i++) {
    obj[propertiesToClone[i]] = e[propertiesToClone[i]]
  }
  return JSON.stringify(obj)
}

// workaround for Electron bug
setTimeout(function () {
  /* Used for swipe gestures */
  window.addEventListener('wheel', function (e) {
    ipc.send('wheel-event', cloneEvent(e))
  })

  var scrollTimeout = null

  window.addEventListener('scroll', function () {
    clearTimeout(scrollTimeout)
    scrollTimeout = setTimeout(function () {
      ipc.send('scroll-position-change', Math.round(window.scrollY))
    }, 200)
  })
}, 0)

/* Used for picture in picture item in context menu */
ipc.on('getContextMenuData', function (event, data) {
  // check for video element to show picture-in-picture menu
  var hasVideo = Array.from(document.elementsFromPoint(data.x, data.y)).some(el => el.tagName === 'VIDEO')
  ipc.send('contextMenuData', { hasVideo })
})

ipc.on('enterPictureInPicture', function (event, data) {
  var videos = Array.from(document.elementsFromPoint(data.x, data.y)).filter(el => el.tagName === 'VIDEO')
  if (videos[0]) {
    videos[0].requestPictureInPicture()
  }
})

window.addEventListener('message', function (e) {
  if (!e.origin.startsWith('min://')) {
    return
  }

  if (e.data?.message === 'showCredentialList') {
    ipc.send('showCredentialList')
  }

  if (e.data?.message === 'showUserscriptDirectory') {
    ipc.send('showUserscriptDirectory')
  }

  if (e.data?.message === 'downloadFile') {
    ipc.send('downloadFile', e.data.url)
  }
})

/* --- START: New Permission Dialog Code --- */

// --- Permission Dialog Queue System ---

// Global queue to hold incoming permission requests
let permissionRequestQueue = []
// Flag to ensure only one dialog is shown at a time
let isDialogActive = false

/**
 * Gets the human-readable details for a permission request.
 */
function getPermissionDetails (request) {
  const details = {
    title: 'Permission Request',
    explanation: 'This site is asking for a permission.',
    purpose: 'This allows the site to function correctly.',
    suggestion: 'Allowing this is usually safe.'
  }

  const origin = request.origin || 'This site'

  if (request.permission === 'notifications') {
    details.title = 'Show Notifications'
    details.explanation = `${origin} wants to show you notifications.`
    details.purpose = 'This is used for alerts, new messages, or updates.'
    details.suggestion = 'Only allow this if you trust the site and want updates.'
  }

  if (request.permission === 'pointerLock') {
    details.title = 'Lock Your Mouse'
    details.explanation = `${origin} wants to lock your mouse cursor.`
    details.purpose = 'This is typically used by games or 3D viewers to let you look around without the cursor leaving the window.'
    details.suggestion = 'This is generally safe and required for many full-screen games.'
  }

  if (request.permission === 'media') {
    const mediaType = request.details.mediaTypes[0] // We split them, so there's only one
    if (mediaType === 'video') {
      details.title = 'Use Your Camera'
      details.explanation = `${origin} wants to use your camera.`
      details.purpose = 'This is used for video calls, photo booths, or virtual meetings.'
      details.suggestion = 'Only allow this on sites you trust, like a video chat service. This is a high-risk permission.'
    } else if (mediaType === 'audio') {
      details.title = 'Use Your Microphone'
      details.explanation = `${origin} wants to use your microphone.`
      details.purpose = 'This is used for video calls, voice chats, or audio recording.'
      details.suggestion = 'Only allow this on sites you trust, like a video chat service. This is a high-risk permission.'
    }
  }

  return details
}

/**
 * Creates and shows the permission dialog for a specific request.
 */
function showPermissionDialog (request) {
  // 1. Get human-readable content
  console.log(`[DEBUG] SHOWING dialog for permissionId: ${request.permissionId}, permission: ${request.permission}`);
  const content = getPermissionDetails(request)

  // 2. Create dialog elements
  const dialogOverlay = document.createElement('div')
  dialogOverlay.id = 'min-permission-overlay'
  
  const dialogBox = document.createElement('div')
  dialogBox.id = 'min-permission-dialog'

  const title = document.createElement('h4')
  title.textContent = content.title

  const closeButton = document.createElement('button')
  closeButton.innerHTML = '&times;' // 'x'
  closeButton.className = 'min-permission-close'

  const explanation = document.createElement('p')
  explanation.textContent = content.explanation

  const purpose = document.createElement('p')
  purpose.innerHTML = `<strong>Purpose:</strong> ${content.purpose}`

  const suggestion = document.createElement('p')
  suggestion.innerHTML = `<strong>Suggestion:</strong> ${content.suggestion}`
  if (content.suggestion.includes('high-risk')) {
    suggestion.style.color = '#c0392b' // Red for risky
  }

  const buttonBar = document.createElement('div')
  buttonBar.className = 'min-permission-buttons'

  const denyButton = document.createElement('button')
  denyButton.textContent = 'Deny'
  denyButton.className = 'min-permission-deny'

  const acceptButton = document.createElement('button')
  acceptButton.textContent = 'Accept'
  acceptButton.className = 'min-permission-accept'

  // 3. Assemble the dialog
  buttonBar.appendChild(denyButton)
  buttonBar.appendChild(acceptButton)
  
  dialogBox.appendChild(closeButton)
  dialogBox.appendChild(title)
  dialogBox.appendChild(explanation)
  dialogBox.appendChild(purpose)
  dialogBox.appendChild(suggestion)
  dialogBox.appendChild(buttonBar)
  
  dialogOverlay.appendChild(dialogBox)

  // 4. Add styles
  const styles = `
    #min-permission-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.1); /* Slight dim */
      z-index: 2147483646;
      display: flex;
      justify-content: flex-end; /* Aligns child (dialog) to the right */
      align-items: flex-start; /* Aligns child (dialog) to the top */
      padding: 10px; /* Provides spacing from the edges */
      pointer-events: none; /* Lets clicks go through the overlay */
    }
    #min-permission-dialog {
      position: relative; /* Needed for the close button's absolute position */
      width: 300px;
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 16px;
      z-index: 2147483647; /* (already here) */
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: #333;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      pointer-events: auto; /* This element can be clicked */
    }
    #min-permission-dialog h4 {
      font-size: 16px;
      margin: 0 0 12px;
      font-weight: 600;
      padding-right: 20px; /* Space for close button */
    }
    #min-permission-dialog p {
      margin: 0 0 10px;
      line-height: 1.5;
    }
    .min-permission-close {
      position: absolute;
      top: 10px;
      right: 10px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 20px;
      padding: 4px;
      line-height: 1;
      color: #888;
    }
    .min-permission-close:hover {
      color: #000;
    }
    .min-permission-buttons {
      margin-top: 15px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .min-permission-buttons button {
      border: none;
      border-radius: 5px;
      padding: 8px 12px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .min-permission-deny {
      background: #eee;
      color: #333;
    }
    .min-permission-deny:hover {
      background: #ddd;
    }
    .min-permission-accept {
      background: #007aff;
      color: white;
    }
    .min-permission-accept:hover {
      background: #0056b3;
    }
  `
  
  const styleTag = document.createElement('style')
  styleTag.textContent = styles
  dialogOverlay.appendChild(styleTag)
  
  // 5. Add event handlers
  const closeDialog = (grant) => {
    // --- DEBUG START ---
    console.log('[DEBUG] closeDialog called. Grant =', grant)
    
    const message = {
      permissionId: request.permissionId,
      grant: grant
    }
    
    console.log('[DEBUG] Sending IPC "handle-permission-request" with:', message)
    // --- DEBUG END ---

    // Send the *same* message for both "Accept" and "Deny"
    ipc.send('handle-permission-request', message)
    
    // Clean up
    dialogOverlay.remove()
    isDialogActive = false
    
    // Process the next item in the queue
    processPermissionQueue()
  }

  // Close button = Deny
  closeButton.onclick = (e) => {
    e.stopPropagation()
    closeDialog(false) // false = deny
  }

  // Deny button
  denyButton.onclick = (e) => {
    e.stopPropagation()
    closeDialog(false)
  }

  // Accept button
  acceptButton.onclick = (e) => {
    e.stopPropagation()
    closeDialog(true) // true = grant
  }
  
  // 6. Append to page
  if (document.body) {
    document.body.appendChild(dialogOverlay)
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(dialogOverlay)
    })
  }
}

/**
 * Checks the queue and shows the next dialog if available.
 */
// In default.js, replace from line 290 to the end

/**
 * Checks the queue and shows the next dialog if available.
 */
function processPermissionQueue () {
  // --- DEBUG START ---
  console.log(`[DEBUG] Processing queue. IsDialogActive: ${isDialogActive}, Queue length: ${permissionRequestQueue.length}`);
  // --- DEBUG END ---

  if (isDialogActive || permissionRequestQueue.length === 0) {
    if (isDialogActive) {
      console.log('[DEBUG] Queue processing skipped: Dialog already active.');
    }
    if (permissionRequestQueue.length === 0) {
      console.log('[DEBUG] Queue processing skipped: Queue is empty.');
    }
    return // Dialog already showing or queue is empty
  }

  isDialogActive = true
  const nextRequest = permissionRequestQueue.shift() // Get the next request
  
  // Use a timeout to ensure dialogs don't appear *too* rapidly
  setTimeout(() => {
    showPermissionDialog(nextRequest)
  }, 100)
}

// Listen for the message from js/navbar/permissionRequests.js
// USES "ipc" from top of file
ipc.on('queue-permission-request', (event, request) => {
  // --- DEBUG START ---
  console.log(`[DEBUG] Received 'queue-permission-request' for permissionId: ${request.permissionId}, permission: ${request.permission}`);
  // --- DEBUG END ---
  permissionRequestQueue.push(request)
  processPermissionQueue()
})
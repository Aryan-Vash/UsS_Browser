// In js/navbar/cookieManagerIcon.js

const { ipcRenderer } = require('electron')
const cookieManager = require('js/cookieManager/cookieManager.js')

// DEBUG 1: Confirms this file is loaded
console.log('DEBUG: cookieManagerIcon.js was loaded and is running!')

// NO event listener wrapper. This initialize() function
// runs immediately, BEFORE sessionRestore.js is called.
function initialize () {
  
  // DEBUG 2: This should fire immediately
  console.log('DEBUG: Initializing cookie button and adding listeners...')
  const cookieManagerButton = document.getElementById('cookie-manager-button')

  async function show () {
    // DEBUG 3: This log should now appear
    console.log('DEBUG: show() function is running. Checking for cookies...')
    
    const tab = tasks.get(tasks.activeId) // "tasks" is the correct global
    
    if (!tab) {
      console.log('DEBUG: No active tab found. Hiding button.')
      cookieManagerButton.hidden = true
      return
    }

    const url = tab.url
    if (url.startsWith('min://') || url.startsWith('about:')) {
      console.log('DEBUG: Internal page. Hiding button.')
      cookieManagerButton.hidden = true
      return
    }

    // The actual cookie check
    try {
      const cookies = await ipcRenderer.invoke('get-cookies-for-url', url, tab.partition)

      if (cookies && cookies.length > 0) {
        // DEBUG 4: This is the SUCCESS log
        console.log(`DEBUG: SUCCESS! Found ${cookies.length} cookies for ${url}. Button should appear.`)
        cookieManagerButton.hidden = false
      } else {
        // DEBUG 5: This is the "no cookies" log
        console.log(`DEBUG: No cookies found for ${url}. Hiding button.`)
        cookieManagerButton.hidden = true
      }
    } catch (e) {
      console.error('DEBUG: Error while checking for cookies:', e)
      cookieManagerButton.hidden = true
    }
  }

  // This is the click listener for the button itself
  cookieManagerButton.addEventListener('click', (e) => {
    e.stopPropagation()
    const tab = tasks.get(tasks.activeId)
    cookieManager.show(tab.url, tab.partition, cookieManagerButton)
  })

  // --- ADD LISTENERS ---
  // These listeners are now added *before* sessionRestore runs,
  // so they will be ready to catch all events.
  
  // 1. Listens for when the user switches tabs
  //    This will also fire when the *first tab* is selected on startup.
  tasks.on('tab-selected', show)

  // 2. Listens for when a page is DONE loading in any tab.
  tasks.on('page-load-stop', (tabId) => {
    // Check if the page that finished loading is the one we're looking at
    if (tabId === tasks.activeId) {
      console.log('DEBUG: Active page finished loading. Re-checking for cookies.')
      show()
    }
  })

  console.log('DEBUG: Listeners added. Waiting for events.')
}

module.exports = { initialize }
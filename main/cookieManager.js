// In main/cookieManager.js

const { ipcMain } = require('electron')

function init () {
  // 1. Listen for a request from the UI to GET cookies
  ipcMain.handle('get-cookies-for-url', async (event, url, partition) => {
    if (!url) {
      return []
    }

    // Choose the correct session (default or a partition)
    let sessionToQuery = session.defaultSession
    if (partition) {
      sessionToQuery = session.fromPartition(partition)
    }

    try {
      // Query the correct session
      const cookies = await sessionToQuery.cookies.get({ url })
      return cookies
    } catch (e) {
      console.error('Error fetching cookies:', e)
      return []
    }
  })

  // 2. Listen for a request from the UI to REMOVE cookies
  //    It must accept the partition!
  ipcMain.handle('remove-cookies', async (event, partition, cookiesToRemove) => {
    let removedCount = 0
    if (!Array.isArray(cookiesToRemove)) {
      return { success: false, count: 0 }
    }

    // 1. Get the correct session
    let sessionToQuery = session.defaultSession
    if (partition) {
      sessionToQuery = session.fromPartition(partition)
    }

    try {
      for (const cookie of cookiesToRemove) {
        if (cookie.url && cookie.name) {
          // 2. Remove from the correct session
          await sessionToQuery.cookies.remove(cookie.url, cookie.name)
          removedCount++
        }
      }
      return { success: true, count: removedCount }
    } catch (e) {
      console.error('Error removing cookies:', e)
      return { success: false, count: 0 }
    }
  })
}

var cookieManager = { init }
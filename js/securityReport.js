/* global modalMode */
const { ipcRenderer } = require('electron')

const securityReport = {
    requestInFlight: false,

    getCurrentURL: () => {
        const tabEditorInput = document.getElementById('tab-editor-input');
        if (tabEditorInput && tabEditorInput.value) {
            return tabEditorInput.value;
        }
        // Fallback for demonstration if the editor input is not available/visible
        return 'https://www.example-secure-site.com';
    },

    setLoadingState: (isLoading) => {
        securityReport.requestInFlight = isLoading
        const elStatus = document.getElementById('report-status')
        const elSummary = document.getElementById('report-summary')
        if (isLoading) {
            if (elStatus) elStatus.textContent = 'Fetching security report…'
            if (elSummary) elSummary.textContent = 'Please wait while we analyze this site.'
        }
    },

    renderReport: async (url) => {
        securityReport.setLoadingState(true)

        const elUrl = document.getElementById('report-url')
        const elStatus = document.getElementById('report-status')
        const elSummary = document.getElementById('report-summary')
        const elModel = document.getElementById('report-model')

        if (elUrl) elUrl.textContent = url
        if (elModel) elModel.textContent = ''

        try {
            const reportData = await ipcRenderer.invoke('security-report-fetch', url)
            const modelPrediction = reportData?.model?.prediction?.[0] || {}
            const combined = reportData?.combined || {}

            const status = modelPrediction.risk_level || combined.model_risk_level || 'Unknown'
            const summary = reportData?.natural_language_summary || combined.heuristic_summary || 'No summary available.'

            if (elStatus) {
                elStatus.textContent = status.replace(/_/g, ' ')
            }

            if (elSummary) {
                elSummary.textContent = summary
            }

            if (elModel) {
                const prettyModel = modelPrediction && Object.keys(modelPrediction).length > 0
                  ? JSON.stringify(modelPrediction, null, 2)
                  : 'No model data returned.'
                elModel.textContent = prettyModel
            }
        } catch (error) {
            console.error('[SecurityReport] Failed to fetch data', error)
            if (elStatus) {
                elStatus.textContent = 'Unable to load security report'
            }
            if (elSummary) {
                elSummary.textContent = 'Ensure the local analysis service is running on port 8009 and try again.'
            }
        } finally {
            securityReport.setLoadingState(false)
        }
    },

    // Initialization and event setup
    init: () => {
        const reportButton = document.getElementById('security-report-button');
        const reportDialog = document.getElementById('security-report-dialog');
        const closeButton = document.getElementById('security-report-close');

        if (!reportButton || !reportDialog || !closeButton) {
            // Elements not present — nothing to initialize
            return
        }

        // Event listener to open the modal
        reportButton.addEventListener('click', async () => {
            const currentURL = securityReport.getCurrentURL();
            await securityReport.renderReport(currentURL);
            
            // Use the standard Min modal helper if available, otherwise use basic DOM show/hide
            if (typeof modalMode !== 'undefined' && modalMode.show) {
                modalMode.show(reportDialog);
            } else {
                reportDialog.hidden = false;
            }
        });

        // Event listener to close the modal
        closeButton.addEventListener('click', () => {
            if (typeof modalMode !== 'undefined' && modalMode.hide) {
                modalMode.hide(reportDialog);
            } else {
                reportDialog.hidden = true;
            }
        });
    }
};

// Export init for require() usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = securityReport;
}

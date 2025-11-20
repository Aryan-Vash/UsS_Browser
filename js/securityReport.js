/* global modalMode */
const { ipcRenderer } = require('electron')

const securityReport = {
    requestInFlight: false,

    getCurrentURL: () => {
        const tabEditorInput = document.getElementById('tab-editor-input');
        if (tabEditorInput && tabEditorInput.value) {
            return tabEditorInput.value;
        }
        return 'https://www.example-secure-site.com';
    },

    setLoadingState: (isLoading) => {
        securityReport.requestInFlight = isLoading
        
        const elLoading = document.getElementById('security-report-loading')
        const elContent = document.getElementById('security-report-content')
        
        if (elLoading && elContent) {
            if (isLoading) {
                elLoading.hidden = false;
                elContent.hidden = true;
            } else {
                elLoading.hidden = true;
                elContent.hidden = false;
            }
        }
    },

    renderReport: async (url) => {
        // 1. Show loading state immediately
        securityReport.setLoadingState(true)

        const elUrl = document.getElementById('report-url')
        const elStatus = document.getElementById('report-status')
        const elSummary = document.getElementById('report-summary')
        const elModel = document.getElementById('report-model')

        // Reset UI content
        if (elUrl) elUrl.textContent = url
        if (elModel) elModel.textContent = ''
        if (elStatus) elStatus.textContent = '' 
        if (elSummary) elSummary.textContent = ''

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
    
    init: () => {
        const reportButton = document.getElementById('security-report-button');
        const reportDialog = document.getElementById('security-report-dialog');
        const closeButton = document.getElementById('security-report-close');

        if (!reportButton || !reportDialog || !closeButton) {
            return
        }
        reportButton.addEventListener('click', () => {
            const currentURL = securityReport.getCurrentURL();
            if (typeof modalMode !== 'undefined' && modalMode.show) {
                modalMode.show(reportDialog);
            } else {
                reportDialog.hidden = false;
            }

            securityReport.renderReport(currentURL);
        });
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

/**
 * Page Object Models for the Pithagoras/BadgerBox UI
 * These provide a clean interface to interact with UI elements
 */

class ToolbarPage {
    // Project menu
    get projectMenuBtn() { return $('#project-menu-btn'); }
    get projectDropdown() { return $('#project-dropdown-content'); }
    get projectNewBtn() { return $('#project-new-btn-menu'); }
    get projectOpenBtn() { return $('#project-open-btn-menu'); }
    get projectSaveBtn() { return $('#project-save-btn-menu'); }
    get projectImportBtn() { return $('#project-import-btn-menu'); }
    get projectExportBtn() { return $('#project-export-btn-menu'); }

    // Circuits menu
    get circuitsMenuBtn() { return $('#circuits-menu-btn'); }
    get circuitsDropdown() { return $('#circuits-dropdown-content'); }

    // Mode menu
    get modeMenuBtn() { return $('#mode-menu-btn'); }
    get modeDropdown() { return $('#mode-dropdown-content'); }
    get modeDesignBtn() { return $('#mode-design-btn'); }
    get modeBuildBtn() { return $('#mode-build-btn'); }

    // Debug controls
    get debugStartBtn() { return $('#debug-start-btn'); }
    get debugStopBtn() { return $('#debug-stop'); }
    get debugContinueBtn() { return $('#debug-continue'); }
    get debugPauseBtn() { return $('#debug-pause'); }
    get debugStepOverBtn() { return $('#debug-step-over'); }
    get debugStepIntoBtn() { return $('#debug-step-into'); }
    get debugStepOutBtn() { return $('#debug-step-out'); }

    // Other toolbar buttons
    get bluetoothToggleBtn() { return $('#bluetooth-toggle-btn'); }
    get preferencesBtn() { return $('#preferences-btn'); }
    get fullscreenBtn() { return $('#fullscreen-btn'); }

    async openProjectMenu() {
        await this.projectMenuBtn.waitForClickable();
        await this.projectMenuBtn.click();
        await browser.pause(100); // Brief pause for dropdown animation
        await this.projectDropdown.waitForDisplayed({ timeout: 5000 });
    }

    async openCircuitsMenu() {
        await this.circuitsMenuBtn.waitForClickable();
        await this.circuitsMenuBtn.click();
        await browser.pause(100);
        await this.circuitsDropdown.waitForDisplayed({ timeout: 5000 });
    }

    async openModeMenu() {
        // Check if already open
        const isOpen = await this.modeDropdown.isDisplayed().catch(() => false);
        if (isOpen) {
            return; // Already open, no need to click
        }

        await this.modeMenuBtn.waitForClickable();
        await this.modeMenuBtn.click();
        await browser.pause(200);
        await this.modeDropdown.waitForDisplayed({ timeout: 8000 });
    }

    async switchToDesignMode() {
        await this.openModeMenu();
        await this.modeDesignBtn.waitForClickable();
        await this.modeDesignBtn.click();
        await browser.pause(200); // Wait for mode switch animation
    }

    async switchToBuildMode() {
        await this.openModeMenu();
        await this.modeBuildBtn.waitForClickable();
        await this.modeBuildBtn.click();
        await browser.pause(200); // Wait for mode switch animation
    }

    async loadDemoCircuit() {
        // Load the default LRC circuit demo
        await browser.execute(() => {
            if (window.loadCircuit) {
                window.loadCircuit('lrc.txt', 'LRC Circuit');
            }
        });
        // Wait for circuit to load
        await browser.pause(1000);
    }
}

class EditorPage {
    get fileTreePanel() { return $('#file-tree-panel'); }
    get fileTree() { return $('#file-tree'); }
    get fileTreeSearch() { return $('#file-tree-search'); }
    get clearFileSearchBtn() { return $('#clear-file-search'); }
    get toggleFiletreeBtn() { return $('#toggle-filetree'); }
    get editorTabs() { return $('#editor-tabs'); }
    get codeIframe() { return $('#code'); }

    async waitForFileTree() {
        await this.fileTree.waitForDisplayed();
    }

    async searchFiles(query) {
        await this.fileTreeSearch.setValue(query);
    }

    async clearFileSearch() {
        await browser.pause(500); // Wait for any animations
        // Use JavaScript click to avoid click interception
        await browser.execute(() => {
            const btn = document.getElementById('clear-file-search');
            if (btn) btn.click();
        });
    }

    async toggleFileTree() {
        await this.toggleFiletreeBtn.click();
    }

    async getOpenTabs() {
        const tabs = await this.editorTabs.$$('.editor-tab');
        return tabs;
    }
}

class ConsolePage {
    get consolePanel() { return $('#console-panel'); }
    get consoleTabs() { return $('#console-tabs'); }
    get consoleContent() { return $('#console-content'); }

    // Console tabs
    get consoleTab() { return $('.console-tab[data-tab="console"]'); }
    get breakpointsTab() { return $('.console-tab[data-tab="breakpoints"]'); }
    get watchesTab() { return $('.console-tab[data-tab="watches"]'); }
    get scopesTab() { return $('.console-tab[data-tab="scopes"]'); }

    // Console toolbar
    get debugLevelBtn() { return $('.console-level-btn[data-level="DEBUG"]'); }
    get infoLevelBtn() { return $('.console-level-btn[data-level="INFO"]'); }
    get warnLevelBtn() { return $('.console-level-btn[data-level="WARN"]'); }
    get errorLevelBtn() { return $('.console-level-btn[data-level="ERROR"]'); }
    get eventLevelBtn() { return $('.console-level-btn[data-level="EVENT"]'); }
    get consoleSearch() { return $('#console-search'); }
    get consoleClearBtn() { return $('#console-clear-btn'); }
    get consoleDetachBtn() { return $('#console-detach-btn'); }
    get consoleCollapseBtn() { return $('#console-collapse-btn'); }

    // Breakpoints
    get breakpointsList() { return $('#breakpoints-list'); }
    get toggleAllBreakpointsBtn() { return $('#toggle-all-breakpoints-btn'); }

    async switchToConsoleTab() {
        await this.consoleTab.click();
    }

    async switchToBreakpointsTab() {
        await this.breakpointsTab.click();
    }

    async switchToWatchesTab() {
        await this.watchesTab.click();
    }

    async switchToScopesTab() {
        await this.scopesTab.click();
    }

    async clearConsole() {
        await this.consoleClearBtn.click();
    }

    async searchConsole(query) {
        await this.consoleSearch.setValue(query);
    }

    async filterByLevel(level) {
        const btn = await $(`.console-level-btn[data-level="${level}"]`);
        await btn.click();
    }
}

class CircuitPage {
    get circuitFrame() { return $('#circuitFrame'); }

    async waitForCircuit() {
        await this.circuitFrame.waitForDisplayed();
    }

    async switchToCircuit(iframe) {
        await browser.switchToFrame(iframe);
    }

    async switchToParent() {
        await browser.switchToParentFrame();
    }
}

class BreadboardPage {
    get breadboardPane() { return $('#breadboard-pane'); }
    get breadboardContainer() { return $('#breadboard-container'); }
    get breadboard() { return $('#breadboard'); }
    get stepControls() { return $('#step-controls'); }
    get backBtn() { return $('#backBtn'); }
    get resetBtn() { return $('#resetBtn'); }
    get nextBtn() { return $('#nextBtn'); }

    async waitForBreadboard() {
        await this.breadboard.waitForDisplayed();
    }

    async clickNext() {
        await this.nextBtn.click();
    }

    async clickBack() {
        await this.backBtn.click();
    }

    async clickReset() {
        await this.resetBtn.click();
    }
}

class BluetoothPage {
    get bluetoothDialog() { return $('#bluetooth-dialog'); }

    async waitForDialog() {
        await this.bluetoothDialog.waitForDisplayed({ timeout: 5000 });
    }

    async isDialogOpen() {
        return await this.bluetoothDialog.isDisplayed();
    }
}

class SplashPage {
    get splashScreen() { return $('#splash-screen'); }
    get splashVersion() { return $('#splash-version'); }
    get splashLogo() { return $('.splash-logo'); }

    async waitForSplashToDisappear() {
        await this.splashScreen.waitForDisplayed({ timeout: 30000, reverse: true });
    }

    async isSplashVisible() {
        return await this.splashScreen.isDisplayed();
    }
}

class GutterPage {
    get gutterButtons() { return $('#gutter-buttons'); }
    get maxRightBtn() { return $('#max-right'); }
    get returnGutterBtn() { return $('#return-gutter'); }
    get maxLeftBtn() { return $('#max-left'); }

    async maximizeRight() {
        await this.maxRightBtn.click();
    }

    async maximizeLeft() {
        await this.maxLeftBtn.click();
    }

    async returnToCenter() {
        await this.returnGutterBtn.click();
    }
}

class PinManagerPage {
    get pinManager() { return $('#pin-manager'); }
    get pinManagerView() { return $('#pin-manager-view'); }
    get bomItems() { return $('#pm-bom-items'); }
    get createMapping() { return $('#pm-create-mapping'); }
    get manufacturerName() { return $('#pm-manufacturer-name'); }
    get manufacturerModelNbr() { return $('#pm-manufacturer-model-nbr'); }

    async waitForPinManager() {
        await this.pinManager.waitForDisplayed();
    }

    async isVisible() {
        return await this.pinManager.isDisplayed();
    }
}

module.exports = {
    ToolbarPage: new ToolbarPage(),
    EditorPage: new EditorPage(),
    ConsolePage: new ConsolePage(),
    CircuitPage: new CircuitPage(),
    BreadboardPage: new BreadboardPage(),
    BluetoothPage: new BluetoothPage(),
    SplashPage: new SplashPage(),
    GutterPage: new GutterPage(),
    PinManagerPage: new PinManagerPage()
};
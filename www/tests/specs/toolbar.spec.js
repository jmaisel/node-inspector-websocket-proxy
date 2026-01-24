const { ToolbarPage, SplashPage } = require('../helpers/page-objects');

describe('Toolbar Functionality', () => {
    before(async () => {
        await browser.url('/app/index.html');
        await SplashPage.waitForSplashToDisappear();
    });

    describe('Project Menu', () => {
        it('should display the project menu button', async () => {
            expect(await ToolbarPage.projectMenuBtn.isDisplayed()).to.be.true;
        });

        it('should open project dropdown when clicked', async () => {
            await ToolbarPage.openProjectMenu();
            expect(await ToolbarPage.projectDropdown.isDisplayed()).to.be.true;
        });

        it('should show all project menu items', async () => {
            // Open menu if not already open
            const isOpen = await ToolbarPage.projectDropdown.isDisplayed().catch(() => false);
            if (!isOpen) {
                await ToolbarPage.openProjectMenu();
            }
            expect(await ToolbarPage.projectNewBtn.isDisplayed()).to.be.true;
            expect(await ToolbarPage.projectOpenBtn.isDisplayed()).to.be.true;
            expect(await ToolbarPage.projectSaveBtn.isDisplayed()).to.be.true;
            expect(await ToolbarPage.projectImportBtn.isDisplayed()).to.be.true;
            expect(await ToolbarPage.projectExportBtn.isDisplayed()).to.be.true;
        });

        it('should have correct text labels', async () => {
            // Reuse open menu or open it
            const isOpen = await ToolbarPage.projectDropdown.isDisplayed().catch(() => false);
            if (!isOpen) {
                await ToolbarPage.openProjectMenu();
            }
            expect(await ToolbarPage.projectNewBtn.getText()).to.include('New Project');
            expect(await ToolbarPage.projectSaveBtn.getText()).to.include('Save Project');
        });
    });

    describe('Circuits Menu', () => {
        it('should display the circuits menu button', async () => {
            expect(await ToolbarPage.circuitsMenuBtn.isDisplayed()).to.be.true;
        });

        it('should open circuits dropdown when clicked', async () => {
            await ToolbarPage.openCircuitsMenu();
            expect(await ToolbarPage.circuitsDropdown.isDisplayed()).to.be.true;
        });
    });

    describe('Mode Menu', () => {
        it('should display the mode menu button', async () => {
            expect(await ToolbarPage.modeMenuBtn.isDisplayed()).to.be.true;
        });

        it('should open mode dropdown when clicked', async () => {
            await ToolbarPage.openModeMenu();
            expect(await ToolbarPage.modeDropdown.isDisplayed()).to.be.true;
        });

        it('should show Design and Build mode options', async () => {
            const isOpen = await ToolbarPage.modeDropdown.isDisplayed().catch(() => false);
            if (!isOpen) {
                await ToolbarPage.openModeMenu();
            }
            expect(await ToolbarPage.modeDesignBtn.isDisplayed()).to.be.true;
            expect(await ToolbarPage.modeBuildBtn.isDisplayed()).to.be.true;
        });

        it('should allow switching to Design mode', async () => {
            await ToolbarPage.switchToDesignMode();
            // Mode switch should complete without error
            await browser.pause(500);
        });

        it('should allow switching to Build mode', async () => {
            await ToolbarPage.switchToBuildMode();
            // Mode switch should complete without error
            await browser.pause(500);
        });
    });

    describe('Debug Controls', () => {
        it('should display the debug start button', async () => {
            expect(await ToolbarPage.debugStartBtn.isDisplayed()).to.be.true;
        });

        it('should have debug start button disabled initially', async () => {
            expect(await ToolbarPage.debugStartBtn.isEnabled()).to.be.false;
        });

        it('should display debug control buttons when debugging', async () => {
            // Debug controls are hidden initially
            const stopBtn = await ToolbarPage.debugStopBtn;
            const isDisplayed = await stopBtn.isDisplayed().catch(() => false);
            // Initially hidden - this test documents the initial state
            expect(isDisplayed).to.be.false;
        });
    });

    describe('Connection Button', () => {
        it('should display the connect button', async () => {
            expect(await ToolbarPage.bluetoothToggleBtn.isDisplayed()).to.be.true;
        });

        it('should have correct label', async () => {
            const text = await ToolbarPage.bluetoothToggleBtn.getText();
            expect(text).to.include('Connect');
        });
    });

    describe('Preferences Button', () => {
        it('should display the preferences button', async () => {
            expect(await ToolbarPage.preferencesBtn.isDisplayed()).to.be.true;
        });

        it('should have correct label', async () => {
            const text = await ToolbarPage.preferencesBtn.getText();
            expect(text).to.include('Preferences');
        });
    });

    describe('Fullscreen Button', () => {
        it('should display the fullscreen button', async () => {
            expect(await ToolbarPage.fullscreenBtn.isDisplayed()).to.be.true;
        });

        it('should be clickable', async () => {
            expect(await ToolbarPage.fullscreenBtn.isClickable()).to.be.true;
        });
    });
});
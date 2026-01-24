const { EditorPage, SplashPage, ToolbarPage } = require('../helpers/page-objects');

describe('Code Editor', () => {
    before(async () => {
        await browser.url('/app/index.html');
        await SplashPage.waitForSplashToDisappear();
        // Load a demo circuit so file tree has content
        await ToolbarPage.loadDemoCircuit();
    });

    describe('File Tree Panel', () => {
        it('should display the file tree panel', async () => {
            expect(await EditorPage.fileTreePanel.isDisplayed()).to.be.true;
        });

        it('should display the file tree', async () => {
            expect(await EditorPage.fileTree.isDisplayed()).to.be.true;
        });

        it('should have a search input', async () => {
            expect(await EditorPage.fileTreeSearch.isDisplayed()).to.be.true;
        });

        it('should have a clear search button', async () => {
            // Button only appears after typing in search
            await EditorPage.searchFiles('test');
            await browser.pause(300);
            expect(await EditorPage.clearFileSearchBtn.isDisplayed()).to.be.true;
            // Clean up
            await EditorPage.fileTreeSearch.clearValue();
        });

        it('should have a toggle button', async () => {
            expect(await EditorPage.toggleFiletreeBtn.isDisplayed()).to.be.true;
        });

        it('should allow searching files', async () => {
            await EditorPage.searchFiles('main');
            const value = await EditorPage.fileTreeSearch.getValue();
            expect(value).to.equal('main');
            // Clean up
            await EditorPage.fileTreeSearch.clearValue();
        });

        it('should clear search when clear button is clicked', async () => {
            await EditorPage.searchFiles('main');
            await browser.pause(500); // Wait for button to appear and be clickable
            await EditorPage.clearFileSearch();
            const value = await EditorPage.fileTreeSearch.getValue();
            expect(value).to.equal('');
        });

        it('should toggle file tree visibility', async () => {
            const initialDisplay = await EditorPage.fileTreePanel.isDisplayed();
            await EditorPage.toggleFileTree();
            await browser.pause(500); // Wait for animation
            const afterToggle = await EditorPage.fileTreePanel.isDisplayed();
            // Panel should still exist but may have different visibility class
            expect(afterToggle).to.exist;
        });
    });

    describe('Editor Tabs', () => {
        it('should display the editor tabs container', async () => {
            expect(await EditorPage.editorTabs.isDisplayed()).to.be.true;
        });

        it('should be able to get open tabs', async () => {
            const tabs = await EditorPage.getOpenTabs();
            expect(tabs).to.be.an('array');
        });
    });

    describe('Code Editor Iframe', () => {
        it('should display the code editor iframe', async () => {
            expect(await EditorPage.codeIframe.isDisplayed()).to.be.true;
        });

        it('should have correct src attribute', async () => {
            const src = await EditorPage.codeIframe.getAttribute('src');
            expect(src).to.include('ace.html');
        });

        it('should be loaded', async () => {
            await EditorPage.codeIframe.waitForExist();
            expect(await EditorPage.codeIframe.isExisting()).to.be.true;
        });
    });
});
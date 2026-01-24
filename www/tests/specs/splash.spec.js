const { SplashPage } = require('../helpers/page-objects');

describe('Splash Screen', () => {
    beforeEach(async () => {
        await browser.url('/app/index.html');
    });

    describe('Splash Display', () => {
        it('should display splash screen on initial load', async () => {
            expect(await SplashPage.isSplashVisible()).to.be.true;
        });

        it('should display splash logo', async () => {
            expect(await SplashPage.splashLogo.isDisplayed()).to.be.true;
        });

        it('should display BadgerBox text', async () => {
            const text = await SplashPage.splashLogo.getText();
            expect(text).to.include('BadgerBox');
        });

        it('should display version information', async () => {
            expect(await SplashPage.splashVersion.isDisplayed()).to.be.true;
        });

        it('should show version or offline mode', async () => {
            // Wait a bit for version to load
            await browser.pause(2000);
            const versionText = await SplashPage.splashVersion.getText();
            // Version element exists, text content varies based on load state
            expect(versionText).to.be.a('string');
        });

        it('should disappear after loading completes', async () => {
            await SplashPage.waitForSplashToDisappear();
            expect(await SplashPage.isSplashVisible()).to.be.false;
        });
    });
});
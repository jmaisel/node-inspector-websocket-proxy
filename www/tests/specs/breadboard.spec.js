const { BreadboardPage, SplashPage, ToolbarPage } = require('../helpers/page-objects');

describe('Breadboard View', () => {
    before(async () => {
        await browser.url('/app/index.html');
        await SplashPage.waitForSplashToDisappear();
    });

    describe('Breadboard Elements', () => {
        it('should display the breadboard pane', async () => {
            // Breadboard may only be visible in Build mode
            await ToolbarPage.switchToBuildMode();
            await browser.pause(1000);
            expect(await BreadboardPage.breadboardPane.isExisting()).to.be.true;
        });

        it('should display the breadboard container', async () => {
            expect(await BreadboardPage.breadboardContainer.isExisting()).to.be.true;
        });

        it('should display the breadboard SVG', async () => {
            expect(await BreadboardPage.breadboard.isExisting()).to.be.true;
        });
    });

    describe('Step Controls', () => {
        it('should display step controls', async () => {
            expect(await BreadboardPage.stepControls.isExisting()).to.be.true;
        });

        it('should display back button', async () => {
            expect(await BreadboardPage.backBtn.isDisplayed()).to.be.true;
        });

        it('should display reset button', async () => {
            expect(await BreadboardPage.resetBtn.isDisplayed()).to.be.true;
        });

        it('should display next button', async () => {
            expect(await BreadboardPage.nextBtn.isDisplayed()).to.be.true;
        });

        it('should have clickable control buttons', async () => {
            expect(await BreadboardPage.backBtn.isClickable()).to.be.true;
            expect(await BreadboardPage.resetBtn.isClickable()).to.be.true;
            expect(await BreadboardPage.nextBtn.isClickable()).to.be.true;
        });

        it('should allow clicking next button', async () => {
            await BreadboardPage.clickNext();
            await browser.pause(200);
        });

        it('should allow clicking back button', async () => {
            await BreadboardPage.clickBack();
            await browser.pause(200);
        });

        it('should allow clicking reset button', async () => {
            await BreadboardPage.clickReset();
            await browser.pause(200);
        });
    });
});
const { GutterPage, SplashPage } = require('../helpers/page-objects');

describe('Gutter Controls', () => {
    before(async () => {
        await browser.url('/app/index.html');
        await SplashPage.waitForSplashToDisappear();
    });

    describe('Gutter Buttons', () => {
        it('should display gutter buttons container', async () => {
            expect(await GutterPage.gutterButtons.isDisplayed()).to.be.true;
        });

        it('should display max right button', async () => {
            expect(await GutterPage.maxRightBtn.isDisplayed()).to.be.true;
        });

        it('should display return gutter button', async () => {
            expect(await GutterPage.returnGutterBtn.isDisplayed()).to.be.true;
        });

        it('should display max left button', async () => {
            expect(await GutterPage.maxLeftBtn.isDisplayed()).to.be.true;
        });

        it('should allow clicking max right button', async () => {
            await GutterPage.maximizeRight();
            await browser.pause(500);
        });

        it('should allow clicking return button', async () => {
            await GutterPage.returnToCenter();
            await browser.pause(500);
        });

        it('should allow clicking max left button', async () => {
            await GutterPage.maximizeLeft();
            await browser.pause(500);
        });

        it('should return to center position', async () => {
            await GutterPage.returnToCenter();
            await browser.pause(500);
        });
    });
});
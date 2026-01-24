const { CircuitPage, SplashPage } = require('../helpers/page-objects');

describe('Circuit Simulator', () => {
    before(async () => {
        await browser.url('/app/index.html');
        await SplashPage.waitForSplashToDisappear();
    });

    describe('Circuit Frame', () => {
        it('should display the circuit iframe', async () => {
            await CircuitPage.waitForCircuit();
            expect(await CircuitPage.circuitFrame.isDisplayed()).to.be.true;
        });

        it('should have correct src attribute', async () => {
            const src = await CircuitPage.circuitFrame.getAttribute('src');
            expect(src).to.include('simulator.html');
        });

        it('should load with a default circuit', async () => {
            const src = await CircuitPage.circuitFrame.getAttribute('src');
            expect(src).to.include('startCircuit');
        });

        it('should be able to switch to circuit frame', async () => {
            const iframe = await CircuitPage.circuitFrame;
            await CircuitPage.switchToCircuit(iframe);
            // Should be in iframe context now
            await CircuitPage.switchToParent();
            // Should be back in main context
        });
    });
});
class LineItem{
    constructor(c, quantity, manufacturer, model){

        this.logger = new Logger("LineItem", Logger.LEVEL.DEBUG);

        this.label = CircuitModel.labelForJsid(c.jsid);
        this.sublabel = LineItem.sublabel(c);
        this.fullLabel = this.label + this.sublabel;

        this.simple = CircuitModel.isSimpleComponent(c);

        this.manufacturer = manufacturer;
        this.model = model;

        this.example = c.jsid;
        this.jsids = Array.of(this.example);
        this.quantity = quantity || 1;
        this.pinMapping = c.pinMapping;

        this.logger.debug('created LineItem', this);
    }

    static sublabel(c){

        const label = CircuitModel.labelForJsid(c.jsid);

        if(label === "Or Gate")
            return ` (${c.getPostCount()} pin)`;

        return "";
    }
}
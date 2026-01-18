class CircuitScanner{
    static Node = {
        src: "src",
        dest: "dest",
        arr: ["src", "dest"],
        each: (fun)=>{
            CircuitScanner.Node.arr.forEach(fun);
        }
    };

    static match = (spec, test) => test.comp === spec.comp && test.pin === spec.pin;

    constructor(simmodel) {
        this.simmodel = simmodel;
        this.logger = new Logger("CircuitScanner");
    }

    static isWire(jsid){
        return jsid.includes("WireElm");
    }

    links() {
        const links = [];
        const map = {}, src = {}, dest = {};

        // Traverse through the simmodel to find all connections
        Object.keys(this.simmodel).forEach(coord => {

            const components = this.simmodel[coord];

            // components at a particular x, y
            components.forEach(comp => {
                delete comp.point;
                const compPin = `${comp.comp}:${comp.pin}`;

                // fugly O(^2) double loop, but small data sets make it ok.
                // on a slow machine it will be a second or 2 for the largest
                // sim model, and that's way too big for the breadboard anyway.
                components.forEach(otherComp => {

                    delete otherComp.point
                    const otherCompPin = `${otherComp.comp}:${otherComp.pin}`;

                    if (compPin !== otherCompPin) {
                        let bi = { src: comp, dest: otherComp };
                        let di = { src: otherComp, dest: comp };
                        let kbi = JSON.stringify(bi);
                        let kdi = JSON.stringify(di);

                        if(!map[kbi] && !map[kdi]){
                            map[kbi] = bi
                            map[kdi] = di;
                            links.push(bi);
                        }
                    }
                });
            });
        });

        return links;
    }

    traceWire(wire, done = new Set()){

        this.logger.debug("traceWire", {wire, done})

        let result = [];

        if(done.has(wire)){
            return;
        }

        // create both ends of the wire
        let p0 = { comp: wire, pin: 0};
        let p1 = { comp: wire, pin: 1};

        // find initial connections on both ends of the wire
        let scans = [
            this.scanTargets(p0, CircuitScanner.Node.src), this.scanTargets(p0, CircuitScanner.Node.dest),
            this.scanTargets(p1, CircuitScanner.Node.src), this.scanTargets(p1, CircuitScanner.Node.dest)
        ]

        // prevent infinite recursion.
        done.add(wire);

        // loop through each connection list
        scans
            .filter(scan =>  scan.length)
            .forEach((conn, idx) => {

                // source / dest
                CircuitScanner.Node.arr.forEach((st, idx2) => {

                    if(conn.length){
                        let target = conn[0][st];

                        if(CircuitScanner.isWire(target.comp)){
                            let t = this.traceWire(target.comp, done)

                            if(t && t.length)
                                result.push(...t);
                        }
                        else{
                            result.push(target);
                        }
                    }
                })
            })

        result.sort((i1, i2) => JSON.stringify(i1).localeCompare(JSON.stringify(i2)));
        return result;
    }

    scanTargets(test, scanTarget){
        return this.links(this.simmodel).filter(item => CircuitScanner.match(item[scanTarget], test));
    }

    scan(test){
        let result = [];

        this.each((scanTarget)=>{
            result.push(...this.scanTargets(test, scanTarget));
        });

        return result;
    }

    connectsTo(pinout){
        let allLinks = this.links();
        let result = new Set();

        CircuitScanner.Node.each((n, i) => {
            allLinks
                .filter(l => CircuitScanner.match(l[n], pinout) )
                .forEach(link => {
                    let node = link[n];
                    let inv = link[CircuitScanner.Node.arr[i^1]];

                    if(CircuitScanner.isWire(node.comp)){
                        result = this.traceWire(node.comp);
                    }
                    else if(!CircuitScanner.match(node, pinout)){
                        result = [node]
                    }

                    if(CircuitScanner.isWire(inv.comp)){
                        result = this.traceWire(inv.comp);
                    }
                    else if(!CircuitScanner.match(inv, pinout)){
                        result = [inv]
                    }
                })
        })
        return [...result].filter(i => !CircuitScanner.match(i, pinout));
    }

    dictionary(){
        let dictionary = new Map();

        const sortByEntries = (map)=>{
            const s = JSON.stringify;
            const mapEntries = [...map.entries()];
            mapEntries.sort(([keyA, valueA], [keyB, valueB]) => s(keyA).localeCompare(s(keyB)));
            return new Map(mapEntries);
        }

        this.links().forEach(link => {
            CircuitScanner.Node.each(i => {

                if(!CircuitScanner.isWire(link[i].comp)){
                    dictionary.set(link[i], this.connectsTo(link[i]))
                }
            })
        })

        return sortByEntries(dictionary);
    }
}

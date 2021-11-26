export class StructuredTextMetrics {
    // This property is always defined on creation
    public width: number = 0;

    // If computed is true, then the following properties are computed
    public computed: boolean = false;
    public x: number = 0;
    public baselineY: number = 0;
    public height: number = 0;

    constructor(width: number) {
        if ( width ) { this.width = width ; }
    }

    public fuseWithRightPart(metrics: StructuredTextMetrics) {
        // widths are summed
        this.width += metrics.width;

        if (! this.computed || ! metrics.computed) {
            this.computed = false;
            return;
        }

        // .x and .baselineY does not change, while .height is maximized
        if (metrics.height > this.height) { this.height = metrics.height; }
    }
}

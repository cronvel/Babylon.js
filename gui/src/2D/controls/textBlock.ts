import { Observable } from "babylonjs/Misc/observable";
import { Measure } from "../measure";
import { ValueAndUnit } from "../valueAndUnit";
import { Control } from "./control";
import { RegisterClass } from "babylonjs/Misc/typeStore";
import { Nullable } from "babylonjs/types";
import { serialize } from 'babylonjs/Misc/decorators';
import { ICanvasRenderingContext , ICanvasGradient } from 'babylonjs/Engines/ICanvas';
import { Engine } from 'babylonjs/Engines/engine';



interface StructuredTextPart {
  text: string;

  color?: string | ICanvasGradient;

  underline?: boolean;
  lineThrough?: boolean;

  // For instance, font size and family is not updatable, the whole TextBlock shares the same size and family (not useful and it introduces complexity)
  fontStyle?: string;
  fontWeight?: string;

  outlineWidth?: number;
  outlineColor?: string;

  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;

  // Computed part width
  width?: number;
}

type StructuredText = Array<StructuredTextPart>;
type StructuredTextLine = {
  parts: StructuredText;

  // Computed line width
  width?: number;
};
type StructuredTextLines = Array<StructuredTextLine>;

// Mostly the same than StructuredTextPart, but nothing is optional here,
// this is the attributes about to be sent to the context.
interface TextPartAttributes {
  color: string | ICanvasGradient;

  underline: boolean;
  lineThrough: boolean;

  // For instance, font size and family is not updatable, the whole TextBlock shares the same size and family (not useful and it introduces complexity)
  fontStyle: string;
  fontWeight: string;

  outlineWidth: number;
  outlineColor: string;

  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}


/**
 * Enum that determines the text-wrapping mode to use.
 */
export enum TextWrapping {
    /**
     * Clip the text when it's larger than Control.width; this is the default mode.
     */
    Clip = 0,

    /**
     * Wrap the text word-wise, i.e. try to add line-breaks at word boundary to fit within Control.width.
     */
    WordWrap = 1,

    /**
     * Ellipsize the text, i.e. shrink with trailing … when text is larger than Control.width.
     */
    Ellipsis,
}

/**
 * Class used to create text block control
 */
export class TextBlock extends Control {
    private _text = "";
    private _structuredText: StructuredText = [];   //++CR
    private _useStructuredText = false; //++CR this is probably temp, everything should use structuredText internally
    private _textWrapping = TextWrapping.Clip;
    private _textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    private _textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;

    private _lines: any[];
    private _resizeToFit: boolean = false;
    private _lineSpacing: ValueAndUnit = new ValueAndUnit(0);
    private _outlineWidth: number = 0;
    private _outlineColor: string = "white";
    private _underline: boolean = false;
    private _lineThrough: boolean = false;
    /**
     * An event triggered after the text is changed
     */
    public onTextChangedObservable = new Observable<TextBlock>();

    /**
     * An event triggered after the text was broken up into lines
     */
    public onLinesReadyObservable = new Observable<TextBlock>();

    /**
     * Function used to split a string into words. By default, a string is split at each space character found
     */
    public wordSplittingFunction: Nullable<(line: string) => string[]>;

    /**
     * Return the line list (you may need to use the onLinesReadyObservable to make sure the list is ready)
     */
    public get lines(): any[] {
        return this._lines;
    }

    /**
     * Gets or sets an boolean indicating that the TextBlock will be resized to fit container
     */
    @serialize()
    public get resizeToFit(): boolean {
        return this._resizeToFit;
    }

    /**
     * Gets or sets an boolean indicating that the TextBlock will be resized to fit container
     */
    public set resizeToFit(value: boolean) {
        if (this._resizeToFit === value) {
            return;
        }
        this._resizeToFit = value;

        if (this._resizeToFit) {
            this._width.ignoreAdaptiveScaling = true;
            this._height.ignoreAdaptiveScaling = true;
        }

        this._markAsDirty();
    }

    /**
     * Gets or sets a boolean indicating if text must be wrapped
     */
    @serialize()
    public get textWrapping(): TextWrapping | boolean {
        return this._textWrapping;
    }

    /**
     * Gets or sets a boolean indicating if text must be wrapped
     */
    public set textWrapping(value: TextWrapping | boolean) {
        if (this._textWrapping === value) {
            return;
        }
        this._textWrapping = +value;
        this._markAsDirty();
    }

    /**
     * Gets or sets text to display
     */
    @serialize()
    public get text(): string {
        return this._text;
    }

    /**
     * Gets or sets text to display
     */
    public set text(value: string) {
        if (this._text === value) {
            return;
        }
        this._text = value + ""; // Making sure it is a text
        this._structuredText = [ { text: this._text } ] ;
        this._useStructuredText = false;
        this._markAsDirty();

        this.onTextChangedObservable.notifyObservers(this);
    }

    //++CR
    /**
     * Gets or sets structured text to display
     */
    @serialize()
    public get structuredText(): StructuredText {
        return this._structuredText;
    }
    //--CR

    //++CR
    /**
     * Gets or sets structured text to display
     */
    public set structuredText(value: StructuredText) {
        if (this._structuredText === value || ! Array.isArray( value ) ) {
            return;
        }
        this._structuredText = value ;
        this._useStructuredText = true;
        this._text = this._structuredText.reduce( ( accumulator , part ) => accumulator + part.text , '' )
        this._markAsDirty();
        this.onTextChangedObservable.notifyObservers(this);
    }
    //--CR

    /**
     * Gets or sets text horizontal alignment (BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER by default)
     */
    @serialize()
    public get textHorizontalAlignment(): number {
        return this._textHorizontalAlignment;
    }

    /**
     * Gets or sets text horizontal alignment (BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER by default)
     */
    public set textHorizontalAlignment(value: number) {
        if (this._textHorizontalAlignment === value) {
            return;
        }

        this._textHorizontalAlignment = value;
        this._markAsDirty();
    }

    /**
     * Gets or sets text vertical alignment (BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER by default)
     */
    @serialize()
    public get textVerticalAlignment(): number {
        return this._textVerticalAlignment;
    }

    /**
     * Gets or sets text vertical alignment (BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER by default)
     */
    public set textVerticalAlignment(value: number) {
        if (this._textVerticalAlignment === value) {
            return;
        }

        this._textVerticalAlignment = value;
        this._markAsDirty();
    }

    /**
     * Gets or sets line spacing value
     */
    @serialize()
    public set lineSpacing(value: string | number) {
        if (this._lineSpacing.fromString(value)) {
            this._markAsDirty();
        }
    }

    /**
     * Gets or sets line spacing value
     */
    public get lineSpacing(): string | number {
        return this._lineSpacing.toString(this._host);
    }

    /**
     * Gets or sets outlineWidth of the text to display
     */
    @serialize()
    public get outlineWidth(): number {
        return this._outlineWidth;
    }

    /**
     * Gets or sets outlineWidth of the text to display
     */
    public set outlineWidth(value: number) {
        if (this._outlineWidth === value) {
            return;
        }
        this._outlineWidth = value;
        this._markAsDirty();
    }

    /**
     * Gets or sets a boolean indicating that text must have underline
     */
    @serialize()

    public get underline(): boolean {
        return this._underline;
    }

    /**
     * Gets or sets a boolean indicating that text must have underline
     */
    public set underline(value: boolean) {
        if (this._underline === value) {
            return;
        }
        this._underline = value;
        this._markAsDirty();
    }

    /**
     * Gets or sets an boolean indicating that text must be crossed out
     */
    @serialize()
    public get lineThrough(): boolean {
        return this._lineThrough;
    }

    /**
     * Gets or sets an boolean indicating that text must be crossed out
     */
    public set lineThrough(value: boolean) {
        if (this._lineThrough === value) {
            return;
        }
        this._lineThrough = value;
        this._markAsDirty();
    }

    /**
     * Gets or sets outlineColor of the text to display
     */
    @serialize()
    public get outlineColor(): string {
        return this._outlineColor;
    }

    /**
     * Gets or sets outlineColor of the text to display
     */
    public set outlineColor(value: string) {
        if (this._outlineColor === value) {
            return;
        }
        this._outlineColor = value;
        this._markAsDirty();
    }

    /**
     * Creates a new TextBlock object
     * @param name defines the name of the control
     * @param text defines the text to display (emptry string by default)
     */
    constructor(
        /**
         * Defines the name of the control
         */
        public name?: string,
        text: string = ""
    ) {
        super(name);

        this.text = text;
    }

    protected _getTypeName(): string {
        return "TextBlock";
    }

    protected _processMeasures(parentMeasure: Measure, context: ICanvasRenderingContext): void {
        if (!this._fontOffset) {
            this._fontOffset = Control._GetFontOffset(context.font);
        }

        super._processMeasures(parentMeasure, context);

        // Prepare lines
        this._lines = this._breakLines(this._currentMeasure.width, context);
        this.onLinesReadyObservable.notifyObservers(this);

        let maxLineWidth: number = 0;

        for (let i = 0; i < this._lines.length; i++) {
            const line = this._lines[i];

            if (line.width > maxLineWidth) {
                maxLineWidth = line.width;
            }
        }

        if (this._resizeToFit) {
            if (this._textWrapping === TextWrapping.Clip) {
                let newWidth = (this.paddingLeftInPixels + this.paddingRightInPixels + maxLineWidth) | 0;
                if (newWidth !== this._width.internalValue) {
                    this._width.updateInPlace(newWidth, ValueAndUnit.UNITMODE_PIXEL);
                    this._rebuildLayout = true;
                }
            }
            let newHeight = (this.paddingTopInPixels + this.paddingBottomInPixels + this._fontOffset.height * this._lines.length) | 0;

            if (this._lines.length > 0 && this._lineSpacing.internalValue !== 0) {
                let lineSpacing = 0;
                if (this._lineSpacing.isPixel) {
                    lineSpacing = this._lineSpacing.getValue(this._host);
                } else {
                    lineSpacing = this._lineSpacing.getValue(this._host) * this._height.getValueInPixel(this._host, this._cachedParentMeasure.height);
                }

                newHeight += (this._lines.length - 1) * lineSpacing;
            }

            if (newHeight !== this._height.internalValue) {
                this._height.updateInPlace(newHeight, ValueAndUnit.UNITMODE_PIXEL);
                this._rebuildLayout = true;
            }
        }
    }

    private _drawText(text: string, textWidth: number, y: number, context: ICanvasRenderingContext): void {
        var width = this._currentMeasure.width;
        var x = 0;
        switch (this._textHorizontalAlignment) {
            case Control.HORIZONTAL_ALIGNMENT_LEFT:
                x = 0;
                break;
            case Control.HORIZONTAL_ALIGNMENT_RIGHT:
                x = width - textWidth;
                break;
            case Control.HORIZONTAL_ALIGNMENT_CENTER:
                x = (width - textWidth) / 2;
                break;
        }

        if (this.shadowBlur || this.shadowOffsetX || this.shadowOffsetY) {
            context.shadowColor = this.shadowColor;
            context.shadowBlur = this.shadowBlur;
            context.shadowOffsetX = this.shadowOffsetX;
            context.shadowOffsetY = this.shadowOffsetY;
        }

        if (this.outlineWidth) {
            context.strokeText(text, this._currentMeasure.left + x, y);
        }
        context.fillText(text, this._currentMeasure.left + x, y);

        if (this._underline) {
            context.beginPath();
            context.lineWidth = Math.round(this.fontSizeInPixels * 0.05);
            context.moveTo(this._currentMeasure.left + x, y + 3);
            context.lineTo(this._currentMeasure.left + x + textWidth, y + 3);
            context.stroke();
            context.closePath();
        }

        if (this._lineThrough) {
            context.beginPath();
            context.lineWidth = Math.round(this.fontSizeInPixels * 0.05);
            context.moveTo(this._currentMeasure.left + x, y - this.fontSizeInPixels / 3);
            context.lineTo(this._currentMeasure.left + x + textWidth, y - this.fontSizeInPixels / 3);
            context.stroke();
            context.closePath();
        }
    }

    //++CR
    private _drawStructuredText(structuredText: StructuredText, textWidth: number, y: number, context: ICanvasRenderingContext): void {
        var attr ,
            x = 0 ,
            width = this._currentMeasure.width ;

        switch (this._textHorizontalAlignment) {
            case Control.HORIZONTAL_ALIGNMENT_LEFT:
                x = 0;
                break;
            case Control.HORIZONTAL_ALIGNMENT_RIGHT:
                x = width - textWidth;
                break;
            case Control.HORIZONTAL_ALIGNMENT_CENTER:
                x = (width - textWidth) / 2;
                break;
        }

        //console.warn( "****************** ._drawStructuredText()" , structuredText , textWidth , y ) ;

        var halfThickness = Math.round( this.fontSizeInPixels * 0.025 ) ,
            underlineYOffset = 3 ,
            lineThroughYOffset = - this.fontSizeInPixels / 3 ;

        for ( let part of structuredText ) {
            if ( ! part.width ) { continue ; }

            attr = this._inheritAttributes( part ) ;
            this._setContextAttributes( context , attr ) ;

            if ( attr.outlineWidth ) {
                if ( attr.underline ) {
                    context.strokeRect( this._currentMeasure.left + x - halfThickness , y + underlineYOffset - halfThickness , part.width , 2 * halfThickness ) ;
                }

                context.strokeText( part.text , this._currentMeasure.left + x , y ) ;

                if ( attr.lineThrough ) {
                    context.strokeRect( this._currentMeasure.left + x - halfThickness , y + lineThroughYOffset - halfThickness , part.width , 2 * halfThickness ) ;
                }
            }

            if ( attr.underline ) {
                context.fillRect( this._currentMeasure.left + x - halfThickness , y + underlineYOffset - halfThickness , part.width , 2 * halfThickness ) ;
            }

            context.fillText( part.text , this._currentMeasure.left + x , y ) ;

            if ( attr.lineThrough ) {
                context.fillRect( this._currentMeasure.left + x - halfThickness , y + lineThroughYOffset - halfThickness , part.width , 2 * halfThickness ) ;
            }

            x += part.width ;
        }
    };
    //--CR

    //++CR
    // Compute an attribute object from a text's part, inheriting from this
    private _inheritAttributes(part: StructuredTextPart): TextPartAttributes {
        return {
            color: part.color ?? this.color ,
            outlineWidth: part.outlineWidth ?? this._outlineWidth ,
            outlineColor: part.outlineColor ?? this._outlineColor ,
            shadowColor: part.shadowColor ?? this.shadowColor ,
            shadowBlur: part.shadowBlur ?? this.shadowBlur ,
            shadowOffsetX: part.shadowOffsetX ?? this.shadowOffsetX ,
            shadowOffsetY: part.shadowOffsetY ?? this.shadowOffsetY ,
            underline: part.underline ?? this._underline ,
            lineThrough: part.lineThrough ?? this._lineThrough ,

            // For instance, font size and family is not updatable, the whole TextBlock shares the same size and family (not useful and it introduces complexity)
            fontStyle: part.fontStyle ?? this._style?.fontStyle ?? this._fontStyle ,
            fontWeight: part.fontWeight ?? this._style?.fontWeight ?? this._fontWeight ,
        } ;
    } ;
    //--CR

    //++CR
    // It's like ._applyStates(), but for each line parts
    private _setContextAttributes(context: ICanvasRenderingContext, attr: TextPartAttributes) {
        // .fillStyle and .strokeStyle can receive a CSS color string, a CanvasGradient or a CanvasPattern,
        // but here we just care about color string.
        context.fillStyle = attr.color ;

        // Disallow changing font size and family? If this would be allowed, line-height computing would need to be upgraded...
        context.font = attr.fontStyle + " " + attr.fontWeight + " " + this.fontSize + " " + this._fontFamily ;
        //console.warn( "************?????????????????" , attr , attr.fontStyle + " " + attr.fontWeight + " " + this.fontSize + " " + this._fontFamily ) ;

        if ( attr.shadowBlur || attr.shadowOffsetX || attr.shadowOffsetY ) {
            if ( attr.shadowColor ) { context.shadowColor = attr.shadowColor ; }
            context.shadowBlur = attr.shadowBlur ;
            context.shadowOffsetX = attr.shadowOffsetX ;
            context.shadowOffsetY = attr.shadowOffsetY ;
        }
        else {
            context.shadowBlur = 0 ;
        }

        if ( attr.outlineWidth ) {
            context.lineWidth = attr.outlineWidth ;
            context.strokeStyle = attr.outlineColor ;
            context.lineJoin = 'miter' ;
            context.miterLimit = 2 ;
        }
        else {
            context.lineWidth = 0 ;
        }
    }
    //--CR

    //++CR
    // Like ._setContextAttributesForMeasure(), but only set up attributes that cares for measuring text
    private _setContextAttributesForMeasure(context: ICanvasRenderingContext, attr: TextPartAttributes) {
        context.font = attr.fontStyle + " " + attr.fontWeight + " " + this.fontSize + " " + this._fontFamily ;
    }
    //--CR

    /** @hidden */
    public _draw(context: ICanvasRenderingContext, invalidatedRectangle?: Nullable<Measure>): void {
        context.save();

        this._applyStates(context);

        // Render lines
        this._renderLines(context);

        context.restore();
    }

    protected _applyStates(context: ICanvasRenderingContext): void {
        super._applyStates(context);
        if (this.outlineWidth) {
            context.lineWidth = this.outlineWidth;
            context.strokeStyle = this.outlineColor;
            context.lineJoin = 'miter';
            context.miterLimit = 2;
        }
    }

    protected _breakLines(refWidth: number, context: ICanvasRenderingContext): object[] {
        if ( this._useStructuredText ) { return this._breakStructuredTextLines( refWidth , context ) ; }  //++CR

        var lines = [];
        var _lines = this.text.split("\n");

        if (this._textWrapping === TextWrapping.Ellipsis) {
            for (var _line of _lines) {
                lines.push(this._parseLineEllipsis(_line, refWidth, context));
            }
        } else if (this._textWrapping === TextWrapping.WordWrap) {
            for (var _line of _lines) {
                lines.push(...this._parseLineWordWrap(_line, refWidth, context));
            }
        } else {
            for (var _line of _lines) {
                lines.push(this._parseLine(_line, context));
            }
        }

        return lines;
    }

    //++CR
    protected _breakStructuredTextLines(refWidth: number, context: ICanvasRenderingContext): StructuredTextLines {
        var _newPart ,
            lines: StructuredTextLines = [] ,
            _currentLine: StructuredText = [] ,
            _lines: Array<StructuredText> = [ _currentLine ];

        for ( let _part of this._structuredText ) {
            if ( _part.text.includes( '\n' ) ) {
                for ( let _splitted of _part.text.split( '\n' ) ) {
                    _newPart = Object.assign( {} , _part ) ;
                    _newPart.text = _splitted ;
                    _currentLine.push( _newPart ) ;

                    // Create a new line
                    _currentLine = [] ;
                    _lines.push( _currentLine ) ;
                }
            }
            else {
                _currentLine.push( _part ) ;
            }
        }

        if (this._textWrapping === TextWrapping.Ellipsis) {
            for ( let _line of _lines) {
                lines.push(this._parseStructuredTextLineEllipsis(_line, refWidth, context));
            }
        }
        else if (this._textWrapping === TextWrapping.WordWrap) {
            for ( let _line of _lines) {
                lines.push(... this._parseStructuredTextLineWordWrap(_line, refWidth, context));
            }
        }
        else {
            for ( let _line of _lines) {
                lines.push(this._parseStructuredTextLine(_line, context));
            }
        }

        return lines;
    }
    //--CR

    protected _parseLine(line: string = "", context: ICanvasRenderingContext): object {
        var textMetrics = context.measureText(line);
        var lineWidth = Math.abs(textMetrics.actualBoundingBoxLeft) + Math.abs(textMetrics.actualBoundingBoxRight);
        return { text: line, width: lineWidth };
    }

    //++CR
    protected _parseStructuredTextLine(line: StructuredText, context: ICanvasRenderingContext): StructuredTextLine {
        var lineWidth = this._structuredTextWidth( line , context ) ;
        return { parts: line, width: lineWidth } ;
    };
    //--CR

    protected _parseLineEllipsis(line: string = "", width: number, context: ICanvasRenderingContext): object {
        var textMetrics = context.measureText(line);
        var lineWidth = Math.abs(textMetrics.actualBoundingBoxLeft) + Math.abs(textMetrics.actualBoundingBoxRight);

        if (lineWidth > width) {
            line += "…";
        }
        // unicode support. split('') does not work with unicode!
        // make sure Array.from is available
        const characters = Array.from && Array.from(line);
        if (!characters) {
            // no array.from, use the old method
            while (line.length > 2 && lineWidth > width) {
                line = line.slice(0, -2) + "…";
                textMetrics = context.measureText(line);
                lineWidth = Math.abs(textMetrics.actualBoundingBoxLeft) + Math.abs(textMetrics.actualBoundingBoxRight);
            }
        } else {
            while (characters.length && lineWidth > width) {
                characters.pop();
                line = `${characters.join("")}...`;
                textMetrics = context.measureText(line);
                lineWidth = Math.abs(textMetrics.actualBoundingBoxLeft) + Math.abs(textMetrics.actualBoundingBoxRight);
            }
        }

        return { text: line, width: lineWidth };
    }

    //++CR
    protected _parseStructuredTextLineEllipsis(line: StructuredText, width: number , context: ICanvasRenderingContext): StructuredTextLine {
        var _part , characters ,
            lineWidth = this._structuredTextWidth( line , context ) ;

        while ( line.length && lineWidth > width ) {
            _part = line[ line.length - 1 ] ;
            characters = Array.from( _part.text ) ;

            while ( characters.length && lineWidth > width ) {
                characters.pop() ;

                _part.text = characters.join('') + "…" ;
                delete _part.width ;    // delete .width, so ._structuredTextWidth() will re-compute it instead of using the existing one
                lineWidth = this._structuredTextWidth( line , context ) ;
            }

            if ( lineWidth > width ) {
                line.pop() ;
            }
        }

        return { parts: line, width: lineWidth } ;
    };
    //--CR

    protected _parseLineWordWrap(line: string = "", width: number, context: ICanvasRenderingContext): object[] {
        var lines = [];
        var words = this.wordSplittingFunction ? this.wordSplittingFunction(line) : line.split(" ");
        var textMetrics = context.measureText(line);
        var lineWidth = Math.abs(textMetrics.actualBoundingBoxLeft) + Math.abs(textMetrics.actualBoundingBoxRight);

        for (var n = 0; n < words.length; n++) {
            var testLine = n > 0 ? line + " " + words[n] : words[0];
            var metrics = context.measureText(testLine);
            var testWidth = Math.abs(metrics.actualBoundingBoxLeft) + Math.abs(metrics.actualBoundingBoxRight);
            if (testWidth > width && n > 0) {
                lines.push({ text: line, width: lineWidth });
                line = words[n];
                textMetrics = context.measureText(line);
                lineWidth = Math.abs(textMetrics.actualBoundingBoxLeft) + Math.abs(textMetrics.actualBoundingBoxRight);
            } else {
                lineWidth = testWidth;
                line = testLine;
            }
        }
        lines.push({ text: line, width: lineWidth });

        return lines;
    }

    //++CR
    // This splitting function does not exlude the splitter, it keeps it on the right-side of the split.
    protected static _defaultWordSplittingFunction(str: string): Array<string> {
        var match ,
            lastIndex = 0 ,
            splitted = [] ,
            regexp = / +/g ;

        //str = str.trim() ;

        while ( match = regexp.exec( str ) ) {
            if ( lastIndex < match.index ) {
                splitted.push( str.slice( lastIndex , match.index ) ) ;
            }

            lastIndex = match.index ;
        }

        if ( lastIndex < str.length ) {
            splitted.push( str.slice( lastIndex ) ) ;
        }

        return splitted ;
    };
    //--CR

    //++CR
    // Join consecutive parts sharing the exact same attributes.
    // It produces better results for underline and line-through, avoiding outline overlaps.
    protected static _fuseStructuredTextParts( structuredText: StructuredText ): StructuredText {
        if ( structuredText.length <= 1 ) { return structuredText ; }

        var index , part ,
            last: StructuredTextPart = structuredText[ 0 ] ,
            lastInserted: StructuredTextPart = last ,
            output: StructuredText = [ last ] ;

        for ( index = 1 ; index < structuredText.length ; index ++ ) {
            part = structuredText[ index ] ;
            if (
                last.color === part.color
                && last.outlineWidth === part.outlineWidth && last.outlineColor === part.outlineColor
                && last.shadowColor === part.shadowColor && last.shadowBlur === part.shadowBlur
                && last.shadowOffsetX === part.shadowOffsetX && last.shadowOffsetY === part.shadowOffsetY
                && last.underline === part.underline
                && last.lineThrough === part.lineThrough
                && last.fontStyle === part.fontStyle && last.fontWeight === part.fontWeight
            ) {
                lastInserted.text += part.text ;
                lastInserted.width = ( lastInserted.width || 0 ) + ( part.width || 0 ) ;   // It's never undefined here, but it's needed to please tsc
            }
            else {
                output.push( part ) ;
                lastInserted = part ;
            }

            last = part ;
        }

        return output ;
    } ;
    //--CR

   //++CR
    // Set the width of each parts and return the total width
    protected _structuredTextWidth(structuredText: StructuredText, context: ICanvasRenderingContext): number {
        var contextSaved = false ;

        var _width = structuredText.reduce( ( width , part ) => {
            if ( part.width === undefined ) {
                if ( ! contextSaved ) { context.save() ; }

                let attr = this._inheritAttributes( part ) ;
                this._setContextAttributesForMeasure( context , attr ) ;

                let textMetrics = context.measureText( part.text ) ;

                // .actualBoundingBox* does not work: sometime it skips spaces
                part.width = textMetrics.width ;
                //part.width = Math.abs( textMetrics.actualBoundingBoxLeft ) + Math.abs( textMetrics.actualBoundingBoxRight ) ;
                //part.width = Math.abs( textMetrics.actualBoundingBoxRight - textMetrics.actualBoundingBoxLeft ) ;
                //console.warn( "******************* ._structuredTextWidth() " , part , textMetrics ) ;
            }

            return width + part.width ;
        } , 0 ) ;

        if ( contextSaved ) { context.restore() ; }

        return _width ;
    };
    //--CR

    //++CR
    protected _parseStructuredTextLineWordWrap(line: StructuredText, width: number, context: ICanvasRenderingContext): StructuredTextLines {
        var _part: StructuredTextPart ,
            _word: StructuredTextPart ,
            wordText: string ,
            lines: StructuredTextLines = [] ,
            words: StructuredText = [] ,
            wordSplittingFunction = this.wordSplittingFunction || TextBlock._defaultWordSplittingFunction ;

        // Split each part of the line
        for ( _part of line ) {
            for ( wordText of wordSplittingFunction( _part.text ) ) {
                _word = Object.assign( {} , _part ) ;
                _word.text = wordText ;
                words.push( _word ) ;
            }
        }

        var lastTestWidth = 0 ,
            testWidth = 0 ,
            testLine: StructuredText = [] ;

        for ( _word of words ) {
            testLine.push( _word ) ;
            lastTestWidth = testWidth ;
            testWidth = this._structuredTextWidth( testLine , context ) ;

            if ( testWidth > width && testLine.length > 1 ) {
                testLine.pop() ;
                //lines.push( { parts: testLine , width: lastTestWidth } ) ;
                lines.push( { parts: TextBlock._fuseStructuredTextParts( testLine ) , width: lastTestWidth } ) ;

                // Create a new line with the current word as the first word.
                // We have to left-trim it because it mays contain a space.
                _word.text = _word.text.trimStart() ;
                delete _word.width ;    // delete .width, so ._structuredTextWidth() will re-compute it instead of using the existing one
                testLine = [ _word ] ;
                testWidth = this._structuredTextWidth( testLine , context ) ;
            }
        }

        lines.push( { parts: TextBlock._fuseStructuredTextParts( testLine ) , width: testWidth } ) ;

        return lines ;
    };
    //--CR

    protected _renderLines(context: ICanvasRenderingContext): void {
        var height = this._currentMeasure.height;
        var rootY = 0;
        switch (this._textVerticalAlignment) {
            case Control.VERTICAL_ALIGNMENT_TOP:
                rootY = this._fontOffset.ascent;
                break;
            case Control.VERTICAL_ALIGNMENT_BOTTOM:
                rootY = height - this._fontOffset.height * (this._lines.length - 1) - this._fontOffset.descent;
                break;
            case Control.VERTICAL_ALIGNMENT_CENTER:
                rootY = this._fontOffset.ascent + (height - this._fontOffset.height * this._lines.length) / 2;
                break;
        }

        rootY += this._currentMeasure.top;

        for (let i = 0; i < this._lines.length; i++) {
            const line = this._lines[i];

            if (i !== 0 && this._lineSpacing.internalValue !== 0) {
                if (this._lineSpacing.isPixel) {
                    rootY += this._lineSpacing.getValue(this._host);
                } else {
                    rootY = rootY + this._lineSpacing.getValue(this._host) * this._height.getValueInPixel(this._host, this._cachedParentMeasure.height);
                }
            }

            //++CR
            if ( this._useStructuredText ) {
                this._drawStructuredText(line.parts, line.width, rootY, context);
            }
            else {
                this._drawText(line.text, line.width, rootY, context);
            }
            //--CR

            rootY += this._fontOffset.height;
        }
    }

    /**
     * Given a width constraint applied on the text block, find the expected height
     * @returns expected height
     */
    public computeExpectedHeight(): number {
        if (this.text && this.widthInPixels) {
            // Shoudl abstract platform instead of using LastCreatedEngine
            const context = Engine.LastCreatedEngine?.createCanvas(0, 0).getContext("2d");
            if (context) {
                this._applyStates(context);
                if (!this._fontOffset) {
                    this._fontOffset = Control._GetFontOffset(context.font);
                }
                const lines = this._lines ? this._lines : this._breakLines(this.widthInPixels - this.paddingLeftInPixels - this.paddingRightInPixels, context);

                let newHeight = this.paddingTopInPixels + this.paddingBottomInPixels + this._fontOffset.height * lines.length;

                if (lines.length > 0 && this._lineSpacing.internalValue !== 0) {
                    let lineSpacing = 0;
                    if (this._lineSpacing.isPixel) {
                        lineSpacing = this._lineSpacing.getValue(this._host);
                    } else {
                        lineSpacing = this._lineSpacing.getValue(this._host) * this._height.getValueInPixel(this._host, this._cachedParentMeasure.height);
                    }

                    newHeight += (lines.length - 1) * lineSpacing;
                }

                return newHeight;
            }
        }
        return 0;
    }

    dispose(): void {
        super.dispose();

        this.onTextChangedObservable.clear();
    }
}
RegisterClass("BABYLON.GUI.TextBlock", TextBlock);

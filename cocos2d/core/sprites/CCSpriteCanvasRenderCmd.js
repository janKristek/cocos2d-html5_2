/****************************************************************************
 Copyright (c) 2013-2014 Chukong Technologies Inc.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

(function() {
    cc.Sprite.CanvasRenderCmd = function (renderable) {
        cc.Node.CanvasRenderCmd.call(this, renderable);
        this._needDraw = true;
        this._textureCoord = {
            renderX: 0,                             //the x of texture coordinate for render, when texture tinted, its value doesn't equal x.
            renderY: 0,                             //the y of texture coordinate for render, when texture tinted, its value doesn't equal y.
            x: 0,                                   //the x of texture coordinate for node.
            y: 0,                                   //the y of texture coordinate for node.
            width: 0,
            height: 0,
            validRect: false
        };
        this._blendFuncStr = "source-over";
        this._colorized = false;

        this._textureToRender = null;
    };

    var proto = cc.Sprite.CanvasRenderCmd.prototype = Object.create(cc.Node.CanvasRenderCmd.prototype);
    proto.constructor = cc.Sprite.CanvasRenderCmd;

    proto._init = function () {};

    proto.setDirtyRecursively = function (value) {};

    proto._resetForBatchNode = function () {};

    proto._setTexture = function (texture) {
        var node = this._node;
        if (node._texture !== texture) {
            if (texture) {
                node._textureLoaded = texture._textureLoaded;
            }else{
                node._textureLoaded = false;
            }
            node._texture = texture;
            this._updateColor();
        }
    };

    proto._setColorDirty = function () {
        this.setDirtyFlag(cc.Node._dirtyFlags.colorDirty | cc.Node._dirtyFlags.opacityDirty);
    };

    proto.isFrameDisplayed = function (frame) {      //TODO there maybe has a bug
        var node = this._node;
        if (frame.getTexture() !== node._texture)
            return false;
        return cc.rectEqualToRect(frame.getRect(), node._rect);
    };

    proto.updateBlendFunc = function (blendFunc) {
        this._blendFuncStr = cc.Node.CanvasRenderCmd._getCompositeOperationByBlendFunc(blendFunc);
    };

    proto._setBatchNodeForAddChild = function (child) {
        return true;
    };

    proto._handleTextureForRotatedTexture = function (texture, rect, rotated, counterclockwise) {
        if (rotated && texture.isLoaded()) {
            var tempElement = texture.getHtmlElementObj();
            tempElement = cc.Sprite.CanvasRenderCmd._cutRotateImageToCanvas(tempElement, rect, counterclockwise);
            var tempTexture = new cc.Texture2D();
            tempTexture.initWithElement(tempElement);
            tempTexture.handleLoadedTexture();
            texture = tempTexture;
            rect.x = rect.y = 0;
            this._node._rect = cc.rect(0, 0, rect.width, rect.height);
        }
        return texture;
    };

    proto._checkTextureBoundary = function (texture, rect, rotated) {
        if (texture && texture.url) {
            var _x = rect.x + rect.width, _y = rect.y + rect.height;
            if (_x > texture.width)
                cc.error(cc._LogInfos.RectWidth, texture.url);
            if (_y > texture.height)
                cc.error(cc._LogInfos.RectHeight, texture.url);
        }
    };

    proto.rendering = function (ctx, scaleX, scaleY) {
        var node = this._node;
        var locTextureCoord = this._textureCoord, alpha = (this._displayedOpacity / 255);
        var texture = this._textureToRender || node._texture;

        if ((texture && (locTextureCoord.width === 0 || locTextureCoord.height === 0|| !texture._textureLoaded)) || alpha === 0)
            return;

        var wrapper = ctx || cc._renderContext, context = wrapper.getContext();
        var locX = node._offsetPosition.x, locHeight = node._rect.height, locWidth = node._rect.width,
            locY = -node._offsetPosition.y - locHeight, image;

        wrapper.setTransform(this._worldTransform, scaleX, scaleY);
        wrapper.setCompositeOperation(this._blendFuncStr);
        wrapper.setGlobalAlpha(alpha);

        if(node._flippedX || node._flippedY)
            wrapper.save();
        if (node._flippedX) {
            locX = -locX - locWidth;
            context.scale(-1, 1);
        }
        if (node._flippedY) {
            locY = node._offsetPosition.y;
            context.scale(1, -1);
        }

        var sx, sy, sw, sh, x, y, w, h;
        if (this._colorized) {
            sx = 0;
            sy = 0;
        }else{
            sx = locTextureCoord.renderX;
            sy = locTextureCoord.renderY;
        }
        sw = locTextureCoord.width;
        sh = locTextureCoord.height;

        x = locX * scaleX;
        y = locY * scaleY;
        w = locWidth * scaleX;
        h = locHeight * scaleY;

        if (texture) {
            image = texture._htmlElementObj;
            if (texture._pattern !== "") {
                wrapper.setFillStyle(context.createPattern(image, texture._pattern));
                context.fillRect(x, y, w, h);
            } else {
                context.drawImage(image,
                    sx, sy, sw, sh,
                    x, y, w, h);
            }
        } else {
            var contentSize = node._contentSize;
            if (locTextureCoord.validRect) {
                var curColor = this._displayedColor;
                wrapper.setFillStyle("rgba(" + curColor.r + "," + curColor.g + "," + curColor.b + ",1)");
                context.fillRect(x, y, contentSize.width * scaleX, contentSize.height * scaleY);
            }
        }
        if(node._flippedX || node._flippedY)
            wrapper.restore();
        cc.g_NumberOfDraws++;
    };

    proto._updateColor = function(){
        var node = this._node;

        var texture = node._texture, rect = this._textureCoord;
        var dColor = this._displayedColor;

        if(texture){
            if(dColor.r !== 255 || dColor.g !== 255 || dColor.b !== 255){
                this._textureToRender = texture._generateColorTexture(dColor.r, dColor.g, dColor.b, rect);
                this._colorized = true;
            }else if(texture){
                this._textureToRender = texture;
                this._colorized = false;
            }
        }
    };

    proto.getQuad = function () {
        //throw an error. it doesn't support this function.
        return null;
    };

    proto._updateForSetSpriteFrame = function (pNewTexture, textureLoaded){
        this._colorized = false;
        this._textureCoord.renderX = this._textureCoord.x;
        this._textureCoord.renderY = this._textureCoord.y;
        textureLoaded = textureLoaded || pNewTexture._textureLoaded;

        if (textureLoaded) {
            //problem example http://mab.to/eo7YoVAs9
            var curColor = this._node.getColor();
            if (curColor.r !== 255 || curColor.g !== 255 || curColor.b !== 255||
                this._displayedColor.r !== 255 || this._displayedColor.g !== 255 || this._displayedColor.b !== 255) {
                this._updateColor();
            }
        }
    };

    proto.updateTransform = function () {      //TODO need delete, because Canvas needn't
        var _t = this, node = this._node;

        // re-calculate matrix only if it is dirty
        if (node.dirty) {
            // If it is not visible, or one of its ancestors is not visible, then do nothing:
            var locParent = node._parent;
            if (!node._visible || ( locParent && locParent !== node._batchNode && locParent._shouldBeHidden)) {
                node._shouldBeHidden = true;
            } else {
                node._shouldBeHidden = false;

                if (!locParent || locParent === node._batchNode) {
                    node._transformToBatch = _t.getNodeToParentTransform();
                } else {
                    //cc.assert(_t._parent instanceof cc.Sprite, "Logic error in CCSprite. Parent must be a CCSprite");
                    node._transformToBatch = cc.affineTransformConcat(_t.getNodeToParentTransform(), locParent._transformToBatch);
                }
            }
            node._recursiveDirty = false;
            node.dirty = false;
        }

        // recursively iterate over children
        if (node._hasChildren)
            node._arrayMakeObjectsPerformSelector(node._children, cc.Node._stateCallbackType.updateTransform);
    };

    proto._spriteFrameLoadedCallback = function (spriteFrame) {
        var node = this;
        node.setTextureRect(spriteFrame.getRect(), spriteFrame.isRotated(), spriteFrame.getOriginalSize());

        node._renderCmd._updateColor();
        node.dispatchEvent("load");
    };

    proto._textureLoadedCallback = function (sender) {
        var node = this;
        if (node._textureLoaded)
            return;

        node._textureLoaded = true;
        var locRect = node._rect, locRenderCmd = this._renderCmd;
        if (!locRect) {
            locRect = cc.rect(0, 0, sender.width, sender.height);
        } else if (cc._rectEqualToZero(locRect)) {
            locRect.width = sender.width;
            locRect.height = sender.height;
        }

        node.texture = sender;
        node.setTextureRect(locRect, node._rectRotated);

        //set the texture's color after the it loaded
        var locColor = locRenderCmd._displayedColor;
        if (locColor.r !== 255 || locColor.g !== 255 || locColor.b !== 255)
            locRenderCmd._updateColor();

        // by default use "Self Render".
        // if the sprite is added to a batchnode, then it will automatically switch to "batchnode Render"
        node.setBatchNode(node._batchNode);
        node.dispatchEvent("load");
    };

    proto._setTextureCoords = function (rect, needConvert) {
        if (needConvert === undefined)
            needConvert = true;
        var locTextureRect = this._textureCoord,
            scaleFactor = needConvert ? cc.contentScaleFactor() : 1;
        locTextureRect.renderX = locTextureRect.x = 0 | (rect.x * scaleFactor);
        locTextureRect.renderY = locTextureRect.y = 0 | (rect.y * scaleFactor);
        locTextureRect.width = 0 | (rect.width * scaleFactor);
        locTextureRect.height = 0 | (rect.height * scaleFactor);
        locTextureRect.validRect = !(locTextureRect.width === 0 || locTextureRect.height === 0 || locTextureRect.x < 0 || locTextureRect.y < 0);
    };

    cc.Sprite.CanvasRenderCmd._cutRotateImageToCanvas = function (texture, rect, counterclockwise) {
        if (!texture)
            return null;

        if (!rect)
            return texture;

        counterclockwise = counterclockwise == null? true: counterclockwise;   // texture package is counterclockwise, spine is clockwise

        var nCanvas = document.createElement("canvas");
        nCanvas.width = rect.width;
        nCanvas.height = rect.height;
        var ctx = nCanvas.getContext("2d");
        ctx.translate(nCanvas.width / 2, nCanvas.height / 2);
        if(counterclockwise)
            ctx.rotate(-1.5707963267948966);
        else
            ctx.rotate(1.5707963267948966);
        ctx.drawImage(texture, rect.x, rect.y, rect.height, rect.width, -rect.height / 2, -rect.width / 2, rect.height, rect.width);
        return nCanvas;
    };
})();

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var HTMLParser = (function () {
    function HTMLParser() {
        this._listeners = {};
        this._mapCdataTags = this.makeMap('script,style,{%,{{,}},%}');
        this._arrBlocks = [];
        this.lastEvent = null;
    }
    HTMLParser.prototype.makeMap = function (str) {
        var obj = {};
        var items = str.split(',');
        for (var i = 0; i < items.length; i++) {
            obj[items[i]] = true;
        }
        return obj;
    };
    HTMLParser.prototype.parse = function (html) {
        var _this = this;
        var mapCdataTags = this._mapCdataTags;
        var regTag = /<(?:\/([^\s>]+)\s*|!--([\s\S]*?)--|!([^>]*?)|([\w\-:]+)((?:\s+[^\s"'>\/=\x00-\x0F\x7F\x80-\x9F]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]*))?)*?)\s*(\/?))>/g;
        var regAttr = /\s*([^\s"'>\/=\x00-\x0F\x7F\x80-\x9F]+)(?:\s*=\s*(?:(")([^"]*)"|(')([^']*)'|([^\s"'>]*)))?/g;
        var regTemplate = /\s(\{\%|\{\{).+?(\%\}|\}\})/g;
        var regLine = /\r?\n/g;
        var match;
        var matchIndex;
        var lastIndex = 0;
        var tagName;
        var arrAttrs;
        var tagCDATA = null;
        var attrsCDATA;
        var arrCDATA = [];
        var lastCDATAIndex = 0;
        var text;
        var lastLineIndex = 0;
        var line = 1;
        var arrBlocks = this._arrBlocks;
        this.fire('start', {
            pos: 0,
            line: 1,
            col: 1,
        });
        var saveBlock = function (type, raw, pos, data) {
            var col = pos - lastLineIndex + 1;
            if (data === undefined) {
                data = {};
            }
            data.raw = raw;
            data.pos = pos;
            data.line = line;
            data.col = col;
            arrBlocks.push(data);
            _this.fire(type, data);
            var lineMatch;
            while ((lineMatch = regLine.exec(raw))) {
                line++;
                lastLineIndex = pos + regLine.lastIndex;
            }
        };
        while ((match = regTag.exec(html))) {
            matchIndex = match.index;
            if (matchIndex > lastIndex) {
                text = html.substring(lastIndex, matchIndex);
                if (tagCDATA) {
                    arrCDATA.push(text);
                }
                else {
                    saveBlock('text', text, lastIndex);
                }
            }
            lastIndex = regTag.lastIndex;
            if ((tagName = match[1])) {
                if (tagCDATA && tagName === tagCDATA) {
                    text = arrCDATA.join('');
                    saveBlock('cdata', text, lastCDATAIndex, {
                        tagName: tagCDATA,
                        attrs: attrsCDATA,
                    });
                    tagCDATA = null;
                    attrsCDATA = undefined;
                    arrCDATA = [];
                }
                if (!tagCDATA) {
                    saveBlock('tagend', match[0], matchIndex, {
                        tagName: tagName,
                    });
                    continue;
                }
            }
            if (tagCDATA) {
                arrCDATA.push(match[0]);
            }
            else {
                if ((tagName = match[4])) {
                    arrAttrs = [];
                    var attrs = match[5].replace(regTemplate, '');
                    var attrMatch = void 0;
                    var attrMatchCount = 0;
                    while ((attrMatch = regAttr.exec(attrs))) {
                        var name_1 = attrMatch[1];
                        var quote = attrMatch[2]
                            ? attrMatch[2]
                            : attrMatch[4]
                                ? attrMatch[4]
                                : '';
                        var value = attrMatch[3]
                            ? attrMatch[3]
                            : attrMatch[5]
                                ? attrMatch[5]
                                : attrMatch[6]
                                    ? attrMatch[6]
                                    : '';
                        arrAttrs.push({
                            name: name_1,
                            value: value,
                            quote: quote,
                            index: attrMatch.index,
                            raw: attrMatch[0],
                        });
                        attrMatchCount += attrMatch[0].length;
                    }
                    if (attrMatchCount === attrs.length) {
                        saveBlock('tagstart', match[0], matchIndex, {
                            tagName: tagName,
                            attrs: arrAttrs,
                            close: match[6],
                        });
                        if (mapCdataTags[tagName]) {
                            tagCDATA = tagName;
                            attrsCDATA = arrAttrs.concat();
                            arrCDATA = [];
                            lastCDATAIndex = lastIndex;
                        }
                    }
                    else {
                        saveBlock('text', match[0], matchIndex);
                    }
                }
                else if (match[2] || match[3]) {
                    saveBlock('comment', match[0], matchIndex, {
                        content: match[2] || match[3],
                        long: match[2] ? true : false,
                    });
                }
            }
        }
        if (html.length > lastIndex) {
            text = html.substring(lastIndex, html.length);
            saveBlock('text', text, lastIndex);
        }
        this.fire('end', {
            pos: lastIndex,
            line: line,
            col: html.length - lastLineIndex + 1,
        });
    };
    HTMLParser.prototype.addListener = function (types, listener) {
        var _listeners = this._listeners;
        var arrTypes = types.split(/[,\s]/);
        var type;
        for (var i = 0, l = arrTypes.length; i < l; i++) {
            type = arrTypes[i];
            if (_listeners[type] === undefined) {
                _listeners[type] = [];
            }
            _listeners[type].push(listener);
        }
    };
    HTMLParser.prototype.fire = function (type, data) {
        if (data === undefined) {
            data = {};
        }
        data.type = type;
        var listeners = [];
        var listenersType = this._listeners[type];
        var listenersAll = this._listeners['all'];
        if (listenersType !== undefined) {
            listeners = listeners.concat(listenersType);
        }
        if (listenersAll !== undefined) {
            listeners = listeners.concat(listenersAll);
        }
        var lastEvent = this.lastEvent;
        if (lastEvent !== null) {
            delete lastEvent['lastEvent'];
            data.lastEvent = lastEvent;
        }
        this.lastEvent = data;
        for (var i = 0, l = listeners.length; i < l; i++) {
            listeners[i].call(this, data);
        }
    };
    HTMLParser.prototype.removeListener = function (type, listener) {
        var listenersType = this._listeners[type];
        if (listenersType !== undefined) {
            for (var i = 0, l = listenersType.length; i < l; i++) {
                if (listenersType[i] === listener) {
                    listenersType.splice(i, 1);
                    break;
                }
            }
        }
    };
    HTMLParser.prototype.fixPos = function (event, index) {
        var text = event.raw.substr(0, index);
        var arrLines = text.split(/\r?\n/);
        var lineCount = arrLines.length - 1;
        var line = event.line;
        var col;
        if (lineCount > 0) {
            line += lineCount;
            col = arrLines[lineCount].length + 1;
        }
        else {
            col = event.col + index;
        }
        return {
            line: line,
            col: col,
        };
    };
    HTMLParser.prototype.getMapAttrs = function (arrAttrs) {
        var mapAttrs = {};
        var attr;
        for (var i = 0, l = arrAttrs.length; i < l; i++) {
            attr = arrAttrs[i];
            mapAttrs[attr.name] = attr.value;
        }
        return mapAttrs;
    };
    return HTMLParser;
}());
exports.default = HTMLParser;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHRtbHBhcnNlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb3JlL2h0bWxwYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUF3QkE7SUFPRTtRQUNFLElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFBO1FBQ3BCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQywwQkFBMEIsQ0FBQyxDQUFBO1FBQzdELElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFBO1FBQ3BCLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFBO0lBQ3ZCLENBQUM7SUFFTSw0QkFBTyxHQUFkLFVBQ0UsR0FBVztRQUlYLElBQU0sR0FBRyxHQUErQixFQUFFLENBQUE7UUFDMUMsSUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUU1QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUNyQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFBO1NBQ3JCO1FBRUQsT0FBTyxHQUFHLENBQUE7SUFDWixDQUFDO0lBRU0sMEJBQUssR0FBWixVQUFhLElBQVk7UUFBekIsaUJBb0tDO1FBbktDLElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUE7UUFHdkMsSUFBTSxNQUFNLEdBQUcsMEpBQTBKLENBQUE7UUFFekssSUFBTSxPQUFPLEdBQUcsNkZBQTZGLENBQUE7UUFDN0csSUFBTSxXQUFXLEdBQUcsOEJBQThCLENBQUE7UUFDbEQsSUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFBO1FBRXhCLElBQUksS0FBNkIsQ0FBQTtRQUNqQyxJQUFJLFVBQWtCLENBQUE7UUFDdEIsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFBO1FBQ2pCLElBQUksT0FBZSxD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
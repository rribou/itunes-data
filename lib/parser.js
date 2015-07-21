'use strict';

function repeat(str, len) {
    var out = [];
    for (var i = 0; i < len; i++) out.push(str);
    return out.join('');
}

function identity(d) {
    return d;
}

module.exports = function () {
    var path = require('path'),
        Q = require('q'),
        xml = require('node-xml'),
        data = {},
        current = {},
        element,
        key = 'library',
        stack = [],
        value,
        depth = 0,
        parse = identity,
        parsers = {
            'integer': parseInt,
            'date': function (str) {
                return new Date(str);
            }
        };

    this.parseFile = function (file) {
        var deferred = Q.defer();
        var parser = new xml.SaxParser(function (cb) {
            cb.onStartElementNS(function (name, attrs) {
                var parent = current;
                element = name;
                switch (name) {
                    case 'plist':
                        current.version = attrs.version;
                        break;
                    case 'dict':
                        depth = stack.push(current);
                        current = current[key] = {key: key};
                        break;
                    case 'array':
                        depth = stack.push(current);
                        current = current[key] = [];
                        current.key = key;
                        break;
                    case 'true':
                    case 'false':
                        value = (name === 'true');
                        break;
                    default:
                        parse = parsers[name] || identity;
                }

                if (current !== parent && Array.isArray(parent)) {
                    parent.push(current);
                }
                value = '';
            });

            cb.onCharacters(function (text) {
                if (element === 'key') {
                    key = text;
                }
                var val = parse(text);
                if (typeof val === 'string') {
                    value += val;
                } else {
                    value = val;
                }
            });

            cb.onEndElementNS(function (name) {
                element = null;
                switch (name) {
                    // don't do anything with the key
                    case 'key':
                        break;

                    case 'array':
                    case 'dict':
                        var child = current;
                        current = stack.pop();
                        depth = stack.length;

                        delete child.key;
                        switch (current.key) {
                            case 'library':
                                //parser.emit('library', current);
                                break;
                            case 'Tracks':
                                if (!data.hasOwnProperty('tracks')) {
                                    data.tracks = [];
                                }
                                data.tracks.push(child);
                                break;
                            case 'Playlists':
                                if (!data.hasOwnProperty('playlists')) {
                                    data.playlists = [];
                                }
                                if (child.Name) {
                                    data.playlists.push(child);
                                }
                                break;
                        }
                        key = null;
                        break;

                    default:
                        if (key && current) {
                            current[key] = value;
                            // console.warn(repeat('. ', depth), key, '=', value);
                        }
                }
            });

            cb.onEndDocument(function () {
                deferred.resolve(data);
            });

            cb.onError(function (err) {
                deferred.reject(err);
            });
        });
        parser.parseFile(file);
        return deferred.promise;
    };

    return this;
};

﻿var XSockets = XSockets || {};

XSockets.TcpClient = (function (net) {
    var ctor = function (host, port, arrControllers) {
        
        var self = this;
        this.controllers = {};
        
        var registerController = function (name) {
            if (!self.controllers.hasOwnProperty(name)) {
                self.controllers[name] = new XSockets.Controller(name);
                self.controllers[name].onsend = function (t, d, c) {
                    self.socket.write(new XSockets.Message(t, d, c).toBytes());
                };
            }
            return self.controllers[name];
        };
        arrControllers.forEach(function (c) {
            registerController(c);
        });
        
        var initControllers = function () {
            arrControllers.forEach(function (c) {
                var init = new XSockets.Message('0xcc', {
                    init: true
                }, c);
                self.socket.write(init.toBytes());
            });
        };
        
        this.socket = new net.Socket();
        
        this.socket.on('error', function (d) {
            self.onerror(d);
        });
        var ondata = function (d) {
            d = parse(d);
            
            if (d.T == "0x00") {
                self.onconnected(d);
                
                initControllers();
                return;
            }
            self.controllers[d.C].fire(d);
        };
        this.open = function () {
            self.socket.connect(port, host, function () {
                self.socket.on('data', ondata);
                self.socket.write('JsonProtocol');
            });
        };
        
        this.controller = function (name) {
            return registerController(name);
        };
        
        this.close = function () {
            self.socket.destroy();
        };
        
        this.onconnected = function (d) {
            console.warn('not implemented', d);
        };
        this.onerror = function (d) {
            console.warn('not implemented', d);
        };
        this.send = function (topic, data, ctrl) {
            if (arguments.length !== 3) {
                throw "Method takes 3 parameters but was invoked with " + arguments.length + " parameters";
            }
            var m = new XSockets.Message(topic, data, ctrl);
            self.socket.write(m.toBytes());
        };
        
        //Ugly hack to get the message, we should look for endbyte here
        var parse = function (d) {
            var s = d.toString();
            return JSON.parse(s.substring(1, s.length - 1));
        };
    };
    return ctor;
})(require('net'));

XSockets.Message = (function () {
    function message(topic, object, controller) {
        this.T = topic ? topic.toLowerCase() : undefined;
        this.D = object;
        this.C = controller ? controller.toLowerCase() : undefined;
        this.JSON = {
            T: topic,
            D: JSON.stringify(object),
            C: controller
        };
    }
    message.prototype.parse = function (text, binary) {
        var data = JSON.parse(text);
        var d = {
            topic: data.T,
            controller: data.C,
            data: JSON.parse(data.D),
            binary: binary
        };
        return d;
    };
    message.prototype.toString = function () {
        return JSON.stringify(this.JSON);
    };
    
    message.prototype.toBytes = function () {
        //Wrap the message in start/end bytes
        var json = this.toString();
        var buf = new Buffer(json.length + 2);
        buf[0] = 0x00;
        buf.write(json, 1);
        buf[json.length + 1] = 0xff;
        return buf;
        
    };
    return message;
})();


XSockets.Controller = (function () {
    var ctor = function (ctrlName) {
        var self = this;
        this.name = ctrlName;
        this.delagates = {};
        
        this.onopen = function () {
            console.warn('not implemented');
        };
        this.onclose = function () {
            console.warn('not implemented');
        };
        this.onerror = function () {
            console.warn('not implemented');
        };
        this.on = function (topic, fn) {
            if (!this.delagates.hasOwnProperty(topic)) {
                self.delagates[topic] = fn;
            }
        };
        this.off = function (topic) {
            if (this.delagates.hasOwnProperty(topic)) {
                delete self.delagates[topic];
            }
        };
        this.send = function (topic, data) {
            this.onsend(topic, data, this.name);
        };
        
        this.fire = function (obj) {
            if (dispatchInternal(obj)) {
                if (this.delagates.hasOwnProperty(obj.T))
                    this.delagates[obj.T](JSON.parse(obj.D));
            }
        };
        var dispatchInternal = function (o) {
            switch (o.T) {
                case '0x14':
                    self.onopen(o.D);
                    return false;
                case '0x15':
                    self.onclose(o.D);
                    return false;
                case '0x1f4':
                    self.onerror(o.D);
                    return false;
                default:
                    return true;
            }
        };
    };
    return ctor;
})();

module.exports = XSockets;